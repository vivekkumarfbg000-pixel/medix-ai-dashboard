import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCcw, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ReturnOrderModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: any;
    onSuccess: () => void;
}

export function ReturnOrderModal({ open, onOpenChange, order, onSuccess }: ReturnOrderModalProps) {
    const [returnQty, setReturnQty] = useState<Record<string, number>>({});
    const [reason, setReason] = useState("Customer Return");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!order) return null;

    // Parse order items (handling JSONB structure)
    const orderItems = Array.isArray(order.order_items) ? order.order_items : [];

    const handleQtyChange = (itemName: string, maxQty: number, val: string) => {
        const qty = parseInt(val) || 0;
        if (qty < 0) return;
        if (qty > maxQty) {
            toast.error(`Cannot return more than sold (${maxQty})`);
            return;
        }
        setReturnQty(prev => ({ ...prev, [itemName]: qty }));
    };

    const calculateTotalRefund = () => {
        let total = 0;
        orderItems.forEach((item: any) => {
            const qty = returnQty[item.name] || 0;
            total += qty * (item.price || 0);
        });
        return total;
    };

    const handleSubmit = async () => {
        const totalRefund = calculateTotalRefund();
        if (totalRefund <= 0) {
            toast.error("Please select at least one item to return");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Create Return Record
            const { data: returnRecord, error: returnError } = await supabase.from("sales_returns").insert({
                sale_id: order.id,
                shop_id: order.shop_id,
                total_refund_amount: totalRefund,
                reason: reason
            }).select().single();

            if (returnError) throw returnError;

            // 2. Process Items & Restore Stock
            const itemsToReturn = orderItems.filter((item: any) => (returnQty[item.name] || 0) > 0);

            for (const item of itemsToReturn) {
                const qty = returnQty[item.name];

                // Add to sales_return_items
                await supabase.from("sales_return_items").insert({
                    return_id: returnRecord.id,
                    inventory_id: item.inventory_id, // Might be null if legacy data
                    medicine_name: item.name,
                    quantity: qty,
                    refund_price: item.price
                });

                // Restore Stock Integration
                if (item.inventory_id) {
                    await supabase.rpc('adjust_inventory_stock', {
                        p_inventory_id: item.inventory_id,
                        p_quantity_change: qty,
                        p_movement_type: 'IN', // Stock IN for returns
                        p_reason: `Return: Sales Order #${order.invoice_number || order.id.slice(0, 6)}`
                    });
                }
            }

            toast.success(`Return Processed. Refund: ₹${totalRefund}`);
            onSuccess();
            onOpenChange(false);
            setReturnQty({});
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to process return: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Return Items</DialogTitle>
                    <DialogDescription>Select items to return. Inventory will be automatically updated.</DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[300px] border rounded-md p-2">
                    {orderItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex-1">
                                <div className="font-medium text-sm">{item.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    Sold: {item.qty} x ₹{item.price}
                                </div>
                            </div>
                            <div className="w-20">
                                <Input
                                    type="number"
                                    min={0}
                                    max={item.qty}
                                    className="h-8 text-center"
                                    placeholder="0"
                                    value={returnQty[item.name] || ""}
                                    onChange={(e) => handleQtyChange(item.name, item.qty, e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </ScrollArea>

                <div className="space-y-3 py-2">
                    <div className="flex justify-between items-center font-bold text-lg">
                        <span>Total Refund</span>
                        <span className="text-red-600">₹{calculateTotalRefund().toFixed(2)}</span>
                    </div>

                    <Input
                        placeholder="Reason for return (optional)"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleSubmit} disabled={isSubmitting}>
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        {isSubmitting ? "Processing..." : "Confirm Return"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
