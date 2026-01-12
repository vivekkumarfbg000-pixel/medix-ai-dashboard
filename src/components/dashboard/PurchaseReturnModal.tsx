import { useState, useEffect } from "react";
import { useUserShops } from "@/hooks/useUserShops";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Search, AlertCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PurchaseReturnModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

interface ReturnItem {
    tempId: string;
    inventory_id?: string;
    medicine_name: string;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    refund_price: number;
}

export function PurchaseReturnModal({ open, onOpenChange, onSuccess }: PurchaseReturnModalProps) {
    const { currentShop } = useUserShops();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<string>("");
    const [returnDate, setReturnDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [reason, setReason] = useState("");
    const [items, setItems] = useState<ReturnItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Inventory Search
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);

    useEffect(() => {
        if (open && currentShop?.id) {
            fetchSuppliers();
        }
    }, [open, currentShop]);

    const fetchSuppliers = async () => {
        const { data } = await supabase.from("suppliers").select("id, name").eq("shop_id", currentShop?.id);
        setSuppliers(data || []);
    };

    const handleSearchInventory = async (query: string) => {
        setSearchTerm(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        // Limit to items with stock > 0
        const { data } = await supabase
            .from("inventory")
            .select("id, medicine_name, batch_number, expiry_date, unit_price, quantity")
            .eq("shop_id", currentShop?.id)
            .ilike("medicine_name", `%${query}%`)
            .gt('quantity', 0)
            .limit(5);
        setSearchResults(data || []);
    };

    const addItem = (invItem: any) => {
        // Prevent dupes
        if (items.some(i => i.inventory_id === invItem.id)) {
            toast.warning("Item already added");
            return;
        }

        const newItem: ReturnItem = {
            tempId: Date.now().toString(),
            inventory_id: invItem.id,
            medicine_name: invItem.medicine_name,
            batch_number: invItem.batch_number,
            expiry_date: invItem.expiry_date || "",
            quantity: 1,
            // Default refund price to purchase price (approx 70% of MRP logic or direct unit_price if stored)
            // Ideally we track purchase price, but for now we fallback to unit_price (MRP) * 0.7 estimate
            refund_price: invItem.unit_price ? Number((invItem.unit_price * 0.7).toFixed(2)) : 0
        };
        setItems([...items, newItem]);
        setSearchTerm("");
        setSearchResults([]);
    };

    const updateItem = (id: string, field: keyof ReturnItem, value: any) => {
        setItems(items.map(i => i.tempId === id ? { ...i, [field]: value } : i));
    };

    const removeItem = (id: string) => {
        setItems(items.filter(i => i.tempId !== id));
    };

    const calculateTotal = () => items.reduce((sum, i) => sum + (i.quantity * i.refund_price), 0);

    const handleSubmit = async () => {
        if (!selectedSupplier) {
            toast.error("Please select a supplier");
            return;
        }
        if (items.length === 0) {
            toast.error("Add at least one item to return");
            return;
        }
        if (!reason) {
            toast.error("Please provide a reason (e.g., Expired)");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                shop_id: currentShop?.id,
                supplier_id: selectedSupplier,
                total_amount: calculateTotal(),
                reason: reason,
                return_date: returnDate
            };

            // @ts-ignore - RPC created in migration
            const { data, error } = await supabase.rpc('process_purchase_return', {
                p_return_data: payload,
                p_items: items
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            toast.success("Debit Note Created & Stock Deducted! 📉");
            onSuccess();
            onOpenChange(false);
            // Reset
            setItems([]);
            setReason("");
            setSearchTerm("");
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to process return: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <FileText className="w-5 h-5" /> New Debit Note (Purchase Return)
                    </DialogTitle>
                </DialogHeader>

                <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Stock Warning</AlertTitle>
                    <AlertDescription className="text-amber-700 text-xs">
                        This action will <b>immediately deduct</b> stock from your inventory. Ensure physical goods are packed for return.
                    </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Return To (Supplier) *</Label>
                        <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Supplier" />
                            </SelectTrigger>
                            <SelectContent>
                                {suppliers.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Return Date</Label>
                        <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Reason *</Label>
                        <Input
                            placeholder="e.g. Expired, Damaged, Slow Moving"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                        />
                    </div>
                </div>

                {/* Item Search */}
                <div className="relative mb-4">
                    <Label>Find Items to Return</Label>
                    <div className="relative flex-1 mt-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by medicine name (shows only items in stock)..."
                            value={searchTerm}
                            onChange={e => handleSearchInventory(e.target.value)}
                            className="pl-10"
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                                {searchResults.map(res => (
                                    <div
                                        key={res.id}
                                        className="p-2 hover:bg-slate-100 cursor-pointer text-sm flex justify-between"
                                        onClick={() => addItem(res)}
                                    >
                                        <div>
                                            <div className="font-bold text-red-700">{res.medicine_name}</div>
                                            <div className="text-xs text-muted-foreground">Batch: {res.batch_number} | Exp: {res.expiry_date}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium text-green-700">{res.quantity} in Stock</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Items List */}
                <div className="space-y-2 border rounded-md p-2 bg-slate-50 max-h-[300px] overflow-y-auto">
                    <div className="grid grid-cols-12 gap-2 text-xs font-bold text-muted-foreground px-2 mb-2">
                        <div className="col-span-4">Item Name</div>
                        <div className="col-span-2">Batch</div>
                        <div className="col-span-2">Expiry</div>
                        <div className="col-span-1">Ret. Qty</div>
                        <div className="col-span-2">Refund Rate</div>
                        <div className="col-span-1"></div>
                    </div>
                    {items.length === 0 && <div className="text-center py-8 text-black/50">No items added.</div>}
                    {items.map(item => (
                        <div key={item.tempId} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border shadow-sm">
                            <div className="col-span-4 text-sm font-medium truncate" title={item.medicine_name}>
                                {item.medicine_name}
                            </div>
                            <div className="col-span-2 text-xs text-muted-foreground">
                                {item.batch_number || "N/A"}
                            </div>
                            <div className="col-span-2 text-xs text-muted-foreground">
                                {item.expiry_date || "N/A"}
                            </div>
                            <div className="col-span-1">
                                <Input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={e => updateItem(item.tempId, "quantity", parseInt(e.target.value) || 0)}
                                    className="h-8 text-sm font-bold text-center border-red-200 text-red-700"
                                />
                            </div>
                            <div className="col-span-2">
                                <Input
                                    type="number"
                                    value={item.refund_price}
                                    onChange={e => updateItem(item.tempId, "refund_price", parseFloat(e.target.value) || 0)}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div className="col-span-1 text-center">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(item.tempId)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center bg-red-50 p-3 rounded-lg border border-red-100">
                    <span className="font-semibold text-red-900">Total Debit Note Value</span>
                    <span className="text-xl font-bold text-red-700">₹{calculateTotal().toLocaleString()}</span>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Processing..." : "Create Debit Note"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
