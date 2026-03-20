import { supabase } from "@/integrations/supabase/client";
import logger from "@/utils/logger";
import imageCompression from "browser-image-compression";
import { 
    checkConnectivity, 
    fetchWithTimeout, 
    ENDPOINTS, 
    callGeminiVision, 
    safeJSONParse 
} from "./core";
import { 
    LAB_REPORT_PROMPT, 
    PRESCRIPTION_ANALYSIS_PROMPT, 
    DIARY_ANALYSIS_PROMPT 
} from "./prompts";

/**
 * VISION & DOCUMENT ANALYSIS MODULE
 * Handles image compression, upload, and AI extraction from prescriptions, reports, etc.
 */

export const analyzeDocument = async (file: File, type: 'prescription' | 'lab_report' | 'invoice' | 'inventory_list' | 'diary'): Promise<any> => {
    // 1. Compress Image
    let fileToUpload = file;
    if (file.type.startsWith('image/')) {
        try {
            const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1920, useWebWorker: true, initialQuality: 0.8 };
            fileToUpload = await imageCompression(file, options);
        } catch (error) {
            logger.warn("[AI Vision] Compression failed", error);
        }
    }

    // 2. Upload to Supabase (Background)
    const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
    let mimeType = fileToUpload.type;
    if (!mimeType) {
        if (fileExt.toLowerCase() === 'png') mimeType = 'image/png';
        else if (fileExt.toLowerCase() === 'webp') mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
    }

    const fileName = `${type}_${Date.now()}.${fileExt}`;
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
            supabase.storage.from('clinical-uploads').upload(`${user.id}/${fileName}`, fileToUpload);
        }
    });

    // 3. Convert to Base64
    const reader = new FileReader();
    reader.readAsDataURL(fileToUpload);
    const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                resolve(result.split(',')[1].replace(/[\r\n\s]+/g, ''));
            } else reject("Base64 failed");
        };
    });

    // 4. Route to Gemini Vision
    try {
        const systemPrompt = getVisionPrompt(type);
        const geminiRes = await callGeminiVision(
            systemPrompt + "\n\nIMPORTANT: Return ONLY raw JSON. No markdown formatting.",
            base64Data,
            mimeType
        );

        const parsed = safeJSONParse(geminiRes, null);
        if (!parsed) throw new Error("Invalid Gemini Response");

        return { ...parsed, isMock: false };

    } catch (error) {
        logger.error("[AI Vision] Gemini failed, attempting N8N fallback...", error);
        return await callN8NVisionFallback(type, base64Data);
    }
};

const getVisionPrompt = (type: string) => {
    if (type === 'lab_report') return LAB_REPORT_PROMPT;
    if (type === 'diary') return DIARY_ANALYSIS_PROMPT;
    return PRESCRIPTION_ANALYSIS_PROMPT;
};

const callN8NVisionFallback = async (type: string, base64: string) => {
    const shopId = localStorage.getItem("currentShopId");
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
        action: type === 'prescription' ? 'analyze-prescription' : 'scan-report',
        image_base64: base64,
        userId: user?.id,
        shopId
    };

    const endpoint = type === 'prescription' ? ENDPOINTS.ANALYZE_PRESCRIPTION : ENDPOINTS.OPS;
    const res = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }, 30000);

    if (!res.ok) throw new Error("All AI routes failed.");
    return res.json();
};
