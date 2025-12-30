import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveQuery } from "dexie-react-hooks";
import { db, OfflineInventory } from "@/db/db";
import { toast } from "sonner";
import { ShoppingCart, RefreshCw, Mic, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { VoiceCommandBar, ParsedItem } from "@/components/dashboard/VoiceCommandBar";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { useUserRole } from "@/hooks/useUserRole";

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

    const addToCart = (product: OfflineInventory, qty: number = 1) => {
        setCart((prev) => {
            const existing = prev.find((c) => c.item.id === product.id);
            if (existing) {
                return prev.map((c) => c.item.id === product.id ? { ...c, qty: c.qty + qty } : c);
            }
            return [...prev, { item: product, qty: qty }];
        });
        toast.success(`Added ${product.medicine_name}`);
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter((c) => c.item.id !== id));
    };

    const calculateTotal = () => cart.reduce((acc, curr) => acc + (curr.item.unit_price * curr.qty), 0);

    const handleVoiceCommand = async (transcription: string, items: ParsedItem[]) => {
        setSearch(transcription);
        toast.info(`AI Processed: ${transcription}`);

        // Process each parsed item (Name + Quantity)
        for (const item of items) {
            // Fuzzy Find Best Match in Local DB
            // 1. Try Exact Match
            let bestMatch = await db.inventory.where("medicine_name").equalsIgnoreCase(item.name).first();

            // 2. If not found, try StartsWith
            if (!bestMatch) {
                const candidates = await db.inventory.where("medicine_name").startsWithIgnoreCase(item.name).toArray();
                if (candidates.length > 0) bestMatch = candidates[0];
            }

            // 3. If found, add to cart
            if (bestMatch) {
                // Determine qty (default to 1)
                const qtyToAdd = item.quantity || 1;
                addToCart(bestMatch, qtyToAdd);
                toast.success(`Voice Added: ${qtyToAdd}x ${bestMatch.medicine_name}`);
            } else {
                toast.warning(`Could not find "${item.name}" in inventory.`);
            }
        }
        setSearch("");
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

    // --- CHECKOUT LOGIC ---
    const { currentShop } = useUserShops();
    const { canModify } = useUserRole(currentShop?.id);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const handleCheckout = async () => {
        if (!currentShop?.id) {
            toast.error("No shop selected!");
            return;
        }
        if (cart.length === 0) return;

        setIsCheckingOut(true);
        const invoiceNumber = `LITE-${Date.now().toString().slice(-6)}`;
        const total = calculateTotal();

        // Prepare items for DB
        const orderItems = cart.map(c => ({
            name: c.item.medicine_name,
            qty: c.qty,
            price: c.item.unit_price,
            inventory_id: c.item.id
        }));

        try {
            // 1. Create Order in Supabase
            const { error } = await supabase.from('orders').insert({
                shop_id: currentShop.id,
                customer_name: "Walk-in (Lite)",
                total_amount: total,
                status: 'approved',
                source: 'lite_pos',
                invoice_number: invoiceNumber,
                order_items: orderItems as any
            });

            if (error) throw error;

            // 2. (Optional) Sync to local Dexie for offline history? (Skipping for now to prioritize online)

            toast.success(`Order ${invoiceNumber} Saved!`, {
                description: `₹${total} Collected`
            });
            setCart([]); // Clear Cart
        } catch (err: any) {
            toast.error("Checkout Failed", { description: err.message });
            console.error(err);
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50 relative">
            {/* Header */}
            <div className="bg-primary p-4 flex items-center justify-between text-white shadow-md z-10">
                <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg">
                    <ArrowLeft /> Back
                </Link>
                <div className="flex flex-col items-center">
                    <h1 className="text-xl font-bold">Munim-ji Lite ⚡</h1>
                    <span className="text-xs opacity-80">{currentShop?.name || "No Shop"}</span>
                </div>
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
                            <VoiceCommandBar
                                compact={true}
                                onTranscriptionComplete={handleVoiceCommand}
                            />
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
                        <Button
                            size="lg"
                            className="w-full h-14 text-xl font-bold bg-green-600 hover:bg-green-700 active:scale-95 transition-transform"
                            onClick={() => withHaptic(handleCheckout)}
                            disabled={isCheckingOut || cart.length === 0}
                        >
                            {isCheckingOut ? "Saving..." : "Checkout & Cash (₹)"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Floating Action Button (FAB) for Voice */}
            <div className="md:hidden fixed bottom-6 right-6 z-50">
                <div className="bg-primary/90 text-white rounded-full p-2 shadow-2xl">
                    <VoiceCommandBar
                        compact={true}
                        onTranscriptionComplete={handleVoiceCommand}
                    />
                </div>
            </div>
        </div>
    );
};

export default LitePOS;
