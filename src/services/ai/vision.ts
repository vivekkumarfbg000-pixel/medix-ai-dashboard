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
    // 1. Validate file type — Gemini Vision only accepts images (JPEG, PNG, WEBP, HEIC)
    const originalMime = file.type || '';
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

    // Reject PDFs early — Gemini doesn't support PDF as inline_data
    if (originalMime === 'application/pdf' || fileExt === 'pdf') {
        throw new Error('PDF files are not supported yet. Please take a photo or screenshot of the document and upload that instead.');
    }

    // Derive a valid Gemini-supported MIME type
    let mimeType: string;
    if (originalMime.startsWith('image/')) {
        // Map obscure types to supported ones
        if (originalMime === 'image/heic' || originalMime === 'image/heif') mimeType = 'image/jpeg';
        else if (originalMime === 'image/gif' || originalMime === 'image/bmp' || originalMime === 'image/tiff') mimeType = 'image/jpeg';
        else mimeType = originalMime; // jpeg, png, webp are natively supported
    } else {
        // Infer from extension as fallback
        if (fileExt === 'png') mimeType = 'image/png';
        else if (fileExt === 'webp') mimeType = 'image/webp';
        else if (fileExt === 'heic' || fileExt === 'heif') mimeType = 'image/jpeg';
        else mimeType = 'image/jpeg'; // default safe fallback
    }

    // 2. Compress Image (only for supported image types)
    let fileToUpload = file;
    try {
        const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1920, useWebWorker: true, initialQuality: 0.8 };
        const compressed = await imageCompression(file, options);
        fileToUpload = compressed;
        // After compression, force JPEG if uncertain (compressed files sometimes lose their MIME type)
        if (!fileToUpload.type || fileToUpload.type === 'application/octet-stream') {
            mimeType = 'image/jpeg';
        }
    } catch (error) {
        logger.warn("[AI Vision] Compression failed, using original file", error);
    }

    // 3. Background upload to Supabase storage
    const fileName = `${type}_${Date.now()}.${fileExt}`;
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
            supabase.storage.from('clinical-uploads').upload(`${user.id}/${fileName}`, fileToUpload);
        }
    });

    // 4. Convert to Base64
    const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                resolve(result.split(',')[1].replace(/[\r\n\s]+/g, ''));
            } else reject("Base64 conversion failed");
        };
        reader.onerror = reject;
        reader.readAsDataURL(fileToUpload);
    });

    // 5. Route to Gemini Vision
    try {
        const systemPrompt = getVisionPrompt(type);
        const geminiRes = await callGeminiVision(
            systemPrompt + "\n\nIMPORTANT: Return ONLY raw JSON. No markdown formatting.",
            base64Data,
            mimeType
        );

        const parsed = safeJSONParse(geminiRes, null);
        if (!parsed) throw new Error("Invalid Gemini Response");

        // [HARDENING]: Ensure result is an object, wrap arrays if found
        let normalized = parsed;
        if (Array.isArray(parsed)) {
            if (type === 'lab_report') normalized = { test_results: parsed };
            else if (type === 'diary') normalized = { entries: parsed };
            else normalized = { items: parsed };
        }

        return { ...normalized, isMock: false };

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
