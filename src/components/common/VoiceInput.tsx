
import React, { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';

interface VoiceInputProps {
    onTranscript: (text: string) => void;
    lang?: string; // 'en-US' or 'hi-IN'
    placeholder?: string;
    className?: string;
}

const VoiceInput: React.FC<VoiceInputProps> = ({
    onTranscript,
    lang = 'en-IN',
    placeholder = "Speak to search...",
    className = ""
}) => {
    const [isListening, setIsListening] = useState(false);
    const [hasSupport, setHasSupport] = useState(true);

    useEffect(() => {
        const checkSupport = async () => {
            if (Capacitor.isNativePlatform()) {
                // Assume support, but check permissions later
                setHasSupport(true);
            } else {
                if (!('webkitSpeechRecognition' in window)) {
                    setHasSupport(false);
                }
            }
        };
        checkSupport();
    }, []);

    const toggleListening = async () => {
        if (!hasSupport) {
            toast.error("Voice search not supported in this environment.");
            return;
        }

        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const startListening = async () => {
        setIsListening(true);
        toast.info("Listening... (Speak clearly) 🎙️");

        if (Capacitor.isNativePlatform()) {
            try {
                // Direct request, skip 'available' check which fails on some emulators/devices
                const permissionStatus = await SpeechRecognition.checkPermissions();
                if (permissionStatus.speechRecognition !== 'granted') {
                    const permissionRequest = await SpeechRecognition.requestPermissions();
                    if (permissionRequest.speechRecognition !== 'granted') {
                        toast.error("Microphone permission denied");
                        setIsListening(false);
                        return;
                    }
                }

                await SpeechRecognition.removeAllListeners();

                // On Android, 'partialResults' is key for real-time feel
                await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
                    if (data.matches && data.matches.length > 0) {
                        onTranscript(data.matches[0]);
                    }
                });

                await SpeechRecognition.start({
                    language: lang, // 'en-US' or 'hi-IN'
                    maxResults: 1,
                    prompt: placeholder,
                    partialResults: true,
                    popup: false,
                });

            } catch (error) {
                console.error("Native voice error:", error);

                // Fallback attempt: Try without specific language if it failed
                try {
                    await SpeechRecognition.start({
                        partialResults: true,
                        popup: false,
                    });
                } catch (retryError) {
                    toast.error("Voice Input failed.");
                    setIsListening(false);
                }
            }
        } else {
            // Web implementation
            if (!('webkitSpeechRecognition' in window)) {
                toast.error("Browser does not support voice input.");
                setIsListening(false);
                return;
            }

            const recognition = new (window as any).webkitSpeechRecognition();
            recognition.lang = lang;
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => { /* toast shown */ };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                onTranscript(transcript);
                toast.success("Captured");
                setIsListening(false);
            };

            recognition.onerror = (event: any) => {
                console.error(event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.start();
        }
    };

    const stopListening = async () => {
        setIsListening(false);
        if (Capacitor.isNativePlatform()) {
            try {
                await SpeechRecognition.stop();
            } catch (e) {
                console.warn("Stop error:", e);
            }
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (Capacitor.isNativePlatform()) {
                SpeechRecognition.removeAllListeners();
            }
        };
    }, []);

    return (
        <Button
            variant={isListening ? "destructive" : "secondary"}
            size="icon"
            onClick={toggleListening}
            className={`voice-input-mic rounded-full transition-all duration-300 ${isListening ? 'animate-pulse scale-110 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'hover:bg-primary/20'} ${className}`}
            title="Munim-ji Voice Search"
        >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
    );
};

export default VoiceInput;
