
import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface VoiceInputProps {
    onTranscript: (text: string) => void;
    lang?: string; // 'en-US' or 'hi-IN'
    placeholder?: string;
    className?: string;
}

const VoiceInput: React.FC<VoiceInputProps> = ({
    onTranscript,
    lang = 'hi-IN',
    placeholder = "Speak to search...",
    className = ""
}) => {
    const [isListening, setIsListening] = useState(false);
    const [hasSupport, setHasSupport] = useState(true);

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window)) {
            setHasSupport(false);
        }
    }, []);

    const toggleListening = () => {
        if (!hasSupport) {
            toast.error("Voice search not supported in this browser. Try Chrome.");
            return;
        }

        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const startListening = () => {
        setIsListening(true);
        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.lang = lang;
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            toast.info("Listening... (Munim-ji is active) 🎙️");
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            onTranscript(transcript);
            toast.success(`Heard: "${transcript}"`);
            setIsListening(false);
        };

        recognition.onerror = (event: any) => {
            console.error(event.error);
            setIsListening(false);
            // toast.error("Could not hear you properly.");
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    const stopListening = () => {
        setIsListening(false);
        // Logic to strictly stop if needed, usually reliance on onend is enough for single shots
    };

    if (!hasSupport) return null;

    return (
        <Button
            variant={isListening ? "destructive" : "secondary"}
            size="icon"
            onClick={toggleListening}
            className={`rounded-full transition-all duration-300 ${isListening ? 'animate-pulse scale-110 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'hover:bg-primary/20'} ${className}`}
            title="Munim-ji Voice Search"
        >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
    );
};

export default VoiceInput;
