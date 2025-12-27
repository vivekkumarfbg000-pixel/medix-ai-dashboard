
import { supabase } from "@/integrations/supabase/client";

// Configuration from Environment
const N8N_WEBHOOK_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || "https://primary-production-4416.up.railway.app/webhook"; // Default to a placeholder or user's provided URL if known

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

            const payload = { query: message, image };

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
            return {
                reply: "I am currently running in **Offline Mode**. My connection to the Medical Brain (n8n) is interpreted. Please check your internet or server configuration.\n\n*Simulated Answer*: Please consult a doctor for '" + message + "'.",
                sources: ["System Alert"]
            };
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
            // For MVP with RLS, if n8n has a service role or if we use signed URL:
            const { data: urlData } = await supabase.storage
                .from('clinical-uploads')
                .createSignedUrl(filePath, 300); // 5 mins access

            if (!urlData?.signedUrl) throw new Error("Failed to generate access URL");

            // 3. Trigger n8n Webhook
            const webhookEndpoint = type === 'prescription' ? '/analyze-prescription' : '/analyze-report';
            const response = await fetch(`${N8N_WEBHOOK_BASE}${webhookEndpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileUrl: urlData.signedUrl, userId: (await supabase.auth.getUser()).data.user?.id }),
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
            console.warn("Using offline interaction logic");
            return []; // Return empty or offline fallback
        }
    },

    /**
     * Market Intelligence (Price & Substitutes)
     */
    async getMarketData(drugName: string): Promise<any> {
        try {
            const response = await fetch(`${N8N_WEBHOOK_BASE}/market-intel`, {
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
            return { is_banned: false, reason: "Offline Check Mode", is_h1: false };
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
    }
};
