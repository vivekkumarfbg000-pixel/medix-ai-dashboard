import { logger } from "@/utils/logger";

interface TTSOptions {
    rate?: number; // 0.1 to 10
    pitch?: number; // 0 to 2
    volume?: number; // 0 to 1
    lang?: string; // 'en-IN', 'hi-IN'
}

/**
 * Text-to-Speech Utility for Indian Context
 * Ensures numbers are spoken naturally and selects appropriate Indian voices.
 */

/** Returns true if the AI voice/sound is enabled globally */
export const isVoiceEnabled = (): boolean => {
    if (typeof window === 'undefined') return false;
    // Default is ON (enabled) unless explicitly set to "false"
    return localStorage.getItem("MEDIX_AI_VOICE_ENABLED") !== "false";
};

export const speak = (text: string, options: TTSOptions = {}) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        logger.warn("TTS not supported in this browser.");
        return;
    }

    // ✅ CRITICAL FIX: Respect the global voice toggle from Settings
    if (!isVoiceEnabled()) {
        logger.log("[TTS] Voice is muted by user preference. Skipping.");
        return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // 1. Text Normalization for Natural Speech
    const cleanText = text
        .replace(/₹/g, " Rupees ")
        .replace(/Rs\./gi, " Rupees ")
        .replace(/\//g, " per ")
        .replace(/(\d+)-(\d+)/g, "$1 to $2");

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // 2. Defaults - Optimized for Indian context
    utterance.rate = options.rate || 0.9; // Slightly slower makes Hinglish much clearer
    utterance.pitch = options.pitch || 1.1; // Slightly higher pitch for a friendly assistant tone
    utterance.volume = options.volume || 1.0;

    // 3. Language & Voice Selection Strategy
    const voices = window.speechSynthesis.getVoices();
    
    // Priority: 1. Hindi India (hi-IN), 2. English India (en-IN), 3. Female UK (often sounds better than default US)
    const preferredVoice = voices.find(v => v.lang === 'hi-IN') || 
                          voices.find(v => v.lang === 'en-IN') ||
                          voices.find(v => v.lang.includes('en-GB') && v.name.includes('Female'));

    if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang;
    } else {
        utterance.lang = 'en-IN'; // Fallback lang
    }

    // 4. Logging & Execution
    utterance.onstart = () => logger.log("[TTS] Speaking:", cleanText.substring(0, 40) + "...");
    utterance.onerror = (e) => logger.error("[TTS] Error:", e);

    window.speechSynthesis.speak(utterance);
};

// Warm up voices (Chrome sometimes returns empty list initially)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        // Just trigger a fetch so they are ready
        window.speechSynthesis.getVoices();
    };
}
