import logger from "@/utils/logger";
import { Capacitor } from "@capacitor/core";

// Rate limiting configuration
const requestCache = new Map<string, number>();
const RATE_LIMIT_MS = 1000; 

// Configuration from Environment
export const N8N_BASE = (import.meta.env.VITE_N8N_WEBHOOK_URL || "https://n8n.medixai.shop/webhook").trim();

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

export async function callGeminiVision(prompt: string, base64Image: string, mimeType: string = "image/jpeg"): Promise<string> {
    try {
        checkConnectivity();

        const isNative = Capacitor.isNativePlatform();
        const baseUrl = isNative 
            ? 'https://medixai.shop/gemini-proxy' 
            : (typeof window !== 'undefined' ? '/gemini-proxy' : 'https://generativelanguage.googleapis.com');
        
        const response = await fetchWithTimeout(
            `${baseUrl}/v1beta/models/gemini-2.0-flash:generateContent`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
            } catch (e) {
                // Not JSON
            }
            throw new Error(`Vision API Failed (${response.status}): ${errorMessage.substring(0, 150)}`);
        }

        const data = await response.json();
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return result;

    } catch (e: any) {
        throw new Error(`Vision Analysis Failed: ${e.message}`);
    }
}

export async function callGroqAI(messages: any[], model: string = "gemini-2.0-flash", jsonMode: boolean = false): Promise<string> {
    const makeRequest = async () => {
        checkConnectivity();

        const isNative = Capacitor.isNativePlatform();
        const baseUrl = isNative 
            ? 'https://medixai.shop/gemini-proxy' 
            : (typeof window !== 'undefined' ? '/gemini-proxy' : 'https://generativelanguage.googleapis.com');
        
        let systemInstruction = "";
        const contents = [];
        
        for (const msg of messages) {
            if (msg.role === "system") {
                systemInstruction += msg.content + "\n";
            } else {
                contents.push({
                    role: msg.role === "assistant" ? "model" : "user",
                    parts: [{ text: msg.content }]
                });
            }
        }
        
        const payload: any = {
            contents: contents
        };
        
        if (systemInstruction) {
            payload.systemInstruction = { parts: { text: systemInstruction } };
        }
        
        if (jsonMode) {
            payload.generationConfig = { responseMimeType: "application/json" };
        }

        const response = await fetchWithTimeout(
            `${baseUrl}/v1beta/models/gemini-2.0-flash:generateContent`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            },
            15000
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`AI API Failed (${response.status}): ${errText.substring(0, 150)}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    };

    try {
        return await makeRequest();
    } catch (e: any) {
        throw new Error(`Gemini Fallback Failed: ${e.message}`);
    }
}

export async function callGroqWhisper(audioBlob: Blob): Promise<string> {
    checkConnectivity();

    const formData = new FormData();
    // Groq requires a filename with an audio extension
    formData.append("file", audioBlob, "audio.webm");
    // Standard Whisper v3 model
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("response_format", "json");

    const isNative = Capacitor.isNativePlatform();
    const baseUrl = isNative 
        ? 'https://medixai.shop/groq-proxy' 
        : (typeof window !== 'undefined' ? '/groq-proxy' : 'https://api.groq.com');
    const response = await fetchWithTimeout(
        `${baseUrl}/openai/v1/audio/transcriptions`,
        {
            method: "POST",
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
            } catch (e) {
                logger.warn("JSON Parse Failed completely:", text);
            }
        }
    }
    return fallback;
};
