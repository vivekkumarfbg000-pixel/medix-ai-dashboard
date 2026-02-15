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
export const speak = (text: string, options: TTSOptions = {}) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        logger.warn("TTS not supported in this browser.");
        return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // 1. Text Normalization for Natural Speech
    // Replace "Rs." or "₹" with "Rupees"
    let cleanText = text
        .replace(/₹/g, "Rupees ")
        .replace(/^Rs\.\s$/gi, "Rupees ")
        .replace(/\//g, " per "); // "500/strip" -> "500 per strip"

    // Example: "120" -> "one hundred twenty" (Standard engines do this automatically)
    // However, if the text is like "5-10" it might say "five dash ten", we might prefer "five to ten".
    cleanText = cleanText.replace(/(\d+)-(\d+)/g, "$1 to $2");

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // 2. Defaults
    utterance.rate = options.rate || 0.95; // Slightly slower for clarity
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;

    // 3. Language & Voice Selection Strategy
    // Default to Indian English or Hindi
    utterance.lang = options.lang || 'en-IN';

    const voices = window.speechSynthesis.getVoices();

    // Prefer Indian English voices (Google or Microsoft)
    // Prioritize "Google UK English Female" or "Microsoft Heera" if available as they handle mixed Hinglish reasonably well
    // But strict Indian English is 'en-IN'.
    const indianVoice = voices.find(v =>
        (v.lang === 'en-IN' || v.lang === 'hi-IN') &&
        !v.name.includes("Male") // Typically prefer female voice for assistant, or just first match
    );

    // Fallback if no specific Indian voice found but en-IN is supported
    if (indianVoice) {
        utterance.voice = indianVoice;
    }

    // 4. Logging & Execution
    utterance.onstart = () => logger.log("[TTS] Speaking:", cleanText.substring(0, 30));
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
