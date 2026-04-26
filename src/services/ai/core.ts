import logger from "@/utils/logger";
import { Capacitor } from "@capacitor/core";

// Rate limiting configuration
const requestCache = new Map<string, number>();
const RATE_LIMIT_MS = 1000; 

// ── ENDPOINTS ────────────────────────────────────────────────────────────────
// Local AI (Gemini) is the primary intelligence engine.
// N8N webhooks have been removed — all AI tasks run via Gemini proxy.
export const ENDPOINTS = {
    // Legacy keys kept for compatibility but all resolve to Gemini calls
    CHAT: 'gemini-chat',
    INTERACTIONS: 'gemini-interactions',
    MARKET: 'gemini-market',
    COMPLIANCE: 'gemini-compliance',
    FORECAST: 'gemini-forecast',
    OPS: 'gemini-ops',
    ANALYZE_PRESCRIPTION: 'gemini-prescription'
};

export function checkConnectivity(): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error("You are offline. Please check your internet connection.");
    }
}

export async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 15000): Promise<Response> {
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

/** Resolve the Gemini proxy base URL based on platform */
function getGeminiBaseUrl(): string {
    const isNative = Capacitor.isNativePlatform();
    if (isNative) return 'https://medixai.shop/gemini-proxy';
    return typeof window !== 'undefined' ? '/gemini-proxy' : 'https://generativelanguage.googleapis.com';
}

/** Resolve the Groq proxy base URL based on platform */
function getGroqBaseUrl(): string {
    const isNative = Capacitor.isNativePlatform();
    if (isNative) return 'https://medixai.shop/groq-proxy';
    return typeof window !== 'undefined' ? '/groq-proxy' : 'https://api.groq.com';
}

export async function callGeminiVision(prompt: string, base64Image: string, mimeType: string = "image/jpeg"): Promise<string> {
    try {
        checkConnectivity();

        let endpoint = `${getGeminiBaseUrl()}/v1beta/models/gemini-2.0-flash:generateContent`;
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const headers: any = { "Content-Type": "application/json" };
        
        if (apiKey) {
            endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        }

        const response = await fetchWithTimeout(
            endpoint,
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: base64Image } }
                        ]
                    }]
                })
            },
            45000
        );

        if (!response.ok) {
            const errText = await response.text();
            let errorMessage = errText;
            try {
                const errJson = JSON.parse(errText);
                errorMessage = errJson.message || errJson.error || errText;
            } catch (_e) {
                // Not JSON
            }
            throw new Error(`Vision API Failed (${response.status}): ${String(errorMessage).substring(0, 150)}`);
        }

        const data = await response.json();
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return result;

    } catch (e: any) {
        throw new Error(`Vision Analysis Failed: ${e.message}`);
    }
}

/**
 * Primary AI call — routes through Groq AI for fast text operations.
 */
export async function callGroqAI(messages: any[], model: string = "llama-3.3-70b-versatile", jsonMode: boolean = false): Promise<string> {
    checkConnectivity();

    const payload: any = {
        model: model,
        messages: messages,
    };
    
    if (jsonMode) {
        payload.response_format = { type: "json_object" };
    }

    let endpoint = `${getGroqBaseUrl()}/openai/v1/chat/completions`;
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    const headers: any = { "Content-Type": "application/json" };
    
    if (apiKey) {
        endpoint = `https://api.groq.com/openai/v1/chat/completions`;
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetchWithTimeout(
        endpoint,
        {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        },
        20000
    );

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq AI Failed (${response.status}): ${errText.substring(0, 150)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

export async function callGroqWhisper(audioBlob: Blob): Promise<string> {
    checkConnectivity();

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("response_format", "json");

    let endpoint = `${getGroqBaseUrl()}/openai/v1/audio/transcriptions`;
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    const headers: any = {};
    
    if (apiKey) {
        endpoint = `https://api.groq.com/openai/v1/audio/transcriptions`;
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetchWithTimeout(
        endpoint,
        {
            method: "POST",
            headers,
            body: formData
        },
        30000
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Whisper API Failed: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.text || "";
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
            } catch (_e) {
                logger.warn("JSON Parse Failed completely:", text.substring(0, 100));
            }
        }
    }
    return fallback;
};
