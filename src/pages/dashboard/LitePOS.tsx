import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLiveQuery } from "dexie-react-hooks";
import { db, OfflineInventory } from "@/db/db";
import { toast } from "sonner";
import {
    ShoppingCart, Mic, Trash2, ArrowLeft, ShieldAlert,
    Zap, X, TrendingUp, Search, User, IndianRupee, Sparkles,
    Plus, BookmarkPlus, ChevronRight
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { VoiceCommandBar } from "@/components/dashboard/VoiceCommandBar";
import { useUserShops } from "@/hooks/useUserShops";
import { aiService } from "@/services/aiService";
import { CustomerSearch, Customer } from "@/components/dashboard/CustomerSearch";
import { supabase } from "@/integrations/supabase/client";
import VoiceInput from "@/components/common/VoiceInput";
import { whatsappService } from "@/services/whatsappService";
import { drugService } from "@/services/drugService";

const LitePOS = () => {
    const navigate = useNavigate();
    const { currentShop } = useUserShops();
    const [cart, setCart] = useState<{ item: OfflineInventory; qty: number }[]>([]);
    const [search, setSearch] = useState("");
    const [paymentMode, setPaymentMode] = useState<string>("cash");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [discountPercentage, setDiscountPercentage] = useState(0);
    const [interactions, setInteractions] = useState<string[]>([]);
    const [showMobileCatalog, setShowMobileCatalog] = useState(false);
    const [profitStats, setProfitStats] = useState({ totalProfit: 0, margin: 0 });
    const [isSyncing, setIsSyncing] = useState(false);
    const [showGuestDialog, setShowGuestDialog] = useState(false);
    const [guestDetails, setGuestDetails] = useState({ name: "", phone: "" });
    const searchInputRef = useRef<HTMLInputElement>(null);
    const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [alternativeData, setAlternativeData] = useState<{ name: string; substitutes: string[]; targetItemId?: string } | null>(null);
    const [doctorName, setDoctorName] = useState(""); // For H1 Compliance


    const location = useLocation(); // Hook to get navigation state

    // --- VOICE & SCAN COMMAND HANDLER ---
    useEffect(() => {
        const handleIncomingData = async () => {
            const state = location.state as {
                voiceItems?: { name: string, quantity: number }[],
                voiceTranscription?: string,
                importItems?: { name: string, quantity: number }[],
                customerName?: string
            };

            // Set customer name if passed from Scan
            if (state?.customerName && !selectedCustomer) {
                // @ts-ignore
                setSelectedCustomer({ name: state.customerName, phone: "", id: "temp" });
            }

            const itemsToProcess = state?.voiceItems || state?.importItems;

            if (itemsToProcess && itemsToProcess.length > 0 && currentShop?.id) {
                const source = state.voiceItems ? "Voice" : "Prescription Scan";
                const description = state.voiceTranscription || "Imported from Pulse Scan";

                toast.info(`Processing ${source} Data...`, { description });

                const newCartItems: { item: OfflineInventory; qty: number }[] = [];

                // Fetch ALL inventory to match (from Dexie for speed)
                const inventory = await db.inventory.where('shop_id').equals(currentShop.id).toArray();

                for (const incomingItem of itemsToProcess) {
                    const searchName = incomingItem.name.toLowerCase().trim();

                    // Match Logic (Direct Includes)
                    // TODO: Improve with Fuzzy Search if needed
                    const match = inventory.find(i => i.medicine_name.toLowerCase().includes(searchName));

                    if (match) {
                        newCartItems.push({
                            item: match,
                            qty: incomingItem.quantity || 1
                        });
                    } else {
                        // Notify missing item - maybe add as 'Manual' item?
                        // For now just warn
                        toast.warning(`Item not found: ${incomingItem.name}`);
                    }
                }

                if (newCartItems.length > 0) {
                    setCart(prev => {
                        // Avoid duplicates if React Double Invoke happens
                        // We will just append for now, user can dedupe in UI
                        return [...prev, ...newCartItems];
                    });
                    toast.success(`Added ${newCartItems.length} items from ${source}`);

                    // Clean state to prevent re-add on refresh
                    window.history.replaceState({}, '');
                }
            }
        };

        handleIncomingData();
    }, [location.state, currentShop?.id]);

    // Handle Deep Linking for Customer (e.g. from Customers Page)
    useEffect(() => {
        const state = location.state as { customer?: Customer };
        if (state?.customer) {
            setSelectedCustomer(state.customer);
            toast.success(`Customer Selected: ${state.customer.name}`);
        }
    }, [location.state]);

    // --- CHECKOUT LOGIC ---
    const handleCheckout = async () => {
        if (!currentShop?.id || cart.length === 0) return;

        // If no customer selected, prompt for Guest Details (for WhatsApp)
        // Only if not already paying by Credit (which requires a real customer)
        if (!selectedCustomer && paymentMode !== 'credit' && !showGuestDialog) {
            // Check if we want to prompt? Yes, for WhatsApp value
            setShowGuestDialog(true);
            return;
        }

        // If dialog is open, we proceed to confirmCheckout
        await confirmCheckout();
    };

    const confirmCheckout = async () => {
        setShowGuestDialog(false); // Close dialog if open
        const { total } = calculateTotals();
        toast.loading("Processing Order...");

        // LINKED CUSTOMER CREDIT CHECK
        const finalTotal = calculateTotals().total;
        if (paymentMode === 'credit' && selectedCustomer) {
            const currentBal = selectedCustomer.credit_balance || 0;
            const limit = selectedCustomer.credit_limit || 5000;

            if (currentBal + finalTotal > limit) {
                toast.dismiss();
                toast.error(`Credit Limit Exceeded! (Max: ₹${limit})`);
                return;
            }
        }

        // Determine Final Customer Details
        const finalName = selectedCustomer?.name || guestDetails.name || "Walk-in Customer";
        const finalPhone = selectedCustomer?.phone || guestDetails.phone || null;
        let finalCustomerId = selectedCustomer?.id || null;

        try {
            // 1. Try Online Checkout First
            if (navigator.onLine) {
                // AUTO-CREATE CUSTOMER FOR CREDIT (Udhaar)
                if (paymentMode === 'credit' && !finalCustomerId) {
                    if (!finalName || finalName === "Walk-in Customer") {
                        toast.error("Customer Name is required for Credit (Udhaar)!");
                        return;
                    }

                    toast.loading("Creating Account for Credit...");
                    // Check if exists by phone first to avoid dupe? 
                    // For now, simple insert to ensure flow works.
                    const { data: newCust, error: createError } = await supabase
                        .from('customers')
                        .insert({
                            shop_id: currentShop?.id,
                            name: finalName,
                            phone: finalPhone || "",
                            credit_balance: 0
                        })
                        .select()
                        .single();

                    if (createError) {
                        console.error("Failed to create customer", createError);
                        toast.error("Could not create customer account for credit.");
                        return;
                    }
                    finalCustomerId = newCust.id;
                    toast.dismiss();
                    toast.success(`Created account for ${finalName}`);
                }

                try {
                    const { data: order, error: orderError } = await supabase
                        .from("orders")
                        .insert({
                            shop_id: currentShop?.id,
                            customer_name: finalName,
                            customer_phone: finalPhone,
                            doctor_name: doctorName, // Defined in state below
                            customer_id: finalCustomerId,
                            total_amount: total,
                            payment_mode: paymentMode,
                            status: paymentMode === 'credit' ? "pending" : "approved",
                            source: "LitePOS",
                            // FIX: Populate JSONB for Reporting RPC
                            order_items: cart.map(c => ({
                                id: c.item.id,
                                name: c.item.medicine_name,
                                qty: c.qty,
                                price: c.item.unit_price,
                                purchase_price: c.item.purchase_price || 0,
                                schedule_h1: c.item.schedule_h1
                            }))
                        })
                        .select()
                        .single();

                    if (orderError) throw orderError;

                    // 2. Create Order Items
                    const orderItems = cart.map(c => ({
                        order_id: order.id,
                        inventory_id: c.item.id,
                        name: c.item.medicine_name,
                        qty: c.qty,
                        price: c.item.unit_price,
                        cost_price: c.item.purchase_price || 0
                    }));

                    // @ts-ignore
                    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
                    if (itemsError) throw itemsError;

                    {/* 3. Update Inventory (Deduct Stock) */ }
                    for (const c of cart) {
                        // @ts-ignore
                        await supabase.rpc('decrement_stock', {
                            row_id: c.item.id,
                            amount: c.qty
                        });
                    }

                    // 4. Update Customer Credit Balance if payment is credit
                    if (paymentMode === 'credit' && finalCustomerId) {
                        // Re-fetch current balance to be safe or just increment (RPC is better but simple update for now)
                        // Fetch first
                        const { data: freshCust } = await supabase.from('customers').select('credit_balance').eq('id', finalCustomerId).single();
                        const currentBal = freshCust?.credit_balance || 0;
                        const newBalance = currentBal + total;

                        const { error: creditError } = await supabase
                            .from('customers')
                            .update({ credit_balance: newBalance })
                            .eq('id', finalCustomerId);

                        if (creditError) console.error("Credit Balance Update Failed:", creditError);

                        // Log Ledger Entry
                        await supabase.from('ledger_entries').insert({
                            shop_id: currentShop?.id,
                            customer_id: finalCustomerId,
                            amount: total,
                            transaction_type: 'CREDIT', // Matches Customers.tsx logic (CREDIT increases balance)
                            description: `Order #${order.invoice_number || order.id.slice(0, 6)}`
                        });
                    }

                    // Success Online
                    await finalizeSuccess(finalName, finalPhone, order.id, true, total);

                } catch (onlineError) {
                    console.warn("Online Checkout Failed, trying offline...", onlineError);
                    await performOfflineCheckout(finalName, finalPhone, total);
                }
            } else {
                // Offline immediately
                await performOfflineCheckout(finalName, finalPhone, total);
            }

        } catch (err: any) {
            console.error(err);
            toast.dismiss();
            toast.error(`Checkout Failed: ${err.message}`);
        }
    };

    const performOfflineCheckout = async (name: string, phone: string | null, amount: number) => {
        // Save to IndexedDB
        const orderId = await db.orders.add({
            shop_id: currentShop?.id || 'OFFLINE',
            customer_name: name,
            customer_phone: phone || undefined,
            total_amount: amount,
            items: cart.map(c => ({
                id: c.item.id,
                name: c.item.medicine_name,
                qty: c.qty,
                price: c.item.unit_price
            })),
            created_at: new Date().toISOString(),
            is_synced: 0
        });

        // Decrement Local Stock
        for (const c of cart) {
            const item = await db.inventory.get(c.item.id);
            if (item) {
                await db.inventory.update(c.item.id, { quantity: item.quantity - c.qty, is_synced: 0 });
            }
        }

        await finalizeSuccess(name, phone, `OFF-${orderId}`, false, amount);
    };

    const finalizeSuccess = async (name: string, phone: string | null, invoiceId: string, isOnline: boolean, totalAmount: number) => {
        toast.dismiss();

        // 🎉 CELEBRATION CONFETTI
        const confetti = (await import('canvas-confetti')).default;
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#3b82f6', '#8b5cf6']
        });

        // WhatsApp Invoice - Always show option
        if (isOnline) {
            if (phone) {
                const waLink = whatsappService.generateInvoiceLink(phone, {
                    invoice_number: invoiceId.slice(0, 8).toUpperCase(),
                    customer_name: name,
                    shop_name: currentShop?.name || "Medix Pharmacy",
                    created_at: new Date().toISOString(),
                    total_amount: totalAmount,
                    status: paymentMode === 'credit' ? 'pending' : 'paid',
                    items: cart.map(c => ({ name: c.item.medicine_name, qty: c.qty, price: c.item.unit_price }))
                });
                window.open(waLink, '_blank');
                toast.success("Order Placed & WhatsApp Invoice Sent! 🎉");
            } else {
                // Show WhatsApp send button even without phone
                toast.success("Order Placed Successfully! 🎉", {
                    description: "Click below to send invoice via WhatsApp",
                    action: {
                        label: "Send WhatsApp",
                        onClick: () => {
                            const phoneNumber = prompt("Enter customer WhatsApp number (with country code, e.g., +91...):");
                            if (phoneNumber) {
                                const waLink = whatsappService.generateInvoiceLink(phoneNumber, {
                                    invoice_number: invoiceId.slice(0, 8).toUpperCase(),
                                    customer_name: name,
                                    shop_name: currentShop?.name || "Medix Pharmacy",
                                    created_at: new Date().toISOString(),
                                    total_amount: totalAmount,
                                    status: paymentMode === 'credit' ? 'pending' : 'paid',
                                    items: cart.map(c => ({ name: c.item.medicine_name, qty: c.qty, price: c.item.unit_price }))
                                });
                                window.open(waLink, '_blank');
                            }
                        }
                    }
                });
            }
        } else {
            toast.success("Order Saved Offline! (Will Sync Later) 💾");
        }

        setCart([]);
        setPaymentMode('cash');
        setSelectedCustomer(null);
        setGuestDetails({ name: "", phone: "" });
        setInteractions([]);
    };
    const syncInventory = async () => {
        if (!currentShop?.id) return;
        setIsSyncing(true);
        try {
            // 1. Fetch Cloud Inventory
            const { data, error } = await supabase
                .from('inventory')
                .select('*')
                .eq('shop_id', currentShop.id);

            if (error) throw error;

            // 2. Refresh Local DB
            await db.transaction('rw', db.inventory, async () => {
                await db.inventory.where('shop_id').equals(currentShop.id).delete(); // Clear old

                // Map to OfflineInventory format
                const items = data.map((item: any) => ({
                    id: item.id,
                    shop_id: item.shop_id,
                    medicine_name: item.medicine_name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    batch_number: item.batch_number,
                    expiry_date: item.expiry_date,
                    rack_number: item.rack_number,
                    // FIX: Map cost_price from DB to purchase_price in local Dexie
                    purchase_price: item.cost_price || item.purchase_price || 0,
                    generic_name: item.generic_name,
                    composition: item.composition,
                    schedule_h1: item.schedule_h1,
                    manufacturer: item.manufacturer,
                    is_synced: 1
                }));

                await db.inventory.bulkAdd(items);
            });
            toast.success(`Synced ${data.length} items from Cloud`);
        } catch (e) {
            console.error("Sync Failed", e);
            toast.error("Failed to sync inventory");
        } finally {
            setIsSyncing(false);
        }
    };

    // Auto-Sync on Mount or Shop Change
    useEffect(() => {
        if (currentShop?.id) {
            syncInventory();

            // REALTIME SUSCRIPTION
            const channel = supabase
                .channel('pos-inventory-sync')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'inventory', filter: `shop_id=eq.${currentShop?.id}` },
                    async (payload) => {
                        console.log("Realtime Inventory Change:", payload);

                        // Handle DELETE
                        if (payload.eventType === 'DELETE') {
                            await db.inventory.delete(payload.old.id);
                            return;
                        }

                        // Handle INSERT/UPDATE
                        const item = payload.new as any;
                        const offlineItem: OfflineInventory = {
                            id: item.id,
                            shop_id: item.shop_id,
                            medicine_name: item.medicine_name,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            batch_number: item.batch_number,
                            expiry_date: item.expiry_date,
                            rack_number: item.rack_number,
                            purchase_price: item.cost_price || item.purchase_price || 0,
                            generic_name: item.generic_name,
                            composition: item.composition,
                            schedule_h1: item.schedule_h1,
                            manufacturer: item.manufacturer,
                            is_synced: 1
                        };

                        await db.inventory.put(offlineItem);
                        toast.info(`Price/Stock Updated: ${item.medicine_name}`);
                    }
                )
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [currentShop?.id]);

    // --- PARCHA IMPORT LOGIC ---
    // const location = useLocation(); // Removed duplicate

    const hasImported = useRef(false);

    useEffect(() => {
        const processImport = async () => {
            // FIX: Support both keys for backward compatibility
            // @ts-ignore
            const state = location.state as { importItems: any[], cartItems: any[], customerName: string } | null;
            const itemsToImport = state?.importItems || state?.cartItems; // Support both

            if (itemsToImport && itemsToImport.length > 0 && !hasImported.current && currentShop?.id) {
                hasImported.current = true;
                toast.loading("Importing Medicines from Parcha...", { id: 'import-load' });

                const matches = [];
                const notFound = [];

                // OPTIMIZATION: Fetch ALL inventory ONCE and create a Lookup Map
                const allItems = await db.inventory.where('shop_id').equals(currentShop.id).toArray();

                // Create Lowercase Map for fuzzy matching: "dolo 650" -> Item
                // We use a Map<string, Item[]> in case of duplicates, but simplest is Last Win or First Win.
                // Better: Map<name, Item>
                const inventoryMap = new Map();
                allItems.forEach(i => {
                    inventoryMap.set(i.medicine_name.toLowerCase(), i);
                });

                for (const imp of itemsToImport) {
                    const impName = imp.name.toLowerCase().trim();
                    let found = inventoryMap.get(impName);

                    // Fallback: Partial Match (Slower, but in-memory now so okay)
                    if (!found) {
                        found = allItems.find(i => i.medicine_name.toLowerCase().includes(impName));
                    }

                    if (found) {
                        matches.push({ item: found, qty: imp.quantity || imp.qty || 1 });
                    } else {
                        // Create a TEMP item for billing
                        matches.push({
                            item: {
                                id: 'TEMP_' + Date.now() + Math.random(),
                                shop_id: currentShop.id,
                                medicine_name: imp.name + " (Manual)",
                                quantity: 999,
                                unit_price: imp.unit_price || 0,
                                is_synced: 0
                            } as OfflineInventory,
                            qty: imp.quantity || imp.qty || 1
                        });
                        notFound.push(imp.name);
                    }
                }

                setCart(prev => [...prev, ...matches]);

                if (state.customerName) {
                    // Search Logic Hint
                    setSearch(state.customerName);
                    toast.info(`Customer: ${state.customerName}`);
                }

                toast.success(`Imported ${matches.length} medicines`, { id: 'import-load' });
                window.history.replaceState({}, document.title);
            }
        };

        processImport();
    }, [location.state, currentShop?.id]);

    // --- DEBOUNCE SEARCH ---
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    // --- DATA ---
    const products = useLiveQuery(
        () => {
            if (!currentShop?.id) return [];

            if (debouncedSearch) {
                // OPTIMIZATION: Use Compound Index [shop_id+medicine_name] for fast prefix search
                // This prevents scanning the entire shop inventory
                const lowerSearch = debouncedSearch.toLowerCase();

                // Note: Dexie compound indexes work best when values are exact. 
                // For 'startsWith' on the second part of a compound index, we use 'between'.
                // However, since medicine_name in DB might be Mixed Case and we want case-insensitive...
                // The current schema index is just values. 
                // To be truly fast, we'd need a lowercase index. 
                // For now, we will stick to the 'filter' BUT verify if we can check ignoring case differently.
                // ACTUALLY: The best way without a new migration is to grab everything for the shop 
                // but LIMIT it earlier if possible? No, we need to filter first.

                // Let's try the Compound Index approach assuming standard capitalization or if user typed exact start.
                // But generally, the filter on memory is safer for case-insensitivity without a 'medicine_name_lower' field.

                // Let's optimize by NOT re-creating the collection chain improperly.

                return db.inventory
                    .where('shop_id')
                    .equals(currentShop.id)
                    .filter(i => i.medicine_name.toLowerCase().includes(lowerSearch)) // Includes is better than startsWith for users
                    .limit(20)
                    .toArray();
            }

            return db.inventory.where("shop_id").equals(currentShop.id).limit(20).toArray();
        },
        [debouncedSearch, currentShop?.id]
    );

    // --- CART LOGIC ---
    const addToCart = async (item: OfflineInventory) => {
        // SAFETY CHECK: Expiry
        if (item.expiry_date) {
            const today = new Date();
            const expiry = new Date(item.expiry_date);
            const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                toast.error(`EXPIRED ITEM! Cannot Sell.`, {
                    description: `${item.medicine_name} expired on ${item.expiry_date}`,
                    duration: 5000,
                    icon: <ShieldAlert className="text-red-600" />
                });
                return; // BLOCK SALE
            }

            if (diffDays < 30) {
                toast.warning(`Near Expiry Warning`, {
                    description: `Expires in ${diffDays} days (${item.expiry_date})`
                });
            }
        }

        // SAFETY CHECK: Low Stock
        if (item.quantity < 10) {
            toast.info("Low Stock Alert", {
                description: `Only ${item.quantity} units remaining.`
            });
        }

        setCart(prev => {
            const existing = prev.find(p => p.item.id === item.id);
            if (existing) {
                return prev.map(p => p.item.id === item.id ? { ...p, qty: p.qty + 1 } : p);
            }
            return [...prev, { item, qty: 1 }];
        });
    };

    // --- INTERACTION CHECK (Centralized) ---
    useEffect(() => {
        if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);

        if (cart.length > 1) {
            interactionTimeoutRef.current = setTimeout(async () => {
                const drugNames = [...new Set(cart.map(c => c.item.medicine_name))];
                try {
                    const warnings = await aiService.checkInteractions(drugNames);
                    setInteractions(warnings); // Replace interactions with current set
                    if (warnings.length > 0) {
                        toast.error("Interaction Detected!", { id: "interaction-toast" });
                    }
                } catch (e) {
                    console.error("Interaction check failed", e);
                }
            }, 1000); // Debounce 1s
        } else {
            setInteractions([]);
        }

        return () => {
            if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
        };
    }, [cart]);


    const updateQty = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.item.id === id) {
                const newQty = Math.max(1, item.qty + delta);
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    const updatePrice = (id: string, newPrice: number) => {
        setCart(prev => prev.map(item => {
            if (item.item.id === id) {
                return { ...item, item: { ...item.item, unit_price: newPrice } };
            }
            return item;
        }));
    };

    const manualCheckInteractions = async () => {
        if (cart.length < 2) return toast.info("Need at least 2 items to check interactions");
        toast.loading("Checking Interactions...", { id: "manual-check" });
        try {
            const drugNames = [...new Set(cart.map(c => c.item.medicine_name))];
            const warnings = await aiService.checkInteractions(drugNames);
            setInteractions(warnings);
            if (warnings.length > 0) {
                toast.error(`Found ${warnings.length} interactions!`, { id: "manual-check" });
            } else {
                toast.success("No interactions found. Safe to proceed.", { id: "manual-check" });
            }
        } catch (e) {
            console.error(e);
            toast.error("Check failed.", { id: "manual-check" });
        }
    };

    const showAlternatives = async (medicineName: string, itemId?: string) => {
        toast.loading(`Finding alternatives for ${medicineName}...`, { id: 'alt-search' });
        try {
            // Use local DB first for matches
            const currentItem = cart.find(c => c.item.medicine_name === medicineName)?.item;
            const allItems = await db.inventory.where('shop_id').equals(currentShop?.id || '').toArray();

            let substitutes: any[] = [];
            if (currentItem) {
                // Use the robust logic from drugService
                substitutes = drugService.findBetterMarginSubstitutes(currentItem, allItems);
            } else {
                // Fallback if item not in cart (shouldn't happen) or loose match
                const match = allItems.find(i => i.medicine_name === medicineName);
                if (match) substitutes = drugService.findBetterMarginSubstitutes(match, allItems);
            }

            // --- AI FALLBACK (If no local stock found) ---
            if (substitutes.length === 0) {
                toast.loading(`No local matches. Asking Market Intelligence...`, { id: 'alt-search' });
                try {
                    const aiSuggestions = await aiService.getGenericSubstitutes(medicineName);
                    // Map AI strings "Name (Brand) - ₹Price" to Mock Inventory Objects
                    substitutes = aiSuggestions.map((s, idx) => {
                        const parts = s.split(' - ₹');
                        const name = parts[0].trim();
                        const price = parts.length > 1 ? parseFloat(parts[1]) : 0;
                        return {
                            id: `AI_GEN_${Date.now()}_${idx}`,
                            shop_id: currentShop?.id,
                            medicine_name: name + " (Market)", // Tag as external
                            unit_price: price,
                            quantity: 0, // Out of stock
                            purchase_price: price * 0.7, // Est margin
                            is_synced: 0,
                            generic_name: "AI Suggestion",
                            composition: "Market Substitute"
                        };
                    });
                } catch (aiErr) {
                    console.warn("AI Fallback failed", aiErr);
                }
            }

            // Store ID to replace specific row
            setAlternativeData({ name: medicineName, substitutes: substitutes as any[], targetItemId: itemId });
            toast.success(`Found ${substitutes.length} options`, { id: 'alt-search' });
        } catch (e) {
            console.error(e);
            toast.error("Could not fetch alternatives", { id: 'alt-search' });
        }
    };

    const addToShortbook = () => {
        toast.success(`'${search}' added to Shortbook`);
        setSearch("");
    };

    // --- SUBSTITUTE LOGIC ---
    const handleSubstituteSelect = (sub: any) => {
        if (!alternativeData) return;

        setCart(prev => prev.map(c => {
            // FIX: Replace specific item ID if available, else fallback to name
            const isMatch = alternativeData.targetItemId
                ? c.item.id === alternativeData.targetItemId
                : c.item.medicine_name === alternativeData.name;

            if (isMatch) {
                return {
                    ...c,
                    item: sub, // Direct replacement with the inventory item
                    qty: c.qty // Keep quantity
                };
            }
            return c;
        }));

        toast.success(`Swapped '${alternativeData.name}' with '${sub.medicine_name}'`);
        setAlternativeData(null); // Close dialog
    };


    const calculateTotals = () => {
        const subtotal = cart.reduce((acc, curr) => acc + (curr.item.unit_price * curr.qty), 0);
        const totalProfit = cart.reduce((acc, curr) => acc + ((curr.item.unit_price - (curr.item.purchase_price || 0)) * curr.qty), 0);
        const discountAmount = (subtotal * discountPercentage) / 100;
        // FIX: Use 2 decimal precision instead of Math.round (which forces integers)
        const total = Number((subtotal - discountAmount).toFixed(2));
        const margin = subtotal > 0 ? (totalProfit / subtotal) * 100 : 0;
        return { subtotal, discount: discountAmount, total, totalProfit, margin };
    };

    // Update profit stats when cart changes
    useEffect(() => {
        const { totalProfit, margin } = calculateTotals();
        setProfitStats({ totalProfit, margin });
    }, [cart, discountPercentage]);

    const { total } = calculateTotals();

    return (
        <div className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden selection:bg-cyan-500/30">
            {/* --- HEADER --- */}
            <div className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-3 sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-cyan-400" onClick={() => navigate("/dashboard")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="leading-tight">
                        <div className="font-bold text-base text-white tracking-tight">BILLING<span className="text-cyan-400">HUB</span></div>
                        <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono uppercase">
                            V3.0 • PRO TERMINAL
                            {isSyncing && <span className="text-yellow-400 animate-pulse flex items-center gap-1">⚡ SYNCING...</span>}
                        </div>
                    </div>
                </div>

                {/* MOBILE: Center Voice Trigger - Made Prominent */}
                <div className="md:hidden">
                    <VoiceCommandBar compact={true} onTranscriptionComplete={(txt) => { setSearch(txt); setShowMobileCatalog(true); }} />
                </div>

                {/* MOBILE: Toggle Catalog */}
                <Button
                    size="sm"
                    variant={showMobileCatalog ? "secondary" : "default"}
                    className={`md:hidden ${showMobileCatalog ? 'bg-slate-700 text-white' : 'bg-cyan-600 text-black hover:bg-cyan-500'}`}
                    onClick={() => setShowMobileCatalog(!showMobileCatalog)}
                >
                    {showMobileCatalog ? <X className="w-4 h-4" /> : <div className="flex items-center gap-1"><Plus className="w-4 h-4" /> <span className="text-[10px] font-bold">ADD MED</span></div>}
                </Button>
            </div>

            {/* --- MAIN WORKSPACE --- */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* LEFT: CATALOG (30%) */}
                <div className={`
                    absolute inset-0 z-40 bg-slate-900/98 md:relative md:w-[30%] md:min-w-[280px] md:z-0 md:flex flex-col border-r border-slate-800 transition-transform duration-200
                    ${showMobileCatalog ? 'flex translate-x-0' : 'hidden md:flex'}
                `}>
                    {/* Search Bar */}
                    <div className="p-3 border-b border-slate-800 bg-slate-900 shrink-0">
                        <div className="relative group flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    ref={searchInputRef}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search Medicine..."
                                    className="h-10 pl-9 bg-slate-800 border-slate-700 text-white text-sm focus:ring-1 focus:ring-cyan-500"
                                    autoFocus
                                />
                            </div>
                            {/* Munim-ji Voice Trigger */}
                            <div className="">
                                <VoiceInput
                                    onTranscript={async (text) => {
                                        toast.info(`Processing: "${text}"`);
                                        const result = await aiService.processVoiceText(text);

                                        if (result.items && result.items.length > 0) {
                                            for (const item of result.items) {
                                                // 1. Fuzzy Search in DB
                                                const matches = await db.inventory
                                                    .where('shop_id').equals(currentShop?.id || '')
                                                    .filter(i => i.medicine_name.toLowerCase().includes(item.name.toLowerCase()))
                                                    .toArray();

                                                if (matches.length > 0) {
                                                    // Pick best match (first one)
                                                    addToCart(matches[0]);
                                                    toast.success(`Added ${matches[0].medicine_name}`);
                                                } else {
                                                    // Add as Temp
                                                    toast.warning(`"${item.name}" not found in inventory. Added as Manual Item.`);
                                                    const tempItem: OfflineInventory = {
                                                        id: `VOICE_${Date.now()}`,
                                                        shop_id: currentShop?.id || '',
                                                        medicine_name: item.name + " (Voice)",
                                                        quantity: 999,
                                                        unit_price: 0, // Needs manual price
                                                        is_synced: 0
                                                    };
                                                    setCart(prev => [...prev, { item: tempItem, qty: item.quantity }]);
                                                }
                                            }
                                        } else {
                                            toast.error("Could not understand order.");
                                            setSearch(text); // Fallback to search
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        {/* Zero State / Shortbook */}
                        {search && products?.length === 0 && (
                            <div className="mt-2 animate-in fade-in">
                                <Button
                                    size="sm"
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs justify-start"
                                    onClick={addToShortbook}
                                >
                                    <BookmarkPlus className="w-4 h-4 mr-2" /> Add '{search}' to Shortbook
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Matrix List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {!products ? (
                            // SKELETON LOADER STATE
                            Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="flex flex-col p-3 rounded-md bg-slate-900 border border-slate-800 space-y-2">
                                    <Skeleton className="h-4 w-3/4 bg-slate-800" />
                                    <div className="flex justify-between">
                                        <Skeleton className="h-3 w-1/4 bg-slate-800" />
                                        <Skeleton className="h-3 w-1/4 bg-slate-800" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            products.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => addToCart(p)}
                                    className="group flex flex-col p-3 rounded-md bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800 cursor-pointer transition-all"
                                >
                                    <div className="flex justify-between items-start gap-2 mb-1">
                                        {/* FIX: Smaller font for mobile (text-[10px]), allow wrapping */}
                                        <span className="text-[10px] md:text-[11px] font-semibold text-slate-200 leading-snug break-words whitespace-normal w-full">
                                            {p.medicine_name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                            <span>Qty:{p.quantity}</span>
                                            <span className="text-slate-700">|</span>
                                            <span>{p.batch_number || "N/A"}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-cyan-400 font-mono">₹{p.unit_price}</span>

                                            {/* Alternative Popover */}
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); }}
                                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-800 hover:bg-purple-900/50 text-purple-400 transition-colors"
                                                    >
                                                        <Sparkles className="w-3 h-3" />
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-56 bg-slate-950 border border-purple-500/30 text-slate-300 p-0 shadow-xl" align="end">
                                                    <div className="p-2 bg-purple-900/10 border-b border-purple-500/20 text-xs font-bold text-purple-300 flex items-center gap-2">
                                                        <Sparkles className="w-3 h-3" /> Smart Substitutes
                                                    </div>
                                                    <div className="p-3 text-[10px] text-slate-400 text-center italic">
                                                        No direct substitutes found in local DB.
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </div>
                            )))}
                    </div>
                </div>

                {/* RIGHT: BILL DESK (70%) */}
                <div className="flex-1 flex flex-col bg-slate-950 w-full relative">

                    {/* Customer Context */}
                    <div className="min-h-[3.5rem] bg-slate-900 border-b border-slate-800 flex items-center px-3 gap-2 shrink-0">
                        <User className="w-4 h-4 text-slate-500" />
                        <div className="flex-1 flex gap-2">
                            <div className="relative flex-1">
                                <User className="absolute left-2 top-2.5 w-3 h-3 text-slate-500" />
                                <CustomerSearch
                                    onSelect={setSelectedCustomer}
                                    selectedCustomer={selectedCustomer}
                                    placeholder="Link Customer..."
                                    className="h-8 bg-transparent border-none text-slate-200 focus:ring-0 text-xs placeholder:text-slate-600 w-full pl-8"
                                />
                            </div>
                            <Input
                                placeholder="Ref. Doctor (Optional)"
                                className="h-8 w-40 bg-slate-900 border-slate-800 text-xs text-white"
                                value={doctorName}
                                onChange={e => setDoctorName(e.target.value)}
                            />
                        </div>
                        {selectedCustomer && (
                            <div className="flex items-center gap-3 text-[10px] font-mono border-l border-slate-700 pl-3">
                                <div>
                                    <span className="text-slate-500 block">BALANCE</span>
                                    <span className={`font-bold ${selectedCustomer.credit_balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        ₹{selectedCustomer.credit_balance || 0}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">LIMIT</span>
                                    <span className="text-slate-300">₹{selectedCustomer.credit_limit || 5000}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Cart Workspace - Tighter Spacing space-y-1 */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-40">
                                <ShoppingCart className="w-16 h-16 mb-4 stroke-1" />
                                <div className="text-xl font-thin tracking-wider">TERMINAL READY</div>
                            </div>
                        ) : (
                            cart.map((c) => (
                                <div key={c.item.id} className="flex items-center justify-between p-2 pl-3 bg-slate-900/50 border border-slate-800 rounded-md hover:border-slate-700 group">
                                    {/* FIX: Allow medicine name to wrap nicely */}
                                    <div className="flex-1 mr-2 overflow-hidden">
                                        <h4 className="font-bold text-[10px] md:text-[11px] text-slate-200 leading-tight break-words whitespace-normal mb-1">
                                            {c.item.medicine_name}
                                        </h4>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="flex items-center bg-slate-950 border border-slate-700 rounded px-1 shrink-0">
                                                <span className="text-[10px] text-slate-500 mr-1">₹</span>
                                                <input
                                                    className="w-12 bg-transparent text-[11px] font-mono text-white outline-none"
                                                    type="number"
                                                    value={c.item.unit_price}
                                                    onChange={(e) => updatePrice(c.item.id, Number(e.target.value))}
                                                />
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-mono shrink-0">x {c.qty}</span>

                                            {/* Alternative Option Button - FIXED STYLING */}
                                            <button
                                                onClick={() => showAlternatives(c.item.medicine_name, c.item.id)}
                                                className="text-[9px] bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded border border-purple-700/30 hover:bg-purple-800/60 hover:border-purple-600/50 flex items-center gap-1 shrink-0 transition-all"
                                                title="Find Better Margin Alternatives"
                                            >
                                                <Sparkles className="w-3 h-3" /> <span className="font-medium">Alt</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* Quantity Stepper */}
                                        <div className="flex items-center bg-slate-950 rounded border border-slate-800 h-7">
                                            <button onClick={() => updateQty(c.item.id, -1)} className="w-7 h-full flex items-center justify-center hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">-</button>
                                            <div className="w-8 text-center text-[11px] font-bold border-x border-slate-800 h-full flex items-center justify-center text-cyan-50">{c.qty}</div>
                                            <button onClick={() => updateQty(c.item.id, 1)} className="w-7 h-full flex items-center justify-center hover:bg-slate-800 text-cyan-400 transition-colors">+</button>
                                        </div>

                                        <div className="w-14 text-right font-bold text-white text-sm font-mono tracking-tight">
                                            ₹{Math.round(c.item.unit_price * c.qty)}
                                        </div>

                                        <button onClick={() => setCart(prev => prev.filter(x => x.item.id !== c.item.id))} className="text-slate-600 hover:text-red-500 transition-colors p-1">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* FOOTER: PROFIT & TOTALS */}
                    <div className="bg-slate-900 border-t border-slate-800 p-3 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">

                        {/* Interaction Banner (Clickable) */}
                        {interactions.length > 0 && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <button
                                        type="button"
                                        className="w-full mb-3 flex items-center justify-between bg-red-950/40 border border-red-900/50 rounded px-3 py-2 text-red-400 hover:bg-red-900/20 transition-colors group cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <ShieldAlert className="w-4 h-4 animate-pulse" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">⚠️ Dawa Reaction Alert</span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-[90%] md:max-w-md bg-slate-950 border-slate-800 text-slate-200 rounded-xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-red-400 flex items-center gap-2">
                                            <ShieldAlert className="w-5 h-5" /> 🚫 Khatarnak Interaction Detected
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-3 mt-2">
                                        {interactions.map((msg, idx) => (
                                            <div key={idx} className="p-3 rounded bg-red-900/10 border border-red-900/30 text-xs text-red-200 leading-relaxed">
                                                {msg}
                                            </div>
                                        ))}
                                        <Button className="w-full bg-slate-800 hover:bg-slate-700 text-white mt-4" onClick={() => { }}>
                                            Samajh Gaya (Proceed)
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}

                        {/* ALTERNATIVE MEDICINE POPUP */}
                        {alternativeData && (
                            <Dialog open={!!alternativeData} onOpenChange={(o) => !o && setAlternativeData(null)}>
                                <DialogContent className="glass-card border-purple-500/30 text-white max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2 text-purple-400">
                                            <Sparkles className="w-5 h-5" /> Alternatives for {alternativeData.name}
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto">
                                        {alternativeData.substitutes.length === 0 ? (
                                            <div className="text-center p-4 text-slate-500">
                                                No direct substitutes found in inventory.
                                            </div>
                                        ) : (
                                            alternativeData.substitutes.map((sub: any, i: number) => {
                                                const profit = sub.unit_price - (sub.purchase_price || 0);
                                                return (
                                                    <div
                                                        key={sub.id || i}
                                                        className="p-3 bg-slate-900/50 border border-purple-500/20 rounded-lg flex justify-between items-center group hover:bg-purple-900/10 cursor-pointer transition-all"
                                                        onClick={() => handleSubstituteSelect(sub)}
                                                    >
                                                        <div>
                                                            <div className="font-bold text-slate-200">{sub.medicine_name}</div>
                                                            <div className="text-xs text-slate-500">{sub.composition || sub.generic_name}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-bold text-lg text-purple-400">₹{sub.unit_price}</div>
                                                            <div className="text-[10px] text-emerald-400 font-medium">
                                                                Profit: ₹{profit.toFixed(1)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 text-center mt-2">Tap to replace item in cart</p>
                                </DialogContent>
                            </Dialog>
                        )}

                        {/* Top: Stats & Discounts */}
                        <div className="flex justify-between items-end mb-3">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">Est. Profit</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-emerald-500 font-mono">₹{Math.round(profitStats.totalProfit)}</span>
                                    <span className={`text-[10px] px-1 rounded ${profitStats.margin > 20 ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-yellow-950 text-yellow-400 border border-yellow-900'}`}>
                                        {Math.round(profitStats.margin)}%
                                    </span>
                                    {/* Manual Sync Button */}
                                    <button
                                        onClick={async () => {
                                            const toastId = toast.loading("Resyncing: Checking Interactions & Profit...");

                                            try {
                                                // 1. Force Interaction Check
                                                if (cart.length > 0) {
                                                    const drugNames = [...new Set(cart.map(c => c.item.medicine_name))];
                                                    const warnings = await aiService.checkInteractions(drugNames);
                                                    setInteractions(warnings);

                                                    if (warnings.length > 0) {
                                                        // Update the loading toast to error
                                                        toast.error("Interaction Detected!", { id: toastId });
                                                        return; // Keep error visible
                                                    } else {
                                                        toast.success("No Interactions Found", { id: toastId });
                                                    }
                                                } else {
                                                    toast.dismiss(toastId);
                                                }

                                                // 2. Recalculate Profit
                                                const { totalProfit, margin } = calculateTotals();
                                                setProfitStats({ totalProfit, margin });

                                            } catch (e) {
                                                console.error("Sync Error", e);
                                                toast.error("Sync Failed", { id: toastId });
                                            }
                                        }}
                                        className="h-4 w-4 flex items-center justify-center rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 ml-1"
                                        title="Sync Interactions & Profit"
                                    >
                                        <Zap className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>

                            {/* MANUAL GUEST DETAILS (Hidden state, shown via Dialog) */}
                            <Dialog open={showGuestDialog} onOpenChange={setShowGuestDialog}>
                                <DialogContent className="bg-slate-950 border-slate-800 text-slate-100 max-w-sm">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <User className="w-5 h-5 text-cyan-400" /> Walk-in Customer Details
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-2">
                                        <div className="space-y-2">
                                            <label className="text-xs text-slate-400 uppercase font-bold">Customer Name (Optional)</label>
                                            <Input
                                                placeholder="Enter Name"
                                                value={guestDetails.name}
                                                onChange={e => setGuestDetails(prev => ({ ...prev, name: e.target.value }))}
                                                className="bg-slate-900 border-slate-800"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs text-slate-400 uppercase font-bold">WhatsApp Number</label>
                                            <Input
                                                placeholder="9876543210"
                                                value={guestDetails.phone}
                                                onChange={e => setGuestDetails(prev => ({ ...prev, phone: e.target.value }))}
                                                className="bg-slate-900 border-slate-800"
                                                type="tel"
                                            />
                                            <p className="text-[10px] text-slate-500">Required for sending digital invoice.</p>
                                        </div>
                                        <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-black font-bold" onClick={confirmCheckout}>
                                            Confirm & Print Bill
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            <div className="text-right">
                                <div className="flex items-center justify-end gap-1 mb-1">
                                    <span className="text-[9px] text-slate-500 uppercase">Disc</span>
                                    <Input
                                        className="h-5 w-10 text-[10px] text-center p-0 border border-slate-700 bg-slate-800 text-white rounded focus:ring-0"
                                        value={discountPercentage}
                                        onChange={e => setDiscountPercentage(Number(e.target.value))}
                                    />
                                    <span className="text-[10px] text-slate-500">%</span>
                                </div>
                                <div className="text-3xl font-black text-white font-mono leading-none tracking-tighter">
                                    <span className="text-lg text-slate-600 align-top mr-0.5">₹</span>{total}
                                </div>
                            </div>
                        </div>

                        {/* Primary Actions */}
                        <div className="grid grid-cols-4 gap-2">
                            <Button variant="outline" className="h-11 col-span-1 border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 p-0" onClick={() => setCart([])}>
                                <Trash2 className="w-5 h-5" />
                            </Button>

                            <Button
                                className={`
                                    col-span-3 h-11 font-bold text-sm shadow-[0_0_15px_rgba(6,182,212,0.1)]
                                    ${paymentMode === 'cash' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : ''}
                                    ${paymentMode === 'online' ? 'bg-purple-600 hover:bg-purple-500 text-white' : ''}
                                    ${paymentMode === 'credit' ? 'bg-orange-600 hover:bg-orange-500 text-white' : ''}
                                `}
                                onClick={handleCheckout}
                                disabled={cart.length === 0}
                            >
                                <div className="flex items-center gap-2 uppercase tracking-wide">
                                    {paymentMode === 'cash' && <IndianRupee className="w-4 h-4" />}
                                    {paymentMode === 'online' && <Zap className="w-4 h-4" />}
                                    {paymentMode === 'credit' && <User className="w-4 h-4" />}
                                    {paymentMode === 'credit' ? 'DEBIT ACCOUNT' : 'COLLECT'}
                                </div>
                            </Button>
                        </div>

                        {/* Mode Toggles */}
                        <div className="flex justify-between px-2 mt-3 pt-2 border-t border-slate-800/50">
                            {['cash', 'online', 'credit'].map(m => (
                                <button
                                    key={m}
                                    onClick={() => setPaymentMode(m)}
                                    className={`text-[9px] uppercase font-bold tracking-widest py-1 px-2 rounded transition-all ${paymentMode === m ? 'text-cyan-400 bg-cyan-950/30' : 'text-slate-600 hover:text-slate-400'}`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default LitePOS;
