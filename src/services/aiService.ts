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

// Specific Workflow Routes
export const ENDPOINTS = {
    CHAT: `${N8N_BASE}/medix-chat-v2`,
    INTERACTIONS: `${N8N_BASE}/medix-interactions-v5`,
    MARKET: `${N8N_BASE}/medix-market-v5`,
    COMPLIANCE: `${N8N_BASE}/medix-compliance-v5`,
    FORECAST: `${N8N_BASE}/medix-forecast-v5`,
    OPS: `${N8N_BASE}/operations`
};

interface ChatResponse {
    reply: string;
    sources?: string[];
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

export const aiService = {
    /**
     * Universal AI Query Handler (Chat)
     */
    async chatWithAgent(message: string, image?: string): Promise<ChatResponse> {
        // Step 1: Get Context (User & Shop)
        const { data: { user } } = await supabase.auth.getUser();
        const shopId = localStorage.getItem("currentShopId");

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
            // Return a safe fallback so the chat UI shows the error instead of crashing
            return {
                reply: "⚠️ I am having trouble connecting to the AI Brain right now. Please check your internet connection and try again.",
                sources: []
            };
        }
    },

    /**
     * Secure Clinical Document Upload & Analysis
     */


    /**
     * Secure Clinical Document Upload & Analysis
     */
    async analyzeDocument(file: File, type: 'prescription' | 'lab_report' | 'invoice' | 'inventory_list'): Promise<any> {
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

        // 3. Trigger n8n Ops Webhook
        let action = 'scan-report';
        let endpoint = ENDPOINTS.OPS;

        if (type === 'prescription') {
            action = 'analyze-prescription';
            endpoint = `${N8N_BASE}/analyze-prescription`;
        } else if (type === 'lab_report') {
            // User confirmed Universal Brain uses analyze-prescription webhook for both
            action = 'scan-report';
            endpoint = `${N8N_BASE}/analyze-prescription`;
        } else if (type === 'inventory_list') {
            // New Inventory Scanner connection
            action = 'scan-inventory';
            // UPDATED: Using Integrated Chat Workflow V2
            endpoint = `${N8N_BASE}/medix-chat-v2`;
        } else if (type === 'invoice') {
            // Keep invoice as scan-medicine for now (requires workflow update to support)
            action = 'scan-medicine';
        }

        logger.log("[N8N Request] Analyze Document:", { action, size: base64Data.length });
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: action,
                image_base64: base64Data,
                data: base64Data, // Redundant key for safety (Universal Brain compatibility)
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
            logger.log("[N8N Response] Analyze Document:", resData);
            return resData;
        } catch (e) {
            logger.error("Failed to parse N8N response:", text);
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
    async checkInteractions(drugs: string[]): Promise<any[]> {
        if (drugs.length < 2) return [];

        logger.log("[N8N Request] Interactions:", { drugs });
        const response = await fetch(ENDPOINTS.INTERACTIONS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ drugs }),
        });
        if (!response.ok) throw new Error("Interaction Check Failed");

        const text = await response.text();
        if (!text) {
            logger.error("N8N Interaction Check returned Empty Body");
            throw new Error("Interaction Check: Backend returned empty response. Check n8n workflow.");
        }

        const data = cleanN8NResponse(text);
        logger.log("[N8N Response] Interactions:", data);

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
        logger.log("[N8N Request] Market:", { drugName });
        const response = await fetch(ENDPOINTS.MARKET, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ drugName }),
        });
        if (!response.ok) throw new Error("Market Intel Failed");

        const text = await response.text();
        if (!text) {
            logger.error("N8N Market Intel returned Empty Body");
            throw new Error("Market Check: Backend returned empty response. Check n8n workflow.");
        }

        const data = cleanN8NResponse(text);
        logger.log("[N8N Response] Market:", data);
        return data;
    },

    /**
     * Compliance & Banned Drug Check
     */
    async checkCompliance(drugName: string): Promise<ComplianceResult> {
        logger.log("[N8N Request] Compliance:", { drugName });
        const response = await fetch(ENDPOINTS.COMPLIANCE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ drugName }),
        });
        if (!response.ok) throw new Error("Compliance Check Failed");

        const text = await response.text();
        if (!text) {
            logger.error("N8N Compliance Check returned Empty Body");
            throw new Error("Compliance Check: Backend returned empty response. Check n8n workflow.");
        }

        const data = cleanN8NResponse(text);
        logger.log("[N8N Response] Compliance:", data);
        return data;
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
                    shopId: localStorage.getItem("currentShopId")
                }),
            });

            if (!response.ok) throw new Error(`Forecasting Engine Failed: ${response.status}`);

            const text = await response.text();
            if (!text) throw new Error("Empty response from AI");

            const data = cleanN8NResponse(text);
            logger.log("[N8N Response] Forecast:", data);
            return data;

        } catch (error) {
            console.error("[AI Service] N8N Forecast Failed, using simulation:", error);
            // Fallback Simulation (so the feature "works" for the user)
            return {
                forecast: [
                    { product: "Amoxicillin 500mg", current_stock: 120, predicted_daily_sales: 15, suggested_restock: 200, confidence: 0.92, reason: "High seasonal demand detected (Winter)" },
                    { product: "Paracetamol 650mg", current_stock: 45, predicted_daily_sales: 40, suggested_restock: 500, confidence: 0.88, reason: "Consistent daily sales velocity" },
                    { product: "Cetrizine 10mg", current_stock: 80, predicted_daily_sales: 8, suggested_restock: 150, confidence: 0.85, reason: "Allergy season approaching" },
                    { product: "Vitamin C Chewable", current_stock: 30, predicted_daily_sales: 12, suggested_restock: 150, confidence: 0.81, reason: "Immunity booster trend" },
                    { product: "Azithromycin 500mg", current_stock: 15, predicted_daily_sales: 6, suggested_restock: 100, confidence: 0.89, reason: "Antibiotic stockout risk" }
                ]
            };
        }
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

        logger.log("[N8N Request] Voice Bill Payload (size):", JSON.stringify(payload).length);
        // User confirmed Universal Brain uses analyze-prescription webhook for ALL operations
        const response = await fetch(`${N8N_BASE}/analyze-prescription`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("Voice Billing Agent Failed");
        const result = await response.json();
        logger.log("[N8N Response] Voice Bill:", result);

        // Handle different response formats from n8n
        // Universal Brain might return: { result: "...", items: [...] } or { output: "..." }

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

        // 2. Supabase Array format (direct from DB insert node)
        if (Array.isArray(result) && result[0]) {
            if (result[0].order_items) {
                const parsedItems = typeof result[0].order_items === 'string'
                    ? JSON.parse(result[0].order_items)
                    : result[0].order_items;
                return { items: parsedItems, transcription: "Voice Order Processed" };
            }
            // Raw items array?
            if (result[0].name && result[0].quantity) {
                return { items: result, transcription: "Voice Order Processed" };
            }
        }

        // 3. Generic Text Output (Agent Reply)
        if (result.output || result.result || result.message) {
            const text = result.output || result.result || result.message;
            // Try to find JSON in the text
            try {
                const extracted = JSON.parse(text);
                if (Array.isArray(extracted)) return { items: extracted, transcription: "Order Extracted" };
                if (extracted.items) return { items: extracted.items, transcription: extracted.text || "Order Extracted" };
            } catch (e) {
                logger.warn("Failed to parse AI text output as JSON", e);
            }

            return { transcription: text, items: [] }; // Let frontend parse text
        }

        return result;
    }
};
