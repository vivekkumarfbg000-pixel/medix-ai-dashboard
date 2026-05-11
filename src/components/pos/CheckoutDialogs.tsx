import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, CreditCard, Banknote, Landmark, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface SplitPayment {
    mode: 'cash' | 'upi' | 'card' | 'credit';
    amount: number;
}

interface CheckoutDialogsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    total: number;
    paymentMode: string;
    setPaymentMode: (mode: string) => void;
    onConfirm: (finalPaymentMode: string, splits?: SplitPayment[]) => void;
    isProcessing: boolean;
}

export function CheckoutDialogs({
    open,
    onOpenChange,
    total,
    paymentMode,
    setPaymentMode,
    onConfirm,
    isProcessing
}: CheckoutDialogsProps) {
    const [isSplit, setIsSplit] = useState(false);
    const [splits, setSplits] = useState<SplitPayment[]>([
        { mode: 'cash', amount: total },
        { mode: 'upi', amount: 0 }
    ]);

    const updateSplitAmount = (index: number, val: string) => {
        const num = parseFloat(val) || 0;
        const newSplits = [...splits];
        newSplits[index].amount = num;
        
        // Auto-balance if only 2 splits
        if (splits.length === 2) {
            const otherIndex = index === 0 ? 1 : 0;
            newSplits[otherIndex].amount = Math.max(0, total - num);
        }
        setSplits(newSplits);
    };

    const handleConfirm = () => {
        if (isSplit) {
            const splitTotal = splits.reduce((acc, curr) => acc + curr.amount, 0);
            if (Math.abs(splitTotal - total) > 0.1) {
                toast.error("Split amounts must equal the grand total.");
                return;
            }
            const activeSplits = splits.filter(s => s.amount > 0);
            const modes = activeSplits.map(s => s.mode).join('+');
            onConfirm(modes, activeSplits);
        } else {
            onConfirm(paymentMode);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass-card sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-primary" /> Confirm Checkout
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="flex justify-between items-center bg-muted/50 p-4 rounded-lg">
                        <span className="text-muted-foreground font-medium">Grand Total</span>
                        <span className="text-2xl font-bold text-primary">₹{total.toFixed(2)}</span>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-base">Payment Method</Label>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-primary h-8"
                                onClick={() => setIsSplit(!isSplit)}
                            >
                                {isSplit ? "Use Single Payment" : "Split Payment"}
                            </Button>
                        </div>

                        {!isSplit ? (
                            <RadioGroup value={paymentMode} onValueChange={setPaymentMode} className="grid grid-cols-2 gap-3">
                                <Label className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMode === 'cash' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                                    <RadioGroupItem value="cash" className="sr-only" />
                                    <Banknote className={`w-5 h-5 ${paymentMode === 'cash' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <span className="font-medium">Cash</span>
                                </Label>
                                <Label className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMode === 'upi' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                                    <RadioGroupItem value="upi" className="sr-only" />
                                    <Smartphone className={`w-5 h-5 ${paymentMode === 'upi' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <span className="font-medium">UPI</span>
                                </Label>
                                <Label className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMode === 'card' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                                    <RadioGroupItem value="card" className="sr-only" />
                                    <CreditCard className={`w-5 h-5 ${paymentMode === 'card' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <span className="font-medium">Card</span>
                                </Label>
                                <Label className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMode === 'credit' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                                    <RadioGroupItem value="credit" className="sr-only" />
                                    <Landmark className={`w-5 h-5 ${paymentMode === 'credit' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <span className="font-medium">Credit (Udhaar)</span>
                                </Label>
                            </RadioGroup>
                        ) : (
                            <div className="space-y-3 bg-muted/20 p-3 rounded-xl border">
                                {splits.map((split, idx) => (
                                    <div key={idx} className="flex gap-2 items-end">
                                        <div className="flex-1 space-y-1">
                                            <Label>Method {idx + 1}</Label>
                                            <select 
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                                value={split.mode}
                                                onChange={(e) => {
                                                    const newSplits = [...splits];
                                                    newSplits[idx].mode = e.target.value as any;
                                                    setSplits(newSplits);
                                                }}
                                            >
                                                <option value="cash">Cash</option>
                                                <option value="upi">UPI</option>
                                                <option value="card">Card</option>
                                            </select>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <Label>Amount (₹)</Label>
                                            <Input 
                                                type="number" 
                                                min="0"
                                                step="0.01"
                                                value={split.amount || ''} 
                                                onChange={(e) => updateSplitAmount(idx, e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <div className="text-sm text-muted-foreground pt-2 border-t">
                                    Remaining: <span className={Math.abs(total - splits.reduce((a,c)=>a+c.amount,0)) > 0.01 ? "text-destructive font-bold" : "text-success font-bold"}>
                                        ₹{Math.max(0, total - splits.reduce((a,c)=>a+c.amount,0)).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={isProcessing} className="w-full sm:w-auto">
                        {isProcessing ? "Processing..." : (
                            <>
                                <Check className="w-4 h-4 mr-2" /> Complete Sale
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
