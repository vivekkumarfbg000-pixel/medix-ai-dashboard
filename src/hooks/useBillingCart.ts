import { useState, useMemo, useCallback } from "react";
import { OfflineInventory } from "@/db/db";

export interface CartItem {
    item: OfflineInventory;
    qty: number;
}

export function useBillingCart(initialCart: CartItem[] = []) {
    const [cart, setCart] = useState<CartItem[]>(initialCart);
    const [discountPercentage, setDiscountPercentage] = useState(0);
    const [idempotencyKey, setIdempotencyKey] = useState<string>(crypto.randomUUID());

    const resetCart = useCallback(() => {
        setCart([]);
        setDiscountPercentage(0);
        setIdempotencyKey(crypto.randomUUID());
    }, []);

    const totals = useMemo(() => {
        const subtotal = cart.reduce((acc, curr) => acc + (curr.item.unit_price * curr.qty), 0);
        const totalProfit = cart.reduce((acc, curr) => {
            const purchasePrice = curr.item.purchase_price || (curr.item.unit_price * 0.7); // 30% margin fallback
            return acc + ((curr.item.unit_price - purchasePrice) * curr.qty);
        }, 0);
        const discountAmount = (subtotal * discountPercentage) / 100;

        const total = Number((subtotal - discountAmount).toFixed(2));

        const gstBreakdown = cart.reduce((acc, curr) => {
            const itemRatio = subtotal > 0 ? (curr.item.unit_price * curr.qty) / subtotal : 0;
            const itemDiscountedTotal = total * itemRatio;
            const rate = curr.item.gst_rate || 12;
            const taxable = itemDiscountedTotal / (1 + rate / 100);
            const gst = itemDiscountedTotal - taxable;
            return {
                cgst: acc.cgst + (gst / 2),
                sgst: acc.sgst + (gst / 2)
            };
        }, { cgst: 0, sgst: 0 });

        const margin = subtotal > 0 ? (totalProfit / subtotal) * 100 : 0;
        
        return { 
            subtotal, 
            discount: discountAmount, 
            total, 
            totalProfit, 
            margin, 
            gst: gstBreakdown 
        };
    }, [cart, discountPercentage]);

    const addToCart = useCallback((item: OfflineInventory, qty: number = 1) => {
        if (qty <= 0) return;
        setCart(prev => {
            const existing = prev.find(i => i.item.id === item.id);
            if (existing) {
                return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + qty } : i);
            }
            return [...prev, { item, qty }];
        });
    }, []);

    const removeItem = useCallback((productId: string) => {
        setCart(prev => prev.filter(c => c.item.id !== productId));
    }, []);

    const updateQuantity = useCallback((id: string, qty: number) => {
        if (qty <= 0) {
            removeItem(id);
            return;
        }
        setCart(prev => prev.map(i => i.item.id === id ? { ...i, qty } : i));
    }, [removeItem]);

    const updatePrice = useCallback((id: string, price: number) => {
        if (price < 0) return;
        setCart(prev => prev.map(i => i.item.id === id ? { ...i, item: { ...i.item, unit_price: price } } : i));
    }, []);

    const clearCart = useCallback(() => setCart([]), []);

    return {
        cart,
        setCart,
        discountPercentage,
        setDiscountPercentage,
        totals,
        addToCart,
        updateQty: updateQuantity,
        updatePrice,
        removeItem,
        clearCart,
        resetCart,
        idempotencyKey
    };
}
