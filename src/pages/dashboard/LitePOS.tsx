import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveQuery } from "dexie-react-hooks";
import { db, OfflineInventory } from "@/db/db";
import { toast } from "sonner";
import { ShoppingCart, RefreshCw, Mic, Trash2, ArrowLeft, Download, ShieldAlert } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { VoiceCommandBar, ParsedItem } from "@/components/dashboard/VoiceCommandBar";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { useUserRole } from "@/hooks/useUserRole";
import { whatsappService } from "@/services/whatsappService";
import { aiService } from "@/services/aiService";

import { CustomerSearch, Customer } from "@/components/dashboard/CustomerSearch";
import { SalesReturnModal } from "@/components/dashboard/SalesReturnModal";

const LitePOS = () => {
    const [cart, setCart] = useState<{ item: OfflineInventory; qty: number }[]>([]);
    const [search, setSearch] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const [paymentMode, setPaymentMode] = useState<string>("cash");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null); // New State
    const { currentShop } = useUserShops();
    const [interactions, setInteractions] = useState<string[]>([]);
    const [checkingSafety, setCheckingSafety] = useState(false);
    const location = useLocation();

    // Handle Navigation State (from DiaryScan)
    useEffect(() => {
        if (location.state?.cartItems) {
            const incomingItems = location.state.cartItems;

            // Fuzzy Find Logic to map Incoming Names -> Local Dexie Items
            const processIncoming = async () => {
                let mappedCount = 0;
                for (const item of incomingItems) {
                    // 1. Try Exact Match
                    let bestMatch = await db.inventory.where("medicine_name").equalsIgnoreCase(item.name).first();

                    // 2. If not found, try StartsWith
                    if (!bestMatch) {
                        const candidates = await db.inventory.where("medicine_name").startsWithIgnoreCase(item.name).toArray();
                        if (candidates.length > 0) bestMatch = candidates[0];
                    }

                    if (bestMatch) {
                        addToCart(bestMatch, item.qty || 1);
                        mappedCount++;
                    }
                }

                if (mappedCount > 0) {
                    toast.success(`Imported ${mappedCount} items from Diary Scan`);
                } else if (incomingItems.length > 0) {
                    toast.warning("Could not automatically match extracted items to inventory. Please search manually.");
                }
            };

            processIncoming();

            // Clear state to prevent re-adding on refresh (simple hack)
            window.history.replaceState({}, document.title);
        }
    }, [currentShop?.id]);

    useEffect(() => {
        const checkSafety = async () => {
            if (cart.length < 2) {
                setInteractions([]);
                return;
            }

            setCheckingSafety(true);
            try {
                // Debounce could be good here, but for now we keep it simple
                const drugNames = cart.map(c => c.item.medicine_name);
                const warnings = await aiService.checkInteractions(drugNames);
                // Simplify output for LitePOS
                const messages = warnings.map((w: any) =>
                    typeof w === 'string' ? w : `${w.severity?.toUpperCase() || 'WARN'}: ${w.description || 'Interaction detected'}`
                );
                setInteractions(messages);
            } catch (e) {
                console.error("Safety Check Failed", e);
            } finally {
                setCheckingSafety(false);
            }
        };

        const timeoutId = setTimeout(checkSafety, 1500); // 1.5s debounce
        return () => clearTimeout(timeoutId);
    }, [cart]);

    // Sync inventory from Supabase to local Dexie DB
    const syncInventory = async () => {
        if (!currentShop?.id) {
            toast.error("No shop selected!");
            return;
        }

        setIsSyncing(true);
        try {
            const { data, error } = await supabase
                .from('inventory')
                .select('id, medicine_name, quantity, unit_price, batch_number, expiry_date, rack_number, shelf_number, gst_rate, hsn_code')
                .eq('shop_id', currentShop.id)
                .gt('quantity', 0);

            if (error) throw error;

            if (data && data.length > 0) {
                // Clear existing and add fresh data
                await db.inventory.clear();
                await db.inventory.bulkAdd(data.map(item => ({
                    ...item,
                    is_synced: 1
                })));
                toast.success(`Synced ${data.length} items!`, { description: "Inventory ready for offline use" });
            } else {
                toast.info("No inventory items found in your shop");
            }
        } catch (err: any) {
            toast.error("Sync Failed", { description: err.message });
            console.error(err);
        } finally {
            setIsSyncing(false);
        }
    };

    // Auto-sync on mount if online and shop available
    useEffect(() => {
        if (currentShop?.id && navigator.onLine) {
            // Check if local DB is empty
            db.inventory.count().then(count => {
                if (count === 0) {
                    syncInventory();
                }
            });
        }
    }, [currentShop?.id]);

    // Live Query from Local DB (Instant Search)
    const products = useLiveQuery(
        () => search
            ? db.inventory.where("medicine_name").startsWithIgnoreCase(search).limit(12).toArray()
            : db.inventory.limit(12).toArray(),
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
        };

        const handleVolumeKeys = (e: any) => {
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

    // Swipe Logic
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
    const { canModify } = useUserRole(currentShop?.id);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const handleCheckout = async () => {
        if (!currentShop?.id) {
            toast.error("No shop selected!");
            return;
        }
        if (cart.length === 0) return;

        // Validation for Credit
        if (paymentMode === 'credit' && !selectedCustomer) {
            toast.error("Please select a customer for Udhaar!");
            return;
        }

        setIsCheckingOut(true);
        const invoiceNumber = `LITE-${Date.now().toString().slice(-6)}`;
        const total = calculateTotal();

        // Prepare items for DB
        // Prepare items for DB with Snapshot Metadata (Crucial for Reports/Audit)
        const orderItems = cart.map(c => ({
            name: c.item.medicine_name,
            qty: c.qty,
            price: c.item.unit_price,
            inventory_id: c.item.id,
            batch: c.item.batch_number || null,
            expiry: c.item.expiry_date || null,
            gst: c.item.gst_rate || 0,
            hsn: c.item.hsn_code || null
        }));

        try {
            // 1. Create Order in Supabase
            const { data: orderData, error } = await supabase.from('orders').insert({
                shop_id: currentShop.id,
                customer_name: paymentMode === 'credit' ? selectedCustomer?.name : "Walk-in (Lite)",
                total_amount: total,
                status: 'approved',
                source: 'lite_pos',
                payment_mode: paymentMode,
                payment_status: paymentMode === 'credit' ? 'unpaid' : 'paid', // Credit is unpaid
                invoice_number: invoiceNumber,
                order_items: orderItems as any
            }).select().single();

            if (error) throw error;

            // 2. If Credit, Update Ledger & Customer Balance
            if (paymentMode === 'credit' && selectedCustomer) {
                // Add Ledger Entry
                const { error: ledgerError } = await supabase.from('customer_ledger').insert({
                    shop_id: currentShop.id,
                    customer_id: selectedCustomer.id,
                    transaction_type: 'DEBIT',
                    amount: total,
                    description: `Udhaar Purchase: ${invoiceNumber}`,
                    // reference_id: orderData.id // Optional if column exists
                });

                if (ledgerError) console.error("Ledger Error", ledgerError);

                // Update Customer Balance
                const newBalance = (selectedCustomer.credit_balance || 0) + total;
                await supabase.from('customers').update({
                    credit_balance: newBalance
                }).eq('id', selectedCustomer.id);
            }

            toast.success(`Order ${invoiceNumber} Saved!`, {
                description: paymentMode === 'credit' ? `Added ₹${total} to ${selectedCustomer?.name}'s Khata` : `₹${total} Collected`
            });
            setCart([]); // Clear Cart
            setSelectedCustomer(null); // Reset Customer
            setPaymentMode("cash"); // Reset Mode
        } catch (err: any) {
            toast.error("Checkout Failed", { description: err.message });
            console.error(err);
        } finally {
            setIsCheckingOut(false);
        }
    };

    const handleFastCheckout = async () => {
        if (!currentShop?.id) return;
        if (cart.length === 0) return;

        setIsCheckingOut(true);
        const invoiceNumber = `FAST-${Date.now().toString().slice(-6)}`;
        const total = calculateTotal();

        const orderItems = cart.map(c => ({
            name: c.item.medicine_name,
            qty: c.qty,
            price: c.item.unit_price,
            inventory_id: c.item.id,
            batch: c.item.batch_number || null,
            expiry: c.item.expiry_date || null,
            gst: c.item.gst_rate || 0,
            hsn: c.item.hsn_code || null
        }));

        try {
            const { error } = await supabase.from('orders').insert({
                shop_id: currentShop.id,
                customer_name: "Walk-in (Fast)",
                total_amount: total,
                status: 'approved',
                source: 'lite_pos_fast',
                payment_mode: 'cash',
                payment_status: 'paid',
                invoice_number: invoiceNumber,
                order_items: orderItems as any
            });

            if (error) throw error;

            toast.success(`⚡ Fast Cash: ₹${total} Received!`);
            setCart([]);
        } catch (err: any) {
            toast.error("Failed", { description: err.message });
        } finally {
            setIsCheckingOut(false);
        }
    };

    const handleWhatsAppShare = () => {
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }

        // Prompt for phone number since LitePOS doesn't force customer details
        const phone = prompt("Enter Customer WhatsApp Number:");
        if (!phone) return;

        const link = whatsappService.generateInvoiceLink(phone, {
            customer_name: "Walk-in Customer",
            created_at: new Date().toISOString(),
            total_amount: calculateTotal(),
            status: "DRAFT",
            items: cart.map(c => ({
                name: c.item.medicine_name,
                qty: c.qty,
                price: c.item.unit_price
            }))
        });
        window.open(link, '_blank');
    };

    return (
        <div className="h-screen flex flex-col bg-background relative">
            {/* Header - Deep Blue Gradient */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-4 flex items-center justify-between text-white shadow-lg z-10">
                <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
                    <ArrowLeft className="w-5 h-5" /> Back
                </Link>
                <div className="flex flex-col items-center">
                    <h1 className="text-xl font-bold tracking-tight">Munim-ji Lite ⚡</h1>
                    <span className="text-xs text-blue-100">{currentShop?.name || "No Shop"}</span>
                </div>
                <div className="flex items-center gap-2">
                    <SalesReturnModal /> {/* Added Professional Return Modal */}

                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={syncInventory}
                        disabled={isSyncing}
                        className="bg-white/20 hover:bg-white/30 text-white border-0"
                    >
                        <RefreshCw className={`w-4 h-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync'}
                    </Button>
                    <span className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium">
                        {navigator.onLine ? "🟢 Online" : "🔴 Offline"}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Left: Product Grid (Big Buttons) */}
                <div className="flex-1 p-4 overflow-y-auto pb-24 md:pb-4 bg-slate-100 dark:bg-slate-900">
                    <div className="mb-4 flex gap-2">
                        <Input
                            id="lite-search-input"
                            placeholder="Search... (F4)"
                            className="h-12 text-lg shadow-sm bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-foreground"
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
                                className="h-auto min-h-[140px] bg-white dark:bg-slate-800 rounded-xl shadow-md border-2 border-slate-200 dark:border-slate-700 p-3 flex flex-col items-center justify-between hover:border-blue-400 hover:shadow-lg active:scale-95 transition-all group relative overflow-hidden text-left"
                            >
                                <div className="w-full">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-base text-slate-800 dark:text-white leading-tight line-clamp-2">{prod.medicine_name}</span>
                                        <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold shadow-sm whitespace-nowrap">₹{prod.unit_price}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono space-y-0.5">
                                        <div className="flex justify-between">
                                            <span>📦 B: <span className="text-slate-700 dark:text-slate-300 font-bold">{prod.batch_number || 'N/A'}</span></span>
                                            <span>📅 {prod.expiry_date || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>📍 {prod.rack_number ? `R:${prod.rack_number} S:${prod.shelf_number || '-'}` : 'No Loc'}</span>
                                            <span>Qty: {prod.quantity}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full mt-2 text-center text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                    Click to Add +
                                </div>
                            </button>
                        ))}
                        {products?.length === 0 && (
                            <div className="col-span-full text-center py-10 text-slate-500 dark:text-slate-400">
                                No items found. Run "Sync" first.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Cart Panel */}
                <div className="md:w-96 bg-white dark:bg-slate-800 shadow-xl border-l border-slate-200 dark:border-slate-700 flex flex-col z-20">
                    <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5" /> Current Bill
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900">
                        {cart.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 dark:text-slate-400 font-medium">Empty Cart</div>
                        ) : cart.map((line) => (
                            <div
                                key={line.item.id}
                                className="flex justify-between items-center p-3 border-2 border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 touch-pan-y shadow-sm"
                                onTouchStart={onTouchStart}
                                onTouchMove={onTouchMove}
                                onTouchEnd={() => onTouchEnd(line.item.id)}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-slate-800 dark:text-white truncate">{line.item.medicine_name}</div>
                                    <div className="text-sm text-slate-600 dark:text-slate-300">
                                        ₹{line.item.unit_price} × {line.qty}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">₹{line.item.unit_price * line.qty}</span>
                                    <Button variant="ghost" size="icon" className="hover:bg-red-100 dark:hover:bg-red-900/30" onClick={() => withHaptic(() => removeFromCart(line.item.id))}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Safety Warnings */}
                    {(interactions.length > 0 || checkingSafety) && (
                        <div className={`p-3 border-t border-slate-200 dark:border-slate-700 ${interactions.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50'}`}>
                            {checkingSafety ? (
                                <p className="text-xs text-muted-foreground flex items-center gap-2">
                                    <RefreshCw className="w-3 h-3 animate-spin" /> Checking interactions...
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                                        <ShieldAlert className="w-3 h-3" /> INTERACTION ALERT
                                    </p>
                                    {interactions.map((msg, idx) => (
                                        <p key={idx} className="text-xs text-red-700 dark:text-red-300">• {msg}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-4">
                        <div className="flex justify-between text-xl font-bold text-slate-800 dark:text-white">
                            <span>Total</span>
                            <span className="text-emerald-600 dark:text-emerald-400">₹{calculateTotal()}</span>
                        </div>

                        {/* Payment Mode Selector */}
                        <div className="grid grid-cols-4 gap-2">
                            {["cash", "upi", "card", "credit"].map((mode) => (
                                <Button
                                    key={mode}
                                    variant={paymentMode === mode ? "default" : "outline"}
                                    className={`capitalize h-8 text-xs ${paymentMode === mode ?
                                        (mode === 'credit' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')
                                        : ''}`}
                                    onClick={() => setPaymentMode(mode)}
                                >
                                    {mode}
                                </Button>
                            ))}
                        </div>

                        {/* Customer Selector (Visible only if Credit is selected) */}
                        {paymentMode === 'credit' && (
                            <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                                <p className="text-xs text-red-600 mb-1 font-medium">Customer Required for Udhaar</p>
                                <CustomerSearch
                                    selectedCustomer={selectedCustomer}
                                    onSelect={setSelectedCustomer}
                                />
                                {selectedCustomer && (
                                    <div className="text-xs mt-1 text-slate-500">
                                        Current Due: <span className="font-bold text-red-600">₹{selectedCustomer.credit_balance}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button
                                size="lg"
                                variant="outline"
                                className="h-14 w-14 border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                                onClick={() => withHaptic(handleWhatsAppShare)}
                                title="Share Bill on WhatsApp"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-phone"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                            </Button>
                            <Button
                                size="lg"
                                className="h-14 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-lg flex flex-col items-center justify-center leading-none px-6"
                                onClick={() => withHaptic(handleFastCheckout)}
                                disabled={isCheckingOut || cart.length === 0 || paymentMode === 'credit'}
                                title="Skip details, just cash"
                            >
                                <span className="text-xs uppercase opacity-80 mb-1">Fast Cash</span>
                                <span className="text-lg">⚡ Pay</span>
                            </Button>
                            <Button
                                size="lg"
                                className={`flex-1 h-14 text-xl font-bold text-white active:scale-95 transition-transform shadow-lg ${paymentMode === 'credit' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                onClick={() => withHaptic(handleCheckout)}
                                disabled={isCheckingOut || cart.length === 0 || (paymentMode === 'credit' && !selectedCustomer)}
                            >
                                {isCheckingOut ? "Saving..." : (paymentMode === 'credit' ? "Confirm Udhaar" : "Checkout (₹)")}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Floating Action Button (FAB) for Voice */}
            <div className="md:hidden fixed bottom-6 right-6 z-50">
                <div className="bg-blue-600 text-white rounded-full p-2 shadow-2xl">
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
