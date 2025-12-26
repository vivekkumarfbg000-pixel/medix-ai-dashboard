export interface N8NConfig {
    baseUrl: string;
}

// Default to a placeholder if not set. User will need to configure this in .env
const ENV_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || "https://your-n8n-instance.com/webhook";

export const n8nService = {
    /**
     * Chat with the Clinical Pharmacist Agent
     * Webhook: /chat
     */
    async chatWithAgent(message: string, image?: string): Promise<{ reply: string; sources?: string[] }> {
        try {
            const response = await fetch(`${ENV_WEBHOOK_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: message,
                    image: image // Base64 string or URL
                }),
            });

            if (!response.ok) throw new Error("n8n Agent unreachable");
            return await response.json();
        } catch (error) {
            console.error("Clinical Agent Error:", error);
            // Fallback for demo if n8n not connected
            return {
                reply: "I'm having trouble connecting to the Clinical Knowledge Base. Please ensure your n8n workflow is active.",
                sources: ["System Error"]
            };
        }
    },

    /**
     * Check Drug Interactions
     * Webhook: /interactions
     */
    async checkInteractions(drugs: string[]): Promise<any[]> {
        if (drugs.length < 2) return [];

        try {
            const response = await fetch(`${ENV_WEBHOOK_URL}/interactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drugs }),
            });

            if (!response.ok) throw new Error("n8n Interaction Check unreachable");
            const data = await response.json();
            return data.interactions || []; // Expecting { interactions: [...] }
        } catch (error) {
            console.error("Interaction Check Error:", error);
            return [];
        }
    },

    // Check Regulatory Status (Satya-Check)
    async checkBannedStatus(drugName: string): Promise<{ is_banned: boolean; is_h1: boolean; reason: string; warning_level: string }> {
        try {
            const response = await fetch(`${ENV_WEBHOOK_URL}/compliance-check`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drugName }),
            });

            if (!response.ok) throw new Error("Compliance Check Failed");
            return await response.json();
        } catch (error) {
            console.error("Compliance Check Failed", error);
            // Fail safe - assume safe but warn
            return { is_banned: false, is_h1: false, reason: "Offline: Could not verify.", warning_level: "LOW" };
        }
    },

    // Get market intelligence (Prices & Substitutes)
    async getMarketData(drugName: string): Promise<any> {
        try {
            const response = await fetch(`${ENV_WEBHOOK_URL}/market-intel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drugName }),
            });

            if (!response.ok) throw new Error("n8n Market Intel unreachable");
            return await response.json();
        } catch (error) {
            console.error("Market Intel Error:", error);
            return null;
        }
    }
};
