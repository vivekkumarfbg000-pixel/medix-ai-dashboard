import { supabase } from "@/integrations/supabase/client";
import logger from "@/utils/logger";
import { 
    checkConnectivity, 
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
 * Production-ready — all AI routes via local Gemini proxy. N8N removed.
 */

export const aiService = {
    /**
     * Universal AI Query Handler (Chat)
     */
    async chatWithAgent(message: string, image?: string, history: { role: string, text: string }[] = []): Promise<ChatResponse> {
        const shopId = localStorage.getItem("currentShopId");

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
            toolResult = `Navigating to ${action.args.path}`;
        } else if (action.tool === "market_data") {
            const mkt = await this.getMarketData(action.args.drug_name);
            toolResult = JSON.stringify(mkt);
        } else if (action.tool === "direct_reply") {
            if (action.args?.answer) return { reply: action.args.answer, sources: ["Gemini AI"] };
        }

        // Final Synthesis
        const finalPrompt = [
            { role: "system", content: SYSTEM_PROMPT_PHARMACIST },
            { role: "user", content: `Query: "${contextMessage}"\n\nTool Used: ${action.tool}\nResult: ${toolResult}` }
        ];

        const reply = await callGroqAI(finalPrompt);
        
        const finalAction = (action.tool !== "direct_reply") ? {
            type: action.tool.toUpperCase(),
            payload: action.args
        } : undefined;

        return { 
            reply, 
            sources: ["Gemini AI (Local Tools)"],
            action: finalAction as any,
            navigationPath: action.tool === "navigate" ? action.args.path : undefined
        };
    },

    async _injectContext(message: string, shopId: string): Promise<string> {
        try {
            // FIX: Add a 3s timeout to context fetching so the AI doesn't hang if DB is slow
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const { data: lowStock } = await supabase
                .from('inventory')
                .select('medicine_name, quantity')
                .eq('shop_id', shopId)
                .lt('quantity', 15)
                .limit(5)
                .abortSignal(controller.signal);
            
            clearTimeout(timeoutId);

            let ctx = message;
            if (lowStock?.length) {
                const stockList = lowStock.map(i => `${i.medicine_name}(${i.quantity})`).join(', ');
                ctx = `[Context: Low stock items: ${stockList}]\n\n${message}`;
            }
            return ctx;
        } catch (err) { 
            logger.warn("AI Context Injection skipped (DB timeout or error):", err);
            return message; 
        }
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
            const res = await callGroqAI(prompt, "llama-3.3-70b-versatile", true);
            return safeJSONParse(res, { items: [] });
        } catch (error) {
            logger.error("[Voice] parseOrderFromText AI parsing failed:", error);
            return { items: [] };
        }
    },

    async analyzeDocument(file: File, type: any) {
        return analyzeDocImpl(file, type);
    },

    /**
     * Drug compliance check — powered by local Gemini AI
     * Replaces the deprecated N8N webhook endpoint.
     */
    async checkCompliance(drugName: string): Promise<ComplianceResult> {
        checkConnectivity();
        const prompt = [
            {
                role: "system",
                content: `You are a pharmaceutical compliance expert for the Indian market (CDSCO/DPCO regulations).
Check if the given drug is banned, restricted, or has regulatory issues in India.
Return ONLY valid JSON:
{
  "is_banned": boolean,
  "reason": "string explanation",
  "schedule": "H/H1/X/OTC/None",
  "requires_prescription": boolean,
  "storage_conditions": "string",
  "max_retail_governed": boolean
}`
            },
            { role: "user", content: `Check compliance status for: ${drugName}` }
        ];
        const res = await callGroqAI(prompt, "llama-3.3-70b-versatile", true);
        return safeJSONParse(res, { is_banned: false, reason: "Unable to determine", schedule: "Unknown" });
    },

    /**
     * Market data & substitute intelligence — powered by local Gemini AI
     * Replaces the deprecated N8N webhook endpoint.
     */
    async getMarketData(drugName: string): Promise<MarketData> {
        checkConnectivity();
        const prompt = [
            {
                role: "system",
                content: `You are a pharmaceutical market intelligence system for the Indian pharma market.
For the given drug, provide market data including generic substitutes with pricing.
Return ONLY valid JSON:
{
  "drug_name": "string",
  "avg_market_price": number,
  "substitutes": [
    {
      "name": "Brand Name",
      "generic_name": "Generic Name",
      "price": number,
      "margin_percentage": number,
      "manufacturer": "string"
    }
  ],
  "market_trend": "stable|rising|declining",
  "availability": "high|medium|low"
}`
            },
            { role: "user", content: `Market data for: ${drugName}` }
        ];
        const res = await callGroqAI(prompt, "llama-3.3-70b-versatile", true);
        return safeJSONParse(res, { drug_name: drugName, substitutes: [], market_trend: "stable" });
    },

    async checkInteractions(drugs: string[]): Promise<{ warnings: string[] }> {
        const prompt = [
            { role: "system", content: "You are a clinical pharmacist AI. Check for major drug interactions among the following medications. Return ONLY a valid JSON object with a 'warnings' array containing short descriptions of major interactions. If safe, return { \"warnings\": [] }." },
            { role: "user", content: drugs.join(", ") }
        ];
        try {
            const res = await callGroqAI(prompt, "llama-3.3-70b-versatile", true);
            return safeJSONParse(res, { warnings: [] });
        } catch { return { warnings: [] }; }
    },

    async getGenericSubstitutes(medicineName: string): Promise<any[]> {
        const prompt = [
            { role: "system", content: "You are a pharma generic recommender for Indian market. For the given drug, return generic alternatives that are cheaper or have a better profit margin. Return ONLY a valid JSON array of objects with keys 'name' and 'margin' (percentage number) under a 'substitutes' array. E.g. { \"substitutes\": [ { \"name\": \"Generic Name\", \"margin\": 25 } ] }" },
            { role: "user", content: medicineName }
        ];
        try {
            const res = await callGroqAI(prompt, "llama-3.3-70b-versatile", true);
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
        const res = await callGroqAI(prompt, "llama-3.3-70b-versatile", true);
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
- Low Stock: ${lowStock.join(', ') || 'None'}
- Near Expiry: ${nearExpiry.join(', ') || 'None'}
` 
                }
            ];

            return await callGroqAI(prompt);
        } catch {
            return "Bhaiya, data fetch karne mein thodi problem hui, par aapki sale badhiya chal rahi hai! Kaam shuru karte hain.";
        }
    },

    /**
     * AI-Powered Demand Forecast — replaces N8N forecast endpoint
     */
    async getInventoryForecast(inventoryData: { medicine_name: string; quantity: number; avg_daily_sales?: number }[]): Promise<any> {
        const prompt = [
            {
                role: "system",
                content: `You are a pharmacy inventory demand forecasting AI for Indian medical shops.
Analyze the provided inventory data and predict which items need reordering.
Return ONLY valid JSON:
{
  "forecast": [
    {
      "medicine_name": "string",
      "current_stock": number,
      "predicted_daily_demand": number,
      "days_until_stockout": number,
      "recommended_order_qty": number,
      "urgency": "critical|high|medium|low",
      "reason": "brief explanation"
    }
  ],
  "summary": "brief overall summary"
}`
            },
            {
                role: "user",
                content: `Inventory data:\n${inventoryData.map(i => `${i.medicine_name}: ${i.quantity} units (avg daily: ${i.avg_daily_sales || 'unknown'})`).join('\n')}`
            }
        ];

        const res = await callGroqAI(prompt, "llama-3.3-70b-versatile", true);
        return safeJSONParse(res, { forecast: [], summary: "Unable to generate forecast" });
    },

    /**
     * AI-Powered Sales Pulse Analysis
     * Analyzes historical sales to find high-velocity items and trends.
     */
    async analyzeSalesPulse(salesData: any[]): Promise<{ insight: string; action: string }> {
        const prompt = [
            {
                role: "system",
                content: `You are a Retail Intelligence AI for a pharmacy. 
Analyze the provided sales data (JSON format) and identify one major trend or high-demand medicine.
Provide a clear insight and a recommended action.
Return ONLY valid JSON:
{
  "insight": "Short trend summary",
  "action": "Recommended inventory action"
}`
            },
            {
                role: "user",
                content: `Sales Data (Last 30 days): ${JSON.stringify(salesData.slice(0, 50))}` // Limit payload
            }
        ];

        try {
            const res = await callGroqAI(prompt, "llama-3.3-70b-versatile", true);
            return safeJSONParse(res, { 
                insight: "Stable sales observed.", 
                action: "Continue regular stock monitoring." 
            });
        } catch {
            return { 
                insight: "Data analysis unavailable.", 
                action: "Please check stock manually." 
            };
        }
    }
};

export { safeJSONParse, ENDPOINTS };
