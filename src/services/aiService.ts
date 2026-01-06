import { supabase } from "@/integrations/supabase/client";

// Configuration from Environment
// Using the N8N Cloud URLs directly
const N8N_BASE = "https://vivek2073.app.n8n.cloud/webhook";

// Specific Workflow Routes
export const ENDPOINTS = {
    CHAT: `${N8N_BASE}/medix-chat-v2`,           // Integrates with production medix-chat workflow
    INTERACTIONS: `${N8N_BASE}/medix-interactions-v5`, // Renamed for uniqueness
    MARKET: `${N8N_BASE}/medix-market-v5`,             // Renamed for uniqueness
    COMPLIANCE: `${N8N_BASE}/medix-compliance-v5`,      // Renamed for uniqueness
    FORECAST: `${N8N_BASE}/medix-forecast-v5`,    // Added missing endpoint
    OPS: `${N8N_BASE}/operations`             // medix-operations-workflow.json
};

interface ChatResponse {
    reply: string;
    sources?: string[];
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
            console.error("Failed to parse N8N response:", text);
            throw new Error("Invalid format received from AI Agent");
        }
    }

    if (parsed && (parsed.error || parsed.message === "Webhook call failed")) {
        console.error("N8N Error Details:", parsed);
        throw new Error(parsed.error || parsed.message || "AI Service Error: Webhook Failed");
    }

    return parsed;
};

