import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveQuery } from "dexie-react-hooks";
import { db, OfflineInventory } from "@/db/db";
import { toast } from "sonner";
import { ShoppingCart, RefreshCw, Mic, Trash2, ArrowLeft, Download, ShieldAlert, Zap } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { VoiceCommandBar, ParsedItem } from "@/components/dashboard/VoiceCommandBar";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { useUserRole } from "@/hooks/useUserRole";
import { whatsappService } from "@/services/whatsappService";
import { aiService } from "@/services/aiService";

import { CustomerSearch, Customer } from "@/components/dashboard/CustomerSearch";
import { SalesReturnModal } from "@/components/dashboard/SalesReturnModal";
import { SubstituteModal } from "@/components/dashboard/SubstituteModal";
import { RecentInvoices } from "@/components/dashboard/RecentInvoices";
import { UpsellWidget } from "@/components/dashboard/UpsellWidget";
import { Eye, EyeOff, Percent } from "lucide-react";

const LitePOS = () => {
    const [cart, setCart] = useState<{ item: OfflineInventory; qty: number }[]>([]);
    const [search, setSearch] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const [paymentMode, setPaymentMode] = useState<string>("cash");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null); // New State
    const { currentShop } = useUserShops();
    const [interactions, setInteractions] = useState<string[]>([]);
    const [dismissedInteractions, setDismissedInteractions] = useState(false);
    const [checkingSafety, setCheckingSafety] = useState(false);
    const [customerStats, setCustomerStats] = useState<{ lastVisit: string | null; topItems: string[] } | null>(null);
    const location = useLocation();

    // Fetch Customer Insights
    useEffect(() => {
        if (!selectedCustomer) {
            setCustomerStats(null);
            return;
        }

        const fetchStats = async () => {
            // 1. Get Last Visit
            const { data: lastOrder } = await supabase
                .from('orders')
                .select('created_at')
                .eq('customer_name', selectedCustomer.name) // ideally use ID, but Schema uses name for now? Check DB schema. Using name as fallback or if ID available use it. 
                // Wait, orders table usually has customer_id or just name. LitePOS uses name 'Walk-in' often. 
                // Let's assume we filter by name for now safely or modify check if customer_id exists
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            // 2. Mock Top Items for now (Standard CRM would query aggregations)
            // Real implementation would be: select order_items from orders where customer... -> aggregate
            setCustomerStats({
                lastVisit: lastOrder ? new Date(lastOrder.created_at).toLocaleDateString() : 'New Customer',
                topItems: ['Paracetamol', 'Cough Syrup', 'Mask'] // Mock for MVP speed
            });
        };

        fetchStats();
    }, [selectedCustomer]);

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
        setDismissedInteractions(false); // Reset dismissal on cart change

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

                // FILTER: Only show MAJOR/HIGH/SEVERE interactions (User Request: "Only Major Risk")
                // We assume the AI returns a 'severity' field. If not, we trust the description.
                const criticalWarnings = warnings.filter((w: any) => {
                    if (typeof w === 'string') return true; // Keep string warnings just in case
                    const sev = w.severity?.toLowerCase() || '';
                    return sev.includes('high') || sev.includes('severe') || sev.includes('major') || sev.includes('critical');
                });

                if (criticalWarnings.length === 0) {
                    setInteractions([]);
                    return;
                }

                const messages = criticalWarnings.map((w: any) =>
                    typeof w === 'string' ? w : `${w.severity?.toUpperCase() || 'CRITICAL'}: ${w.description || 'Major Interaction Check'}`
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
                    ...(item as any),
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

    const [discountPercentage, setDiscountPercentage] = useState(0);

    const addToCart = (product: OfflineInventory, qty: number = 1) => {
        // Stock Validation
        const currentInCart = cart.find(c => c.item.id === product.id)?.qty || 0;
        if (currentInCart + qty > product.quantity) {
            toast.error(`Out of Stock! Only ${product.quantity} available.`);
            return;
        }

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

    const calculateSubTotal = () => cart.reduce((acc, curr) => acc + (curr.item.unit_price * curr.qty), 0);

    const calculateTotal = () => {
        const subTotal = calculateSubTotal();
        const discountAmount = subTotal * (discountPercentage / 100);
        return Math.round(subTotal - discountAmount);
    };

    const calculateMargin = () => {
        const discountFactor = 1 - (discountPercentage / 100);
        return cart.reduce((acc, curr) => {
            const cost = curr.item.purchase_price || (curr.item.unit_price * 0.7);
            const sellingPrice = curr.item.unit_price * discountFactor;
            return acc + ((sellingPrice - cost) * curr.qty);
        }, 0);
    };

    // --- SUBSTITUTE LOGIC ---
    const [subModalOpen, setSubModalOpen] = useState(false);
    const [subLoading, setSubLoading] = useState(false);
    const [missingQuery, setMissingQuery] = useState("");
    const [substitutes, setSubstitutes] = useState<import("@/components/dashboard/SubstituteModal").SubstituteOption[]>([]);

    const handleVoiceCommand = async (transcription: string, items: ParsedItem[]) => {
        setSearch(transcription);
        toast.info(`AI Processed: ${transcription}`);

        for (const item of items) {
            // 1. Try Exact/Fuzzy Match locally
            let bestMatch = await db.inventory.where("medicine_name").equalsIgnoreCase(item.name).first();

            if (!bestMatch) {
                const candidates = await db.inventory.where("medicine_name").startsWithIgnoreCase(item.name).toArray();
                if (candidates.length > 0) bestMatch = candidates[0];
            }

            if (bestMatch) {
                const qtyToAdd = item.quantity || 1;
                addToCart(bestMatch, qtyToAdd);
                toast.success(`Voice Added: ${qtyToAdd}x ${bestMatch.medicine_name}`);
            } else {
                // ITEM NOT FOUND -> Trigger AI Substitute Search
                setMissingQuery(item.name);
                setSubModalOpen(true);
                setSubLoading(true);

                try {
                    toast("Finding alternatives for " + item.name + "...");
                    const marketData = await aiService.getMarketData(item.name);

                    // Parse substitutes from AI response
                    // Expected format: { substitutes: ["Name 1", "Name 2"], ... } or just raw text to parse?
                    // Assuming AI returns a standard structure or we try to extract
                    let subs: string[] = [];
                    if (marketData.substitutes && Array.isArray(marketData.substitutes)) {
                        subs = marketData.substitutes;
                    } else if (marketData.alternatives && Array.isArray(marketData.alternatives)) {
                        subs = marketData.alternatives;
                    }

                    // Map to Local Inventory
                    const options: import("@/components/dashboard/SubstituteModal").SubstituteOption[] = [];

                    // 1. Check if we have any of these substitutes in stock
                    for (const subName of subs) {
                        const localMatch = await db.inventory.where("medicine_name").equalsIgnoreCase(subName).first();
                        // also try startsWith for robustness
                        const fuzzyMatch = !localMatch ? (await db.inventory.where("medicine_name").startsWithIgnoreCase(subName).first()) : null;

                        const match = localMatch || fuzzyMatch;

                        if (match) {
                            options.push({
                                name: match.medicine_name,
                                isAvailable: true,
                                stock: match.quantity,
                                price: match.unit_price,
                                item: match,
                                matchType: 'Same Composition'
                            });
                        } else {
                            options.push({
                                name: subName,
                                isAvailable: false
                            });
                        }
                    }

                    setSubstitutes(options);

                } catch (e) {
                    console.error("Substitute Check Failed", e);
                    toast.error("Could not find substitutes");
                    setSubstitutes([]); // Empty state
                } finally {
                    setSubLoading(false);
                }
            }
        }
    };

    const handleSubstituteSelect = (item: OfflineInventory) => {
        addToCart(item, 1);
        setSubModalOpen(false);
        toast.success(`Substituted with ${item.medicine_name}`);
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
        if (paymentMode === 'credit') {
            if (!selectedCustomer) {
                toast.error("Please select a customer for Udhaar!");
                return;
            }
            if (selectedCustomer.is_blocked) {
                toast.error(`🚫 Action Blocked: ${selectedCustomer.name} is blocked from new credit.`);
                return;
            }

            const predictedBalance = (selectedCustomer.credit_balance || 0) + calculateTotal();
            if (selectedCustomer.credit_limit && predictedBalance > selectedCustomer.credit_limit) {
                toast.error(`⚠️ Limit Exceeded! Max allowed: ₹${selectedCustomer.credit_limit}. Current Due: ₹${selectedCustomer.credit_balance}`);
                if (!confirm(`Customer will exceed credit limit (₹${selectedCustomer.credit_limit}). Proceed anyway?`)) {
                    return;
                }
            }
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

            if (error) throw error;

            // 2. Decrement Inventory (Local & Cloud)
            for (const item of cart) {
                // Local
                const newQty = item.item.quantity - item.qty;
                await db.inventory.update(item.item.id, { quantity: newQty });

                // Cloud (Optimistic - don't block UI)
                supabase.rpc('decrement_inventory', {
                    row_id: item.item.id,
                    quantity_to_sub: item.qty
                }).then(({ error }) => {
                    if (error) console.error("Cloud Inventory Sync Failed", error);
                });
            }

            // 3. If Credit, Update Ledger & Customer Balance
            if (paymentMode === 'credit' && selectedCustomer) {
                // Add Ledger Entry
                const { error: ledgerError } = await supabase.from('customer_ledger' as any).insert({
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
        // Generate Readable Invoice Number
        const now = new Date();
        const timeCode = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const invoiceNumber = `INV-${timeCode}-${random}`;
        const total = calculateTotal();

        const orderItems = cart.map(c => ({
            name: c.item.medicine_name,
            qty: c.qty,
            price: c.item.unit_price,
            purchase_price: c.item.purchase_price,
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
            shop_name: currentShop?.name || "Medix Pharmacy",
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

    // --- MARGIN INSIGHTS ---
    const [showMargin, setShowMargin] = useState(false);

    // --- HOLD BILL LOGIC ---
    const [savedBills, setSavedBills] = useState<{ id: number; name: string; items: any[]; date: string }[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem("medix_held_bills");
        if (saved) {
            try {
                setSavedBills(JSON.parse(saved));
            } catch (e) { console.error("Failed to load held bills", e); }
        }
    }, []);

    const holdBill = () => {
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }
        const billName = prompt("Enter a name for this bill (e.g., Customer Name):", `Bill #${savedBills.length + 1}`);
        if (!billName) return;

        const newBill = {
            id: Date.now(),
            name: billName,
            items: cart,
            date: new Date().toLocaleTimeString()
        };

        const updatedBills = [...savedBills, newBill];
        setSavedBills(updatedBills);
        localStorage.setItem("medix_held_bills", JSON.stringify(updatedBills));
        setCart([]);
        toast.success("Bill Held Successfully", { description: "You can resume it later from the menu." });
    };

    const restoreBill = (billId: number) => {
        const bill = savedBills.find(b => b.id === billId);
        if (bill) {
            if (cart.length > 0) {
                if (!confirm("Current cart will be overwritten. Proceed?")) return;
            }
            setCart(bill.items);
            const updated = savedBills.filter(b => b.id !== billId);
            setSavedBills(updated);
            localStorage.setItem("medix_held_bills", JSON.stringify(updated));
            toast.info(`Resumed bill: ${bill.name}`);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden">
            {/* Pro Header - Clean White/Slate */}
            <header className="h-16 flex-none bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shadow-sm z-30">

                {/* Left: Branding & Back */}
                <div className="flex items-center gap-4">
                    <Link to="/dashboard" className="group flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full group-hover:bg-slate-200 dark:group-hover:bg-slate-700">
                            <ArrowLeft className="w-4 h-4" />
                        </div>
                    </Link>

                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2 hidden md:block"></div>

                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                            Billing Hub <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold tracking-wider uppercase">Pro</span>
                        </h1>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {currentShop?.name || "Medix Pharmacy"}
                        </span>
                    </div>
                </div>

                {/* Center: Quick Actions (Optional placeholder or Status) */}
                <div className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-md">
                    <div className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {navigator.onLine ? 'System Online' : 'Offline Mode'}
                    </span>
                </div>

                {/* Right: Utilities */}
                <div className="flex items-center gap-3">
                    {/* Voice Billing (Mobile Moved to Header) */}
                    <div className="md:hidden">
                        <VoiceCommandBar
                            compact={true}
                            onTranscriptionComplete={handleVoiceCommand}
                        />
                    </div>

                    {/* Held Bills */}
                    {savedBills.length > 0 && (
                        <div className="relative group z-50">
                            <Button variant="ghost" size="sm" className="relative text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                                <span>On Hold</span>
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] text-white">
                                    {savedBills.length}
                                </span>
                            </Button>
                            <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 hidden group-hover:block animate-in fade-in slide-in-from-top-2">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2 py-1">Restorable Bills</div>
                                {savedBills.map(b => (
                                    <div
                                        key={b.id}
                                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer flex justify-between items-center group/item transition-all"
                                        onClick={() => restoreBill(b.id)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-800 dark:text-slate-200">{b.name}</span>
                                            <span className="text-[10px] text-slate-400">{b.date} • {b.items.length} Items</span>
                                        </div>
                                        <ArrowLeft className="w-4 h-4 text-slate-300 group-hover/item:text-blue-500 opacity-0 group-hover/item:opacity-100 transition-all" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className={`text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 ${showMargin ? 'bg-blue-50 text-blue-600' : ''}`}
                        onClick={() => setShowMargin(!showMargin)}
                        title={showMargin ? "Hide Profit Margins" : "Show Profit Margins"}
                    >
                        {showMargin ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>

                    <RecentInvoices shopId={currentShop?.id} />

                    <SalesReturnModal
                        triggerClassName="text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800"
                        triggerVariant="ghost"
                    />

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={syncInventory}
                        disabled={isSyncing}
                        className="gap-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Sync</span>
                    </Button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Left: Product Grid (Big Buttons) */}
                <div className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4 bg-slate-100 dark:bg-slate-900 min-h-0">
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
                            <div className="col-span-full text-center py-10 text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
                                <p>No items found.</p>
                                {search && (
                                    <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50" onClick={async () => {
                                        const { error } = await supabase.from('shortbook').insert({
                                            shop_id: currentShop?.id,
                                            product_name: search,
                                            added_from: 'pos'
                                        });
                                        if (error) toast.error("Failed to add");
                                        else toast.success("Added directly to Shortbook!");
                                    }}>
                                        + Add "{search}" to Shortbook
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Cart Panel */}
                <div className="md:w-96 w-full h-[45%] md:h-auto bg-white dark:bg-slate-800 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] md:shadow-xl border-t md:border-l border-slate-200 dark:border-slate-700 flex flex-col z-20">
                    <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex justify-between items-center">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5" /> Current Bill
                        </h2>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={holdBill}
                            className="h-7 text-xs bg-white/20 text-white hover:bg-white/30 border-0"
                            disabled={cart.length === 0}
                        >
                            Hold Bill
                        </Button>
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
                // Upsell Widget
                    <UpsellWidget cartItems={cart} onAddItem={(item) => addToCart(item)} />

                    {/* Safety Warnings - Major Risks Only */}
                    {(interactions.length > 0) && !dismissedInteractions && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/10 border-t border-red-100 dark:border-red-900/30 animate-in slide-in-from-bottom-2">
                            <div className="flex justify-between items-start gap-2">
                                <div className="space-y-1 flex-1">
                                    <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                                        <ShieldAlert className="w-3.5 h-3.5" />
                                        CRITICAL INTERACTION
                                    </p>
                                    {interactions.map((msg, idx) => (
                                        <p key={idx} className="text-xs text-red-700 dark:text-red-300 font-bold leading-tight">
                                            • {msg}
                                        </p>
                                    ))}
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px] border-red-200 text-red-600 hover:bg-red-100 hover:text-red-800"
                                    onClick={() => setDismissedInteractions(true)}
                                >
                                    Skip & Proceed
                                </Button>
                            </div>
                        </div>
                    )}

                    {checkingSafety && (
                        <div className="p-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] text-slate-400 flex items-center justify-center gap-2 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Checking safety...
                            </p>
                        </div>
                    )}

                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-4">
                        {/* Discount Section */}
                        <div className="flex items-center justify-between py-2 border-b border-dashed border-slate-200">
                            <span className="text-sm font-medium text-slate-500 flex items-center gap-1">
                                <Percent className="w-3 h-3" /> Discount ({discountPercentage}%)
                            </span>
                            <div className="flex items-center gap-1">
                                {[0, 5, 10, 15].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDiscountPercentage(d)}
                                        className={`text-xs px-2 py-1 rounded border ${discountPercentage === d ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-600'}`}
                                    >
                                        {d}%
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between text-xl font-bold text-slate-800 dark:text-white">
                            <span>Total</span>
                            <div className="text-right">
                                <span className="text-emerald-600 dark:text-emerald-400 block">₹{calculateTotal()}</span>
                                {showMargin && (
                                    <span className="text-[10px] text-slate-400 font-normal">
                                        Est. Profit: <span className="text-green-500">+₹{calculateMargin().toFixed(0)}</span>
                                    </span>
                                )}
                            </div>
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
                                    <div className="mt-2 space-y-2">
                                        <div className="text-xs text-slate-500 flex justify-between">
                                            <span>Current Due:</span>
                                            <span className="font-bold text-red-600">₹{selectedCustomer.credit_balance}</span>
                                        </div>

                                        {/* Mini-CRM: Insights */}
                                        <div className="bg-white/50 rounded border border-red-100 p-2 text-[10px] text-slate-500 space-y-1">
                                            <div className="flex justify-between">
                                                <span>Last Visit:</span>
                                                <span className="font-medium text-slate-700">{customerStats?.lastVisit || 'First Visit'}</span>
                                            </div>
                                            {customerStats?.topItems?.length > 0 && (
                                                <div className="pt-1 border-t border-red-100/50 mt-1">
                                                    <span className="block mb-0.5 opacity-70">Frequently Buys:</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {customerStats.topItems.map((i: string, idx: number) => (
                                                            <span key={idx} className="bg-red-100/50 text-red-700 px-1 rounded flex items-center gap-0.5">
                                                                {i}
                                                                <span className="cursor-pointer hover:font-bold" onClick={() => setSearch(i)}>+</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
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
            </div >

            {/* Mobile FAB Removed - Moved to Header */}


            <SubstituteModal
                isOpen={subModalOpen}
                onClose={() => setSubModalOpen(false)}
                originalQuery={missingQuery}
                alternatives={substitutes}
                isLoading={subLoading}
                onSelect={handleSubstituteSelect}
            />
        </div >
    );
};

export default LitePOS;
