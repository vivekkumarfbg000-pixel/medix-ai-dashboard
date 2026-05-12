import { logger } from "@/utils/logger";

export const safeJSONParse = (text: string, fallback: any = null): any => {
    if (!text || typeof text !== 'string') return text || fallback;
    
    try {
        return JSON.parse(text);
    } catch {
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(clean);
        } catch {
            try {
                const jsonMatch = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
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
