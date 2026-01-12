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
import { Plus, Trash2, Search, Package } from "lucide-react";
import { format } from "date-fns";

interface PurchaseEntryProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

interface PurchaseItem {
    tempId: string;
    inventory_id?: string;
    medicine_name: string;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    purchase_price: number;
}

export function PurchaseEntry({ open, onOpenChange, onSuccess }: PurchaseEntryProps) {
    const { currentShop } = useUserShops();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<string>("");
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [items, setItems] = useState<PurchaseItem[]>([]);
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
        const { data } = await supabase
            .from("inventory")
            .select("id, medicine_name, batch_number, expiry_date, unit_price")
            .ilike("medicine_name", `%${query}%`)
            .limit(5);
        setSearchResults(data || []);
    };

    const addItem = (invItem?: any) => {
        const newItem: PurchaseItem = {
            tempId: Date.now().toString(),
            inventory_id: invItem?.id, // If undefined, it's a new item (not fully supported yet without adding to inventory first)
            medicine_name: invItem?.medicine_name || searchTerm,
            batch_number: invItem?.batch_number || "",
            expiry_date: invItem?.expiry_date || "",
            quantity: 1,
            purchase_price: invItem?.unit_price ? (invItem.unit_price * 0.7) : 0 // Guessing purchase price
        };
        setItems([...items, newItem]);
        setSearchTerm("");
        setSearchResults([]);
    };

    const updateItem = (id: string, field: keyof PurchaseItem, value: any) => {
        setItems(items.map(i => i.tempId === id ? { ...i, [field]: value } : i));
    };

    const removeItem = (id: string) => {
        setItems(items.filter(i => i.tempId !== id));
    };

    const calculateTotal = () => items.reduce((sum, i) => sum + (i.quantity * i.purchase_price), 0);

    const handleSubmit = async () => {
        if (!selectedSupplier || !invoiceNumber) {
            toast.error("Supplier and Invoice Number are required");
            return;
        }
        if (items.length === 0) {
            toast.error("Add at least one item");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Create Purchase Record
            const { data: purchase, error: purchaseError } = await supabase.from("purchases").insert({
                shop_id: currentShop?.id,
                supplier_id: selectedSupplier,
                invoice_number: invoiceNumber,
                invoice_date: invoiceDate,
                total_amount: calculateTotal(),
                status: "completed"
            }).select().single();

            if (purchaseError) throw purchaseError;

            // 2. Add Items & Update Inventory
            for (const item of items) {
                // Add to purchase_items
                await supabase.from("purchase_items").insert({
                    purchase_id: purchase.id,
                    inventory_id: item.inventory_id,
                    medicine_name: item.medicine_name,
                    batch_number: item.batch_number,
                    expiry_date: item.expiry_date || null,
                    quantity: item.quantity,
                    purchase_price: item.purchase_price
                });

                // Update Inventory Stock (Atomic increment)
                if (item.inventory_id) {
                    await supabase.rpc('adjust_inventory_stock', {
                        p_inventory_id: item.inventory_id,
                        p_quantity_change: item.quantity,
                        p_movement_type: 'IN',
                        p_reason: `Purchase Inv: ${invoiceNumber}`
                    });
                } else {
                    // Logic for NEW item not in inventory would go here
                    // For Phase 1, we assume item exists or they add it via Inventory screen first.
                    // We can log a warning or auto-create in future.
                }
            }

            toast.success("Purchase Entry Saved & Stock Updated! 🚀");
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to save purchase: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>New Purchase Entry (Stock In)</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Supplier *</Label>
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
                        <Label>Invoice Number *</Label>
                        <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2024-001" />
                    </div>
                    <div className="space-y-2">
                        <Label>Invoice Date</Label>
                        <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                    </div>
                </div>

                {/* Item Search */}
                <div className="relative mb-4">
                    <Label>Add Products</Label>
                    <div className="flex gap-2 mt-1">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search existing inventory..."
                                value={searchTerm}
                                onChange={e => handleSearchInventory(e.target.value)}
                                className="pl-10"
                            />
                            {searchResults.length > 0 && (
                                <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                                    {searchResults.map(res => (
                                        <div
                                            key={res.id}
                                            className="p-2 hover:bg-slate-100 cursor-pointer text-sm"
                                            onClick={() => addItem(res)}
                                        >
                                            <div className="font-bold">{res.medicine_name}</div>
                                            <div className="text-xs text-muted-foreground">Batch: {res.batch_number} | MRP: {res.unit_price}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Button variant="outline" onClick={() => addItem()}>
                            <Plus className="w-4 h-4 mr-2" /> Manual Add
                        </Button>
                    </div>
                </div>

                {/* Items List */}
                <div className="space-y-2 border rounded-md p-2 bg-slate-50 max-h-[300px] overflow-y-auto">
                    <div className="grid grid-cols-12 gap-2 text-xs font-bold text-muted-foreground px-2 mb-2">
                        <div className="col-span-4">Item Name</div>
                        <div className="col-span-2">Batch</div>
                        <div className="col-span-2">Expiry</div>
                        <div className="col-span-1">Qty</div>
                        <div className="col-span-2">Buy Price</div>
                        <div className="col-span-1"></div>
                    </div>
                    {items.length === 0 && <div className="text-center py-8 text-black/50">No items added.</div>}
                    {items.map(item => (
                        <div key={item.tempId} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border shadow-sm">
                            <div className="col-span-4">
                                <Input
                                    value={item.medicine_name}
                                    onChange={e => updateItem(item.tempId, "medicine_name", e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="Name"
                                />
                            </div>
                            <div className="col-span-2">
                                <Input
                                    value={item.batch_number}
                                    onChange={e => updateItem(item.tempId, "batch_number", e.target.value)}
                                    className="h-8 text-xs"
                                    placeholder="Batch"
                                />
                            </div>
                            <div className="col-span-2">
                                <Input
                                    type="date"
                                    value={item.expiry_date}
                                    onChange={e => updateItem(item.tempId, "expiry_date", e.target.value)}
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="col-span-1">
                                <Input
                                    type="number"
                                    value={item.quantity}
                                    onChange={e => updateItem(item.tempId, "quantity", parseInt(e.target.value) || 0)}
                                    className="h-8 text-sm font-bold text-center"
                                />
                            </div>
                            <div className="col-span-2">
                                <Input
                                    type="number"
                                    value={item.purchase_price}
                                    onChange={e => updateItem(item.tempId, "purchase_price", parseFloat(e.target.value) || 0)}
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

                <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <span className="font-semibold text-blue-900">Total Purchase Amount</span>
                    <span className="text-xl font-bold text-blue-700">₹{calculateTotal().toLocaleString()}</span>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Saving..." : "Save Purchase & Update Stock"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
