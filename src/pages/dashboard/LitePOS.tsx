import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveQuery } from "dexie-react-hooks";
import { db, OfflineInventory } from "@/db/db";
import { toast } from "sonner";
import {
    ShoppingCart, RefreshCw, Mic, Trash2, ArrowLeft, ShieldAlert,
    Zap, AlertTriangle, X, TrendingUp, Search, CreditCard,
    User, Save, RotateCcw, Box, MapPin, IndianRupee
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { VoiceCommandBar, ParsedItem } from "@/components/dashboard/VoiceCommandBar";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { useUserRole } from "@/hooks/useUserRole";
import { drugService } from "@/services/drugService";
import { whatsappService } from "@/services/whatsappService";
import { aiService } from "@/services/aiService";
import { CustomerSearch, Customer } from "@/components/dashboard/CustomerSearch";
import { SubstituteModal } from "@/components/dashboard/SubstituteModal";

const LitePOS = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentShop } = useUserShops();
    const { canModify } = useUserRole(currentShop?.id);

    // --- STATE MANAGEMENT ---
    const [cart, setCart] = useState<{ item: OfflineInventory; qty: number }[]>([]);
    const [search, setSearch] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const [paymentMode, setPaymentMode] = useState<string>("cash");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [discountPercentage, setDiscountPercentage] = useState(0);

    // Safety & AI
    const [interactions, setInteractions] = useState<string[]>([]);
    const [dismissedInteractions, setDismissedInteractions] = useState(false);
    const [smartSuggestions, setSmartSuggestions] = useState<Record<string, OfflineInventory[]>>({});
    const [subModalOpen, setSubModalOpen] = useState(false);
    const [substitutes, setSubstitutes] = useState<any[]>([]);

    // UI State
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [showInteractionDialog, setShowInteractionDialog] = useState(false);

    // --- CORE LOGIC: SYNC & LOAD ---
    const syncInventory = async () => {
        if (!currentShop?.id) return;
        setIsSyncing(true);
        const toastId = toast.loading("Syncing Inventory...");
        try {
            const { data, error } = await supabase
                .from('inventory')
                .select('*')
                .eq('shop_id', currentShop.id)
                .gt('quantity', 0);

            if (error) throw error;

            if (data) {
                await db.inventory.clear();
                await db.inventory.bulkAdd(data.map(item => ({ ...(item as any), is_synced: 1 })));
                toast.success(`Synced ${data.length} items`, { id: toastId });
            }
        } catch (e: any) {
            toast.error("Sync Failed: " + e.message, { id: toastId });
        } finally {
            setIsSyncing(false);
        }
    };

    // Initial Sync Check
    useEffect(() => {
        if (currentShop?.id && navigator.onLine) {
            db.inventory.count().then(c => { if (c === 0) syncInventory(); });
        }
    }, [currentShop?.id]);

    // Live Inventory Query
    const products = useLiveQuery(
        () => search
            ? db.inventory.where("medicine_name").startsWithIgnoreCase(search).limit(20).toArray()
            : db.inventory.limit(20).toArray(),
        [search]
    );

    // --- CART ACTIONS ---
    const addToCart = (product: OfflineInventory, qty: number = 1) => {
        setCart(prev => {
            const existing = prev.find(c => c.item.id === product.id);
            if (existing) {
                if (existing.qty + qty > product.quantity) {
                    toast.error(`Low Stock: Only ${product.quantity} available`);
                    return prev;
                }
                return prev.map(c => c.item.id === product.id ? { ...c, qty: c.qty + qty } : c);
            }
            if (qty > product.quantity) {
                toast.error(`Out of Stock!`);
                return prev;
            }
            return [...prev, { item: product, qty }];
        });
        setSearch(""); // Clear search after add for speed
        searchInputRef.current?.focus(); // Keep focus
    };

    const updateQty = (id: string, delta: number) => {
        setCart(prev => prev.map(c => {
            if (c.item.id === id) {
                const newQty = Math.max(1, c.qty + delta);
                if (newQty > c.item.quantity) {
                    toast.error("Max stock reached");
                    return c;
                }
                return { ...c, qty: newQty };
            }
            return c;
        }));
    };

    const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.item.id !== id));

    // --- CALCULATIONS ---
    const totals = () => {
        const subtotal = cart.reduce((acc, c) => acc + (c.item.unit_price * c.qty), 0);
        const discount = subtotal * (discountPercentage / 100);
        const total = Math.round(subtotal - discount);
        const tax = total * 0.12; // Approx GST included or extra depending on logic. Assuming included in MRP usually, but for bill display:
        // Let's assume Unit Price is MRP (Inclusive).
        return { subtotal, discount, total };
    };

    // --- AI & SAFETY CHECKS ---
    useEffect(() => {
        setDismissedInteractions(false);
        const checkSafety = async () => {
            if (cart.length < 2) { setInteractions([]); return; }
            const risk = await aiService.checkInteractions(cart.map(c => c.item.medicine_name));
            setInteractions(risk.map((r: any) => typeof r === 'string' ? r : r.description));
        };
        const timer = setTimeout(checkSafety, 1500);
        return () => clearTimeout(timer);
    }, [cart]);

    useEffect(() => {
        // Smart Margins (Upsell)
        cart.forEach(async (entry) => {
            // Mock check for high margin subs
            // In real app, call drugService.findBetterMarginSubstitutes
        });
    }, [cart]);

    // --- CHECKOUT PROCESS ---
    const handleCheckout = async () => {
        if (!currentShop?.id || cart.length === 0) return;
        if (interactions.length > 0 && !dismissedInteractions) {
            setShowInteractionDialog(true);
            return;
        }

        setIsCheckingOut(true);
        const { total } = totals();
        const invoiceNum = `POS-${Date.now().toString().slice(-6)}`;

        const orderData = {
            shop_id: currentShop.id,
            customer_name: paymentMode === 'credit' ? selectedCustomer?.name : "Walk-in",
            customer_phone: selectedCustomer?.phone,
            total_amount: total,
            status: 'approved', // Auto-approve POS sales
            source: 'lite_pos',
            payment_mode: paymentMode,
            payment_status: paymentMode === 'credit' ? 'unpaid' : 'paid',
            invoice_number: invoiceNum,
            order_items: cart.map(c => ({
                name: c.item.medicine_name,
                qty: c.qty,
                price: c.item.unit_price,
                inventory_id: c.item.id,
                batch: c.item.batch_number
            }))
        };

        try {
            // 1. Save Online
            if (navigator.onLine) {
                const { error } = await supabase.from('orders').insert(orderData);
                if (error) throw error;

                // Credit Ledger
                if (paymentMode === 'credit' && selectedCustomer) {
                    await supabase.from('customer_ledger' as any).insert({
                        shop_id: currentShop.id,
                        customer_id: selectedCustomer.id,
                        amount: total,
                        transaction_type: 'DEBIT',
                        description: `POS Sale ${invoiceNum}`
                    });
                }
            } else {
                // Save Offline
                await db.orders.add({ ...orderData, created_at: new Date().toISOString(), is_synced: 0 });
                toast.warning("Saved Offline. Will sync later.");
            }

            toast.success(`Billing Complete: ₹${total}`);

            // WhatsApp Share
            if (orderData.customer_phone) {
                // Auto-trigger WhatsApp for seamless exp? Or just notify
            }

            setCart([]);
            setSelectedCustomer(null);
            setPaymentMode("cash");
            setDiscountPercentage(0);

        } catch (e: any) {
            toast.error("Checkout Failed: " + e.message);
        } finally {
            setIsCheckingOut(false);
            setShowInteractionDialog(false);
        }
    };

    // --- KEYBOARD SHORTCUTS ---
    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (e.key === "F2") { e.preventDefault(); searchInputRef.current?.focus(); }
            if (e.key === "F4" && cart.length > 0) { e.preventDefault(); handleCheckout(); }
        };
        window.addEventListener("keydown", handleKeys);
        return () => window.removeEventListener("keydown", handleKeys);
    }, [cart, interactions, dismissedInteractions]); // Re-bind on state change for safety

    // --- RENDER HELPERS ---
    const { subtotal, discount, total } = totals();

    return (
        <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden font-sans">
            {/* --- HEADER --- */}
            <div className="h-16 border-b bg-white dark:bg-slate-900 flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            Billing Hub
                        </h1>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className={isSyncing ? "animate-pulse text-blue-500" : "text-green-500"}>●</span>
                            {isSyncing ? "Syncing..." : "System Online"}
                            <span className="text-slate-300">|</span>
                            <span>{currentShop?.name || "No Shop"}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={syncInventory} disabled={isSyncing} className="hidden md:flex">
                        <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                        Sync Stock
                    </Button>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
                    <VoiceCommandBar onTranscriptionComplete={(txt, items) => {
                        setSearch(txt);
                        // Mock adding first item found
                    }} />
                </div>
            </div>

            {/* --- MAIN CONTENT (SPLIT VIEW) --- */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT: PRODUCT CATALOG (65%) */}
                <div className="flex-1 flex flex-col p-4 gap-4 bg-slate-50/50 dark:bg-slate-950">
                    {/* Search Bar */}
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            ref={searchInputRef}
                            placeholder="Scan Barcode / Search Medicine (F2)..."
                            className="h-14 pl-12 text-lg shadow-sm border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl bg-white dark:bg-slate-900 transition-all text-black"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                            <Badge variant="outline" className="text-xs text-slate-400 font-mono hidden md:flex">F2 to Focus</Badge>
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start pb-20">
                        {products?.map((product) => (
                            <div
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 cursor-pointer hover:shadow-lg hover:border-blue-400/50 hover:-translate-y-1 transition-all duration-200"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center font-bold text-xs uppercase shadow-inner">
                                        {product.medicine_name.slice(0, 2)}
                                    </div>
                                    <Badge variant={product.quantity > 10 ? "secondary" : "destructive"} className="text-[10px]">
                                        {product.quantity} left
                                    </Badge>
                                </div>
                                <h3 className="font-semibold text-slate-800 dark:text-slate-100 leading-tight mb-1 truncate" title={product.medicine_name}>
                                    {product.medicine_name}
                                </h3>
                                <p className="text-xs text-slate-400 mb-3 truncate">{product.generic_name || "Generic"}</p>

                                <div className="flex items-center justify-between mt-auto">
                                    <span className="font-bold text-lg text-slate-700 dark:text-slate-200">₹{product.unit_price}</span>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                        <MapPin className="w-3 h-3" />
                                        {product.rack_number || "-"}/{product.shelf_number || "-"}
                                    </div>
                                </div>

                                {/* Hover Effect */}
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform rounded-b-xl" />
                            </div>
                        ))}

                        {/* Empty State */}
                        {(products?.length === 0 && search) && (
                            <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
                                <Box className="w-12 h-12 mb-3 opacity-20" />
                                <p>No products found for "{search}"</p>
                                <Button variant="link" onClick={() => setSearch("")}>Clear Search</Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: BILL DESK (35%) */}
                <div className="w-full max-w-[450px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl flex flex-col z-20">

                    {/* Customer Header */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                        <CustomerSearch
                            onSelect={setSelectedCustomer}
                            placeholder="Adding to Bill: Walk-in Client..."
                            className="bg-white dark:bg-slate-900 border-slate-200 shadow-sm"
                        />
                        {selectedCustomer && (
                            <div className="mt-2 flex justify-between items-center text-xs text-blue-600 px-1">
                                <span>Credit Limit: ₹{selectedCustomer.credit_limit || 0}</span>
                                <span className="font-bold">Due: ₹{selectedCustomer.credit_balance || 0}</span>
                            </div>
                        )}
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                                    <ShoppingCart className="w-8 h-8 opacity-20" />
                                </div>
                                <p className="font-medium">Cart is empty</p>
                                <p className="text-xs max-w-[200px] text-center">Scan a barcode or search for items to begin billing.</p>
                            </div>
                        ) : (
                            cart.map((c, i) => (
                                <div key={c.item.id} className="group flex flex-col gap-2 p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-blue-100 hover:bg-blue-50/30 transition-all bg-white dark:bg-slate-900/50">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 line-clamp-1">{c.item.medicine_name}</h4>
                                            <div className="text-xs text-slate-500 mt-0.5">₹{c.item.unit_price} / unit</div>
                                        </div>
                                        <div className="font-bold text-slate-900 dark:text-slate-100">
                                            ₹{Math.round(c.item.unit_price * c.qty)}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                                            <button onClick={() => updateQty(c.item.id, -1)} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-md transition-colors font-bold text-slate-500">−</button>
                                            <span className="text-sm font-bold w-4 text-center">{c.qty}</span>
                                            <button onClick={() => updateQty(c.item.id, 1)} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-md transition-colors font-bold text-blue-600">+</button>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-red-500" onClick={() => removeFromCart(c.item.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    {/* Warnings */}
                                    {interactions.length > 0 && i === 0 && (
                                        <div className="text-[10px] text-red-500 flex items-center gap-1 mt-1 bg-red-50 p-1 rounded">
                                            <AlertTriangle className="w-3 h-3" /> Potential Interaction Detected
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer / Calculation */}
                    <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] p-4 z-20">
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm text-slate-500">
                                <span>Subtotal</span>
                                <span>₹{subtotal}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-500 items-center">
                                <span className="flex items-center gap-2">
                                    Discount
                                    <Input
                                        type="number"
                                        className="h-6 w-16 text-right text-xs px-1 text-black"
                                        value={discountPercentage}
                                        onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                                        placeholder="%"
                                    />
                                    %
                                </span>
                                <span className="text-red-500">-₹{Math.round(discount)}</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold text-slate-900 dark:text-white pt-2 border-t">
                                <span>Total</span>
                                <span className="text-blue-600">₹{total}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-4 gap-2 mb-3">
                            <Button variant="outline" className="col-span-1 border-dashed text-slate-500" title="Hold Bill" onClick={() => setCart([])}>
                                <Save className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={paymentMode === 'cash' ? "default" : "outline"}
                                onClick={() => setPaymentMode('cash')}
                                className={paymentMode === 'cash' ? "bg-green-600 hover:bg-green-700" : ""}
                            >
                                <IndianRupee className="w-4 h-4 mr-1" /> Cash
                            </Button>
                            <Button
                                variant={paymentMode === 'online' ? "default" : "outline"}
                                onClick={() => setPaymentMode('online')}
                                className={paymentMode === 'online' ? "bg-purple-600 hover:bg-purple-700" : ""}
                            >
                                <Zap className="w-4 h-4 mr-1" /> UPI
                            </Button>
                            <Button
                                variant={paymentMode === 'credit' ? "default" : "outline"}
                                onClick={() => setPaymentMode('credit')}
                                className={paymentMode === 'credit' ? "bg-orange-500 hover:bg-orange-600" : ""}
                            >
                                <User className="w-4 h-4 mr-1" /> Udhaar
                            </Button>
                        </div>

                        <Button
                            size="lg"
                            className={`w-full text-lg font-bold shadow-lg shadow-blue-500/20 ${isCheckingOut ? 'opacity-80' : 'hover:scale-[1.02] transition-transform'}`}
                            onClick={handleCheckout}
                            disabled={cart.length === 0 || isCheckingOut || (paymentMode === 'credit' && !selectedCustomer)}
                        >
                            {isCheckingOut ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <CreditCard className="w-5 h-5 mr-2" />}
                            {paymentMode === 'credit' ? 'Record Udhaar (F4)' : `Collect ₹${total} (F4)`}
                        </Button>
                    </div>
                </div>
            </div>

            {/* --- MODALS --- */}
            {showInteractionDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md border-red-200 shadow-2xl animate-in zoom-in-95 duration-200">
                        <CardHeader className="bg-red-50 border-b border-red-100 pb-4">
                            <CardTitle className="text-red-700 flex items-center gap-2">
                                <ShieldAlert className="w-6 h-6" /> Safety Warning
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="bg-red-50 p-4 rounded-lg text-sm text-red-800 max-h-40 overflow-y-auto">
                                <ul className="list-disc pl-4 space-y-1">
                                    {interactions.map((msg, i) => <li key={i}>{msg}</li>)}
                                </ul>
                            </div>
                            <div className="flex gap-3 justify-end pt-2">
                                <Button variant="outline" onClick={() => setShowInteractionDialog(false)}>Back</Button>
                                <Button variant="destructive" onClick={() => { setDismissedInteractions(true); handleCheckout(); }}>
                                    Ignore & Bill
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default LitePOS;
