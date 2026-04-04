import { supabase } from "@/integrations/supabase/client";
import logger from "@/utils/logger";
import { 
    checkConnectivity, 
    fetchWithTimeout, 
    checkRateLimit, 
    callGroqAI, 
    callGeminiVision, 
    callGroqWhisper,
    safeJSONParse, 
    ENDPOINTS 
} from "./ai/core";
import { 
    SYSTEM_PROMPT_PHARMACIST, 
    SYSTEM_PROMPT_ROUTER, 
    LAB_REPORT_PROMPT 
} from "./ai/prompts";
import * as tools from "./ai/tools";
import { analyzeDocument as analyzeDocImpl } from "./ai/vision";
import { ChatResponse, ComplianceResult, MarketData } from "./ai/types";

/**
 * BHARAT MEDIX AI SERVICE (Unified Orchestrator)
 * Refactored for Production Readiness & Modularity.
 */

export const aiService = {
    /**
     * Universal AI Query Handler (Chat)
     */
    async chatWithAgent(message: string, image?: string, history: { role: string, text: string }[] = []): Promise<ChatResponse> {
        const isDemoMode = typeof window !== 'undefined' && localStorage.getItem("DEMO_MODE") === "true";
        if (isDemoMode) {
            await new Promise(r => setTimeout(r, 1000));
            return { reply: "Demo Mode Active. AI is simulated.", isMock: true };
        }

        const shopId = localStorage.getItem("currentShopId");
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Context Injection (Stock & Patient)
        let contextMessage = message;
        if (shopId) {
            contextMessage = await this._injectContext(message, shopId);
        }

        // 2. Vision Path
        if (image) {
            const base64 = image.includes(',') ? image.split(',')[1] : image;
            const isReport = /report|lab|test|jaanch|result|blood|analyze|check|medical|scan|image|photo/i.test(message);
            const prompt = isReport ? LAB_REPORT_PROMPT : message;
            const reply = await callGeminiVision(prompt, base64);
            return { reply, sources: ["Gemini 2.0 Flash"] };
        }

        // 3. Routing & Tool Execution
        if (!checkRateLimit(ENDPOINTS.CHAT)) throw new Error("Slow down, Bhaiya!");

        const formattedHistory = history.slice(-5).map(h => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.text
        }));

        const routerPrompt = [
            { role: "system", content: SYSTEM_PROMPT_ROUTER + "\n\nCRITICAL: Return ONLY JSON." },
            ...formattedHistory,
            { role: "user", content: contextMessage }
        ];

        const routerRes = await callGroqAI(routerPrompt, "llama-3.3-70b-versatile", true);
        const action = safeJSONParse(routerRes, { tool: "direct_reply", args: { answer: "" } });

        // Tool Execution
        let toolResult = "";
        if (action.tool === "check_inventory" && shopId) {
            toolResult = await tools.tool_checkInventory(shopId, action.args.query);
        } else if (action.tool === "get_sales_report" && shopId) {
            toolResult = await tools.tool_getSalesReport(shopId);
        } else if (action.tool === "add_inventory" && shopId) {
            toolResult = await tools.tool_addInventory(shopId, action.args.name, Number(action.args.qty));
        } else if (action.tool === "get_inventory_value" && shopId) {
            toolResult = await tools.tool_getInventoryValue(shopId);
        } else if (action.tool === "navigate") {
            // This will be handled by the UI, but we acknowledge it
            toolResult = `Navigating to ${action.args.path}`;
        } else if (action.tool === "market_data") {
            const mkt = await this.getMarketData(action.args.drug_name);
            toolResult = JSON.stringify(mkt);
        } else if (action.tool === "direct_reply") {
            if (action.args?.answer) return { reply: action.args.answer, sources: ["Groq AI"] };
        }

        // Final Synthesis
        const finalPrompt = [
            { role: "system", content: SYSTEM_PROMPT_PHARMACIST },
            { role: "user", content: `Query: "${contextMessage}"\n\nTool Used: ${action.tool}\nResult: ${toolResult}` }
        ];

        const reply = await callGroqAI(finalPrompt);
        
        // Pass the action back to the UI if it's a structural one
        const finalAction = (action.tool !== "direct_reply") ? {
            type: action.tool.toUpperCase(),
            payload: action.args
        } : undefined;

        return { 
            reply, 
            sources: ["Groq AI (Local Tools)"],
            action: finalAction as any,
            navigationPath: action.tool === "navigate" ? action.args.path : undefined
        };
    },

    async _injectContext(message: string, shopId: string): Promise<string> {
        try {
            const { data: lowStock } = await supabase.from('inventory').select('medicine_name, quantity').eq('shop_id', shopId).lt('quantity', 15).limit(5);
            let ctx = message;
            if (lowStock?.length) ctx += `\n[Context: Low stock items: ${lowStock.map(i => i.medicine_name).join(', ')}]`;
            return ctx;
        } catch { return message; }
    },

    /**
     * Specialized AI Tasks
     */
    async processVoiceBill(audioBlob: Blob): Promise<{ transcription: string, items: any[] }> {
        logger.log("[Voice] Transcribing audio via Groq Whisper...");
        const transcription = await callGroqWhisper(audioBlob);
        logger.log("[Voice] Transcription success:", transcription);
        const result = await this.parseOrderFromText(transcription);
        return { transcription, items: result?.items || [] };
    },

    async parseOrderFromText(text: string): Promise<{ items: any[] }> {
        const prompt = [
            { 
                role: "system", 
                content: `You are an AI that extracts medicine orders from transcribed voice or text.
Return ONLY a strictly formatted JSON object with an "items" array. No markdown, no conversational text.
Format requirements:
{
  "items": [
    {
      "name": "Medicine Name (Cleaned)",
      "quantity": 1, 
      "intent": "add" 
    }
  ]
}` 
            },
            { role: "user", content: text }
        ];
        
        try {
            const res = await callGroqAI(prompt, "llama-3.1-8b-instant", true);
            return safeJSONParse(res, { items: [] });
        } catch (error) {
            logger.error("[Voice] parseOrderFromText AI parsing failed:", error);
            return { items: [] };
        }
    },

    async analyzeDocument(file: File, type: any) {
        return analyzeDocImpl(file, type);
    },

    async checkCompliance(drugName: string): Promise<ComplianceResult> {
        checkConnectivity();
        const res = await fetchWithTimeout(`${ENDPOINTS.COMPLIANCE}?drug=${encodeURIComponent(drugName)}`, { method: "GET" });
        return res.json();
    },

    async getMarketData(drugName: string): Promise<MarketData> {
        checkConnectivity();
        const res = await fetchWithTimeout(`${ENDPOINTS.MARKET}?drug=${encodeURIComponent(drugName)}`, { method: "GET" });
        return res.json();
    },

    async checkInteractions(drugs: string[]): Promise<{ warnings: string[] }> {
        const prompt = [
            { role: "system", content: "You are a clinical pharmacist AI. Check for major drug interactions among the following medications. Return ONLY a valid JSON object with a 'warnings' array containing short descriptions of major interactions. If safe, return { \"warnings\": [] }." },
            { role: "user", content: drugs.join(", ") }
        ];
        try {
            const res = await callGroqAI(prompt, "llama-3.1-8b-instant", true);
            return safeJSONParse(res, { warnings: [] });
        } catch { return { warnings: [] }; }
    },

    async getGenericSubstitutes(medicineName: string): Promise<any[]> {
        const prompt = [
            { role: "system", content: "You are a pharma generic recommender. For the given drug, return generic alternatives that are cheaper or have a better profit margin. Return ONLY a valid JSON array of objects with keys 'name' and 'margin' (percentage number) under a 'substitutes' array. E.g. { \"substitutes\": [ { \"name\": \"Generic Name\", \"margin\": 25 } ] }" },
            { role: "user", content: medicineName }
        ];
        try {
            const res = await callGroqAI(prompt, "llama-3.1-8b-instant", true);
            const parsed = safeJSONParse(res, { substitutes: [] });
            return parsed.substitutes || [];
        } catch { return []; }
    },

    /**
     * Legacy Compatibility & Restore
     */
    async processUnstructuredInventory(text: string, file?: File): Promise<any[]> {
        if (file) {
            const result = await analyzeDocImpl(file, 'inventory_list');
            return result?.items || [];
        }
        
        const prompt = [
            { role: "system", content: "You are an inventory assistant. Extract medicine names, quantities, and prices from the input. Return a JSON array of objects: { brand_name, quantity, mrp }." },
            { role: "user", content: text }
        ];
        const res = await callGroqAI(prompt, "llama-3.1-8b-instant", true);
        const parsed = safeJSONParse(res, { items: [] });
        return parsed.items || [];
    },

    async explainMedicalReport(summary: string): Promise<string> {
        const prompt = [
            { role: "system", content: LAB_REPORT_PROMPT },
            { role: "user", content: `Explain this report summary in very simple Hinglish: ${summary}` }
        ];
        return await callGroqAI(prompt);
    },

    async getDailyBriefing(shopId: string): Promise<string> {
        try {
            // Fetch some data for context
            const { data: inventory } = await supabase.from('inventory').select('medicine_name, quantity, expiry_date').eq('shop_id', shopId);
            const { data: sales } = await supabase.from('orders').select('total_amount').eq('shop_id', shopId).gte('created_at', new Date(Date.now() - 86400000).toISOString());

            const lowStock = inventory?.filter(i => i.quantity < 10).map(i => i.medicine_name).slice(0, 5) || [];
            const nearExpiry = inventory?.filter(i => i.expiry_date && new Date(i.expiry_date) < new Date(Date.now() + 2592000000)).map(i => i.medicine_name).slice(0, 5) || [];
            const totalSalesInput = sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;

            const prompt = [
                { 
                    role: "system", 
                    content: "You are the Pharmacist Assistant 'Bharat Medix AI'. Generate a short, motivating daily briefing in Hinglish for the shop owner. Use the provided context." 
                },
                { 
                    role: "user", 
                    content: `Context: 
- Total Sales (24h): ₹${totalSalesInput}
- Low Stock: ${lowStock.join(', ')}
- Near Expiry: ${nearExpiry.join(', ')}
` 
                }
            ];

            return await callGroqAI(prompt);
        } catch (error) {
            return "Bhaiya, data fetch karne mein thodi problem hui, par aapki sale badhiya chal rahi hai! Kaam shuru karte hain.";
        }
    }
};

export { safeJSONParse, ENDPOINTS };
