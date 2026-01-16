import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

export function SalesReturnModal({ triggerClassName, triggerVariant }: { triggerClassName?: string, triggerVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [order, setOrder] = useState<any>(null);
    const [returnItems, setReturnItems] = useState<{ [key: string]: number }>({}); // inventory_id -> qty
    const [submitting, setSubmitting] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery) return;
        setLoading(true);
        setOrder(null);
        setReturnItems({});

        // Search by Invoice Number (Exact) or partial fallback
        const { data, error } = await supabase
            .from("orders")
            .select("*, order_items:order_items(inventory_id, name, qty, price)") // Adjust if order_items is JSONB or Table
            .ilike("invoice_number", `%${searchQuery}%`)
            .limit(1)
            .maybeSingle();

        if (error) {
            toast.error("Search failed");
            console.error(error);
        } else if (data) {
            setOrder(data);
            // Pre-fill eligible items (simple logic: all returnable initially 0)
        } else {
            toast.info("Invoice not found");
        }
        setLoading(false);
    };

    const toggleReturnItem = (itemId: string, maxQty: number, currentSetQty: number) => {
        // Toggle logic: If 0, set to 1. If > 0, set to 0 (Simple toggle for now, or counter)
        // Let's implement a simple counter for precision
        const newQty = currentSetQty > 0 ? 0 : 1;
        setReturnItems(prev => ({ ...prev, [itemId]: newQty }));
    };

    const updateQty = (itemId: string, val: number, max: number) => {
        if (val < 0) val = 0;
        if (val > max) {
            toast.warning(`Max returnable quantity is ${max}`);
            val = max;
        }
        setReturnItems(prev => ({ ...prev, [itemId]: val }));
    };

    const calculateRefundTotal = () => {
        if (!order) return 0;
        // Handle JSONB order_items vs Table Relation
        // Assuming order_items is stored as JSONB in 'orders' table based on LitePOS implementation
        const items = Array.isArray(order.order_items) ? order.order_items : [];
        return items.reduce((acc: number, item: any) => {
            const qty = returnItems[item.inventory_id] || 0;
            return acc + (qty * item.price);
        }, 0);
    };

    const handleProcessReturn = async () => {
        const total = calculateRefundTotal();
        if (total <= 0) {
            toast.error("Please select items to return");
            return;
        }

        setSubmitting(true);
        try {
            // Construct items for RPC
            // Need to find inventory_id. If order_items is JSONB, it has it.
            const itemsToReturn = (Array.isArray(order.order_items) ? order.order_items : [])
                .filter((item: any) => (returnItems[item.inventory_id] || 0) > 0)
                .map((item: any) => ({
                    inventory_id: item.inventory_id,
                    medicine_name: item.name,
                    quantity: returnItems[item.inventory_id],
                    price: item.price,
                    restock: true // Default to true for now
                }));

            const { error } = await supabase.rpc('process_sales_return', {
                p_shop_id: order.shop_id,
                p_order_id: order.id,
                p_items: itemsToReturn,
                p_total_refund: total
            });

            if (error) throw error;

            toast.success("Return Processed Successfully!", {
                description: `Refunded ₹${total}`
            });
            setIsOpen(false);
            setOrder(null);
            setReturnItems({});
            setSearchQuery("");

        } catch (err: any) {
            toast.error("Return Failed", { description: err.message });
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    // Helper to extract items safely
    const getOrderItems = () => {
        if (!order) return [];
        // Support both JSONB array and joined relation
        if (Array.isArray(order.order_items)) return order.order_items;
        return [];
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant={triggerVariant || "ghost"}
                    size="sm"
                    className={triggerClassName || "text-slate-600 hover:text-red-600 hover:bg-red-50"}
                >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Sales Return
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RotateCcw className="w-5 h-5 text-red-600" /> Process Sales Return
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Search Bar */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Enter Invoice # (e.g. LITE-123456)"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch} disabled={loading}>
                            {loading ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                    </div>

                    {/* Order Details */}
                    {order && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="bg-slate-50 p-3 rounded-lg border flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-lg">{order.invoice_number}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {format(new Date(order.created_at), "dd MMM yyyy, hh:mm a")} • {order.customer_name}
                                    </div>
                                </div>
                                <Badge variant={order.payment_status === 'paid' ? 'default' : 'destructive'}>
                                    {order.payment_status?.toUpperCase()}
                                </Badge>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">Return</TableHead>
                                            <TableHead>Item</TableHead>
                                            <TableHead className="text-right">Sold Qty</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                            <TableHead className="text-right">Return Qty</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {getOrderItems().map((item: any, idx: number) => {
                                            const returnQty = returnItems[item.inventory_id] || 0;
                                            const isSelected = returnQty > 0;
                                            return (
                                                <TableRow key={idx} className={isSelected ? "bg-red-50" : ""}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={(checked) => {
                                                                updateQty(item.inventory_id, checked ? 1 : 0, item.qty);
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">{item.name}</TableCell>
                                                    <TableCell className="text-right">{item.qty}</TableCell>
                                                    <TableCell className="text-right">₹{item.price}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Input
                                                            type="number"
                                                            className="w-16 h-8 text-right ml-auto"
                                                            min="0"
                                                            max={item.qty}
                                                            value={returnQty}
                                                            onChange={(e) => updateQty(item.inventory_id, parseInt(e.target.value) || 0, item.qty)}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-100 rounded-lg">
                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    Items will be restocked to inventory automatically.
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-muted-foreground">Total Refund</div>
                                    <div className="text-xl font-bold text-red-600">₹{calculateRefundTotal()}</div>
                                </div>
                            </div>

                            <Button
                                className="w-full bg-red-600 hover:bg-red-700"
                                size="lg"
                                onClick={handleProcessReturn}
                                disabled={submitting || calculateRefundTotal() <= 0}
                            >
                                {submitting ? "Processing..." : "Confirm Return & Refund"}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
