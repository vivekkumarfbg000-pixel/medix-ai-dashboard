
import { supabase } from "@/integrations/supabase/client";

// Configuration from Environment
const N8N_WEBHOOK_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || "https://vivek2073.app.n8n.cloud/webhook";
const N8N_OPS_BASE = import.meta.env.VITE_N8N_OPS_URL || "https://vivek2073.app.n8n.cloud/webhook/medix-ops-webhook/operations";

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
            // Step 1: If image exists, we might need to upload it first or send as base64.
            // For lightweight chat, sending base64 to n8n is okay.

            // Step 1: Get Context (User & Shop)
            const { data: { user } } = await supabase.auth.getUser();
            const shopId = localStorage.getItem("currentShopId");

            const payload = {
                query: message,
                image,
                userId: user?.id,
                shopId: shopId
            };

            const response = await fetch(`${N8N_WEBHOOK_BASE}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error("AI Agent Unreachable");
            return await response.json();
        } catch (error) {
            console.warn("AI Service Error:", error);
            // Fallback Response (Mock)
            throw new Error("AI Service Offline. Please check internet.");
        }
    },

    /**
     * Secure Clinical Document Upload & Analysis
     * Uploads to Supabase Storage (RLS Protected) -> Sends URL to n8n for OCR.
     */
    async analyzeDocument(file: File, type: 'prescription' | 'lab_report'): Promise<any> {
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
            // Mapping: 'prescription' -> 'scan-parcha', others to default or different ops
            const action = type === 'prescription' ? 'scan-parcha' : 'scan-report';

            // FIXED: Send to base URL, put action in BODY
            const response = await fetch(`${N8N_OPS_BASE}`, {
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
            throw error;
        }
    },

    /**
     * Interaction Checker (n8n / External API)
     */
    async checkInteractions(drugs: string[]): Promise<any[]> {
        if (drugs.length < 2) return [];
        try {
            const response = await fetch(`${N8N_WEBHOOK_BASE}/interactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drugs }),
            });
            if (!response.ok) throw new Error("Interaction Check Failed");
            const data = await response.json();
            return data.interactions || [];
        } catch (e) {
            console.warn("Interaction Check Failed");
            throw new Error("Could not verify interactions (Offline)");
        }
    },

    /**
     * Market Intelligence (Price & Substitutes)
     */
    async getMarketData(drugName: string): Promise<any> {
        try {
            const response = await fetch(`${N8N_WEBHOOK_BASE}/market`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drugName }),
            });
            if (!response.ok) throw new Error("Market Intel Failed");
            return await response.json();
        } catch (e) {
            return null;
        }
    },

    /**
     * Compliance & Banned Drug Check
     */
    async checkCompliance(drugName: string): Promise<any> {
        try {
            const response = await fetch(`${N8N_WEBHOOK_BASE}/compliance-check`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drugName }),
            });
            if (!response.ok) throw new Error("Compliance Check Failed");
            return await response.json();
        } catch (e) {
            // Offline Facade
            throw new Error("Compliance Check Failed (Offline)");
        }
    },

    /**
     * Inventory Forecasting
     */
    async getInventoryForecast(salesHistory: any[]): Promise<any> {
        try {
            const response = await fetch(`${N8N_WEBHOOK_BASE}/forecast`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ salesHistory }),
            });
            if (!response.ok) throw new Error("Forecasting Engine Failed");
            return await response.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    /**
     * New: Voice Billing Integration
     */
    async processVoiceBill(audioBlob: Blob): Promise<any> {
        try {
            const formData = new FormData();
            const { data: { user } } = await supabase.auth.getUser();
            const shopId = localStorage.getItem("currentShopId");

            formData.append('file', audioBlob);
            formData.append('action', 'voice-bill');
            if (user?.id) formData.append('userId', user.id);
            if (shopId) formData.append('shopId', shopId);

            // FIXED: Send to base URL (action is in formData)
            const response = await fetch(`${N8N_OPS_BASE}`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Voice Billing Agent Failed");
            return await response.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    }
};
