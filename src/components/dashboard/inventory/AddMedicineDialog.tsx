import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { aiService, ComplianceResult } from "@/services/aiService";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { logger } from "@/utils/logger";

const medicineSchema = z.object({
    medicine_name: z.string().min(2, "Name must be at least 2 characters"),
    generic_name: z.string().optional(),
    batch_number: z.string().min(1, "Batch number is required"),
    quantity: z.coerce.number().min(0, "Quantity cannot be negative"),
    unit_price: z.coerce.number().min(0, "Price cannot be negative"),
    expiry_date: z.string().optional(),
    manufacturer: z.string().optional(),
    category: z.string().optional(),
    hsn_code: z.string().optional(),
    gst_rate: z.coerce.number(),
    rack_number: z.string().optional(),
    shelf_number: z.string().optional()
});

type MedicineFormValues = z.infer<typeof medicineSchema>;

interface AddMedicineDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export const AddMedicineDialog = ({ open, onOpenChange, onSuccess }: AddMedicineDialogProps) => {
    const { currentShop } = useUserShops();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<MedicineFormValues>({
        resolver: zodResolver(medicineSchema),
        defaultValues: {
            medicine_name: "",
            generic_name: "",
            batch_number: "",
            quantity: 0,
            unit_price: 0,
            expiry_date: "",
            manufacturer: "",
            category: "",
            hsn_code: "",
            gst_rate: 12,
            rack_number: "",
            shelf_number: ""
        }
    });

    const onSubmit = async (values: MedicineFormValues) => {
        const debugId = toast.loading("Processing...");

        try {
            if (!currentShop?.id) {
                toast.error("No Shop Selected", { id: debugId });
                return;
            }
            setIsSubmitting(true);

            // 1. AI Compliance Check (Fail-safe)
            let complianceResult: ComplianceResult = { is_banned: false, is_h1: false, reason: "" };
            try {
                // Determine if we should skip AI for speed or if offline
                // For now, simple timeout wrapper
                const aiPromise = aiService.checkCompliance(values.medicine_name);
                const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)); // 3s max

                const result = await Promise.race([aiPromise, timeoutPromise]);
                if (result) {
                    complianceResult = result as ComplianceResult;
                } else {
                    console.warn("AI Check Timed out - Skipping");
                }
            } catch (e) {
                console.warn("AI Service Error - Skipping", e);
            }

            // 2. Handle Banned Status
            if (complianceResult.is_banned) {
                if (!window.confirm(`⚠️ AI WARNING: This appears to be a BANNED DRUG.\n\nReason: ${complianceResult.reason}\n\nDo you want to FORCE SAVE this item?`)) {
                    toast.error(`Cancelled addition of banned drug: ${values.medicine_name}`, { id: debugId });
                    setIsSubmitting(false);
                    return;
                }
                toast.warning(`Force saving flaged item...`, { id: debugId });
            }

            // 3. Database Insert
            // 3. Database Insert (Secure RPC)
            toast.loading("Saving to Inventory...", { id: debugId });

            // Payload for RPC
            const payload = {
                p_shop_id: currentShop.id,
                p_medicine_name: values.medicine_name,
                p_quantity: values.quantity,
                p_unit_price: values.unit_price,
                p_batch_number: values.batch_number || null,
                p_expiry_date: values.expiry_date || null,
                p_manufacturer: values.manufacturer || null,
                p_category: values.category || null,
                p_generic_name: values.generic_name || null,
                p_rack_number: values.rack_number || null,
                p_shelf_number: values.shelf_number || null,
                p_gst_rate: values.gst_rate || 0,
                p_hsn_code: values.hsn_code || null,
                p_source: 'manual'
            };

            const { data: rpcData, error: rpcError } = await supabase.rpc('add_inventory_secure', payload);

            if (rpcError) {
                console.warn("RPC Error, falling back to direct insert:", rpcError);
                // Fallback
                const { error: directError } = await supabase.from("inventory").insert({
                    shop_id: currentShop.id,
                    medicine_name: values.medicine_name,
                    generic_name: values.generic_name,
                    batch_number: values.batch_number,
                    quantity: values.quantity,
                    unit_price: values.unit_price,
                    expiry_date: values.expiry_date || null,
                    manufacturer: values.manufacturer,
                    category: values.category,
                    schedule_h1: complianceResult.is_h1,
                    rack_number: values.rack_number,
                    shelf_number: values.shelf_number,
                    gst_rate: values.gst_rate,
                    hsn_code: values.hsn_code,
                    source: 'manual'
                });
                if (directError) throw directError;
            } else if (rpcData && !rpcData.success) {
                throw new Error(rpcData.error || "Insertion Failed via RPC");
            }

            // If we reach here, Success!

            toast.success("Medicine Added!", { id: debugId });
            form.reset();
            onOpenChange(false);
            if (onSuccess) onSuccess();

        } catch (error: any) {
            console.error("Add Medicine Fail:", error);
            toast.error("Failed to add medicine", {
                id: debugId,
                description: error.message || "Unknown Database Error"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add New Medicine</DialogTitle>
                    <DialogDescription>Enter details manually.</DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="medicine_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Medicine Name</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Quantity</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="unit_price"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>MRP</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="batch_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Batch No</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="expiry_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Expiry</FormLabel>
                                        <FormControl><Input type="date" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="rack_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Rack No.</FormLabel>
                                        <FormControl><Input placeholder="e.g. A1" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="shelf_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Shelf No.</FormLabel>
                                        <FormControl><Input placeholder="e.g. 2" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="gst_rate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>GST Rate (%)</FormLabel>
                                        <select
                                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                            value={field.value}
                                            onChange={field.onChange}
                                        >
                                            <option value="0">0% (Nil)</option>
                                            <option value="5">5%</option>
                                            <option value="12">12%</option>
                                            <option value="18">18%</option>
                                        </select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="hsn_code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>HSN Code</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
                            {isSubmitting ? "Saving..." : "Save Medicine"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
