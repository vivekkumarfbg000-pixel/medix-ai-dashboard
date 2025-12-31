import { supabase } from "@/integrations/supabase/client";

// Configuration from Environment (Fallback to Hardcoded for Stability)
// Using the N8N Cloud URLs directly as confirmed from user workflows
const N8N_BASE = "https://vivek2073.app.n8n.cloud/webhook";

// Specific Workflow Routes - Aligned with JSON Workflows
const ENDPOINTS = {
    CHAT: `${N8N_BASE}/chat`,                  // medix-integrated-workflow.json
    INTERACTIONS: `${N8N_BASE}/interactions`, // medix-background-workflow.json (added)
    MARKET: `${N8N_BASE}/market`,             // medix-background-workflow.json
    COMPLIANCE: `${N8N_BASE}/compliance-check`,// medix-background-workflow.json (added)
    // Operations actions: scan-medicine, scan-diary, voice-bill, scan-parcha
    OPS: `${N8N_BASE}/operations`             // medix-operations-workflow.json
};

interface ChatResponse {
    reply: string;
    sources?: string[];
}

export const aiService = {
    /**
     * Universal AI Query Handler
     * Routes simple queries to Edge Functions (future) and complex ones to n8n.
     */
    async chatWithAgent(message: string, image?: string): Promise<ChatResponse> {
        try {
            // Step 1: Get Context (User & Shop)
            const { data: { user } } = await supabase.auth.getUser();
            const shopId = localStorage.getItem("currentShopId");

            const payload = {
                query: message,
                image,
                userId: user?.id,
                shopId: shopId
            };

            const response = await fetch(ENDPOINTS.CHAT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error(`AI Agent Unreachable: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("AI Service Error (Chat):", error);
            throw error; // Let UI handle the error
        }
    },

    /**
     * Secure Clinical Document Upload & Analysis
     * Uploads to Supabase Storage (RLS Protected) -> Sends URL to n8n for OCR.
     */
    async analyzeDocument(file: File, type: 'prescription' | 'lab_report' | 'invoice'): Promise<any> {
        try {
            // 1. Upload to Supabase Storage 'clinical-uploads' bucket
            const fileExt = file.name.split('.').pop();
            const fileName = `${type}_${Date.now()}.${fileExt}`;
            const filePath = `${(await supabase.auth.getUser()).data.user?.id}/${fileName}`;

            const { data, error: uploadError } = await supabase.storage
                .from('clinical-uploads')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public/Signed URL (Signed is better for privacy, but n8n needs access)
            const { data: urlData } = await supabase.storage
                .from('clinical-uploads')
                .createSignedUrl(filePath, 300); // 5 mins access

            if (!urlData?.signedUrl) throw new Error("Failed to generate access URL");

            // 3. Trigger n8n Ops Webhook
            // Mapping: 
            // 'prescription' -> 'scan-parcha'
            // 'lab_report' -> 'scan-report'
            // 'invoice' -> 'scan-medicine'
            let action = 'scan-report'; // default
            if (type === 'prescription') action = 'scan-parcha';
            if (type === 'invoice') action = 'scan-medicine';

            // Use OPS endpoint for file routing
            const response = await fetch(ENDPOINTS.OPS, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: action, // <--- Routing Key
                    fileUrl: urlData.signedUrl,
                    image_base64: null,
                    userId: (await supabase.auth.getUser()).data.user?.id,
                    shopId: localStorage.getItem("currentShopId")
                }),
            });

            if (!response.ok) throw new Error("Analysis Engine Failed");
            return await response.json();

        } catch (error) {
            console.error("Document Analysis Failed:", error);
            throw error; // Fail loudly so user knows upload/scan failed
        }
    },

    /**
     * Generic Operation Trigger (for Lab Analyzer etc)
     */
    async triggerOp(action: string, payload: any): Promise<any> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const shopId = localStorage.getItem("currentShopId");

            const finalBody = {
                ...payload,
                action: action,
                userId: user?.id,
                shopId: shopId
            };

            const response = await fetch(ENDPOINTS.OPS, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalBody),
            });

            if (!response.ok) throw new Error(`Ops Trigger Failed: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Trigger Op Failed:", error);
            throw error;
        }
    },

    /**
     * Interaction Checker (n8n / External API)
     */
    async checkInteractions(drugs: string[]): Promise<any[]> {
        if (drugs.length < 2) return [];
        try {
            const response = await fetch(ENDPOINTS.INTERACTIONS, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drugs }),
            });
            if (!response.ok) throw new Error("Interaction Check Failed");
            const data = await response.json();
            return data.interactions || [];
        } catch (e) {
            console.error("Interaction Check Failed", e);
            throw e;
        }
    },

    /**
     * Market Intelligence (Price & Substitutes)
     */
    async getMarketData(drugName: string): Promise<any> {
        try {
            // FIXED: Updated endpoint to match market_intel.json
            const response = await fetch(ENDPOINTS.MARKET, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drugName }),
            });
            if (!response.ok) throw new Error("Market Intel Failed");
            return await response.json();
        } catch (e) {
            console.error("Market Intel unavailable", e);
            throw e;
        }
    },

    /**
     * Compliance & Banned Drug Check
     */
    async checkCompliance(drugName: string): Promise<any> {
        try {
            const response = await fetch(ENDPOINTS.COMPLIANCE, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drugName }),
            });
            if (!response.ok) throw new Error("Compliance Check Failed");
            return await response.json();
        } catch (e) {
            console.error("Compliance Check Failed", e);
            throw e;
        }
    },

    /**
     * Inventory Forecasting
     */
    async getInventoryForecast(salesHistory: any[]): Promise<any> {
        const FORECAST_URL = `${N8N_BASE}/forecast`;
        try {
            const response = await fetch(FORECAST_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ salesHistory }),
            });
            if (!response.ok) throw new Error("Forecasting Engine Failed");
            return await response.json();
        } catch (e) {
            console.error("Forecasting Engine Failed", e);
            throw e;
        }
    },

    /**
     * New: Voice Billing Integration
     */
    async processVoiceBill(audioBlob: Blob): Promise<any> {
        try {
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

            const response = await fetch(ENDPOINTS.OPS, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error("Voice Billing Agent Failed");

            const result = await response.json();

            // Map Supabase 'order_items' to 'items' for VoiceCommandBar
            // Result is likely an array of inserted rows
            if (Array.isArray(result) && result[0]?.order_items) {
                const parsedItems = typeof result[0].order_items === 'string'
                    ? JSON.parse(result[0].order_items)
                    : result[0].order_items;
                return { items: parsedItems, transcription: "Voice Order Processed" }; // Mock transcription
            }

            return result;
        } catch (e) {
            console.error("Voice Bill Failed", e);
            throw e;
        }
    }
};
