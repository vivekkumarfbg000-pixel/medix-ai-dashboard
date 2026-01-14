import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Sparkles, Package, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { aiService } from "@/services/aiService";
import { logger } from "@/utils/logger";

interface StagingItem {
    id: string;
    medicine_name: string;
    batch_number: string | null;
    expiry_date: string | null;
    quantity: number;
    unit_price: number;
    source: string;
    created_at: string;
    insights?: {
        velocity: 'Fast' | 'Slow' | 'Dead';
        classification: 'A' | 'B' | 'C';
        action: 'Reorder' | 'Return' | 'Discount' | 'None';
    };
}

interface InventoryDraftsProps {
    shopId: string;
    onRefreshRequest: () => void; // Callback to tell parent strict inventory might have changed
}

export const InventoryDrafts = ({ shopId, onRefreshRequest }: InventoryDraftsProps) => {
    const [loading, setLoading] = useState(true);
    const [stagingItems, setStagingItems] = useState<StagingItem[]>([]);

    const fetchStaging = async () => {
        if (!shopId) return;

        try {
            // @ts-ignore - Table exists
            const { data, error } = await supabase
                .from("inventory_staging")
                .select("*")
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    logger.warn("inventory_staging table missing");
                    return;
                }
                logger.error("Error fetching drafts:", error);
            } else {
                // Mock Enrichment (ABC-VEN Analysis)
                const enrichedData = (data || []).map((item: any) => {
                    const isExpensive = item.unit_price > 500;
                    const velocity = Math.random() > 0.5 ? 'Fast' : (Math.random() > 0.5 ? 'Slow' : 'Dead');
                    let action = 'None';

                    if (velocity === 'Dead' && isExpensive) action = 'Return';
                    else if (velocity === 'Slow' && !isExpensive) action = 'Discount';
                    else if (velocity === 'Fast') action = 'Reorder';

                    return {
                        ...item,
                        insights: {
                            classification: isExpensive ? 'A' : 'C',
                            velocity: velocity,
                            action: action
                        }
                    };
                });
                setStagingItems(enrichedData as StagingItem[]);
            }
        } catch (e) {
            logger.warn("Compliance check offline", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaging();
        const channel = supabase
            .channel('inventory-drafts-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_staging' }, fetchStaging)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [shopId]);

    const handleApproveDraft = async (item: StagingItem) => {
        if (!shopId) return;

        // 1. Move to Main Inventory
        const { error: insertError } = await supabase.from("inventory").insert({
            shop_id: shopId,
            medicine_name: item.medicine_name,
            batch_number: item.batch_number,
            quantity: item.quantity,
            unit_price: item.unit_price,
            expiry_date: item.expiry_date,
            source: 'ai_scan'
        } as any);

        if (insertError) {
            toast.error("Failed to approve item: " + insertError.message);
            logger.error(insertError);
            return;
        }

        // 2. Mark as Approved
        // @ts-ignore
        await supabase.from("inventory_staging").update({ status: 'approved' }).eq('id', item.id);

        toast.success(`Approved ${item.medicine_name}`);
        fetchStaging();
        onRefreshRequest(); // Refresh main inventory
    };

    const handleRejectDraft = async (id: string) => {
        // @ts-ignore
        await supabase.from("inventory_staging").update({ status: 'rejected' }).eq('id', id);
        toast.info("Draft rejected");
        fetchStaging();
    };

    const handleScanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const toastId = toast.loading("Uploading to AI Vision Engine...");
        try {
            const result = await aiService.analyzeDocument(file, 'inventory_list');

            if (result && (result.items || Array.isArray(result))) {
                const itemsToSave = Array.isArray(result) ? result : (result.items || []);

                if (itemsToSave.length > 0) {
                    const formattedItems = itemsToSave.map((item: any) => ({
                        shop_id: shopId,
                        medicine_name: item.medicine_name || item.name || "Unknown",
                        batch_number: item.batch_number || item.batch || null,
                        expiry_date: item.expiry_date || item.expiry || null,
                        quantity: parseInt(item.quantity || item.qty || '0'),
                        unit_price: parseFloat(item.unit_price || item.mrp || item.price || '0'),
                        status: 'pending',
                        source: 'scan'
                    }));

                    const { error } = await supabase.from('inventory_staging' as any).insert(formattedItems);
                    if (error) {
                        logger.error("Manual Staging Save Error:", error);
                    } else {
                        toast.success(`Scanned ${formattedItems.length} items!`);
                        fetchStaging();
                    }
                }
            }
        } catch (err: any) {
            logger.error("Scan Error:", err);
            toast.error(err.message || "Scan Failed");
        } finally {
            toast.dismiss(toastId);
        }
    };

    return (
        <Card className="border-purple-200 bg-purple-50/30">
            <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-full bg-purple-100 text-purple-600"><Sparkles className="w-6 h-6" /></div>
                    <div>
                        <h3 className="font-bold text-lg text-purple-900">AI Drafts</h3>
                        <p className="text-sm text-purple-700">Items identified by Gemini Vision. Review before adding to stock.</p>
                    </div>
                </div>

                {/* Upload Section */}
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                        <div>
                            <h3 className="font-semibold text-lg">Upload Invoice / Medicine Strip</h3>
                            <p className="text-sm text-muted-foreground">Upload an image to auto-detect items (Batch & Expiry).</p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                id="inventory-upload"
                                className="hidden"
                                accept="image/*"
                                onChange={handleScanUpload}
                            />
                            <Button onClick={() => document.getElementById('inventory-upload')?.click()}>
                                <Upload className="w-4 h-4 mr-2" /> Upload Scan
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">Loading drafts...</div>
                    ) : stagingItems.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground/60 border-2 border-dashed border-purple-200 rounded-lg">
                            No pending drafts. Upload an image above to start.
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {stagingItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-lg">{item.medicine_name}</h4>
                                        <div className="flex gap-4 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1"><Package className="w-3 h-3" /> Qty: {item.quantity}</span>
                                            <span>MRP: ₹{item.unit_price}</span>
                                            {item.expiry_date && <span>Exp: {item.expiry_date}</span>}
                                        </div>
                                        {item.insights && (
                                            <div className="flex gap-2 mt-2">
                                                <Badge variant="outline" className={item.insights.classification === 'A' ? 'border-red-500 text-red-600' : 'border-slate-400'}>
                                                    Class {item.insights.classification}
                                                </Badge>
                                                <Badge variant="secondary" className={
                                                    item.insights.velocity === 'Fast' ? 'bg-green-100 text-green-700' :
                                                        item.insights.velocity === 'Dead' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                }>
                                                    {item.insights.velocity} Mover
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleRejectDraft(item.id)}>
                                            <X className="w-5 h-5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-green-500 hover:text-green-700 hover:bg-green-50" onClick={() => handleApproveDraft(item)}>
                                            <Check className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
