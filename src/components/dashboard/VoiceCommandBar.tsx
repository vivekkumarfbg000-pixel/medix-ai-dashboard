import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, Volume2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { aiService } from "@/services/aiService";
import { logger } from "@/utils/logger";

interface VoiceCommandBarProps {
  onTranscriptionComplete: (transcription: string, parsedItems: ParsedItem[]) => void;
  compact?: boolean;
}

export interface ParsedItem {
  name: string;
  quantity: number;
  contact?: string;
  intent?: 'add' | 'search';
}

const parseTranscription = (text: string): ParsedItem[] => {
  const items: ParsedItem[] = [];
  const lowerText = text.toLowerCase();

  // Check for Search Intent
  const searchKeywords = ["search", "find", "lookup", "check", "stock", "price", "rate", "available", "hai kya", "hai ya", "kitna"];
  const isSearch = searchKeywords.some(k => lowerText.includes(k));

  if (isSearch) {
    let searchTerm = lowerText;
    const removeWords = ["search", "find", "lookup", "check", "stock", "of", "for", "available", "price", "rate", "do we have", "is there", "hai kya", "hai ya", "nahi", "kitna", "hai"];
    removeWords.forEach(w => {
      searchTerm = searchTerm.replace(new RegExp(`\\b${w}\\b`, 'g'), "");
    });
    searchTerm = searchTerm.trim().replace(/\s+/g, " ");
    if (searchTerm.length > 2) {
      items.push({ name: searchTerm, quantity: 0, intent: 'search' });
    }
    return items;
  }

  // Parse as add intent — split by "and" / "aur" / comma
  const parts = lowerText.split(/,|\band\b|\baur\b/).map(p => p.trim()).filter(p => p.length > 0);
  let contact: string | undefined;

  parts.forEach(part => {
    const contactMatch = part.match(/contact\s+(.+)/i);
    if (contactMatch) {
      contact = contactMatch[1].trim();
      return;
    }

    // Match "2 dolo" or "two dolo" patterns
    const quantityMatch = part.match(/^(\d+)\s+(.+)/);
    if (quantityMatch) {
      items.push({
        name: quantityMatch[2].trim(),
        quantity: parseInt(quantityMatch[1], 10),
        contact,
        intent: 'add'
      });
    } else if (part.length > 0) {
      // No quantity specified — default to 1
      // Remove filler words
      const cleaned = part.replace(/\b(add|dedo|de|do|give|bhai|bhaiya|please|mujhe|chahiye)\b/gi, '').trim();
      if (cleaned.length > 1) {
        items.push({
          name: cleaned,
          quantity: 1,
          contact,
          intent: 'add'
        });
      }
    }
  });

  if (contact) {
    items.forEach(item => item.contact = contact);
  }

  return items;
};

