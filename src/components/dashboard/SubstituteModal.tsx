import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, PackageX, CheckCircle2, AlertCircle } from "lucide-react";
import { OfflineInventory } from "@/db/db";

export interface SubstituteOption {
    name: string;
    isAvailable: boolean;
    stock?: number;
    price?: number;
    item?: OfflineInventory;
    matchType?: 'Same Composition' | 'Generic' | 'Brand Substitute';
}

interface SubstituteModalProps {
    isOpen: boolean;
    onClose: () => void;
    originalQuery: string;
    alternatives: SubstituteOption[];
    onSelect: (item: OfflineInventory) => void;
    isLoading: boolean;
}

export function SubstituteModal({ isOpen, onClose, originalQuery, alternatives, onSelect, isLoading }: SubstituteModalProps) {
    const available = alternatives.filter(a => a.isAvailable);
    const others = alternatives.filter(a => !a.isAvailable);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        ) : (
                            <PackageX className="w-5 h-5 text-red-500" />
                        )}
                        {isLoading ? "Analyzing..." : `"${originalQuery}" Not Found`}
                    </DialogTitle>
                    <DialogDescription>
                        {isLoading
                            ? "Checking composition and finding in-stock alternatives..."
                            : "We found the following alternatives with similar composition."}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="animate-pulse space-y-2 w-full max-w-xs">
                            <div className="h-4 bg-slate-100 rounded w-3/4 mx-auto"></div>
                            <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div>
                        </div>
                        <p className="text-xs text-muted-foreground">Consulting AI Knowledge Base...</p>
                    </div>
                ) : (
                    <ScrollArea className="max-h-[300px] -mx-4 px-4">
                        <div className="space-y-4">
                            {/* In Stock Section */}
                            {available.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-emerald-600 mb-2 flex items-center gap-1">
                                        <CheckCircle2 className="w-4 h-4" /> Available in Stock
                                    </h4>
                                    <div className="grid gap-2">
                                        {available.map((alt, idx) => (
                                            <div
                                                key={idx}
                                                className="border rounded-lg p-3 hover:bg-slate-50 cursor-pointer transition-colors flex justify-between items-center group"
                                                onClick={() => alt.item && onSelect(alt.item)}
                                            >
                                                <div>
                                                    <div className="font-medium text-slate-900">{alt.name}</div>
                                                    <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-emerald-200 bg-emerald-50 text-emerald-700">
                                                            MRP ₹{alt.price}
                                                        </Badge>
                                                        <span>Stock: {alt.stock}</span>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="default" className="h-8 bg-blue-600 hover:bg-blue-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Select
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Market Section (Not in stock) */}
                            {others.length > 0 && (
                                <div className={available.length > 0 ? "pt-2" : ""}>
                                    <h4 className="text-sm font-semibold text-slate-500 mb-2 mt-2 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" /> Market Substitutes (Out of Stock)
                                    </h4>
                                    <div className="space-y-1">
                                        {others.map((alt, idx) => (
                                            <div key={idx} className="text-sm text-slate-500 py-1 px-2 rounded hover:bg-slate-50 flex justify-between">
                                                <span>{alt.name}</span>
                                                <span className="text-[10px] italic opacity-70">Not in inventory</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {available.length === 0 && others.length === 0 && (
                                <div className="text-center py-6 text-slate-500">
                                    No direct substitutes found.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
