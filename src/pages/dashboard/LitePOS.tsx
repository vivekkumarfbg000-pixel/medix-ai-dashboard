import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveQuery } from "dexie-react-hooks";
import { db, OfflineInventory } from "@/db/db";
import { toast } from "sonner";
import { ShoppingCart, RefreshCw, Mic, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import VoiceInput from "@/components/common/VoiceInput";

const LitePOS = () => {
    const [cart, setCart] = useState<{ item: OfflineInventory; qty: number }[]>([]);
    const [search, setSearch] = useState("");

    // Live Query from Local DB (Instant Search)
    const products = useLiveQuery(
        () => db.inventory
            .where("medicine_name")
            .startsWithIgnoreCase(search)
            .limit(10)
            .toArray(),
        [search]
    );

    const addToCart = (product: OfflineInventory) => {
        setCart((prev) => {
            const existing = prev.find((c) => c.item.id === product.id);
            if (existing) {
                return prev.map((c) => c.item.id === product.id ? { ...c, qty: c.qty + 1 } : c);
            }
            return [...prev, { item: product, qty: 1 }];
        });
        toast.success(`Added ${product.medicine_name}`);
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter((c) => c.item.id !== id));
    };

    const calculateTotal = () => cart.reduce((acc, curr) => acc + (curr.item.unit_price * curr.qty), 0);

    const handleVoiceData = (text: string) => {
        setSearch(text);
        // Simple logic: if text matches exactly one item, auto-add
        db.inventory.where("medicine_name").equalsIgnoreCase(text).first().then(item => {
            if (item) {
                addToCart(item);
                setSearch("");
                toast.success(`Voice added: ${item.medicine_name}`);
            } else {
                toast.info(`Searching for "${text}"...`);
            }
        });
    };

    // Mobile Shortcuts: Volume Keys & Haptics
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Desktop Shortcuts
            if (e.key === "F2") {
                e.preventDefault();
                triggerVoice();
            }
            if (e.key === "F4") {
                e.preventDefault();
                document.getElementById("lite-search-input")?.focus();
            }

            // Mobile/Hardware Keys (Volume Buttons often map to specific keys on some devices, 
            // but standard Android Volume keys are hard to capture in Web. 
            // We'll support 'Enter' for barcode scanners primarily)
        };

        const handleVolumeKeys = (e: any) => {
            // Experimental: Some WebViews expose volume keys
            if (e.key === "AudioVolumeUp" || e.key === "AudioVolumeDown") {
                e.preventDefault();
                triggerVoice();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keydown", handleVolumeKeys);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keydown", handleVolumeKeys);
        };
    }, []);

    const triggerVoice = () => {
        if (navigator.vibrate) navigator.vibrate(50); // Haptic
        toast("Listening...");
        document.getElementById("voice-input-btn")?.click();
    };

    // Haptic wrapper for actions
    const withHaptic = (fn: () => void) => {
        if (navigator.vibrate) navigator.vibrate(10);
        fn();
    };

    // Swipe Logic (Basic Implementation)
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = (itemId: string) => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;

        if (isLeftSwipe) {
            withHaptic(() => removeFromCart(itemId));
            toast.info("Item removed");
        }
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50 relative">
            {/* Header */}
            <div className="bg-primary p-4 flex items-center justify-between text-white shadow-md z-10">
                <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg">
                    <ArrowLeft /> Back
                </Link>
                <h1 className="text-xl font-bold">Munim-ji Lite ⚡</h1>
                <div className="flex items-center gap-2">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                        {navigator.onLine ? "🟢 Online" : "🔴 Offline Mode"}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Left: Product Grid (Big Buttons) */}
                <div className="flex-1 p-4 overflow-y-auto pb-24 md:pb-4">
                    <div className="mb-4 flex gap-2">
                        <Input
                            id="lite-search-input"
                            placeholder="Search... (F4)"
                            className="h-12 text-lg shadow-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <div id="voice-wrapper" className="hidden md:block">
                            <VoiceInput onTranscript={handleVoiceData} className="h-12 w-12" />
                            <button id="voice-input-btn" className="hidden" onClick={() => (document.querySelector('.voice-input-mic') as HTMLElement)?.click()}></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {products?.map((prod) => (
                            <button
                                key={prod.id}
                                onClick={() => withHaptic(() => addToCart(prod))}
                                className="h-32 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center gap-2 hover:bg-blue-50 active:scale-95 transition-all"
                            >
                                <span className="font-bold text-lg text-center leading-tight line-clamp-2">{prod.medicine_name}</span>
                                <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full font-mono">₹{prod.unit_price}</span>
                            </button>
                        ))}
                        {products?.length === 0 && (
                            <div className="col-span-full text-center py-10 text-muted-foreground">
                                No items found. Run "Sync" first.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Cart */}
                <div className="md:w-96 bg-white shadow-xl border-l flex flex-col z-20">
                    <div className="p-4 bg-slate-100 border-b">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <ShoppingCart /> Current Bill
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cart.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">Empty Cart</div>
                        ) : cart.map((line) => (
                            <div
                                key={line.item.id}
                                className="flex justify-between items-center p-3 border rounded-lg bg-slate-50 touch-pan-y"
                                onTouchStart={onTouchStart}
                                onTouchMove={onTouchMove}
                                onTouchEnd={() => onTouchEnd(line.item.id)}
                            >
                                <div>
                                    <div className="font-medium">{line.item.medicine_name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        ₹{line.item.unit_price} x {line.qty}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold">₹{line.item.unit_price * line.qty}</span>
                                    <Button variant="ghost" size="icon" onClick={() => withHaptic(() => removeFromCart(line.item.id))}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 border-t bg-slate-50 space-y-4">
                        <div className="flex justify-between text-xl font-bold">
                            <span>Total</span>
                            <span>₹{calculateTotal()}</span>
                        </div>
                        <Button size="lg" className="w-full h-14 text-xl font-bold bg-green-600 hover:bg-green-700 active:scale-95 transition-transform" onClick={() => withHaptic(() => { })}>
                            Checkout & Cash (₹)
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Floating Action Button (FAB) for Voice */}
            <div className="md:hidden fixed bottom-6 right-6 z-50">
                <div className="shadow-xl rounded-full scale-125">
                    <VoiceInput onTranscript={handleVoiceData} className="w-14 h-14" />
                </div>
            </div>
        </div>
    );
};

export default LitePOS;
