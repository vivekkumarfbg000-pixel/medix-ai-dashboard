import { useState, useMemo, useCallback } from "react";
import { OfflineInventory } from "@/db/db";

export interface CartItem {
    item: OfflineInventory;
    qty: number;
}

export function useBillingCart(initialCart: CartItem[] = []) {
    const [cart, setCart] = useState<CartItem[]>(initialCart);
    const [discountPercentage, setDiscountPercentage] = useState(0);

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

    const addToCart = useCallback((product: OfflineInventory, qtyToAdd: number = 1) => {
        setCart(prev => {
            const existing = prev.find(c => c.item.id === product.id);
            if (existing) {
                return prev.map(c => c.item.id === product.id ? { ...c, qty: c.qty + qtyToAdd } : c);
            }
            return [...prev, { item: product, qty: qtyToAdd }];
        });
    }, []);

    const updateQty = useCallback((productId: string, newQty: number) => {
        if (newQty <= 0) {
            setCart(prev => prev.filter(c => c.item.id !== productId));
        } else {
            setCart(prev => prev.map(c => c.item.id === productId ? { ...c, qty: newQty } : c));
        }
    }, []);

    const updatePrice = useCallback((productId: string, newPrice: number) => {
        setCart(prev => prev.map(c => c.item.id === productId ? { ...c, item: { ...c.item, unit_price: newPrice } } : c));
    }, []);

    const removeItem = useCallback((productId: string) => {
        setCart(prev => prev.filter(c => c.item.id !== productId));
    }, []);

    const clearCart = useCallback(() => setCart([]), []);

    return {
        cart,
        setCart,
        discountPercentage,
        setDiscountPercentage,
        totals,
        addToCart,
        updateQty,
        updatePrice,
        removeItem,
        clearCart
    };
}