export const aiService = {
    /**
     * Universal AI Query Handler (Chat)
     */
    async chatWithAgent(message: string, image?: string): Promise<ChatResponse> {
        // Step 1: Get Context (User & Shop)
        const { data: { user } } = await supabase.auth.getUser();
        const shopId = localStorage.getItem("currentShopId");

        const payload = {
            query: message,
            image: image ? (image.includes(',') ? image.split(',')[1] : image) : undefined,
            userId: user?.id,
            shopId: shopId
        };

        console.log("[N8N Request] Chat:", payload);
        const response = await fetch(ENDPOINTS.CHAT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`AI Agent Unreachable: ${response.status}`);
        const data = await response.json();
        console.log("[N8N Response] Chat:", data);

        if (data.error) {
            throw new Error(data.error);
        }

        // Normalize N8N Response (Handle 'output' vs 'reply')
        if (data.output && !data.reply) {
            data.reply = data.output;
        }

        return data;
    },

    /**
     * Secure Clinical Document Upload & Analysis
     */
    async analyzeDocument(file: File, type: 'prescription' | 'lab_report' | 'invoice'): Promise<any> {
        // 1. Upload to Supabase Storage 'clinical-uploads' bucket (Backup/Log)
        const fileExt = file.name.split('.').pop();
        const fileName = `${type}_${Date.now()}.${fileExt}`;
        const filePath = `${(await supabase.auth.getUser()).data.user?.id}/${fileName}`;

        // Non-blocking upload (fire and forget for speed, or await if critical)
        supabase.storage
            .from('clinical-uploads')
            .upload(filePath, file)
            .then(({ error }) => {
                if (error) console.error("Background Upload Failed:", error);
            });

        // 2. Convert to Base64 for N8N (Gemini expects inline data)
        const reader = new FileReader();
        reader.readAsDataURL(file);
        const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
                const result = reader.result as string;
                // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
        });

        // 3. Trigger n8n Ops Webhook
        let action = 'scan-report'; // default
        if (type === 'prescription') action = 'scan-parcha';
        if (type === 'invoice') action = 'scan-medicine';

        console.log("[N8N Request] Analyze Document:", { action, size: base64Data.length });
        const response = await fetch(ENDPOINTS.OPS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: action,
                image_base64: base64Data, // <--- Send Base64 directly
                userId: (await supabase.auth.getUser()).data.user?.id,
                shopId: localStorage.getItem("currentShopId")
            }),
        });

        if (!response.ok) throw new Error("Analysis Engine Failed");

        const text = await response.text();
        if (!text) {
            console.warn("[N8N Response] Analyze Document: Empty Body");
            return { result: "Analysis completed but no data returned." };
        }

        try {
            const resData = JSON.parse(text);
            console.log("[N8N Response] Analyze Document:", resData);
            return resData;
        } catch (e) {
            console.error("Failed to parse N8N response:", text);
            throw new Error("Invalid response from Analysis Engine");
        }
    },

    /**
     * Generic Operation Trigger (for Lab Analyzer etc)
     */
    async triggerOp(action: string, payload: any): Promise<any> {
        const { data: { user } } = await supabase.auth.getUser();
        const shopId = localStorage.getItem("currentShopId");

        const finalBody = {
            ...payload,
            action: action,
            userId: user?.id,
            shopId: shopId
        };

        console.log("[N8N Request] TriggerOp:", finalBody);
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
            console.log("[N8N Response] TriggerOp:", data);
            return data;
        } catch (e) {
            console.error("Failed to parse N8N response:", text);
            throw new Error("Invalid response from AI Agent");
        }
    },

    /**
     * Interaction Checker (n8n / External API)
     */
    async checkInteractions(drugs: string[]): Promise<any[]> {
        if (drugs.length < 2) return [];

        console.log("[N8N Request] Interactions:", { drugs });
        const response = await fetch(ENDPOINTS.INTERACTIONS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ drugs }),
        });
        if (!response.ok) throw new Error("Interaction Check Failed");

        const text = await response.text();
        if (!text) {
            console.error("N8N Interaction Check returned Empty Body");
            throw new Error("Interaction Check: Backend returned empty response. Check n8n workflow.");
        }

        const data = cleanN8NResponse(text);
        console.log("[N8N Response] Interactions:", data);

        // Handle nested output structure
        if (data.output && data.output.interactions) {
            return data.output.interactions;
        }

        return data.interactions || [];
    },

    /**
     * Market Intelligence (Price & Substitutes)
     */
    async getMarketData(drugName: string): Promise<any> {
        console.log("[N8N Request] Market:", { drugName });
        const response = await fetch(ENDPOINTS.MARKET, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ drugName }),
        });
        if (!response.ok) throw new Error("Market Intel Failed");

        const text = await response.text();
        if (!text) {
            console.error("N8N Market Intel returned Empty Body");
            throw new Error("Market Check: Backend returned empty response. Check n8n workflow.");
        }

        const data = cleanN8NResponse(text);
        console.log("[N8N Response] Market:", data);
        return data;
    },

    /**
     * Compliance & Banned Drug Check
     */
    async checkCompliance(drugName: string): Promise<any> {
        console.log("[N8N Request] Compliance:", { drugName });
        const response = await fetch(ENDPOINTS.COMPLIANCE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ drugName }),
        });
        if (!response.ok) throw new Error("Compliance Check Failed");

        const text = await response.text();
        if (!text) {
            console.error("N8N Compliance Check returned Empty Body");
            throw new Error("Compliance Check: Backend returned empty response. Check n8n workflow.");
        }

        const data = cleanN8NResponse(text);
        console.log("[N8N Response] Compliance:", data);
        return data;
    },

    /**
     * Inventory Forecasting
     */
    async getInventoryForecast(salesHistory: any[]): Promise<any> {
        const FORECAST_URL = `${N8N_BASE}/forecast`;
        console.log("[N8N Request] Forecast:", { salesHistory });
        const response = await fetch(FORECAST_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                salesHistory,
                shopId: localStorage.getItem("currentShopId")
            }),
        });
        if (!response.ok) throw new Error("Forecasting Engine Failed");

        const text = await response.text();
        if (!text) {
            console.error("N8N Forecast returned Empty Body");
            throw new Error("Forecasting: Backend returned empty response. Check n8n workflow.");
        }

        const data = cleanN8NResponse(text);
        console.log("[N8N Response] Forecast:", data);
        return data;
    },

    /**
     * Voice Billing Integration
     * Processes voice audio through N8N backend for transcription and parsing
     */
    async processVoiceBill(audioBlob: Blob): Promise<any> {
        const { data: { user } } = await supabase.auth.getUser();
        const shopId = localStorage.getItem("currentShopId");

        // Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
                const result = reader.result as string;
                // Remove data URL prefix (e.g., "data:audio/webm;base64,")
                const base64 = result.split(',')[1];
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

        console.log("[N8N Request] Voice Bill Payload (size):", JSON.stringify(payload).length);
        const response = await fetch(ENDPOINTS.OPS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("Voice Billing Agent Failed");
        const result = await response.json();
        console.log("[N8N Response] Voice Bill:", result);

        // Handle different response formats from n8n
        if (result.transcription && result.items) {
            return result;
        }

        // Map Supabase 'order_items' to 'items' for VoiceCommandBar
        // Result is likely an array of inserted rows
        if (Array.isArray(result) && result[0]?.order_items) {
            const parsedItems = typeof result[0].order_items === 'string'
                ? JSON.parse(result[0].order_items)
                : result[0].order_items;
            return { items: parsedItems, transcription: "Voice Order Processed" };
        }

        return result;
    }
};
