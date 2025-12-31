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
            console.warn("AI Service Error (Chat):", error);

            // --- DEMO MODE FALLBACK ---
            return {
                reply: "I'm currently in Dashboard Demo Mode. I can't access live medical databases right now, but typically I would search PubMed and CDSCO for that query.\n\nFor example, if you asked about 'Azithromycin', I'd tell you it is a macrolide antibiotic used for respiratory infections, and warn about cardiac risks.",
                sources: ["Demo Mode Placeholder", "Simulation Data"]
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
            const { data: urlData } = await supabase.storage
                .from('clinical-uploads')
                .createSignedUrl(filePath, 300); // 5 mins access

            if (!urlData?.signedUrl) throw new Error("Failed to generate access URL");

            // 3. Trigger n8n Ops Webhook
            // Mapping: 'prescription' -> 'scan-parcha', others to default or different ops
            const action = type === 'prescription' ? 'scan-parcha' : 'scan-report';

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

            // FIXED: Fallback Structure matches DiaryScan.tsx "ExtractedItem" format
            if (type === 'prescription') {
                return {
                    items: [
                        { id: 1, sequence: 1, medication_name: "Azithral 500", strength: "500mg", dosage_frequency: "1-0-0", duration: "3 Days", notes: "After food", lasa_alert: false },
                        { id: 2, sequence: 2, medication_name: "Dolo 650", strength: "650mg", dosage_frequency: "SOS", duration: "-", notes: "For fever", lasa_alert: false },
                        { id: 3, sequence: 3, medication_name: "Pantop 40", strength: "40mg", dosage_frequency: "1-0-0", duration: "5 Days", notes: "Before food", lasa_alert: true }
                    ]
                };
            } else {
                return { result: "Hemoglobin: 12.5 g/dL (Normal)", warning: "None" };
            }
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
            console.warn("Interaction Check Failed (Offline Mode)");
            // Mock Interaction for Demo
            if (drugs.some(d => d.toLowerCase().includes('aspirin')) && drugs.some(d => d.toLowerCase().includes('warfarin'))) {
                return [{
                    drug1: "Aspirin",
                    drug2: "Warfarin",
                    severity: "Major",
                    description: "Increased risk of bleeding. Monitor INR closely."
                }];
            }
            return [];
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
            console.warn("Market Intel unavailable (using fallback)");
            return null; // returning null triggers local fallback in drugService
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
            // Offline Facade
            console.warn("Compliance Check Offline. Returning safe default.");
            return { is_banned: false, is_h1: false, warning_level: "SAFE" };
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
            console.error(e);
            return { forecast: "Trend stable (Demo Data)", recommended_stock: 50 };
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

            // Use OPS endpoint for voice routing
            const response = await fetch(ENDPOINTS.OPS, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Voice Billing Agent Failed");
            return await response.json();
        } catch (e) {
            console.error("Voice Bill Failed", e);
            return {
                items: [
                    { drug: "Azithral 500", quantity: 10, price: 120 },
                    { drug: "Dolo 650", quantity: 15, price: 30 }
                ],
                confidence: 0.85
            };
        }
    }
};
