import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface InventoryItem {
    id: string;
    medicine_name: string;
    quantity: number;
}

interface StockAdjustmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: InventoryItem | null;
    mode: 'IN' | 'OUT';
    onSuccess: () => void;
}

const adjustmentSchema = z.object({
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
    reason: z.string().optional()
});

type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;

export const StockAdjustmentDialog = ({ open, onOpenChange, item, mode, onSuccess }: StockAdjustmentDialogProps) => {
    const form = useForm<AdjustmentFormValues>({
        resolver: zodResolver(adjustmentSchema),
        defaultValues: {
            quantity: 1,
            reason: ""
        }
    });

    useEffect(() => {
        if (open) {
            form.reset({ quantity: 1, reason: "" });
        }
    }, [open, form]);

    const handleExecute = async (values: AdjustmentFormValues) => {
        if (!item) return;

        const qtyChange = mode === 'IN' ? values.quantity : -values.quantity;
        const finalReason = values.reason || (mode === 'IN' ? "Restock" : "Manual Deduction");

        const toastId = toast.loading("Updating Stock...");

        try {
            // @ts-ignore
            const { data, error } = await supabase.rpc('adjust_inventory_stock', {
                p_inventory_id: item.id,
                p_quantity_change: qtyChange,
                p_movement_type: mode,
                p_reason: finalReason
            });

            if (error) throw error;

            // @ts-ignore
            if (data && data.success) {
                toast.success(`Stock updated! New Qty: ${data.new_quantity}`);
                onSuccess();
                onOpenChange(false);
            } else {
                // @ts-ignore
                throw new Error(data?.error || "Update failed");
            }
        } catch (error: any) {
            logger.error(error);
            toast.error("Failed to update stock: " + error.message);
        } finally {
            toast.dismiss(toastId);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{mode === 'IN' ? 'Add Stock' : 'Deduct Stock'}: {item?.medicine_name}</DialogTitle>
                    <DialogDescription>
                        {mode === 'IN' ? 'Enter quantity to add to inventory.' : 'Enter quantity to remove from inventory.'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleExecute)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="space-y-2">
                                        <Label>Quantity {mode === 'IN' ? '(+)' : '(-)'}</Label>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min="1"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </div>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="space-y-2">
                                        <Label>Reason (Optional)</Label>
                                        <FormControl>
                                            <Textarea
                                                placeholder={mode === 'IN' ? "e.g. Received shipment" : "e.g. Damaged / Expired"}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </div>
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button
                                type="submit"
                                disabled={form.formState.isSubmitting}
                                variant={mode === 'IN' ? 'default' : 'destructive'}
                            >
                                {form.formState.isSubmitting ? 'Updating...' : 'Confirm Update'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
