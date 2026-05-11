import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

interface AlternativeData {
    itemId: string;
    name: string;
    options: any[];
}

interface AlternativeDialogProps {
    data: AlternativeData | null;
    onClose: () => void;
    onSelect: (itemId: string, sub: any) => void;
}

export function AlternativeDialog({ data, onClose, onSelect }: AlternativeDialogProps) {
    if (!data) return null;

    return (
        <Dialog open={!!data} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="glass-card border-purple-500/30 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-purple-500">
                        <Sparkles className="w-5 h-5" /> Recommended Substitutes
                    </DialogTitle>
                    <DialogDescription>
                        Select a high-margin alternative for <span className="font-bold text-foreground">{data.name}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto pr-1">
                    {data.options.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground bg-muted/20 rounded-lg">
                            No higher margin substitutes found in inventory.
                        </div>
                    ) : (
                        data.options.map((sub, idx) => {
                            const profit = sub.unit_price - (sub.purchase_price || (sub.unit_price * 0.7));
                            return (
                                <div
                                    key={sub.id || idx}
                                    className="p-3 rounded-lg border border-purple-500/10 bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer flex justify-between items-center group transition-all"
                                    onClick={() => onSelect(data.itemId, sub)}
                                >
                                    <div>
                                        <div className="font-bold text-foreground">{sub.medicine_name}</div>
                                        <div className="text-xs text-muted-foreground">{sub.composition || sub.generic_name || "Similar Medicine"}</div>
                                        {sub.stock_status === 'out_of_stock' && (
                                            <span className="text-[10px] text-destructive bg-destructive/10 px-1 py-0.5 rounded ml-1">Out of Stock</span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-lg text-purple-600">₹{sub.unit_price}</div>
                                        <div className="text-[10px] text-green-600 font-medium">
                                            Profit: ₹{profit.toFixed(1)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
