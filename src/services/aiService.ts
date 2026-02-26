import { supabase } from "@/integrations/supabase/client";
import logger from "@/utils/logger";
import imageCompression from 'browser-image-compression';
import { medicalResearchService } from "./medicalResearchService";

// Rate limiting configuration
const requestCache = new Map<string, number>();
const RATE_LIMIT_MS = 1000; // 1 request per second per endpoint

// --- ROBUSTNESS HELPERS ---

/**
 * Check connectivity status to fail fast
 */
function checkConnectivity(): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error("You are offline. Please check your internet connection.");
    }
}

/**
 * Fetch with strict timeout to prevent hangs
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 15000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
        }
        throw error;
    }
}

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
        checkConnectivity();

        // Validate API key
        if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 20) {
            logger.error("[Gemini Vision] API key missing or invalid!");
            throw new Error("Gemini API key is not configured. Please check .env file.");
        }

        logger.log("[Gemini Vision] Calling Gemini 2.0 Flash...", { promptLength: prompt.length, imageSize: base64Image.length });

        const response = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
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
            },
            45000 // 45s timeout for complex medical images
        );

        if (!response.ok) {
            const err = await response.text();
            logger.error("[Gemini Vision] API Error:", response.status, err.substring(0, 300));
            throw new Error(`Gemini API Failed (${response.status}): ${err.substring(0, 100)}`);
        }

        const data = await response.json();
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (!result) {
            logger.error("[Gemini Vision] Empty response", data);
            throw new Error("Gemini returned empty result");
        }

        logger.log("[Gemini Vision] ✓ Success!", { responseLength: result.length });
        return result;

    } catch (e: any) {
        logger.error("[Gemini Vision] Error:", e.message);
        console.error("Full Gemini Error:", e);
        throw new Error(`Vision Analysis Failed: ${e.message}. Please try a clearer image.`);
    }
}

async function callGroqAI(messages: any[], model: string = "llama-3.3-70b-versatile", jsonMode: boolean = false): Promise<string> {
    const makeRequest = async (currentModel: string) => {
        checkConnectivity();

        // DEBUG: Log key status safely
        if (!GROQ_API_KEY) console.error("❌ GROQ_API_KEY is MISSING in Browser Environment!");
        else console.log(`✅ GROQ_API_KEY loaded (${GROQ_API_KEY.length} chars, starts with ${GROQ_API_KEY.substring(0, 4)}...)`);

        const response = await fetchWithTimeout(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    messages: messages,
                    model: currentModel,
                    temperature: 0.7,
                    max_tokens: 1024, // Ensure enough space for JSON
                    response_format: jsonMode ? { type: "json_object" } : undefined
                })
            },
            15000 // 15s timeout
        );

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
            return await makeRequest("llama-3.1-8b-instant");
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
export const safeJSONParse = (text: string, fallback: any = null): any => {
    try {
        // 1. Try direct parse
        return JSON.parse(text);
    } catch {
        // 2. Clean Markdown and whitespace
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(clean);
        } catch {
            // 3. Robust Regex Extraction (Finds the largest outer JSON object)
            try {
                const jsonMatch = clean.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
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
const SYSTEM_PROMPT_PHARMACIST = `You are 'Bharat Medix AI Assistant', a trusted and intelligent pharmacy companion for shop owners ('Bhaiya ji') and customers in India.
Your goal is to be helpful, safe, and efficient, speaking in natural **Hinglish** (Hindi + English mix).

### 🚨 EMERGENCY PROTOCOL (HIGHEST PRIORITY):
If the user mentions **Chest Pain, Breathlessness, Heavy Bleeding, Unconsciousness, or Severe Trauma**:
1. **IMMEDIATELY** advise them to visit a hospital or call an ambulance.
2. DO NOT suggest medicines for these conditions.
3. Response start: "**⚠️ EMERGENCY:** Bhaiya, yeh serious lag raha hai. Turant hospital jaaiye!"

### YOUR ROLE:
1. **Shop Operations**: Inventory checks, restocking, and sales tracking.
2. **Clinical Advisor**: OTC medicine suggestions (Safety First!), dosage, and interaction checks.
3. **Khata Manager**: Managing customer credits and ledger.

### COMMUNICATION STYLE (CRITICAL):
- **Language**: **Natural Minglish/Hinglish** (As spoken in Bihar/North India).
- **Tone**: Respectful ('Ji', 'Bhaiya'), caring, yet professional.
- **Format**: Use bullet points for clarity. Keep responses short and punchy.
- **Example**:
    - User: "Dolo hai?"
    - You: "Haan Bhaiya, **Dolo 650** stock mein hai (50 strips). Kya aur kuch chahiye?"

### WORKFLOW:
1. **Identify Intent**: Is it stock check, sale, medical advice, or khata?
2. **Check Safety**: If medical advice, check for contraindications/allergies.
3. **Response**: Give the answer clearly in Hinglish.

### EXAMPLE SCENARIOS:
- *User*: "Sar dard ho raha hai."
- *You*: "Aap **Dolo 650** ya **Saridon** le sakte hain. Agar gas ban rahi hai toh **Pan-D** bhi le lijiye. Aaram milega."
- *User*: "Ramesh ka 500 likh lo."
- *You*: "Thik hai Bhaiya. **Ramesh** ke khate mein ₹500 jod diye hain."
`;

const SYSTEM_PROMPT_ROUTER = `
You are the 'Brain' of the Pharmacy AI.Your job is to DECIDE which tool to use based on the user's query.
You must output a strict JSON object.

### AVAILABLE TOOLS:
1. ** "check_inventory" **: Check stock / expiry.Args: { "query": "medicine_name" }
- * Triggers *: "hai kya?", "stock", "kitna hai", "available"
2. ** "add_inventory" **: Add new stock.Args: { "name": "medicine", "qty": 10 }
- * Triggers *: "aaya hai", "add karo", "stock mein dalo"
3. ** "get_sales_report" **: View sales / revenue.Args: { }
- * Triggers *: "aaj ka hisaab", "bikri", "sale", "revenue"
4. ** "market_data" **: Price / Substitutes.Args: { "drug_name": "medicine" }
- * Triggers *: "price kya hai", "substitute", "alternative"
5. ** "sell_medicine" **: Billing / Invoice.Args: { "drug_name": "medicine", "quantity": 1 }
- * Triggers *: "becho", "bill banao", "invoice", "customer ko dena hai"
6. ** "add_to_shortbook" **: Order from distributor.Args: { "drug_name": "medicine" }
- * Triggers *: "manga lo", "khatam ho gaya", "shortbook", "order karna"
7. ** "share_whatsapp" **: Share info.Args: { "phone": "9876543210", "message": "text" }
- * Triggers *: "whatsapp karo", "bhejo", "bill send karo"
8. ** "save_patient_note" **: Clinical history.Args: { "phone": "9876543210", "note": "text", "name": "Patient Name" }
- * Triggers *: "note kar lo", "history", "yaad rakhna"
9. ** "get_inventory_forecast" **: Restocking advice.Args: { }
- * Triggers *: "forecast", "kya mangwana hai", "restock", "future stock", "prediction"
10. ** "direct_reply" **: Medical advice, chat, or ambiguous queries.Args: { "answer": "Hinglish response..." }
- * Triggers *: General chat, medical symptoms, "Hello", "Kaise ho"

### RULES:
1. ** Output JSON ONLY **.No markdown.
2. If the user mentions a specific medicine try to extract it.
3. If the query is ambiguous(e.g., "Kuch achi dawa do"), USE "direct_reply".
4. If urgency / emergency is detected, USE "direct_reply".

### EXAMPLE:
User: "Azithral 500 ka stock check karo"
Output: { "tool": "check_inventory", "args": { "query": "Azithral 500" } }
`;

const LAB_REPORT_PROMPT = `You are an expert Medical AI specializing in Indian healthcare.Analyze this medical lab report and provide comprehensive, patient - friendly insights in Hinglish(Hindi + English mix).

### ANALYSIS REQUIREMENTS:

** 1. BIOMARKER EXTRACTION:**
    Extract key test parameters with values and status(High / Low / Normal).

** 2. HINGLISH SUMMARY(CRITICAL - MOST IMPORTANT PART):**
    Create a natural, caring conversation like a helpful pharmacist or doctor talking to the patient:

** Language Style:**
    - Mix 60 % Hindi + 40 % English naturally
        - Start friendly: "Dekhiye", "Suniye", "Samajhiye"
            - Use Hindi verbs: "hai", "hain", "ho sakta hai", "dikhai de raha", "chahiye"
                - Keep medical terms in English, explain in Hindi
                    - Use respectful "aap/aapka/aapko"
                        - Add reassurance when appropriate: "Ghabraane ki zarurat nahi", "Sambhal sakte hain"

                            ** 3. POTENTIAL RISKS:**
                                Identify health risks based on abnormal values.

** 4. DIET & CLINICAL RECOMMENDATIONS:**
    Provide 3 - 5 specific Indian diet suggestions and next clinical steps.

** OUTPUT FORMAT:**
    Provide the response in clean Markdown text.Do NOT use JSON.Use headings and bullet points for readability.`;

// --- LOCAL SUPABASE TOOLS (Client-Side Fallback) ---

const tool_checkInventory = async (shopId: string, query: string) => {
    const { data } = await supabase
        .from('inventory')
        .select('medicine_name, quantity, batch_number, expiry_date')
        .eq('shop_id', shopId)
        .ilike('medicine_name', `% ${query} % `)
        .limit(5);

    if (!data || data.length === 0) return `No stock found for '${query}'.`;
    return data.map(i => `${i.medicine_name}: ${i.quantity} units(Batch: ${i.batch_number || 'N/A'}, Expiry: ${i.expiry_date || 'N/A'})`).join('\n');
};

// Enhanced Inventory Tools
const tool_checkExpiry = async (shopId: string) => {
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { data } = await supabase
        .from('inventory')
        .select('medicine_name, quantity, batch_number, expiry_date')
        .eq('shop_id', shopId)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', thirtyDaysLater.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true })
        .limit(10);

    if (!data || data.length === 0) return '✅ No medicines expiring in the next 30 days.';

    return '⚠️ Medicines expiring soon:\n' + data.map(i => {
        const daysLeft = Math.floor((new Date(i.expiry_date).getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        return `${i.medicine_name} (${i.quantity} units): Expires in ${daysLeft} days(${i.expiry_date})`;
    }).join('\n');
};

const tool_checkReorderLevel = async (shopId: string) => {
    const { data } = await supabase
        .from('inventory')
        .select('medicine_name, quantity, reorder_level')
        .eq('shop_id', shopId)
        .not('reorder_level', 'is', null)
        .limit(100); // Get all items to check

    if (!data) return 'Unable to check reorder levels.';

    const needsReorder = data.filter(i => i.quantity <= (i.reorder_level || 0));

    if (needsReorder.length === 0) return '✅ All items are above reorder level.';

    return '⚠️ Items needing reorder:\n' + needsReorder.map(i =>
        `${i.medicine_name}: ${i.quantity} units(Reorder at: ${i.reorder_level})`
    ).join('\n');
};

const tool_getLowStock = async (shopId: string, threshold: number = 10) => {
    const { data } = await supabase
        .from('inventory')
        .select('medicine_name, quantity')
        .eq('shop_id', shopId)
        .lte('quantity', threshold)
        .order('quantity', { ascending: true })
        .limit(15);

    if (!data || data.length === 0) return `✅ No items with quantity below ${threshold}.`;

    return `⚠️ Low stock items(below ${threshold}): \n` + data.map(i =>
        `${i.medicine_name}: ${i.quantity} units`
    ).join('\n');
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
        product_name: name,
        added_by: 'ai_assistant',
        status: 'pending'
    });
    if (error) return `Failed to add ${name} to Shortbook.`;
    return `Added ${name} to Shortbook (Purchase List).`;
};

// Feature Integration Tools
const tool_getPrescriptions = async (shopId: string, patientName?: string) => {
    let query = supabase
        .from('prescriptions')
        .select('customer_name, doctor_name, medicines, created_at')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(5);

    if (patientName) {
        query = query.ilike('customer_name', `%${patientName}%`);
    }

    const { data } = await query;
    if (!data || data.length === 0) return patientName ? `No prescriptions found for '${patientName}'.` : 'No recent prescriptions found.';

    return data.map(p => {
        const meds = typeof p.medicines === 'string' ? JSON.parse(p.medicines) : p.medicines;
        const medNames = Array.isArray(meds) ? meds.map((m: any) => m.name || m.medicine_name).join(', ') : 'N/A';
        return `${p.customer_name} (Dr. ${p.doctor_name || 'Unknown'}): ${medNames} [${new Date(p.created_at).toLocaleDateString()}]`;
    }).join('\n\n');
};

const tool_checkDrugCompliance = async (drugName: string) => {
    try {
        const result = await aiService.checkCompliance(drugName);
        if (result.is_banned) return `⚠️ BANNED DRUG: ${drugName}\nReason: ${result.reason}`;
        if (result.is_h1) return `⚠️ H1 DRUG: ${drugName}\nRequires prescription (Schedule H1)`;
        return `✅ ${drugName} is compliant for sale.`;
    } catch (e) {
        return `Unable to verify compliance for ${drugName}. Please check manually.`;
    }
};

const tool_getForecast = async (shopId: string) => {
    try {
        // Fetch recent sales for forecast
        const { data: sales } = await supabase
            .from('orders')
            .select('order_items, created_at')
            .eq('shop_id', shopId)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(100);

        if (!sales || sales.length === 0) return 'Not enough sales data for forecasting.';

        const forecast = await aiService.getInventoryForecast(sales);

        if (!forecast.forecast || forecast.forecast.length === 0) {
            return 'No restocking recommendations at this time.';
        }

        return '📊 Inventory Forecast:\n' + forecast.forecast.slice(0, 5).map((f: any) =>
            `${f.product}: Restock ${f.suggested_restock} units (Confidence: ${Math.round(f.confidence * 100)}%)\nReason: ${f.reason}`
        ).join('\n\n');
    } catch (e) {
        return 'Unable to generate forecast. Please try again later.';
    }
};

const tool_getSalesAnalytics = async (shopId: string, period: string = 'today') => {
    try {
        let startDate: Date;
        const now = new Date();

        switch (period.toLowerCase()) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.setHours(0, 0, 0, 0));
        }

        const { data, error } = await supabase
            .from('orders')
            .select('total_amount, order_items')
            .eq('shop_id', shopId)
            .gte('created_at', startDate.toISOString());

        if (error || !data || data.length === 0) return `No sales data for ${period}.`;

        const totalRevenue = data.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const orderCount = data.length;

        return `📈 Sales Analytics (${period}):\n` +
            `Total Revenue: ₹${totalRevenue.toFixed(2)}\n` +
            `Orders: ${orderCount}\n` +
            `Average Order Value: ₹${(totalRevenue / orderCount).toFixed(2)}`;
    } catch (e) {
        return 'Unable to fetch sales analytics.';
    }
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

const tool_callN8NFallback = async (payload: any): Promise<ChatResponse> => {
    logger.warn("[AI Service] ⚠️ Primary AI failed/timed out. Switching to N8N Fallback.");

    try {
        const response = await fetchWithTimeout(ENDPOINTS.CHAT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...payload,
                force_fallback: true,
                system_instruction: "CRITICAL: Response MUST be in Hinglish (Hindi + English). You are acting as a fallback for the primary AI."
            })
        }, 45000); // Give N8N slightly more time since it's the last resort

        if (!response.ok) throw new Error("N8N Fallback Failed");

        const data = await response.json();
        // Handle N8N specific response format if needed, or assume it matches ChatResponse
        return {
            reply: data.output || data.reply || "Maaf kijiye, abhi main aapki madad nahi kar pa raha hoon. Kripya thodi der baad prayas karein.",
            sources: ["Backup System (N8N)"],
            isMock: false
        };
    } catch (e) {
        logger.error("[AI Service] ❌ Total System Failure (Primary + Fallback)", e);
        throw e;
    }
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

        // --- DEFINITON: Primary AI Logic (Groq/Gemini) ---
        const primaryAITask = async (): Promise<ChatResponse> => {
            try {
                // TEST HOOK: Force Fallback
                if (typeof window !== 'undefined' && localStorage.getItem("FORCE_AI_FAIL") === "true") {
                    throw new Error("Simulated Primary AI Failure (Test Mode)");
                }

                logger.log("[Primary] Attempting Local AI (Groq/Gemini)...");

                // --- VISION PATH (Gemini 2.0) ---
                if (image) {
                    logger.log("[Primary] Switching to Gemini Vision (2.0-Flash)...");
                    try {
                        // Extract Base64 if needed
                        const base64 = image.includes(',') ? image.split(',')[1] : image;

                        // Check for Lab Report Intent (BROADENED)
                        // Added: analyze, check, medical, scan, image, photo, dekho
                        const isReport = /report|lab|test|jaanch|result|blood|analyze|check|medical|scan|image|photo|dekho/i.test(contextMessage || "");
                        let visionPrompt = contextMessage || "Analyze this image in detail.";

                        if (isReport) {
                            logger.log("[Vision] Detected Lab Report intent (using detailed medical prompt)");
                            // Force JSON
                            visionPrompt = LAB_REPORT_PROMPT + `\n\nUSER QUERY: ${contextMessage}\n\nIMPORTANT: Return ONLY raw JSON. No markdown formatting.`;
                        }

                        const visionReply = await callGeminiVision(
                            visionPrompt,
                            base64
                        );

                        logger.log("[Vision] Raw Reply:", visionReply.substring(0, 100) + "...");

                        return {
                            reply: visionReply,
                            sources: ["Gemini 2.0 Flash (Vision)"],
                            isMock: false
                        };
                    } catch (geminiErr) {
                        logger.error("Gemini Vision Failed:", geminiErr);
                        throw new Error("Local Vision Failed"); // Trigger fallback
                    }
                }

                logger.log("[Primary] Switching to Groq AI (Smart Router)...");

                // --- STEP 1: ROUTING ---
                // Format history for Groq (limit to last 5 interactions to save tokens)
                const formattedHistory = history.slice(-5).map(h => ({
                    role: h.role === 'user' ? 'user' : 'assistant',
                    content: h.text
                }));

                const routerPrompt = [
                    { role: "system", content: SYSTEM_PROMPT_ROUTER + "\n\nCRITICAL: You MUST return a JSON object with 'tool' and 'args' keys. Do not return anything else." },
                    ...formattedHistory,
                    { role: "user", content: contextMessage }
                ];

                // Use a slightly lower temperature for deterministic routing
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
                } else if (action.tool === "get_inventory_forecast" && shopId) {
                    toolResult = await tool_getForecast(shopId);
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

            } catch (localError: any) {
                // Ensure we catch ANY error from the primary task so the race can handle it
                logger.error("[Primary] Local AI Task Failed:", localError);
                throw localError;
            }
        };

        // --- EXECUTION: Race Condition (30s Timeout) ---
        try {
            const timeoutPromise = new Promise<ChatResponse>((_, reject) =>
                setTimeout(() => reject(new Error("Primary AI Timeout (30s)")), 30000)
            );

            // Race the Primary AI against the clock
            return await Promise.race([primaryAITask(), timeoutPromise]);

        } catch (error) {
            logger.warn("[AI Service] ⚠️ Fallback Triggered (Timeout or Error)", error);
            // Seamlessly switch to N8N
            return await tool_callN8NFallback(payload);
        }
    },

    /**
     * Secure Clinical Document Upload & Analysis
     */


    /**
     * Secure Clinical Document Upload & Analysis
     */
    async analyzeDocument(file: File, type: 'prescription' | 'lab_report' | 'invoice' | 'inventory_list' | 'diary'): Promise<any> {
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
                if (error && !error.message.includes("Bucket not found")) {
                    logger.error("Background Upload Failed:", error);
                }
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
        // UPDATED: 'prescription' also bypasses n8n first to use Local Gemini (Primary) -> N8N (Fallback)
        if (type === 'inventory_list' || type === 'invoice' || type === 'prescription') {
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
                console.warn("[N8N] Failed, falling back to Gemini Vision", n8nError);
            }
        }

        // --- GEMINI VISION READ (Fallback) ---
        // Handles Inventory Lists, Bills, and Lab Reports if N8N fails
        try {
            logger.log("[Fallback] Using Gemini 2.0 Flash for Document Analysis...");
            checkConnectivity();
            let systemPrompt = "";

            if (type === 'inventory_list' || type === 'invoice') {
                systemPrompt = `You are a Pharmacy Inventory Assistant. 
                Analyze this image (Medicine Bill/Invoice/Strip from India).
                Extract a LIST of medicines.
                
                Columns to extract:
                - Medicine Name (Clean name, no dosage if possible, but keep if important)
                - Batch Number (Look for 'Batch', 'B.No', 'Lot')
                - Expiry Date (Format: YYYY-MM-DD. Convert 'Dec 24' to '2024-12-31')
                - Quantity (Look for 'Qty', 'Pack', 'Strip', default to 1 if unclear)
                - MRP/Unit Price (Look for 'MRP', 'Rate', 'Price', default to 0)
                
                Output STRICT JSON Object with an 'items' array.
                Example:
                {
                  "items": [
                    { 
                      "medicine_name": "Dolo 650", 
                      "batch_number": "B123", 
                      "expiry_date": "2025-12-31", 
                      "quantity": 10, 
                      "unit_price": 30.5 
                    }
                  ]
                }`;


                // @ts-ignore: diary type is valid
            } else if (type === 'diary') {
                // Diary Sales Extraction Prompt — for handwritten shop diary pages
                systemPrompt = `You are an expert OCR AI specializing in reading handwritten Indian pharmacy sales diaries (bahi khata / register).

These diaries contain daily medicine sales notes written by shopkeepers — often messy, abbreviated, or in Hindi/Hinglish.

### YOUR TASK:
Extract ALL medicine sales entries from this diary page image.

### WHAT TO LOOK FOR:
- Medicine names (may be abbreviated: "Dolo", "Crocin", "Pan-D", "Azithro")
- Quantities sold (number of strips, bottles, tablets, or packs)
- Prices per unit or total price for that entry
- Customer names (if mentioned, often just first name)
- Any notes (e.g., "udhaar", "cash", "return")

### HANDLING MESSY HANDWRITING:
- Correct common misspellings (e.g., "Paracitamol" → "Paracetamol")
- Recognize Hindi number systems and mixed Hindi-English
- If a medicine name is unclear, provide your best guess with "(?)" suffix
- Quantities may be in: strips, bottles, tablets, pcs, patti
- Prices may use shortcuts: "30/2" means ₹30 for 2, "₹" or "Rs" prefix

### OUTPUT FORMAT (STRICT JSON):
{
  "date": "Date if visible or null",
  "entries": [
    {
      "medication_name": "Medicine Name",
      "quantity": 2,
      "unit": "strip",
      "price": 30,
      "total": 60,
      "customer_name": "Name or null",
      "notes": "cash/udhaar/return or null"
    }
  ],
  "page_total": 450
}

### IMPORTANT:
- Return ONLY valid JSON, no markdown formatting
- Extract ALL visible entries, even partially readable ones
- If price is per unit, calculate total = quantity × price
- If only total is visible, set price = total / quantity
- "page_total" = sum of all entry totals (estimate if not written)
- entries array must have at least 1 item if diary page is readable`;

            } else if (type === 'prescription') {
                // Comprehensive Prescription Analysis Prompt for Diary Scan
                systemPrompt = `You are an expert Prescription Reader AI specializing in Indian pharmacy prescriptions (handwritten or printed).

Analyze this prescription image and extract all medication details.

### EXTRACTION REQUIREMENTS:

**1. PATIENT & DOCTOR INFO:**
- Patient Name (if visible)
- Doctor Name (if visible)
- Contact/Phone (if visible)
- Date (if visible)

**2. MEDICATION LIST:**
For each medicine, extract:
- **Medication Name**: Full drug name (e.g., "Pan-D", "Azithral 500")
- **Strength/Dosage**: e.g., "40mg", "500mg", "5ml"
- **Frequency**: e.g., "1-0-1" (morning-afternoon-night), "BD" (twice daily), "TDS" (thrice daily), "QID" (4 times daily)
- **Duration**: e.g., "5 days", "1 week", "15 days"
- **Instructions/Notes**: e.g., "After food", "Before breakfast", "SOS" (if needed)
- **Indication**: Reason for prescription (if mentioned)

**3. SPECIAL HANDLING:**
- Recognize Indian medical abbreviations:
  - BD = Twice daily
  - TDS/TID = Three times daily  
  - QID = Four times daily
  - OD = Once daily
  - HS = At bedtime
  - SOS = If needed
  - AC = Before meals
  - PC = After meals
- Handle handwritten text carefully
- Correct common spelling variations (e.g., "Paracitamol" → "Paracetamol")

### OUTPUT FORMAT (STRICT JSON):
{
  "patient_name": "Name or null",
  "doctor_name": "Dr. Name or null",
  "patient_contact": "Phone or null",
  "date": "YYYY-MM-DD or null",
  "medications": [
    {
      "medication_name": "Drug name",
      "strength": "Dosage strength",
      "dosage_frequency": "Frequency (1-0-1, BD, etc.)",
      "duration": "Treatment duration",
      "notes": "Instructions",
      "indication": "Reason (if mentioned)"
    }
  ]
}

### IMPORTANT:
- Return ONLY valid JSON, no markdown formatting
- If a field is unclear or not visible, use empty string "" or null
- Extract ALL visible medications from the prescription
- Medications array must have at least 1 item if prescription is readable`;
            } else {
                // Comprehensive Lab Report Analysis Prompt with Hinglish Support
                systemPrompt = `You are an expert Medical AI specializing in Indian healthcare. Analyze this medical lab report and provide comprehensive, patient-friendly insights in Hinglish (Hindi + English mix).

### ANALYSIS REQUIREMENTS:

**1. BIOMARKER EXTRACTION:**
Extract all test parameters with:
- Test name (e.g., "Hemoglobin", "WBC Count", "Blood Sugar")
- Measured value
- Unit (e.g., "g/dL", "/cumm", "mg/dL")
- Normal reference range
- Status: "Normal", "Low", "High", or "Abnormal"

**2. HINGLISH SUMMARY (CRITICAL - MOST IMPORTANT PART):**
Create a natural, caring conversation like a helpful pharmacist or doctor talking to the patient:

**Language Style:**
- Mix 60% Hindi + 40% English naturally
- Start friendly: "Dekhiye", "Suniye", "Samajhiye"
- Use Hindi verbs: "hai", "hain", "ho sakta hai", "dikhai de raha", "chahiye"
- Keep medical terms in English, explain in Hindi
- Use respectful "aap/aapka/aapko"
- Add reassurance when appropriate: "Ghabraane ki zarurat nahi", "Sambhal sakte hain"

**Real Examples:**

Good News: "Bahut achhi baat! Aapki **kidney** aur **liver** bilkul perfect hain. **Cholesterol** bhi normal hai. Jo lifestyle follow kar rahe hain, continue kariye. Bas **Vitamin D** thoda low hai (22) - morning dhoop mein 15-20 minute baithiye."

Concerning: "Dekhiye bhaiya, **blood sugar fasting** 128 mg/dL hai - thoda high hai. Ye **pre-diabetes** stage hai. Par tension mat lo, abhi bhi reverse ho sakta hai! **Diet control** aur daily 30 min **walk** kariye. **Sugar** kam lijiye."

Critical: "Main samajh sakta hoon ye sunke tension hogi. Aapka **hemoglobin** bahut kam - sirf 8.5 g/dL. Severe **anemia** hai, isliye weakness mehsoos hoti hogi. Immediately doctor ko dikhana zaroori hai. Saath mein **palak**, **anar**, **chana** daily khana shuru kariye."

Mixed: "Kuch achha hai kuch pe dhyan dena hoga. **BP** normal hai - bahut achha. Lekin **cholesterol** high nikla - **LDL** 165 (100 se kam hona chahiye). **Oily food** aur **fried items** kam kar dijiye. **Oats** aur **nuts** use kariye."

**3. POTENTIAL RISKS (with Severity):**
Identify health risks based on abnormal values:
- Severity levels: "Low", "Moderate", "High", "Critical"
- Provide actionable risk descriptions
- Consider Indian population context (diabetes, anemia prevalence)

Examples:
- High blood sugar + family history → "Diabetes Risk" (Severity: High)
- Low Vitamin D + bone pain → "Osteoporosis Risk" (Severity: Moderate)
- Very high WBC + fever → "Severe Infection" (Severity: Critical)

**4. DISEASE POSSIBILITIES:**
List potential conditions based on biomarker patterns (2-4 conditions max)

**5. DIET RECOMMENDATIONS:**
Provide 3-5 specific Indian diet suggestions:
- Use Indian foods: "Spinach (Palak)", "Jaggery (Gur)", "Amla"
- Be practical: "Daily 1 cup curd (dahi)"
- Consider vegetarian and non-vegetarian options

**6. CLINICAL NEXT STEPS:**
Suggest 2-4 medical actions:
- Specialist consultations
- Follow-up tests
- Medication guidance (generic)

**7. PREVENTION TIPS:**
Provide 3-5 lifestyle measures:
- Exercise (specific: "30 min walk daily")
- Sleep hygiene
- Stress management
- Hydration
- Regular monitoring

### INDIAN MEDICAL CONTEXT:
- Common conditions: Diabetes, Anemia, Vitamin D deficiency, Thyroid disorders
- Seasonal factors: Consider monsoon (infections), summer (dehydration)
- Cultural diet: Vegetarian-friendly options, common Indian foods

### OUTPUT FORMAT (STRICT JSON):
{
  "summary": "Brief clinical summary in English",
  "hinglish_summary": "Patient-friendly Hinglish explanation (2-3 sentences)",
  "patient_name": "Extract if visible, else null",
  "report_date": "Extract if visible, else null",
  "test_results": [
    {
      "test_name": "Parameter name",
      "value": "Measured value",
      "unit": "Unit",
      "normal_range": "Reference range",
      "status": "Normal/Low/High/Abnormal"
    }
  ],
  "disease_possibility": ["Condition 1", "Condition 2"],
  "potential_risks": [
    {
      "risk": "Risk name",
      "severity": "Low/Moderate/High/Critical",
      "description": "Why this is a risk"
    }
  ],
  "recommendations": {
    "diet": ["Diet tip 1", "Diet tip 2"],
    "medical": ["Next step 1", "Next step 2"],
    "prevention": ["Prevention tip 1", "Prevention tip 2"]
  }
}

### IMPORTANT:
- Return ONLY valid JSON, no markdown formatting
- Ensure all arrays have at least 1-2 items
- Make Hinglish summary conversational and reassuring
- Prioritize risks by severity (Critical first)`;
            }

            let geminiRes;

            // For Prescriptions: Enforce 30s Timeout
            if (type === 'prescription') {
                const timeoutPromise = new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error("Gemini Vision Timed Out (30s)")), 30000)
                );

                geminiRes = await Promise.race([
                    callGeminiVision(
                        systemPrompt + "\n\nIMPORTANT: Return ONLY raw JSON. No markdown formatting.",
                        base64Data
                    ),
                    timeoutPromise
                ]);
            } else {
                // Standard Call
                geminiRes = await callGeminiVision(
                    systemPrompt + "\n\nIMPORTANT: Return ONLY raw JSON. No markdown formatting.",
                    base64Data
                );
            }

            const parsed = safeJSONParse(geminiRes, null);
            if (!parsed) {
                throw new Error("Invalid format from Gemini Vision");
            }

            if (type === 'prescription') {
                const hasArray = Array.isArray(parsed.medications) && parsed.medications.length > 0
                    || Array.isArray(parsed.medicines) && parsed.medicines.length > 0
                    || Array.isArray(parsed.items) && parsed.items.length > 0
                    || Array.isArray(parsed.prescription) && parsed.prescription.length > 0;

                if (!hasArray) {
                    throw new Error("Gemini failed to extract any medicines");
                }
            }

            return { ...parsed, isMock: false };

        } catch (geminiViolate) {
            logger.error("Gemini Vision Analysis Failed:", geminiViolate);

            // --- N8N FALLBACK (Specific for Prescription) ---
            if (type === 'prescription') {
                logger.warn("[Fallback] Switching to N8N Webhook for Prescription...");
                try {
                    // Re-construct N8N Payload
                    const n8nPayload = {
                        action: 'analyze-prescription',
                        image_base64: base64Data,
                        data: base64Data,
                        userId: (await supabase.auth.getUser()).data.user?.id,
                        shopId: typeof window !== 'undefined' ? localStorage.getItem("currentShopId") : null
                    };

                    const n8nRes = await fetchWithTimeout(ENDPOINTS.ANALYZE_PRESCRIPTION, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(n8nPayload)
                    }, 30000); // 30s Timeout for fallback as well

                    if (n8nRes.ok) {
                        const n8nText = await n8nRes.text();
                        const n8nData = JSON.parse(n8nText);
                        logger.log("[Fallback] N8N Success:", n8nData);
                        return n8nData;
                    }
                } catch (n8nErr) {
                    logger.error("[Fallback] N8N Check Failed:", n8nErr);
                }
            }

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
     * Interaction Checker using Groq AI (Primary)
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

            if (drugString.includes("aspirin") && drugString.includes("warfarin")) {
                mockInteractions.push("⚠️ Major: Aspirin + Warfarin: Increased risk of bleeding.");
            }
            if (drugString.includes("paracetamol") && drugString.includes("dolo")) {
                mockInteractions.push("⚠️ Duplicate Therapy: Both contain Paracetamol. Risk of overdose.");
            }
            if (drugString.includes("alcohol") || (drugString.includes("metronidazole"))) {
                mockInteractions.push("⚠️ Moderate: Avoid alcohol while taking Metronidazole.");
            }

            if (mockInteractions.length === 0 && Math.random() > 0.7) {
                mockInteractions.push("⚠️ Moderate: Potential interaction detected. Monitor patient.");
            }

            return { warnings: mockInteractions, isMock: true };
        }

        try {
            logger.log("[Interaction] Using Groq AI Primary for interactions...");
            const prompt = `
Act as a Clinical Pharmacist. Check interactions for the following concurrent medications: ${drugs.join(', ')}.
Return JSON only.
Structure: {
    "interactions": [
        { "drug1": "A", "drug2": "B", "severity": "Major" | "Moderate", "description": "Short reason in Hinglish (max 15 words)" }
    ]
}
If there are no interactions, return { "interactions": [] }.

CRITICAL: You MUST return a JSON object. Do not return anything else. Keep descriptions brief.
            `;

            const groqJson = await callGroqAI([
                { role: "system", content: "You are a clinical interaction checker. Output valid JSON only." },
                { role: "user", content: prompt }
            ], "llama-3.3-70b-versatile", true); // Enable JSON mode

            const parsed = safeJSONParse(groqJson, { interactions: [] });

            // Map to frontend format
            const warnings = (parsed.interactions || []).map((i: any) => `⚠️ ${i.severity}: ${i.drug1} + ${i.drug2}: ${i.description}`);
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
                CRITICAL: You MUST return a JSON object. Do not return anything else.
                `;

                const groqJson = await callGroqAI([
                    { role: "system", content: "You are a pharmaceutical market expert. Output valid JSON only." },
                    { role: "user", content: prompt }
                ], "llama-3.1-8b-instant", true); // Enable JSON mode

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
     * Get Generic Substitutes (Market Intelligence)
     */
    async getGenericSubstitutes(medicineName: string): Promise<string[]> {
        // 1. Try N8N Market Data Endpoint
        try {
            if (checkRateLimit(ENDPOINTS.MARKET)) {
                const response = await fetchWithTimeout(ENDPOINTS.MARKET, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: "substitute", drug_name: medicineName })
                }, 5000);

                if (response.ok) {
                    const data = await response.json();
                    if (data.substitutes && Array.isArray(data.substitutes)) {
                        return data.substitutes.map((s: any) => `${s.name} - ₹${s.price || 0}`);
                    }
                    if (Array.isArray(data)) return data;
                }
            }
        } catch (n8nErr) {
            console.warn("N8N Market Data Failed, switching to Local AI...", n8nErr);
        }

        // 2. Fallback to Groq AI (Llama 3)
        try {
            const prompt = `You are a helpful Indian Pharmacist. List 3-4 cost-effective generic substitutes for "${medicineName}" available in India.
            Format exactly like this list:
            "Brand Name (Generic Name) - ₹ApproxPrice"
            "Brand Name (Generic Name) - ₹ApproxPrice"
            
            Return ONLY the list strings.`;

            const aiRes = await callGroqAI([
                { role: "system", content: "You are a precise medical data assistant." },
                { role: "user", content: prompt }
            ], "llama-3.1-8b-instant");

            const lines = aiRes.split('\n').filter(l => l.includes('- ₹'));
            if (lines.length > 0) return lines.map(l => l.replace(/["]/g, '').trim());

            return [];

        } catch (e) {
            console.error("AI Substitute check failed", e);
            throw new Error("Could not fetch substitutes.");
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
                Check Indian CDSCO/FDA regulations for: "${drugName}".
                
                Example Output:
                { "is_banned": false, "is_h1": true, "reason": "Requires prescription" }

                Return JSON only.
                CRITICAL: You MUST return a JSON object. Do not return anything else.
                `;

                const groqJson = await callGroqAI([
                    { role: "system", content: "You are a Regulatory Affairs Specialist for Indian Pharma. Output valid JSON only." },
                    { role: "user", content: prompt }
                ], "llama-3.3-70b-versatile", true);

                const parsed = safeJSONParse(groqJson, {
                    is_banned: false,
                    is_h1: false,
                    reason: "AI unavailable - Verify Manually",
                    warning_level: "Medium"
                });
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
                
                CRITICAL: You MUST return a JSON object. Do not return anything else.
                `;

                const groqJson = await callGroqAI([
                    { role: "system", content: "You are an Inventory Analyst. Output valid JSON only." },
                    { role: "user", content: prompt }
                ], "llama-3.1-8b-instant", true);

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
    async parseOrderFromText(text: string): Promise<any> {
        // 1. Try Groq AI (Llama 3) for smart parsing
        try {
            const prompt = `
            Analyze this voice transcript: "${text}"
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
            
            CRITICAL: You MUST return a JSON object. Do not return anything else.
            `;

            const parseJson = await callGroqAI([
                { role: "system", content: "You are a Pharmacy Voice Assistant. Output JSON only." },
                { role: "user", content: prompt }
            ], "llama-3.1-8b-instant", true);

            const parsed = safeJSONParse(parseJson, { items: [], intent: 'add' });

            // Map to frontend expected format
            const items = (parsed.items || []).map((i: any) => ({
                ...i,
                intent: parsed.intent || 'add'
            }));

            return {
                transcription: text,
                items: items
            };

        } catch (e) {
            console.warn("[AI Service] Smart Parsing Failed, using Heuristic Fallback", e);
            // Fallback to local heuristic (processVoiceText)
            return await this.processVoiceText(text);
        }
    },

    /**
     * Voice Billing Integration
     * Processes voice audio through N8N (primary) with Groq Whisper fallback
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

        // 1. PRIMARY: N8N Backend (AI Call)
        try {
            logger.log("[Voice] Processing with N8N Backend (Primary)...");

            // Convert Blob to Base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            const base64Data = await new Promise<string>((resolve, reject) => {
                reader.onloadend = () => {
                    const result = reader.result as string;
                    let base64 = result.split(',')[1] || result;
                    base64 = base64.replace(/[\r\n\s]+/g, '');
                    resolve(base64);
                };
                reader.onerror = reject;
            });

            const payload = {
                action: 'voice-bill',
                data: base64Data,
                userId: user?.id,
                shopId: shopId
            };

            logger.log("[N8N Request] Voice Primary:", payload.action);

            const response = await fetchWithTimeout(`${N8N_BASE}/analyze-prescription`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            }, 20000); // 20s timeout for N8N

            if (!response.ok) throw new Error(`N8N Voice Agent Failed: ${response.status}`);
            const result = await response.json();

            if (result.transcription || result.items) {
                const rawItems = result.items || [];
                const mappedItems = rawItems.map((item: any) => ({
                    ...item,
                    quantity: item.quantity || item.qty || 1
                }));

                logger.log("[N8N] Voice Success:", result.transcription);
                return {
                    transcription: result.transcription || result.text || "Voice Order Processed",
                    items: mappedItems
                };
            }

            return result;

        } catch (n8nError) {
            console.warn("[AI Service] N8N Voice Failed, trying Groq Whisper Fallback", n8nError);

            // 2. FALLBACK: Groq Whisper
            try {
                logger.log("[Voice] Falling back to Groq Whisper...");

                if (!GROQ_API_KEY) throw new Error("Groq API Key missing for Voice fallback");

                const formData = new FormData();
                formData.append("file", audioBlob, "voice_input.webm");
                formData.append("model", "whisper-large-v3");
                formData.append("response_format", "json");

                const transResponse = await fetchWithTimeout(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${GROQ_API_KEY}` },
                        body: formData
                    },
                    15000 // 15s timeout for Groq
                );

                if (!transResponse.ok) {
                    const errText = await transResponse.text();
                    throw new Error(`Groq Whisper Failed: ${transResponse.status} - ${errText}`);
                }

                const transData = await transResponse.json();
                const transcription = transData.text;
                logger.log("[Groq Whisper Fallback] Text:", transcription);

                if (!transcription || transcription.trim().length === 0) {
                    return { transcription: "", items: [] };
                }

                // Parse Intent & Items using Shared Method
                return await this.parseOrderFromText(transcription);

            } catch (groqError) {
                logger.error("[Voice] All services failed (N8N + Groq):", groqError);
                throw new Error("Voice processing failed. Please try again or type.");
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
        const buffer: string[] = [];

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
                confidence: 0.8,
                intent: 'add' // Default assumption
            });
        }

        return {
            transcription: text,
            items: items
        };
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
    },

    /**
     * Intelligent Inventory Architect
     * Processes unstructured medicine data (images, voice-to-text, or messy manual notes)
     */
    async processUnstructuredInventory(input: string, image?: File): Promise<any> {
        let extractedText = input;

        // If an image is provided, extract its text using Gemini Vision first
        if (image) {
            try {
                // Compress Image
                const options = {
                    maxSizeMB: 0.8,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    initialQuality: 0.8
                };
                const compressedFile = await imageCompression(image, options);
                const reader = new FileReader();

                const base64Image = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => {
                        const b64 = reader.result as string;
                        resolve(b64.includes(',') ? b64.split(',')[1] : b64);
                    };
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(compressedFile);
                });

                const visionPrompt = "Extract all text from this image precisely. Focus on medicine brand names, composition/salt, packaging details, MRP, and expiry dates. Return the raw text extracted.";
                const visionResult = await callGeminiVision(visionPrompt, base64Image);
                extractedText += `\n[Image Extracted Text]: ${visionResult}`;
            } catch (err: any) {
                logger.error("[processUnstructuredInventory] OCR Failed:", err);
                throw new Error("Failed to read image. Please try again or type manually.");
            }
        }

        // Send to Groq for structured extraction
        const prompt = `
Role: You are the Intelligent Inventory Architect for MedixAI.
Objective: Process unstructured medicine data (images, voice-to-text, or messy manual notes) and integrate it into the "AI Drafts" section of the Inventory Module.

Input Data:
${extractedText}

Instructions:
Data Extraction: Parse the input for: 
Brand Name: (e.g., "Crocinn" -> "Crocin")
Composition/Salt: (e.g., "Paracetamol 650mg")
Packaging: (e.g., "Strip of 15", "Loose", "Bottle")
MRP & Expiry: Extract if available; otherwise, flag as "Required".

Standardization: Map the extracted Brand Name against standard medical terms if obvious. If no match is found, categorize it as a "New Unstructured Entry."
AI Draft Integration:
- Format the output as a JSON object compatible with the inventory_drafts table in Supabase. 
- Set status to "Pending_Verification".
- Generate a reorder_threshold based on a default of 20% of the initial stock entered (assuming qty=10 if not provided, thus threshold=2).
- Conflict Resolution: If the salt composition matches an existing product but the brand is different, add a note: "Alternative brand for [Existing_Product_Name]".

Output Format:
Return ONLY a clean JSON object (or array of objects if multiple) including brand_name, salt, quantity, mrp, expiry, uom (Unit of Measure), and confidence_score. DO NOT wrap in markdown.
        `;

        try {
            const groqResponse = await callGroqAI([
                { role: "system", content: "You MUST return ONLY a raw JSON object or array. No markdown, no explanations." },
                { role: "user", content: prompt }
            ], "llama-3.3-70b-versatile", true);

            const parsed = safeJSONParse(groqResponse);
            if (!parsed) {
                throw new Error("AI failed to extract structured data.");
            }
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e: any) {
            logger.error("[processUnstructuredInventory] Groq Failed:", e);
            throw new Error(`Failed to process unstructured inventory: ${e.message}`);
        }
    }
};
