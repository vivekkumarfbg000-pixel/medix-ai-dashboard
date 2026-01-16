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
}

export function VoiceCommandBar({ onTranscriptionComplete, compact = false }: VoiceCommandBarProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const parseTranscription = (text: string): ParsedItem[] => {
    // Simple parsing logic - can be enhanced with n8n AI processing
    const items: ParsedItem[] = [];
    const parts = text.toLowerCase().split(",").map(p => p.trim());
    let contact: string | undefined;

    parts.forEach(part => {
      // Check for contact info
      const contactMatch = part.match(/contact\s+(.+)/i);
      if (contactMatch) {
        contact = contactMatch[1].trim();
        return;
      }

      // Parse quantity and medicine name
      const quantityMatch = part.match(/^(\d+)\s+(.+)/);
      if (quantityMatch) {
        items.push({
          name: quantityMatch[2].trim(),
          quantity: parseInt(quantityMatch[1], 10),
          contact
        });
      } else if (part.length > 0) {
        items.push({
          name: part,
          quantity: 1,
          contact
        });
      }
    });

    // Add contact to all items if found
    if (contact) {
      items.forEach(item => item.contact = contact);
    }

    return items;
  };

  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(average / 255);
    }
    if (isRecording) {
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording]);

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
  }, [isRecording, isProcessing]); // Re-bind when state changes to capture correct 'isRecording' value

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio analysis for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        try {
          // Call Real AI Service
          const response = await aiService.processVoiceBill(audioBlob);

          if (response) {
            // Prefer n8n parsed items, fallback to local parsing if only text is returned
            // logger.log("Voice Response:", response); // Debug Log
            const transcription = response.transcription || response.text || (response.items ? "Voice Order Processed" : "");
            const items = response.items || parseTranscription(transcription);

            if (!transcription && items.length === 0) {
              throw new Error("No transcription or items received");
            }

            onTranscriptionComplete(transcription, items);
            toast.success("Voice command processed!", {
              description: transcription
            });
          } else {
            throw new Error("Empty response from AI");
          }

        } catch (error) {
          logger.error("Transcription error:", error);
          toast.error("Failed to process voice command. Please try again.");
        } finally {
          setIsProcessing(false);
        }

        // Clean up
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
      };

      mediaRecorder.start();
      setIsRecording(true);
      updateAudioLevel();
      toast.info("Listening...", { description: "Speak clearly now" });
    } catch (error: any) {
      logger.error("Microphone access error:", error);
      toast.error(`Could not access microphone: ${error.message || "Permission denied"}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  };

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
              ? "Listening... Speak your order"
              : isProcessing
                ? "Analyzing voice data..."
                : "Tap microphone to start"}
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