export function VoiceCommandBar({ onTranscriptionComplete, compact = false }: VoiceCommandBarProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const recognitionRef = useRef<any>(null);
  const audioLevelInterval = useRef<number | null>(null);

  // Get SpeechRecognition API (works in Chrome, Edge, Safari, Firefox)
  const getSpeechRecognition = useCallback(() => {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  }, []);

  // Process transcript: try AI smart parsing first, then local fallback
  const processTranscript = useCallback(async (transcript: string) => {
    setIsProcessing(true);
    logger.log("[Voice] Transcript received:", transcript);

    try {
      // 1. Try AI smart parsing (fast text-only call, not audio processing)
      try {
        const smartResult = await aiService.parseOrderFromText(transcript);
        if (smartResult?.items?.length > 0) {
          logger.log("[Voice] AI parsed items:", smartResult.items);
          onTranscriptionComplete(transcript, smartResult.items);
          toast.success("Voice order processed!", { description: transcript });
          return;
        }
      } catch (aiError) {
        logger.warn("[Voice] AI parsing failed, using local parser:", aiError);
      }

      // 2. Fallback: Local parsing (instant, no network)
      const localItems = parseTranscription(transcript);
      if (localItems.length > 0) {
        logger.log("[Voice] Local parsed items:", localItems);
        onTranscriptionComplete(transcript, localItems);
        toast.success("Voice order processed!", { description: transcript });
      } else {
        // 3. Last resort: Pass raw text as single item
        const fallbackItems: ParsedItem[] = [{
          name: transcript.trim(),
          quantity: 1,
          intent: 'add'
        }];
        onTranscriptionComplete(transcript, fallbackItems);
        toast.info("Added as voice item", { description: transcript });
      }
    } catch (error) {
      logger.error("[Voice] Processing error:", error);
      toast.error("Could not process voice command.");
    } finally {
      setIsProcessing(false);
    }
  }, [onTranscriptionComplete]);

  // PRIMARY: Start browser speech recognition (instant, no network for capture)
  const startRecording = useCallback(async () => {
    const SpeechRecognitionAPI = getSpeechRecognition();

    if (!SpeechRecognitionAPI) {
      // No browser support — fall back to MediaRecorder + backend AI
      startMediaRecorderFallback();
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN'; // Indian English (good for Hinglish too)
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        // Simulate audio level for visual feedback
        audioLevelInterval.current = window.setInterval(() => {
          setAudioLevel(Math.random() * 0.6 + 0.2);
        }, 150);
        toast.info("🎙️ Listening...", { description: "Say the medicine name" });
      };

      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        logger.log(`[Voice] Heard: "${transcript}" (confidence: ${(confidence * 100).toFixed(0)}%)`);

        setIsRecording(false);
        clearAudioLevel();

        // Process the transcript
        await processTranscript(transcript);
      };

      recognition.onerror = (event: any) => {
        logger.error("[Voice] SpeechRecognition error:", event.error);
        setIsRecording(false);
        clearAudioLevel();

        if (event.error === 'not-allowed') {
          toast.error("Microphone permission denied. Enable it in browser settings.");
        } else if (event.error === 'no-speech') {
          toast.warning("No speech detected. Tap the mic and speak clearly.");
        } else if (event.error === 'network') {
          toast.warning("Network error. Trying offline mode...");
        } else {
          toast.error(`Voice error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        clearAudioLevel();
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (error: any) {
      logger.error("[Voice] Failed to start recognition:", error);
      toast.error(`Microphone error: ${error.message || "Permission denied"}`);
    }
  }, [getSpeechRecognition, processTranscript]);

  // FALLBACK: MediaRecorder + backend AI (only when browser SpeechRecognition unavailable)
  const startMediaRecorderFallback = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunks, { type: "audio/webm;codecs=opus" });

        try {
          const response = await aiService.processVoiceBill(audioBlob);
          if (response?.transcription || response?.items?.length > 0) {
            const transcription = response.transcription || "Voice Order";
            const items = response.items || parseTranscription(transcription);
            onTranscriptionComplete(transcription, items);
            toast.success("Voice order processed!", { description: transcription });
          } else {
            toast.error("Could not understand. Please try again.");
          }
        } catch (error) {
          logger.error("[Voice] Backend processing failed:", error);
          toast.error("Voice processing failed. Please try again.");
        } finally {
          setIsProcessing(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("🎙️ Recording...", { description: "Speak your order, then tap to stop" });

      // Auto-stop after 10s
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          setIsRecording(false);
        }
      }, 10000);

      // Store ref for manual stop
      recognitionRef.current = { stop: () => { mediaRecorder.stop(); setIsRecording(false); } };

    } catch (error: any) {
      toast.error(`Microphone error: ${error.message || "Permission denied"}`);
    }
  }, [onTranscriptionComplete]);

  const clearAudioLevel = () => {
    if (audioLevelInterval.current) {
      clearInterval(audioLevelInterval.current);
      audioLevelInterval.current = null;
    }
    setAudioLevel(0);
  };

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsRecording(false);
    clearAudioLevel();
  }, []);

  // Keyboard Shortcut (F2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (isRecording) stopRecording();
        else startRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, startRecording, stopRecording]);

  return (
    <div className={cn(
      "voice-bar transition-all duration-500 ease-out",
      compact ? "bg-transparent p-0 border-0 shadow-none w-full" : "glass-card p-2 rounded-full border border-primary/20 bg-background/60 shadow-lg backdrop-blur-md"
    )}>
      <div className={cn("flex items-center gap-4", compact && "gap-2")}>
        {!compact && (
          <div className="pl-4 flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-full hidden sm:block">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-foreground hidden xl:block pr-2">AI Voice Assistant</span>
          </div>
        )}

        <div className={cn("flex-1 flex items-center justify-center gap-3", compact && "justify-start")}>
          <span className={cn("text-sm text-muted-foreground hidden sm:block transition-all", compact && "text-xs truncate max-w-[200px] hidden lg:block", isRecording && "text-primary font-medium")}>
            {isRecording
              ? "Listening... Say medicine name"
              : isProcessing
                ? "Processing order..."
                : "Tap mic to add by voice"}
          </span>

          {/* Audio level indicator */}
          {isRecording && (
            <div className="flex items-center gap-1 h-8 items-end">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 rounded-full transition-all duration-75",
                    audioLevel > i * 0.2 ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-muted h-2"
                  )}
                  style={{ height: `${Math.max(8, 12 + audioLevel * (30 + i * 5))}px` }}
                />
              ))}
            </div>
          )}
        </div>

        <Button
          variant={isRecording ? "destructive" : "default"}
          size="lg"
          className={cn(
            "rounded-full shadow-lg transition-all duration-300 relative overflow-hidden",
            compact ? "w-10 h-10" : "w-12 h-12",
            isRecording && "animate-pulse ring-4 ring-destructive/30 scale-110",
            isProcessing && "opacity-80 disabled:opacity-80"
          )}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isRecording ? (
            <div className="relative">
              <span className="absolute inset-0 rounded-full animate-ping bg-white/50 opacity-75"></span>
              <MicOff className="w-5 h-5 relative z-10" />
            </div>
          ) : (
            <Mic className={cn(compact ? "w-4 h-4" : "w-5 h-5")} />
          )}
        </Button>
      </div>
    </div>
  );
}
