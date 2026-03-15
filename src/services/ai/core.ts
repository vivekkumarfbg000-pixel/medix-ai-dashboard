import logger from "@/utils/logger";

// Rate limiting configuration
const requestCache = new Map<string, number>();
const RATE_LIMIT_MS = 1000; 

// Configuration from Environment
export const N8N_BASE = (import.meta.env.VITE_N8N_WEBHOOK_URL || "https://n8n.medixai.shop/webhook").trim();
export const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY || "").trim();
export const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();

export const ENDPOINTS = {
    CHAT: `${N8N_BASE}/medix-chat-v2`,
    INTERACTIONS: `${N8N_BASE}/medix-interactions-v5`,
    MARKET: `${N8N_BASE}/medix-market-v5`,
    COMPLIANCE: `${N8N_BASE}/medix-compliance-v5`,
    FORECAST: `${N8N_BASE}/medix-forecast-v5`,
    OPS: `${N8N_BASE}/operations`,
    ANALYZE_PRESCRIPTION: `${N8N_BASE}/analyze-prescription`
};

export function checkConnectivity(): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error("You are offline. Please check your internet connection.");
    }
}

export async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 15000): Promise<Response> {
    if (url.includes('n8n') || url.includes('webhook')) {
        // [CRITICAL FIX]: If n8n host is known to be buggy, we could force fallback here.
    }

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

export function checkRateLimit(endpoint: string): boolean {
    const lastRequest = requestCache.get(endpoint);
    const now = Date.now();

    if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
        return false;
    }

    requestCache.set(endpoint, now);
    return true;
}

export async function callGeminiVision(prompt: string, base64Image: string): Promise<string> {
    try {
        checkConnectivity();

        if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 20) {
            logger.error("[Gemini Vision] API key missing or invalid!");
            throw new Error("Gemini API key is not configured.");
        }

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
            45000
        );

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini API Failed (${response.status}): ${err.substring(0, 100)}`);
        }

        const data = await response.json();
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return result;

    } catch (e: any) {
        throw new Error(`Vision Analysis Failed: ${e.message}`);
    }
}

export async function callGroqAI(messages: any[], model: string = "llama-3.3-70b-versatile", jsonMode: boolean = false): Promise<string> {
    const makeRequest = async (currentModel: string) => {
        checkConnectivity();

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
                    max_tokens: 1024,
                    response_format: jsonMode ? { type: "json_object" } : undefined
                })
            },
            15000
        );

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API Failed: ${response.status} - ${err}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "";
    };

    try {
        return await makeRequest(model);
    } catch (e) {
        try {
            return await makeRequest("llama-3.1-8b-instant");
        } catch (fallbackError) {
            throw fallbackError;
        }
    }
}

export const safeJSONParse = (text: string, fallback: any = null): any => {
    try {
        return JSON.parse(text);
    } catch {
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(clean);
        } catch {
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
