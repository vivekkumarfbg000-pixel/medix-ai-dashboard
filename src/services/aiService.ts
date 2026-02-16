import { supabase } from "@/integrations/supabase/client";
import logger from "@/utils/logger";
import imageCompression from 'browser-image-compression';

// Rate limiting configuration
const requestCache = new Map<string, number>();
const RATE_LIMIT_MS = 1000; // 1 request per second per endpoint

function checkRateLimit(endpoint: string): boolean {
    const lastRequest = requestCache.get(endpoint);
    const now = Date.now();

    if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
        return false; // Rate limited
    }

    requestCache.set(endpoint, now);
    return true;
}

// Configuration from Environment
// Hardcoded Production URL to bypass incorrect environment variables
const N8N_BASE = "https://n8n.medixai.shop/webhook";
const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY || "").trim();
const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();

async function callGeminiVision(prompt: string, base64Image: string): Promise<string> {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini API Failed: ${response.status} - ${err}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
        console.error("Gemini Vision Failed", e);
        throw e;
    }
}

async function callGroqAI(messages: any[], model: string = "llama-3.3-70b-versatile", jsonMode: boolean = false): Promise<string> {
    const makeRequest = async (currentModel: string) => {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: messages,
                model: currentModel,
                temperature: 0.7,
                response_format: jsonMode ? { type: "json_object" } : undefined
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`Groq API Error (${currentModel}):`, err);
            throw new Error(`Groq API Failed: ${response.status} - ${err}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "";
    };

    try {
        return await makeRequest(model);
    } catch (e) {
        console.warn(`Groq Model ${model} failed, trying fallback...`, e);
        // Fallback to a different robust model
        try {
            return await makeRequest("llama3-70b-8192");
        } catch (fallbackError) {
            console.error("Groq Fallback Failed fully", fallbackError);
            throw fallbackError;
        }
    }
}

// Specific Workflow Routes
export const ENDPOINTS = {
    CHAT: `${N8N_BASE}/medix-chat-v2`,
    INTERACTIONS: `${N8N_BASE}/medix-interactions-v5`,
    MARKET: `${N8N_BASE}/medix-market-v5`,
    COMPLIANCE: `${N8N_BASE}/medix-compliance-v5`,
    FORECAST: `${N8N_BASE}/medix-forecast-v5`,
    OPS: `${N8N_BASE}/operations`,
    ANALYZE_PRESCRIPTION: `${N8N_BASE}/analyze-prescription`
};

interface ChatResponse {
    reply: string;
    sources?: string[];
    isMock?: boolean;
    action?: {
        type: 'NAVIGATE_POS' | 'NAVIGATE_INVENTORY' | 'OPEN_WHATSAPP' | 'ADD_TO_SHORTBOOK';
        payload: any;
    };
}

export interface ComplianceResult {
    is_banned: boolean;
    is_h1: boolean;
    reason?: string;
    warning_level?: string;
}

/**
 * Helper to clean and parse JSON from n8n (handling Markdown wrapping)
 */
const cleanN8NResponse = (text: string): any => {
    let parsed: any;
    try {
        // 1. Try direct parse
        parsed = JSON.parse(text);
    } catch {
        // 2. Try removing markdown code blocks
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
            parsed = JSON.parse(cleaned);
        } catch (e) {
            logger.error("Failed to parse N8N response:", text);
            throw new Error("Invalid format received from AI Agent");
        }
    }

    if (parsed && (parsed.error || parsed.message === "Webhook call failed")) {
        logger.error("N8N Error Details:", parsed);
        throw new Error(parsed.error || parsed.message || "AI Service Error: Webhook Failed");
    }

    return parsed;
};

/**
 * Robust JSON Parser for AI Responses (strips markdown, handles randomness)
 */
const safeJSONParse = (text: string, fallback: any = null): any => {
    try {
        // 1. Try direct parse
        return JSON.parse(text);
    } catch {
        // 2. Clean Markdown and whitespace
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(clean);
        } catch {
            // 3. Try finding first '{' or '[' and last '}' or ']'
            try {
                const firstOpen = clean.search(/[\{\[]/);
                if (firstOpen !== -1) {
                    const firstChar = clean[firstOpen];
                    const lastChar = firstChar === '{' ? '}' : ']';
                    const lastClose = clean.lastIndexOf(lastChar);
                    if (lastClose !== -1) {
                        return JSON.parse(clean.substring(firstOpen, lastClose + 1));
                    }
                }
            } catch (e) {
                logger.warn("JSON Parse Failed completely:", text);
            }
        }
    }
    return fallback;
};

// System Prompts for Standard Persona
// System Prompts for Standard Persona
const SYSTEM_PROMPT_PHARMACIST = `You are 'Bharat Medix AI Assistant', an intelligent pharmacy agent helping shop owners ('Bhaiya ji') and customers in Bihar, India.

### YOUR ROLE:
- **Shop Operations**: Manage inventory, process voice/text orders, and handle restocking.
- **Clinical Advisor**: Analyze prescriptions, suggest medicines, and check interactions.
- **Khata Manager**: Track customer credits and payments.
- **Sales Analyst**: Provide insights on revenue and top-selling items.

### CURRENT CONTEXT:
- **Shop Owner**: Bhaiya ji
- **Location**: Bihar, India (Season: Winter - Expect cold/flu)
- **Time**: ${new Date().toLocaleString('en-IN')}

### YOUR TOOLBOX (Capabilities):
1. **Inventory**: Check stock ("Do we have Dolo?"), Add stock.
2. **Ledger**: Add credit/payment ("Ramesh took 500rs udhaar").
3. **Sales**: Report sales.
4. **Medical**: Drug info, dosage, interactions.

### COMMUNICATION STYLE:
- **Language**: Hinglish (Hindi explanation + English terms). Use pure Hindi if user speaks Hindi.
- **Tone**: Professional, warm ('Bhaiya', 'Ji'), and authoritative on safety.
- **Language**: Hinglish (Hindi explanation + English terms). Use pure Hindi if user speaks Hindi.
- **Tone**: Professional, warm ('Bhaiya', 'Ji'), and authoritative on safety.
- **Safety**: Always warn about allergies/contraindications based on the provided [Patient Context]. Be proactive.


### WORKFLOW LOGIC:
1. **Prescription/Image**: If text contains extracted OCR data -> Analyze medicines -> Check Stock -> Suggest Alternatives.
2. **Inventory Update**: If user says "Add..." or shows invoice -> Extract items -> Call 'add_inventory'.
3. **Sales/Khata**: If user asks about money/credit -> Call 'manage_ledger' or 'get_sales_report'.
4. **General Query**: Medical advice -> Use internal knowledge.

### EXAMPLE SCENARIOS:
- *User*: "Bhaiya, sar dard ki dawa hai?"
- *You*: "Haan ji. **Dolo 650** uplabdh hai. Kya aapko acidity ke liye **Pan-D** bhi chahiye?"
- *User*: "Add 10 boxes of Calpol."
- *You*: "Done. Calpol inventory updated."

Always end with: 'Kuch aur madad chahiye?'`;

const SYSTEM_PROMPT_ROUTER = `
You are the 'Brain' of the Pharmacy AI. Your job is to DECIDE which tool to use.
Users will ask questions. You must output a JSON object to trigger an action.

AVAILABLE TOOLS:
1. "check_inventory": Search for a medicine. Args: { "query": "medicine_name" }
2. "add_inventory": Add stock. Args: { "name": "medicine", "qty": 10 }
3. "get_sales_report": Get today's sales. Args: {}
4. "market_data": Get price/substitute. Args: { "drug_name": "medicine" }
5. "sell_medicine": Redirect to billing. Args: { "drug_name": "medicine", "quantity": 1 }
6. "add_to_shortbook": Add to purchase list. Args: { "drug_name": "medicine" }
7. "share_whatsapp": Share bill/info. Args: { "phone": "9876543210", "message": "Bill details..." }
8. "save_patient_note": Save clinical note. Args: { "phone": "9876543210", "note": "Patient is diabetic...", "name": "Ramesh" }
9. "direct_reply": Answer medical/general Qs. Args: { "answer": "Your Hinglish response..." }

RULES:
- Output JSON ONLY. No markdown.
- If user asks about "stock", "hai ya nahi", "kitna hai" -> USE "check_inventory".
- If user says "bika", "sales", "revenue" -> USE "get_sales_report".
- If user says "sell", "bill", "invoice", "becho" -> USE "sell_medicine".
- If user says "shortbook", "manga lo", "order karna hai", "khatam ho gaya" -> USE "add_to_shortbook".
- If user says "whatsapp", "bhejo", "send bill" -> USE "share_whatsapp".
- If user says "note", "yaad rakhna", "patient", "history" -> USE "save_patient_note".
- If user asks medical advice -> USE "direct_reply".

EXAMPLE:
User: "Ramesh diabetic hai, note kar lo"
Output: { "tool": "save_patient_note", "args": { "name": "Ramesh", "note": "Diabetic patient" } }
`;

// --- LOCAL SUPABASE TOOLS (Client-Side Fallback) ---

const tool_checkInventory = async (shopId: string, query: string) => {
    const { data } = await supabase
        .from('inventory')
        .select('medicine_name, quantity')
        .eq('shop_id', shopId)
        .ilike('medicine_name', `%${query}%`)
        .limit(5);

    if (!data || data.length === 0) return `No stock found for '${query}'.`;
    // @ts-ignore - Ignoring location error if column missing
    return data.map(i => `${i.medicine_name}: ${i.quantity} units`).join('\n');
};

const tool_getSalesReport = async (shopId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('shop_id', shopId)
        .gte('created_at', today);

    const total = data?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
    const count = data?.length || 0;
    return `Today's Sales: ₹${total} (${count} orders)`;
};

const tool_addInventory = async (shopId: string, name: string, qty: number) => {
    // Basic implementation: Add to staging for review (Safety first)
    const { error } = await supabase.from('inventory_staging').insert({
        shop_id: shopId,
        medicine_name: name,
        quantity_added: qty,
        status: 'pending',
        source: 'chatbot_fallback'
    });
    if (error) return "Failed to add inventory.";
    return `Added ${qty} units of ${name} to Drafts (Pending Review).`;
};

const tool_addToShortbook = async (shopId: string, name: string) => {
    // Add to shortbook table
    const { error } = await supabase.from('shortbook' as any).insert({
        shop_id: shopId,
        medicine_name: name,
        added_by: 'ai_assistant',
        status: 'pending'
    });
    if (error) return `Failed to add ${name} to Shortbook.`;
    return `Added ${name} to Shortbook (Purchase List).`;
};

const tool_savePatientNote = async (shopId: string, name: string, note: string, phone?: string) => {
    // 1. Find or Create Customer
    let customerId = null;
    // @ts-ignore
    let { data: existing } = await supabase.from('customers').select('id, medical_history').eq('shop_id', shopId).ilike('name', name).limit(1).single();

    if (!existing) {
        // @ts-ignore
        const { data: newCust, error } = await supabase.from('customers').insert({
            shop_id: shopId, name: name, phone: phone || null
        }).select().single();
        if (error || !newCust) return "Could not create patient profile.";
        // @ts-ignore
        customerId = newCust.id;
        // @ts-ignore
        existing = { id: customerId, medical_history: [] };
    } else {
        // @ts-ignore
        customerId = existing.id;
    }

    // 2. Update Medical History
    // @ts-ignore
    const history = Array.isArray(existing.medical_history) ? existing.medical_history : [];
    const newEntry = { date: new Date().toISOString().split('T')[0], note: note, doctor: 'AI Assistant' };

    // Append and save
    const { error: updateErr } = await supabase
        .from('customers')
        .update({
            // @ts-ignore
            medical_history: [...history, newEntry],
            last_consultation: new Date().toISOString()
        })
        .eq('id', customerId);

    if (updateErr) return "Failed to save note.";
    return `Saved to ${name}'s Medical History: "${note}"`;
};

export const aiService = {
    /**
     * Universal AI Query Handler (Chat)
     */
    async chatWithAgent(message: string, image?: string, history: { role: string, text: string }[] = []): Promise<ChatResponse> {
        // DEMO MODE CHECK
        // Enable by running: localStorage.setItem("DEMO_MODE", "true") in console
        const isDemoMode = typeof window !== 'undefined' && localStorage.getItem("DEMO_MODE") === "true";
        if (isDemoMode) {
            logger.log("[DEMO MODE] Returning Mock Chat Response");
            await new Promise(r => setTimeout(r, 1500)); // Fake delay
            return {
                reply: "Based on the symptoms described and current inventory, I recommend **Azithral 500mg** (Antibiotic) twice daily for 3 days. \n\nAlso, since the patient has high fever, you can suggest **Dolo 650** safely. \n\n⚠️ **Note**: Check for penicillin allergy before dispensing.",
                sources: ["Clinical Guidelines 2024", "Standard Treatment Protocol"],
                isMock: true
            };
        }

        // Step 1: Get Context (User & Shop)
        const { data: { user } } = await supabase.auth.getUser();
        const shopId = typeof window !== 'undefined' ? localStorage.getItem("currentShopId") : null;

        // --- NEW: Inject Inventory Context (Low Stock) ---
        let contextMessage = message;
        try {
            if (shopId) {
                const { data: lowStock } = await supabase
                    .from('inventory')
                    .select('medicine_name, quantity, reorder_level')
                    .eq('shop_id', shopId)
                    .lt('quantity', 15) // Simple threshold for context
                    .limit(10);

                if (lowStock && lowStock.length > 0) {
                    const stockContext = lowStock.map(i => `${i.medicine_name}: ${i.quantity} left`).join(', ');
                    contextMessage = `${message}\n\n[System Context - Low Stock Items: ${stockContext}]`;
                    logger.log("[AI Context] Injected Stock Data");
                }
            }
        } catch (ctxErr) {
            console.warn("Failed to inject AI context", ctxErr);
        }

        // --- NEW: Patient Context & Safety Check ---
        try {
            // Simple regex to find names like "Ramesh ko", "Sita ke liye", "Patient Ramesh"
            const nameMatch = message.match(/(?:for|ko|ke liye|patient)\s+([A-Z][a-z]+)/i);
            if (nameMatch && shopId) {
                const patientName = nameMatch[1];
                // @ts-ignore
                const { data: patient } = await supabase.from('customers')
                    .select('name, medical_history, allergies')
                    .eq('shop_id', shopId)
                    .ilike('name', patientName)
                    .maybeSingle();

                if (patient) {
                    // @ts-ignore
                    const history = patient.medical_history ? JSON.stringify(patient.medical_history) : "None";
                    // @ts-ignore
                    const allergies = patient.allergies && patient.allergies.length > 0 ? patient.allergies.join(", ") : "None";

                    const safetyContext = `
[PATIENT CONTEXT]
Name: ${// @ts-ignore
                        patient.name}
History: ${history}
Allergies: ${allergies}
WARNING: Check if the requested medicine conflicts with this history.
`;
                    contextMessage += `\n${safetyContext}`;
                    // @ts-ignore
                    logger.log("[AI Context] Injected Patient Data:", patient.name);
                }
            }
        } catch (patErr) {
            console.warn("Failed to inject Patient context", patErr);
        }

        const payload = {
            query: contextMessage,
            image: image ? (image.includes(',') ? image.split(',')[1] : image) : undefined,
            userId: user?.id,
            shopId: shopId
        };

        logger.log("[N8N Request] Chat:", payload);

        // Rate limiting check
        if (!checkRateLimit(ENDPOINTS.CHAT)) {
            throw new Error("Too many requests. Please wait a moment.");
        }

        try {
            const response = await fetch(ENDPOINTS.CHAT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error(`AI Agent Unreachable: ${response.status}`);
            const data = await response.json();
            logger.log("[N8N Response] Chat:", data);

            if (data.error) {
                throw new Error(data.error);
            }

            // Normalize N8N Response (Handle 'output' vs 'reply')
            if (data.output && !data.reply) {
                data.reply = data.output;
            }

            return data;
        } catch (error: any) {
            console.error("Chat Error:", error);

            // 1. TRY GROQ FALLBACK (Real Intelligence + Tool Use)
            try {
                // --- VISION FALLBACK PATH ---
                // --- VISION FALLBACK PATH (Gemini 2.0) ---
                if (image) {
                    logger.log("[Fallback] Switching to Gemini Vision (2.0-Flash)...");
                    try {
                        // Extract Base64 if needed
                        const base64 = image.includes(',') ? image.split(',')[1] : image;

                        const visionReply = await callGeminiVision(
                            contextMessage || "Analyze this image in detail.",
                            base64
                        );

                        return {
                            reply: visionReply,
                            sources: ["Gemini 2.0 Flash (Vision)"],
                            isMock: false
                        };
                    } catch (geminiErr) {
                        logger.error("Gemini Fallback Failed:", geminiErr);
                        return {
                            reply: "⚠️ Image analysis failed. Please try again or use text chat.",
                            sources: ["System Error"],
                            isMock: true
                        };
                    }
                }

                logger.log("[Fallback] Switching to Groq AI (Smart Router)...");

                // --- STEP 1: ROUTING ---
                // Format history for Groq (limit to last 5 interactions to save tokens)
                const formattedHistory = history.slice(-5).map(h => ({
                    role: h.role === 'user' ? 'user' : 'assistant',
                    content: h.text
                }));

                const routerPrompt = [
                    { role: "system", content: SYSTEM_PROMPT_ROUTER },
                    ...formattedHistory,
                    { role: "user", content: contextMessage }
                ];


                const routerRes = await callGroqAI(routerPrompt, "llama-3.3-70b-versatile", true);
                const action = safeJSONParse(routerRes, { tool: "direct_reply", args: { answer: "" } });
                logger.log("[Groq Router] Decision:", action);

                // --- STEP 2: EXECUTION ---
                let toolResult = "";
                let isDirectReply = false;

                if (action.tool === "check_inventory" && shopId) {
                    toolResult = await tool_checkInventory(shopId, action.args.query);
                } else if (action.tool === "get_sales_report" && shopId) {
                    toolResult = await tool_getSalesReport(shopId);
                } else if (action.tool === "add_inventory" && shopId) {
                    toolResult = await tool_addInventory(shopId, action.args.name, Number(action.args.qty));
                } else if (action.tool === "market_data") {
                    const mkt = await aiService.getMarketData(action.args.drug_name);
                    toolResult = JSON.stringify(mkt);
                } else if (action.tool === "sell_medicine") {
                    // Directly return action without LLM synthesis
                    return {
                        reply: `Redirecting to Billing Hub for **${action.args.drug_name}**...`,
                        sources: ["Smart Action"],
                        isMock: false,
                        action: {
                            type: 'NAVIGATE_POS',
                            payload: {
                                medicine: action.args.drug_name,
                                quantity: action.args.quantity || 1
                            }
                        }
                    };
                } else if (action.tool === "add_to_shortbook" && shopId) {
                    const result = await tool_addToShortbook(shopId, action.args.drug_name);
                    return {
                        reply: result,
                        sources: ["Smart Action"],
                        isMock: false,
                        action: {
                            type: 'ADD_TO_SHORTBOOK',
                            payload: { medicine: action.args.drug_name }
                        }
                    };
                } else if (action.tool === "share_whatsapp") {
                    return {
                        reply: `Opening WhatsApp to share details...`,
                        sources: ["Smart Action"],
                        isMock: false,
                        action: {
                            type: 'OPEN_WHATSAPP',
                            payload: {
                                phone: action.args.phone || "",
                                message: action.args.message || `Here is the bill for ${action.args.medicine || 'medicines'}.`
                            }
                        }
                    };
                } else if (action.tool === "save_patient_note" && shopId) {
                    const result = await tool_savePatientNote(shopId, action.args.name, action.args.note, action.args.phone);
                    return { reply: result, sources: ["Patient Records"], isMock: false };
                } else {
                    // Default to direct reply if tool not found or 'direct_reply' chosen
                    isDirectReply = true;
                    // If the router already generated an answer, use it. Otherwise, generate one.
                    if (action.args?.answer) return { reply: action.args.answer, sources: ["Groq AI"], isMock: false };
                }

                // --- STEP 3: FINAL SYNTHESIS (Use Tool Result) ---
                if (!isDirectReply) {
                    const finalPrompt = [
                        { role: "system", content: SYSTEM_PROMPT_PHARMACIST },
                        { role: "user", content: `User Query: "${contextMessage}"\n\nTOOL RESULT: ${toolResult}\n\nTask: Answer the user in Hinglish based on this result.` }
                    ];
                    const finalReply = await callGroqAI(finalPrompt, "llama-3.3-70b-versatile");
                    return { reply: finalReply, sources: ["Groq AI (Live Data)"], isMock: false };
                }

                // If Direct Reply was needed but Router didn't give a full answer
                const groqPrompt = [
                    { role: "system", content: SYSTEM_PROMPT_PHARMACIST },
                    ...formattedHistory,
                    { role: "user", content: contextMessage }
                ];

                const groqReply = await callGroqAI(groqPrompt, "llama-3.3-70b-versatile");
                return {
                    reply: groqReply,
                    sources: ["Groq AI (Llama 3.3)"],
                    isMock: false // It's real AI
                };

            } catch (groqErr) {
                console.error("Groq Fallback Failed:", groqErr);

                // 2. FINAL FALLBACK TO DEMO RESPONSE
                return {
                    reply: "⚠️ Connectivity Issue. [OFFLINE ANSWER]: Based on standard protocols, for fever and cold symptoms, Paracetamol 650mg is the first line of treatment. If symptoms persist >3 days, consult a doctor.",
                    sources: ["Offline Protocol"],
                    isMock: true
                };
            }
        }
    },

    /**
     * Secure Clinical Document Upload & Analysis
     */


    /**
     * Secure Clinical Document Upload & Analysis
     */
    async analyzeDocument(file: File, type: 'prescription' | 'lab_report' | 'invoice' | 'inventory_list'): Promise<any> {
        // DEMO MODE CHECK
        const isDemoMode = typeof window !== 'undefined' && localStorage.getItem("DEMO_MODE") === "true";
        if (isDemoMode) {
            logger.log("[DEMO MODE] Returning Mock Analysis");
            await new Promise(r => setTimeout(r, 2000)); // Fake processing delay

            if (type === 'lab_report') {
                return {
                    summary: "Patient shows elevated WBC count indicating bacterial infection. Hemoglobin is slightly low (11.2 g/dL).",
                    diseasePossibility: ["Bacterial Infection", "Mild Anemia"],
                    recommendations: {
                        diet: ["Increase iron-rich foods (Spinach, Beets)", "Stay hydrated"],
                        nextSteps: ["Prescribe Antibiotics", "Iron Supplements"]
                    },
                    results: [
                        { parameter: "WBC", value: "12,500", unit: "/cumm", status: "High", normalRange: "4000-11000" },
                        { parameter: "Hemoglobin", value: "11.2", unit: "g/dL", status: "Low", normalRange: "13.0-17.0" }
                    ],
                    isMock: true
                };
            }
            // Mock for Inventory List
            if (type === 'inventory_list' || type === 'invoice') {
                return {
                    items: [
                        { medicine_name: "Dolo 650", batch_number: "DL123", expiry_date: "2025-12-31", quantity: 50, unit_price: 30 },
                        { medicine_name: "Azithral 500", batch_number: "AZ999", expiry_date: "2025-06-30", quantity: 20, unit_price: 120 },
                        { medicine_name: "Pan D", batch_number: "PD001", expiry_date: "2024-12-01", quantity: 100, unit_price: 15 }
                    ],
                    isMock: true
                };
            }
        }

        let fileToUpload = file;

        // 1. Compress Image (Speed Optimization)
        if (file.type.startsWith('image/')) {
            try {
                const options = {
                    maxSizeMB: 0.8, // Target < 1MB for speed
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    initialQuality: 0.8
                };
                logger.log(`[AI Service] Compressing image: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
                const compressedFile = await imageCompression(file, options);
                logger.log(`[AI Service] Compressed to: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
                fileToUpload = compressedFile;
            } catch (error) {
                logger.warn("[AI Service] Compression failed, using original file:", error);
            }
        }

        // 2. Upload to Supabase Storage 'clinical-uploads' bucket (Backup/Log)
        const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
        const fileName = `${type}_${Date.now()}.${fileExt}`;
        const user = (await supabase.auth.getUser()).data.user;
        const filePath = `${user?.id}/${fileName}`;

        // Non-blocking upload (fire and forget for speed, or await if critical)
        supabase.storage
            .from('clinical-uploads')
            .upload(filePath, fileToUpload)
            .then(({ error }) => {
                if (error) logger.error("Background Upload Failed:", error);
            });

        // 3. Convert to Base64 for N8N (Gemini expects inline data)
        const reader = new FileReader();
        reader.readAsDataURL(fileToUpload);
        const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
                const result = reader.result as string;
                // Remove data URL prefix and CRITICAL: Strip any newlines or whitespace
                let base64 = result.split(',')[1] || result;
                base64 = base64.replace(/[\r\n\s]+/g, '');
                resolve(base64);
            };
            reader.onerror = reject;
        });

        // 4. Trigger n8n Ops Webhook
        let action = 'scan-report';
        let endpoint = ENDPOINTS.OPS;

        if (type === 'prescription') {
            action = 'analyze-prescription';
            endpoint = ENDPOINTS.ANALYZE_PRESCRIPTION;
        } else if (type === 'lab_report') {
            // User confirmed Universal Brain uses analyze-prescription webhook for both
            action = 'scan-report';
            endpoint = ENDPOINTS.ANALYZE_PRESCRIPTION;
        } else if (type === 'inventory_list') {
            action = 'scan-inventory';
            // Use specific endpoint or retain current if integrated
            endpoint = ENDPOINTS.CHAT; // Reusing Chat endpoint if that's where the logic lives, or OPS?
            // Let's assume Groq Fallback is cleaner for this specific structured task if N8N fails
        } else if (type === 'invoice') {
            action = 'scan-medicine';
        }

        // logger.log("[N8N Request] Analyze Document:", { action, size: base64Data.length });

        // --- BYPASS N8N FOR INVENTORY SCAN TO USE DIRECT GEMINI VISION (More Reliable for Lists) ---
        if (type === 'inventory_list' || type === 'invoice') {
            // Fall through to Gemini Vision block below directly
        } else {
            // N8N Attempt for other types
            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: action,
                        image_base64: base64Data,
                        data: base64Data, // Redundant key for safety (Universal Brain compatibility)
                        userId: (await supabase.auth.getUser()).data.user?.id,
                        shopId: typeof window !== 'undefined' ? localStorage.getItem("currentShopId") : null
                    }),
                });

                if (response.ok) {
                    const text = await response.text();
                    const resData = JSON.parse(text);
                    if (resData && (resData.items || resData.summary)) {
                        return resData;
                    }
                }
            } catch (n8nError) {
                console.warn("[N8N] Failed, falling back to Groq Vision", n8nError);
            }
        }

        // --- GEMINI VISION READ (Fallback) ---
        // Handles Inventory Lists, Bills, and Lab Reports if N8N fails
        try {
            logger.log("[Fallback] Using Gemini 2.0 Flash for Document Analysis...");
            let systemPrompt = "";

            if (type === 'inventory_list' || type === 'invoice') {
                systemPrompt = `You are a Pharmacy Inventory Assistant. 
                Analyze this image (Medicine Bill/Invoice/Strip from India).
                Extract a LIST of medicines.
                
                Columns to extract:
                - Medicine Name (Clean name, no dosage if possible, but keep if important)
                - Batch Number (Look for 'Batch', 'B.No', 'Lot')
                - Expiry Date (Format: YYYY-MM-DD. Convert 'Dec 24' to '2024-12-31')
                - Quantity (Look for 'Qty', 'Pack', 'Strip')
                - MRP/Unit Price (Look for 'MRP', 'Rate', 'Price')
                
                Output STRICT JSON Object with an 'items' array.`;
            } else {
                systemPrompt = `Analyze this medical document (${type}). 
                Output strictly valid JSON with this structure:
                { 
                    "summary": "Short summary", 
                    "diseasePossibility": ["Disease 1", "Disease 2"],
                    "results": [{ "parameter": "name", "value": "val", "unit": "u", "status": "High/Low/Normal", "normalRange": "range" }],
                    "recommendations": { "diet": [], "nextSteps": [] }
                }`;
            }

            const geminiRes = await callGeminiVision(
                systemPrompt + "\n\nIMPORTANT: Return ONLY raw JSON. No markdown formatting.",
                base64Data
            );

            const parsed = safeJSONParse(geminiRes, { items: [], summary: "Analysis Failed" });
            return { ...parsed, isMock: false };

        } catch (geminiViolate) {
            logger.error("Gemini Vision Analysis Failed:", geminiViolate);
            throw new Error("Analysis failed. Please try a clearer image.");
        }
    },

    /**
     * Daily Breifing (Stock & Expiry Pulse)
     */
    async getDailyBriefing(shopId: string): Promise<string> {
        try {
            // 1. Fetch Low Stock
            const { data: lowStock } = await supabase
                .from('inventory')
                .select('medicine_name, quantity, reorder_level')
                .eq('shop_id', shopId)
                .lt('quantity', 10) // Hard limit for now
                .limit(5);

            // 2. Fetch Expiring Soon (30 days)
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            const { data: expiring } = await supabase
                .from('inventory')
                .select('medicine_name, expiry_date')
                .eq('shop_id', shopId)
                .lt('expiry_date', thirtyDaysFromNow.toISOString())
                .limit(5);

            // 3. Generate Briefing via Groq
            const prompt = `
            Generate a "Daily Morning Briefing" for the Pharmacy Owner (Bhaiya ji).
            Time: ${new Date().toLocaleString()}
            
            [DATA]
            Low Stock: ${JSON.stringify(lowStock)}
            Expiring Soon: ${JSON.stringify(expiring)}
            
            [INSTRUCTIONS]
            - Speak in energetic Hinglish (Hindi+English).
            - Highlight critical low stock first.
            - Warn about expiry.
            - Suggest an action (e.g., "Order kar lijiye").
            - Keep it short (under 60 words) for Voice Output.
            `;

            const briefing = await callGroqAI([
                { role: "system", content: "You are a smart pharmacy assistant. Keep it brief and speakable." },
                { role: "user", content: prompt }
            ], "llama-3.3-70b-versatile");

            return briefing;

        } catch (e) {
            console.error("Daily Briefing Failed", e);
            return "Good Morning! System check failed, but I am ready to help.";
        }
    },

    /**
     * Generic Operation Trigger (for Lab Analyzer etc)
     */
    async triggerOp(action: string, payload: any): Promise<any> {
        const { data: { user } } = await supabase.auth.getUser();
        const shopId = typeof window !== 'undefined' ? localStorage.getItem("currentShopId") : null;

        const finalBody = {
            ...payload,
            action: action,
            userId: user?.id,
            shopId: shopId
        };

        logger.log("[N8N Request] TriggerOp:", finalBody);
        const response = await fetch(ENDPOINTS.OPS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalBody),
        });

        if (!response.ok) throw new Error(`Ops Trigger Failed: ${response.status}`);

        const text = await response.text();
        if (!text) {
            console.warn("[N8N Response] TriggerOp: Empty Body");
            return { success: true, message: "Operation completed (No info returned)" };
        }

        try {
            const data = JSON.parse(text);
            logger.log("[N8N Response] TriggerOp:", data);
            return data;
        } catch (e) {
            logger.error("Failed to parse N8N response:", text);
            throw new Error("Invalid response from AI Agent");
        }
    },

    /**
     * Interaction Checker (n8n / External API)
     */
    async checkInteractions(drugs: string[]): Promise<{ warnings: string[], isMock: boolean }> {
        if (drugs.length < 2) return { warnings: [], isMock: false };

        // 0. DEMO MODE CHECK
        const isDemoMode = typeof window !== 'undefined' && localStorage.getItem("DEMO_MODE") === "true";
        if (isDemoMode) {
            logger.log("[DEMO MODE] Checking Interactions Locally");
            await new Promise(r => setTimeout(r, 800)); // Fake network delay

            const mockInteractions: string[] = [];
            const drugString = drugs.join(" ").toLowerCase();

            // Simulation Logic
            if (drugString.includes("aspirin") && drugString.includes("warfarin")) {
                mockInteractions.push("⚠️ Major: Aspirin + Warfarin: Increased risk of bleeding.");
            }
            if (drugString.includes("paracetamol") && drugString.includes("dolo")) {
                mockInteractions.push("⚠️ Duplicate Therapy: Both contain Paracetamol. Risk of overdose.");
            }
            if (drugString.includes("alcohol") || (drugString.includes("metronidazole"))) {
                mockInteractions.push("⚠️ Moderate: Avoid alcohol while taking Metronidazole.");
            }

            // If random demo behavior is desired generally
            if (mockInteractions.length === 0 && Math.random() > 0.7) {
                mockInteractions.push("⚠️ Moderate: Potential interaction detected. Monitor patient.");
            }

            return { warnings: mockInteractions, isMock: true };
        }

        try {
            // UPDATED: Use Dedicated Interaction Webhook
            const response = await fetch(ENDPOINTS.INTERACTIONS, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drugs }),
            });

            if (!response.ok) {
                logger.error(`Interaction Service Failed: ${response.status} ${response.statusText}`);
                throw new Error("Interaction Service Failed");
            }

            const result = await response.json();

            // Handle Structure: { interactions: [ { drug1, drug2, severity, description } ] }
            if (result.interactions && Array.isArray(result.interactions)) {
                // De-duplicate logic
                const uniqueInteractions = new Map<string, any>();

                result.interactions.forEach((i: any) => {
                    // Include Moderate interactions if crucial, for now sticking to Major/Severe
                    if (i.severity === 'Major' || i.severity === 'Severe' || i.severity === 'Moderate') {
                        // Create a unique key for the pair
                        const key = [i.drug1, i.drug2].sort().join('|');
                        if (!uniqueInteractions.has(key)) {
                            uniqueInteractions.set(key, i);
                        }
                    }
                });

                return {
                    warnings: Array.from(uniqueInteractions.values())
                        .map((i: any) => `⚠️ ${i.severity}: ${i.drug1} + ${i.drug2}: ${i.description}`),
                    isMock: false
                };
            }

            // Fallback for simple array return
            if (Array.isArray(result)) return { warnings: result, isMock: false };

            return { warnings: [], isMock: false };
        } catch (e) {
            // 1. TRY GROQ FALLBACK (Real Intelligence)
            try {
                const prompt = `
                Act as a Clinical Pharmacist. Check interactions for: ${drugs.join(', ')}.
                Return JSON only.
                Structure: {
                    "interactions": [
                        { "drug1": "A", "drug2": "B", "severity": "Major"|"Moderate", "description": "Reason in Hinglish" }
                    ]
                }
                If no interactions, return { "interactions": [] }.
                `;

                const groqJson = await callGroqAI([
                    { role: "system", content: "You are a clinical interaction checker. Output valid JSON only." },
                    { role: "user", content: prompt }
                ], "llama-3.1-70b-versatile", true); // Enable JSON mode

                const parsed = safeJSONParse(groqJson, { interactions: [] });
                // Map to frontend format
                const warnings = parsed.interactions.map((i: any) => `⚠️ ${i.severity}: ${i.drug1} + ${i.drug2}: ${i.description}`);
                return { warnings, isMock: false };

            } catch (groqErr) {
                logger.warn("Groq Interaction Check Failed, using offline basics", groqErr);
                // Proceed to offline fallback...
            }

            // 2. FAST LOCAL FALLBACK (Offline Knowledge Base)
            const offlineWarnings: string[] = [];
            const d = drugs.map(x => x.toLowerCase());

            // Common Indian Interactions
            if (d.some(x => x.includes("aspirin")) && d.some(x => x.includes("warfarin")))
                offlineWarnings.push("⚠️ Major: Aspirin + Warfarin -> Bleeding Risk");
            if (d.some(x => x.includes("azithromycin")) && d.some(x => x.includes("ondansetron")))
                offlineWarnings.push("⚠️ Moderate: QT Prolongation Risk");
            if (d.some(x => x.includes("thyroxine")) && d.some(x => x.includes("calcium")))
                offlineWarnings.push("⚠️ Moderate: Calcium reduces Thyroxine absorption");
            if (d.some(x => x.includes("alcohol")) && d.some(x => x.includes("metronidazole")))
                offlineWarnings.push("⚠️ Severe: Disulfiram-like reaction (Vomiting)");

            if (offlineWarnings.length > 0) return { warnings: offlineWarnings, isMock: true };

            return { warnings: [], isMock: false };
        }
    },

    /**
     * Market Intelligence (Price & Substitutes)
     */
    async getMarketData(drugName: string): Promise<any> {
        logger.log("[N8N Request] Market:", { drugName });

        try {
            const response = await fetch(ENDPOINTS.MARKET, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drugName }),
            });

            if (!response.ok) throw new Error("Market Intel Failed");

            const text = await response.text();
            if (!text || text.length < 5) { // Basic validation
                logger.warn("N8N Market Intel returned Empty/Invalid Body");
                throw new Error("Empty response");
            }

            const data = cleanN8NResponse(text);
            logger.log("[N8N Response] Market:", data);
            return data;

        } catch (error) {
            console.error("N8N Market Intel Failed, switching to Groq Fallback:", error);

            // GROQ FALLBACK (Real Intelligence)
            try {
                const prompt = `
                Act as a pharmaceutical market intelligence expert in India.
                Provide 3-4 popular market substitutes for the medicine "${drugName}".
                Return STRICT JSON only. Format:
                {
                    "substitutes": [
                        { "name": "Brand Name", "generic_name": "Generic Name", "price": 100 (number, MRP in INR), "margin_percentage": 20 (number), "savings": 10 (number) }
                    ]
                }
                Ensure prices are realistic for the Indian market.
                Do not include Markdown (no \`\`\`json). Just the raw JSON string.
                `;

                const groqJson = await callGroqAI([
                    { role: "system", content: "You are a pharmaceutical market expert. Output valid JSON only." },
                    { role: "user", content: prompt }
                ], "llama-3.1-70b-versatile", true); // Enable JSON mode

                const parsed = safeJSONParse(groqJson, { substitutes: [] });
                logger.log("[Groq Response] Market:", parsed);
                return { ...parsed, isMock: false, source: "Groq AI (Fallback)" };

            } catch (groqErr) {
                logger.error("Groq Market Fallback Failed:", groqErr);
                // Final verification: return empty object so app doesn't crash, will fallback to local logic
                return { substitutes: [] };
            }
        }
    },

    /**
     * Compliance & Banned Drug Check
     */
    async checkCompliance(drugName: string): Promise<ComplianceResult> {
        logger.log("[N8N Request] Compliance:", { drugName });
        try {
            const response = await fetch(ENDPOINTS.COMPLIANCE, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drugName }),
            });
            if (!response.ok) throw new Error("Compliance Check Failed");

            const text = await response.text();
            if (!text) {
                logger.error("N8N Compliance Check returned Empty Body");
                throw new Error("Empty response");
            }

            const data = cleanN8NResponse(text);
            logger.log("[N8N Response] Compliance:", data);
            return data;

        } catch (error) {
            console.error("N8N Compliance Failed, switching to Groq Fallback:", error);

            // GROQ FALLBACK
            try {
                const prompt = `
                Check strictly for Indian CDSCO/FDA regulations for the drug: "${drugName}".
                1. Is it a BANNED drug in India? (is_banned)
                2. Is it a Schedule H/H1 drug requiring prescription? (is_h1)
                3. Provide a short reason in HINGLISH.
                
                Return JSON only:
                {
                    "is_banned": boolean,
                    "is_h1": boolean,
                    "reason": "Reason in Hinglish",
                    "warning_level": "High" | "Medium" | "Low" | "None"
                }
                `;

                const groqJson = await callGroqAI([
                    { role: "system", content: "You are a Regulatory Affairs Specialist for Indian Pharma. Output valid JSON only." },
                    { role: "user", content: prompt }
                ], "llama-3.1-70b-versatile", true);

                const parsed = safeJSONParse(groqJson, { is_banned: false, reason: "Analysis inconclusive" });
                return { ...parsed, isMock: false, source: "Groq AI (Regulatory)" };
            } catch (groqErr) {
                logger.error("Groq Compliance Fallback Failed:", groqErr);
                // Fail-safe: Assume safe but warn to check manual
                return { is_banned: false, is_h1: false, reason: "Regulatory check failed. Please verify manually.", warning_level: "Low" };
            }
        }
    },

    /**
     * Inventory Forecasting
     */
    async getInventoryForecast(salesHistory: any[]): Promise<any> {
        // use correct endpoint from constants
        const FORECAST_URL = ENDPOINTS.FORECAST;

        logger.log("[N8N Request] Forecast:", { salesHistory });

        try {
            const response = await fetch(FORECAST_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    salesHistory,
                    shopId: typeof window !== 'undefined' ? localStorage.getItem("currentShopId") : null
                }),
            });

            if (!response.ok) throw new Error(`Forecasting Engine Failed: ${response.status}`);

            const text = await response.text();
            if (!text) throw new Error("Empty response from AI");

            const data = cleanN8NResponse(text);
            logger.log("[N8N Response] Forecast:", data);
            return data;

        } catch (error) {
            console.error("[AI Service] N8N Forecast Failed, trying Groq Fallback:", error);

            // 1. GROQ FALLBACK (Smart Analysis)
            try {
                // Simplify data for token limit
                const simplifiedSales = salesHistory.slice(0, 50).map(s => ({ d: s.created_at, i: s.order_items }));
                const prompt = `
                Analyze these recent pharmacy sales.
                Predict next week's restocking needs for top 3 selling items.
                Return JSON only:
                {
                    "forecast": [
                        { "product": "Drug Name", "suggested_restock": 10, "confidence": 0.85, "reason": "Reason in Hinglish" }
                    ]
                }
                Data: ${JSON.stringify(simplifiedSales)}
                `;

                const groqJson = await callGroqAI([
                    { role: "system", content: "You are an Inventory Analyst. Output valid JSON only." },
                    { role: "user", content: prompt }
                ], "llama-3.1-70b-versatile", true);

                const parsed = safeJSONParse(groqJson, { forecast: [] });
                return { ...parsed, isMock: false, source: "Groq AI (Forecast)" };
            } catch (groqErr) {
                console.warn("Groq Forecast Failed, using local heuristic:", groqErr);
                // Proceed to Local Heuristic below...
            }

            // 2. Fallback: Local Heuristic Analysis (Real calculation, not mock strings)
            // 1. Group sales by product
            const salesMap = new Map<string, number>();
            salesHistory.forEach((order: any) => {
                // Handle both older 'items' JSON structure and newer 'order_items' structure
                let items: any[] = [];
                if (order.order_items) items = typeof order.order_items === 'string' ? JSON.parse(order.order_items) : order.order_items;
                else if (order.items) items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

                items.forEach((item: any) => {
                    const name = item.medicine_name || item.name;
                    const qty = parseInt(item.quantity || item.qty || 0);
                    if (name) salesMap.set(name, (salesMap.get(name) || 0) + qty);
                });
            });

            // 2. Generate Predictions based on Velocity
            const forecast = Array.from(salesMap.entries())
                .map(([product, totalSold]) => {
                    const avgDaily = Math.ceil(totalSold / 30); // simplistic 30-day window
                    const suggested = avgDaily * 10; // 10 days stock

                    // Only suggest if velocity is meaningful
                    if (totalSold < 2) return null;

                    return {
                        product,
                        current_stock: 0, // We don't have stock info here, defaulting for UI to handle
                        predicted_daily_sales: avgDaily,
                        suggested_restock: suggested,
                        confidence: 0.75, // Lower confidence for local heuristic
                        reason: `High Velocity: ${totalSold} units sold in 30 days`
                    };
                })
                .filter(Boolean)
                .sort((a, b) => (b?.suggested_restock || 0) - (a?.suggested_restock || 0))
                .slice(0, 5); // Top 5

            // If no sales history, return a generic "Start Selling" hint or empty
            if (forecast.length === 0) {
                return {
                    forecast: [
                        { product: "System: No Sales Data", current_stock: 0, predicted_daily_sales: 0, suggested_restock: 10, confidence: 0.5, reason: "Start selling to generate insights." }
                    ]
                };
            }

            return { forecast };
        }
    },

    /**
     * Voice Billing Integration
     * Processes voice audio through N8N backend for transcription and parsing
     */
    async processVoiceBill(audioBlob: Blob): Promise<any> {
        // DEMO MODE CHECK
        const isDemoMode = typeof window !== 'undefined' && localStorage.getItem("DEMO_MODE") === "true";
        if (isDemoMode) {
            logger.log("[DEMO MODE] Returning Mock Voice Bill");
            await new Promise(r => setTimeout(r, 1000));
            return {
                transcription: "2 Strip Dolo aur 1 bottle Cough Syrup",
                items: [
                    { name: "Dolo 650", quantity: 30, confidence: 0.98 },
                    { name: "Benadryl Cough Syrup", quantity: 1, confidence: 0.95 }
                ]
            };
        }

        const { data: { user } } = await supabase.auth.getUser();
        const shopId = typeof window !== 'undefined' ? localStorage.getItem("currentShopId") : null;

        // Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
                const result = reader.result as string;
                // Remove data URL prefix and CRITICAL: Strip any newlines or whitespace
                let base64 = result.split(',')[1] || result;
                base64 = base64.replace(/[\r\n\s]+/g, '');
                resolve(base64);
            };
            reader.onerror = reject;
        });


        // Send JSON Payload (matching N8N expectation)
        const payload = {
            action: 'voice-bill',
            data: base64Data, // N8N expects this in $json.body.data
            userId: user?.id,
            shopId: shopId
        };

        // --- 0. Local "Hinglish Loopback" (Speed + Offline Support) ---
        // If the 'transcription' is passed directly (simulated) or if we want to mock-parse
        // (Note: In a real app, this runs ON the N8N side, but for the hackathon reliability, we add a client-side parser fallback)

        // This is a "Dummy" method because we usually send Audio -> Text.
        // But if the VoiceInput component returns TEXT directly (Web Speech API), we can parse it here.
        // Since this method takes 'Blob', we'll rely on the N8N/Mock fallback below unless we refactor.

        // ... proceeding to N8N fetch ...

        logger.log("[N8N Request] Voice Bill Payload (size):", JSON.stringify(payload).length);

        try {
            // User confirmed Universal Brain uses analyze-prescription webhook for ALL operations
            const response = await fetch(`${N8N_BASE}/analyze-prescription`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error("Voice Billing Agent Failed");
            const result = await response.json();
            logger.log("[N8N Response] Voice Bill:", result);

            // 1. Standard format (transcription + items)
            if (result.transcription || result.items) {
                const rawItems = result.items || [];
                // FIX: Map 'qty' (from N8N) to 'quantity' (Frontend expectation)
                const mappedItems = rawItems.map((item: any) => ({
                    ...item,
                    quantity: item.quantity || item.qty || 1
                }));

                return {
                    transcription: result.transcription || result.text || result.result || "Voice Order Processed",
                    items: mappedItems
                };
            }

            // 2. Supabase/Generic Fallbacks
            if (Array.isArray(result) && result[0]) {
                return { items: result, transcription: "Order Processed" };
            }

            return result;

        } catch (error) {
            console.warn("[AI Service] Voice Backup Triggered", error);

            // 1. TRY GROQ WHISPER FALLBACK
            try {
                logger.log("[Fallback] processing with Groq Whisper...");
                const formData = new FormData();
                formData.append("file", audioBlob, "voice_input.webm"); // webm/mp3/wav
                formData.append("model", "whisper-large-v3");
                formData.append("temperature", "0");
                formData.append("response_format", "json");

                const transResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${GROQ_API_KEY}` }, // No Content-Type for FormData
                    body: formData
                });

                if (!transResponse.ok) throw new Error(`Groq Whisper Failed: ${transResponse.status}`);

                const transData = await transResponse.json();
                const transcription = transData.text;
                logger.log("[Groq Whisper] Text:", transcription);

                // 2. Parse Intent & Items using Llama 3 (Hinglish Aware)
                const prompt = `
                Analyze this voice transcript: "${transcription}"
                Determine if the user wants to ORDER/ADD stock or SEARCH/CHECK stock.

                Output JSON: 
                { 
                  "intent": "add" | "search",
                  "items": [{ "name": "Medicine", "quantity": 10 }] 
                }

                Examples:
                "Add 10 Dolo" -> intent: "add", items: [{name: "Dolo", quantity: 10}]
                "Dolo hai kya?" -> intent: "search", items: [{name: "Dolo", quantity: 0}]
                "Check stock of Pan D" -> intent: "search", items: [{name: "Pan D", quantity: 0}]
                `;

                const parseJson = await callGroqAI([
                    { role: "system", content: "You are a Pharmacy Voice Assistant. Output JSON only." },
                    { role: "user", content: prompt }
                ], "llama-3.3-70b-versatile", true);

                const parsed = safeJSONParse(parseJson, { items: [], intent: 'add' });

                // Map to frontend expected format
                const items = (parsed.items || []).map((i: any) => ({
                    ...i,
                    intent: parsed.intent || 'add'
                }));

                return {
                    transcription: transcription,
                    items: items
                };

            } catch (whisperErr) {
                console.error("Groq Whisper Fallback Failed:", whisperErr);

                // 3. FINAL FALLBACK: Mock for Demo
                return {
                    transcription: "Mock: 2 Patta Dolo aur 1 Azithral (System Offline Mode)",
                    items: [
                        { name: "Dolo 650", quantity: 30, confidence: 0.95 },
                        { name: "Azithral 500", quantity: 5, confidence: 0.90 }
                    ]
                };
            }
        }


    },

    /**
     * PROCESS VOICE TEXT (Client-Side Munim-ji Logic)
     * Parses Hinglish text directly to avoid N8N latency for simple orders.
     */
    async processVoiceText(text: string): Promise<any> {
        logger.log("[AI Service] Processing Voice Text:", text);

        // 1. Define Dictionary
        const UNITS: Record<string, number> = {
            'patta': 15, 'strip': 15, 'strips': 15, 'pattas': 15,
            'goli': 1, 'tablet': 1, 'tablets': 1, 'goliyan': 1,
            'bottle': 1, 'shishi': 1, 'packet': 1, 'box': 10
        };

        const NUMBERS: Record<string, number> = {
            'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5, 'che': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'ten': 10
        };

        // 2. Heuristic Parsing
        const items = [];
        const words = text.toLowerCase().split(' ');

        let currentQty = 1;
        let buffer: string[] = [];

        for (let i = 0; i < words.length; i++) {
            const w = words[i];

            // Check Number
            if (!isNaN(parseInt(w))) {
                currentQty = parseInt(w);
                continue;
            }
            if (NUMBERS[w]) {
                currentQty = NUMBERS[w];
                continue;
            }

            // Check Unit (Multiplier)
            if (UNITS[w]) {
                currentQty = currentQty * UNITS[w];
                continue;
            }

            // Skip Fillers
            if (['bhai', 'bhaiya', 'aur', 'dedo', 'de', 'do', 'chaiye', 'ko', 'ka', 'ek'].includes(w)) continue;

            // Potential Medicine Name
            if (w.length > 2) {
                buffer.push(w);
            }
        }

        // Simple Assumption: The remaining words are the medicine name
        if (buffer.length > 0) {
            // Capitalize
            const name = buffer.join(' ').replace(/\b\w/g, c => c.toUpperCase());
            items.push({
                name: name,
                quantity: currentQty,
                confidence: 0.8
            });
        }

        return {
            transcription: text,
            items: items
        };
    },

    /**
     * Findings Genric Substitutes (Hackathon Feature)
     */
    async getGenericSubstitutes(drugName: string): Promise<string[]> {
        const prompt = `
        Act as an Indian Pharmacist. User asks for a cheaper generic substitute for: "${drugName}".
        List 3 top reliable generic brands available in India (e.g. Cipla, Sun Pharma).
        OUTPUT: JSON Array of strings ONLY. No markdown.
        Example: ["Generic A (Cipla) - ₹20", "Generic B (Sun) - ₹15"]
        `;

        try {
            const response = await this.chatWithAgent(prompt);
            return safeJSONParse(response.reply, []);
        } catch (e) {
            console.error("Generic Fetch Failed", e);
            // Fallback for Hackathon Demo
            return [`${drugName} Generic (Cipla) - ₹${(Math.random() * 50).toFixed(2)}`, `Jan Aushadhi Version - ₹${(Math.random() * 20).toFixed(2)}`];
        }
    },

    /**
     * Hinglish Explainer (Hackathon Feature)
     */
    async explainMedicalReport(summary: string): Promise<string> {
        const prompt = `
        Explain this medical summary to a rural Indian patient in simple HINGLISH (Hindi + English mix).
        Tone: Empathetic, reassuring, and clear.
        Summary: "${summary}"
        Keep it under 50 words.
        `;

        try {
            const response = await this.chatWithAgent(prompt);
            return response.reply;
        } catch (e) {
            return "Maaf kijiye, abhi main isey explain nahi kar pa raha hu. Kripya doctor se sampark karein.";
        }
    },

    /**
     * Sales Pulse Analysis
     */
    async analyzeSalesPulse(salesData: any[]): Promise<{ insight: string; action: string }> {
        const prompt = `
        Analyze this pharmacy sales trend for the last 7 days:
        ${JSON.stringify(salesData)}
        
        Identify the key trend (Up/Down) and give 1 specific actionable advice for a Pharmacy Owner.
        Response Format: JSON { "insight": "Start with trend...", "action": "One concrete step..." }
        Keep it very short (max 15 words each).
        `;

        try {
            const response = await this.chatWithAgent(prompt);
            return safeJSONParse(response.reply, {
                insight: "Data analysis unavailable right now.",
                action: "Check inventory levels manually."
            });
        } catch (e) {
            // Fallback
            return {
                insight: "Data analysis unavailable right now.",
                action: "Check inventory levels manually."
            };
        }
    },

    /**
     * System Health Diagnostics
     */
    async diagnoseError(errorLog: any): Promise<string> {
        const prompt = `
        Analyze this system error log for a Pharmacy App owner (non-technical).
        Error: ${JSON.stringify(errorLog)}
        
        Explain in 1 sentence in HINGLISH what went wrong and what they should do.
        Example: "Internet issue lag raha hai, n8n connect nahi ho paaya. Refresh karke dekhein."
        `;

        try {
            const response = await this.chatWithAgent(prompt);
            return response.reply;
        } catch (e) {
            return "System error detected. Please contact support or try again.";
        }
    }
};
