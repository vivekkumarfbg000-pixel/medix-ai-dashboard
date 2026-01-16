import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Scan, Save, RefreshCw, CheckCircle2, AlertCircle, Search, X } from "lucide-react";

interface StockAuditProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shopId: string;
    onComplete: () => void;
}

interface AuditItem {
    id: string;
    name: string;
    batch: string;
    systemQty: number;
    countedQty: number;
    status: 'matched' | 'mismatched' | 'pending';
}

export const StockAudit = ({ open, onOpenChange, shopId, onComplete }: StockAuditProps) => {
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [allItems, setAllItems] = useState<any[]>([]);
    const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const scanInputRef = useRef<HTMLInputElement>(null);

    // Fetch Inventory on Open
    useEffect(() => {
        if (open && shopId) {
            loadInventory();
        }
    }, [open, shopId]);

    const loadInventory = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('inventory')
            .select('id, medicine_name, batch_number, quantity, barcode')
            .eq('shop_id', shopId);

        if (error) {
            toast.error("Failed to load inventory for audit");
            return;
        }

        setAllItems(data || []);
        // Initialize audit list (initially empty or pre-filled? Standard is empty scan list)
        // Actually, let's keep track of matched items.
        setLoading(false);
        // Focus scan input
        setTimeout(() => scanInputRef.current?.focus(), 100);
    };

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (!search.trim()) return;

        const term = search.toLowerCase().trim();

        // Find item matches (Name or Barcode)
        const matches = allItems.filter(i =>
            (i.medicine_name?.toLowerCase().includes(term)) ||
            (i.barcode === term)
        );

        if (matches.length === 0) {
            toast.error("Item not found");
            return;
        }

        if (matches.length === 1) {
            // Exact/Single Match -> Auto Increment
            incrementCount(matches[0]);
            setSearch(""); // Clear for next scan
        } else {
            // Multiple matches -> Show selection (Simplification: just pick first or warn)
            // For MVP, picking first but warning user if vague
            toast.info(`Multiple matches found for "${search}". Selected: ${matches[0].medicine_name}`);
            incrementCount(matches[0]);
            setSearch("");
        }
    };

    const incrementCount = (item: any) => {
        setAuditItems(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? {
                    ...i,
                    countedQty: i.countedQty + 1,
                    status: (i.countedQty + 1) === i.systemQty ? 'matched' : 'mismatched'
                } : i);
            } else {
                return [{
                    id: item.id,
                    name: item.medicine_name,
                    batch: item.batch_number || 'N/A',
                    systemQty: item.quantity,
                    countedQty: 1,
                    status: 1 === item.quantity ? 'matched' : 'mismatched'
                }, ...prev];
            }
        });
        toast.success("Counted +1", { duration: 500, position: 'bottom-center' }); // Subtle feedback
    };

    const updateQtyManual = (id: string, newQty: number) => {
        setAuditItems(prev => prev.map(i => {
            if (i.id === id) {
                return {
                    ...i,
                    countedQty: newQty,
                    status: newQty === i.systemQty ? 'matched' : 'mismatched'
                };
            }
            return i;
        }));
    };

    const handleReconcile = async () => {
        if (!confirm("This will update the live inventory quantities to match your counted values. Proceed?")) return;

        setSubmitting(true);
        const updates = auditItems.filter(i => i.status === 'mismatched' || i.countedQty !== i.systemQty);

        if (updates.length === 0) {
            toast.success("No discrepancies to update!");
            setSubmitting(false);
            return;
        }

        let errors = 0;
        for (const item of updates) {
            const { error } = await supabase
                .from('inventory')
                .update({ quantity: item.countedQty })
                .eq('id', item.id);
            if (error) errors++;
        }

        if (errors > 0) {
            toast.warning(`Updated with ${errors} errors.`);
        } else {
            toast.success("Stock Reconciled Successfully!");
            onComplete();
            onOpenChange(false);
        }
        setSubmitting(false);
    };

    const matchedCount = auditItems.filter(i => i.status === 'matched').length;
    const mismatchedCount = auditItems.filter(i => i.status === 'mismatched').length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50">
                    <div className="flex justify-between items-center">
                        <div>
                            <DialogTitle className="flex items-center gap-2">
                                <Scan className="w-5 h-5 text-blue-600" /> Rapid Stock Audit
                            </DialogTitle>
                            <DialogDescription>
                                Scan items to verify physical stock. {matchedCount > 0 && <span className="text-green-600 font-bold ml-2">{matchedCount} Matched</span>}
                                {mismatchedCount > 0 && <span className="text-red-600 font-bold ml-2">{mismatchedCount} Mismatched</span>}
                            </DialogDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button
                                onClick={handleReconcile}
                                disabled={submitting || auditItems.length === 0}
                                className={mismatchedCount > 0 ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {submitting ? "Saving..." : "Reconcile Differences"}
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    {/* Left: Scan Area */}
                    <div className="flex-1 p-6 flex flex-col gap-4 border-r">
                        <form onSubmit={handleScan} className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <Input
                                    ref={scanInputRef}
                                    placeholder="Scan Barcode or Type Name..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-10 h-12 text-lg"
                                    autoFocus
                                />
                            </div>
                            <Button type="submit" size="lg" className="h-12 px-6">Scan</Button>
                        </form>

                        <div className="flex-1 bg-slate-100 rounded-lg p-4 flex items-center justify-center text-slate-400 border-2 border-dashed">
                            {/* Big visual feedback area could go here, for now keeping it simple */}
                            <div className="text-center">
                                <Scan className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>Ready to Scan</p>
                                <p className="text-xs">Use a handheld scanner or type manually</p>
                            </div>
                        </div>
                    </div>

                    {/* Right: List */}
                    <div className="w-full lg:w-[450px] bg-white flex flex-col">
                        <div className="p-3 border-b bg-slate-50 font-medium text-sm flex justify-between text-slate-500">
                            <span>Audited Items ({auditItems.length})</span>
                            <span>System vs Phys.</span>
                        </div>
                        <ScrollArea className="flex-1 p-0">
                            {auditItems.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    No items counted yet.
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {auditItems.map(item => (
                                        <div key={item.id} className={`p-4 flex items-center justify-between ${item.status === 'mismatched' ? 'bg-red-50/50' : 'bg-green-50/50'}`}>
                                            <div className="min-w-0 flex-1 mr-4">
                                                <div className="font-bold text-slate-800 truncate">{item.name}</div>
                                                <div className="text-xs text-slate-500 flex gap-2">
                                                    <span>Batch: {item.batch}</span>
                                                    <span>Sys: {item.systemQty}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="icon" variant="outline" className="h-8 w-8"
                                                    onClick={() => updateQtyManual(item.id, Math.max(0, item.countedQty - 1))}
                                                >-</Button>
                                                <div className={`w-12 text-center font-bold text-lg ${item.status === 'matched' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {item.countedQty}
                                                </div>
                                                <Button
                                                    size="icon" variant="outline" className="h-8 w-8"
                                                    onClick={() => updateQtyManual(item.id, item.countedQty + 1)}
                                                >+</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
