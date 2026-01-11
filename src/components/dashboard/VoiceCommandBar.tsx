import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { aiService } from "@/services/aiService";

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
            console.log("Voice Response:", response); // Debug Log
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
          console.error("Transcription error:", error);
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
      toast.info("Recording... Speak now");
    } catch (error: any) {
      console.error("Microphone access error:", error);
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
    <div className={cn("voice-bar transition-all", compact ? "bg-transparent p-0 border-0 shadow-none w-full" : "")}>
      <div className={cn("flex items-center gap-4", compact && "gap-2")}>
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-primary" />
          <span className={cn("font-semibold text-foreground", compact && "hidden xl:block")}>Voice Billing</span>
        </div>

        <div className={cn("flex-1 flex items-center justify-center gap-3", compact && "justify-start")}>
          <span className={cn("text-sm text-muted-foreground hidden sm:block", compact && "text-xs truncate max-w-[200px] hidden lg:block")}>
            {isRecording
              ? "Listening... Say '2 Crocin, 1 Paracetamol, contact 98765'"
              : isProcessing
                ? "Processing your voice command..."
                : "Click the mic to start voice billing"}
          </span>

          {/* Audio level indicator */}
          {isRecording && (
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1 rounded-full transition-all duration-75",
                    audioLevel > i * 0.2 ? "bg-primary" : "bg-muted"
                  )}
                  style={{ height: `${12 + audioLevel * 20}px` }}
                />
              ))}
            </div>
          )}
        </div>

        <Button
          variant={isRecording ? "destructive" : "default"}
          size="lg"
          className={cn(
            "rounded-full shadow-lg transition-all",
            compact ? "w-10 h-10" : "w-14 h-14",
            isRecording && "animate-pulse ring-4 ring-destructive/30",
            isProcessing && "opacity-50 cursor-not-allowed"
          )}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isRecording ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className={cn(compact ? "w-4 h-4" : "w-6 h-6")} />
          )}
        </Button>
      </div>
    </div>
  );
}
