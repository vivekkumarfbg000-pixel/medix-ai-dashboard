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
        logger.error("[AI Vision] Gemini failed, retrying with simplified prompt...", error);
        // Retry with a simpler prompt as fallback
        try {
            const simplePrompt = type === 'prescription' 
                ? "Extract all medicine names, dosages, and instructions from this prescription image. Return JSON with a 'medicines' array."
                : type === 'lab_report'
                ? "Extract all test results with values, units, and normal ranges from this lab report. Return JSON with a 'test_results' array."
                : "Extract all items, quantities, and prices from this document. Return JSON with an 'items' array.";
            
            const retryRes = await callGeminiVision(
                simplePrompt + "\n\nReturn ONLY raw JSON. No markdown.",
                base64Data,
                mimeType
            );
            const retryParsed = safeJSONParse(retryRes, null);
            if (retryParsed) {
                let normalized = retryParsed;
                if (Array.isArray(retryParsed)) {
                    if (type === 'lab_report') normalized = { test_results: retryParsed };
                    else if (type === 'diary') normalized = { entries: retryParsed };
                    else normalized = { items: retryParsed };
                }
                return { ...normalized, isMock: false };
            }
            throw new Error("Retry also failed to produce valid JSON");
        } catch (retryError) {
            logger.error("[AI Vision] All AI attempts failed", retryError);
            throw new Error("Document analysis failed. Please try again with a clearer image.");
        }
    }
};

const getVisionPrompt = (type: string) => {
    if (type === 'lab_report') return LAB_REPORT_PROMPT;
    if (type === 'diary') return DIARY_ANALYSIS_PROMPT;
    return PRESCRIPTION_ANALYSIS_PROMPT;
};
