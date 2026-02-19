import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageCircle, X, Send, Bot, Sparkles, Loader2, Minimize2 } from "lucide-react";
import { aiService } from "@/services/aiService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

export function AIChatbotWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            text: "Namaste! I am your AI Pharma Assistant. How can I help you today? (e.g., 'Check interaction for Aspirin', 'Analyze sales')",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    // Focus input on open
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            // Call AI Service
            const response = await aiService.chatWithAgent(userMsg.text);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: response.reply,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error("Chat Error:", error);
            toast.error("AI is temporarily unavailable.");
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                text: "I'm having trouble connecting right now. Please try again.",
                timestamp: new Date()
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4 animate-fade-in font-sans">

            {/* Chat Window */}
            {isOpen && (
                <Card className="w-[320px] md:w-[380px] h-[480px] shadow-2xl border-primary/20 flex flex-col glass-card overflow-hidden animate-slide-up origin-bottom-right rounded-2xl">
                    {/* Header */}
                    <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-between shadow-md">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-white/20 rounded-full backdrop-blur-md">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Pharma AI Agent</h3>
                                <p className="text-[10px] text-blue-100 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                    Online
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20 rounded-full" onClick={() => setIsOpen(false)}>
                            <Minimize2 className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 dark:bg-slate-900/50 backdrop-blur-sm scroll-smooth" ref={scrollRef}>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex w-full",
                                    msg.role === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                <div
                                    className={cn(
                                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                                        msg.role === 'user'
                                            ? "bg-blue-600 text-white rounded-br-none"
                                            : "bg-white dark:bg-slate-800 border border-border rounded-bl-none text-slate-800 dark:text-slate-100"
                                    )}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="mb-1 text-[10px] opacity-70 flex items-center gap-1 font-bold text-blue-500">
                                            <Sparkles className="w-3 h-3" /> AI
                                        </div>
                                    )}
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                    <span className="text-[9px] opacity-60 block text-right mt-1">
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start w-full">
                                <div className="bg-white dark:bg-slate-800 border border-border rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                    <span className="text-xs text-muted-foreground animate-pulse">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white dark:bg-slate-900 border-t">
                        <div className="relative flex items-center gap-2">
                            <Input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Ask about medicines..."
                                className="pr-10 h-10 rounded-full border-gray-200 dark:border-slate-700 focus-visible:ring-blue-500 shadow-sm bg-slate-50 dark:bg-slate-800"
                            />
                            <Button
                                size="icon"
                                className={cn(
                                    "absolute right-1 w-8 h-8 rounded-full transition-all duration-200",
                                    input.trim() ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-100 text-gray-400 dark:bg-slate-700"
                                )}
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                            >
                                <Send className="w-4 h-4 ml-0.5" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Floating Action Button (FAB) */}
            <div
                className="group relative flex items-center gap-2"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {!isOpen && (
                    <div className={cn(
                        "transition-all duration-300 origin-right bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg mr-2 backdrop-blur-md",
                        isHovered ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-95 translate-x-2 pointer-events-none"
                    )}>
                        Chat with AI
                    </div>
                )}

                <Button
                    size="icon"
                    className={cn(
                        "h-14 w-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-500 ease-out",
                        "bg-gradient-to-br from-blue-600 to-purple-600 hover:shadow-blue-500/50 hover:scale-110 border-2 border-white/20",
                        isOpen ? "rotate-90 scale-0 opacity-0" : "scale-100 opacity-100"
                    )}
                    onClick={() => setIsOpen(true)}
                >
                    <MessageCircle className="w-7 h-7 text-white" />

                    {/* Notification Dot */}
                    <span className="absolute top-0 right-0 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border-2 border-white"></span>
                    </span>
                </Button>

                {/* Close Button when Open - ensuring smooth transition */}
                {isOpen && (
                    <Button
                        size="icon"
                        className="h-14 w-14 rounded-full shadow-xl bg-slate-800 text-white hover:bg-slate-700 animate-in fade-in zoom-in duration-300 absolute right-0 border-2 border-white/10"
                        onClick={() => setIsOpen(false)}
                    >
                        <X className="w-6 h-6" />
                    </Button>
                )}
            </div>
        </div>
    );
}
