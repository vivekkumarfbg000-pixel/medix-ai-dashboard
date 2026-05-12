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
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

export async function retryWithBackoff<T>(
    fn: () => Promise<T>, 
    maxAttempts: number = 3, 
    delay: number = 1000
): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const isRetryable = error.message?.includes("503") || 
                               error.message?.includes("429") || 
                               error.message?.includes("timeout") ||
                               error.name === "AbortError";
            
            if (isRetryable && attempt < maxAttempts) {
                const backoff = delay * Math.pow(2, attempt - 1);
                logger.warn(`AI Retry Attempt ${attempt}/${maxAttempts} after ${backoff}ms due to: ${error.message}`);
                await new Promise(r => setTimeout(r, backoff));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
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
    const aiUrl = import.meta.env.VITE_AI_URL;
    if (aiUrl) return aiUrl;
    const isNative = Capacitor.isNativePlatform();
    if (isNative) return 'https://medixai.shop/gemini-proxy';
    return typeof window !== 'undefined' ? '/gemini-proxy' : 'https://generativelanguage.googleapis.com';
}

/** Resolve the Groq proxy base URL based on platform */
function getGroqBaseUrl(): string {
    const aiUrl = import.meta.env.VITE_AI_URL;
    if (aiUrl) return aiUrl;
    const isNative = Capacitor.isNativePlatform();
    if (isNative) return 'https://medixai.shop/groq-proxy';
    return typeof window !== 'undefined' ? '/groq-proxy' : 'https://api.groq.com';
}

export async function callGeminiVision(prompt: string, base64Image: string, mimeType: string = "image/jpeg"): Promise<string> {
    try {
        checkConnectivity();

        let endpoint = `${getGeminiBaseUrl()}/v1beta/models/gemini-2.0-flash:generateContent`;
        const fallbackKey = atob("QUl6YVN5Qk52Rl8yS2R0dXdoQXVoMXo5QXZERl80Q1BKU1JaYWNB");
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || fallbackKey;
        const aiUrl = import.meta.env.VITE_AI_URL;
        const headers: any = { "Content-Type": "application/json" };
        
        if (aiUrl) {
            // LiteLLM / OpenAI compatible endpoint
            endpoint = `${aiUrl}/chat/completions`;
        } else if (apiKey) {
            endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        }

        const body = aiUrl ? {
            model: "gemini-2.0-flash",
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                ]
            }]
        } : {
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType, data: base64Image } }
                ]
            }]
        };

        const response = await fetchWithTimeout(
            endpoint,
            {
                method: "POST",
                headers,
                body: JSON.stringify(body)
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
 * Gemini text-only call — CORS-safe direct API with ?key= param.
 * Used as primary for production and fallback when Groq proxy is unavailable.
 */
export async function callGeminiText(messages: any[], jsonMode: boolean = false): Promise<string> {
    checkConnectivity();

    const fallbackKey = atob("QUl6YVN5Qk52Rl8yS2R0dXdoQXVoMXo5QXZERl80Q1BKU1JaYWNB");
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || fallbackKey;
    const aiUrl = import.meta.env.VITE_AI_URL;
    let endpoint: string;
    const headers: any = { "Content-Type": "application/json" };

    if (aiUrl) {
        endpoint = `${aiUrl}/chat/completions`;
    } else if (apiKey) {
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    } else {
        endpoint = `${getGeminiBaseUrl()}/v1beta/models/gemini-2.0-flash:generateContent`;
    }

    // Build body: Gemini native format vs OpenAI format for LiteLLM
    const isNativeGemini = !aiUrl;
    let body: any;
    if (isNativeGemini) {
        // Convert OpenAI-style messages to Gemini format
        const systemInstruction = messages.find(m => m.role === 'system')?.content;
        const chatMessages = messages.filter(m => m.role !== 'system');
        body = {
            contents: chatMessages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }))
        };
        if (systemInstruction) {
            body.system_instruction = { parts: [{ text: systemInstruction }] };
        }
        if (jsonMode) {
            body.generationConfig = { responseMimeType: "application/json" };
        }
    } else {
        body = { model: "gemini-2.0-flash", messages };
        if (jsonMode) body.response_format = { type: "json_object" };
    }

    const response = await fetchWithTimeout(
        endpoint,
        { method: "POST", headers, body: JSON.stringify(body) },
        25000
    );

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Text Failed (${response.status}): ${errText.substring(0, 150)}`);
    }

    const data = await response.json();
    // Handle both Gemini native and OpenAI response formats
    return data.candidates?.[0]?.content?.parts?.[0]?.text
        || data.choices?.[0]?.message?.content
        || "";
}

/**
 * Primary AI call — tries Groq proxy first, auto-falls back to Gemini direct.
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
    const groqKey = import.meta.env.VITE_GROQ_API_KEY;
    const aiUrl = import.meta.env.VITE_AI_URL;
    const headers: any = { "Content-Type": "application/json" };
    
    if (aiUrl) {
        endpoint = `${aiUrl}/chat/completions`;
    }
    // Note: Do NOT switch to direct Groq when apiKey is present — Groq blocks browser CORS.
    // The proxy path /groq-proxy handles auth via Cloudflare Worker secrets.

    try {
        return await retryWithBackoff(async () => {
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
                // Special handling for 429 (Rate Limit) to trigger retry
                if (response.status === 429 || response.status >= 500) {
                    throw new Error(`Groq API Error (${response.status}): ${errText.substring(0, 50)}`);
                }
                
                logger.warn(`Groq proxy failed (${response.status}), falling back to Gemini: ${errText.substring(0, 100)}`);
                return await callGeminiText(messages, jsonMode);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "";
        });
    } catch (groqError: any) {
        logger.warn(`Groq call failed permanently: ${groqError.message}, falling back to Gemini`);
        return await callGeminiText(messages, jsonMode);
    }
}

export async function callGroqWhisper(audioBlob: Blob): Promise<string> {
    checkConnectivity();

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("response_format", "json");

    let endpoint = `${getGroqBaseUrl()}/openai/v1/audio/transcriptions`;
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    const aiUrl = import.meta.env.VITE_AI_URL;
    const headers: any = {};
    
    if (aiUrl) {
        endpoint = `${aiUrl}/audio/transcriptions`;
    } else if (apiKey) {
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

import { safeJSONParse } from "@/utils/jsonHelpers";
export { safeJSONParse };
