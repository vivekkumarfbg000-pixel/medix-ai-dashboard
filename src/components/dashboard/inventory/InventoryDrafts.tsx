import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Upload, Sparkles, Check, X, CheckCheck, Trash2, AlertCircle, FileText } from "lucide-react";
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
    onRefreshRequest: () => void;
    predictions?: any[];
}

export const InventoryDrafts = ({ shopId, onRefreshRequest, predictions = [] }: InventoryDraftsProps) => {
    const [loading, setLoading] = useState(true);
    const [stagingItems, setStagingItems] = useState<StagingItem[]>([]);

    const fetchStaging = async () => {
        if (!shopId) return;

        try {
            const { data, error } = await supabase
                .from("inventory_staging")
                .select("*")
                .eq("shop_id", shopId)
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    logger.warn("inventory_staging table missing");
                    return;
                }
                logger.error("Error fetching drafts:", error);
            } else {
                const enrichedData = (data || []).map((item: any) => {
                    const value = item.unit_price * item.quantity;
                    const classification = value > 5000 ? 'A' : (value > 1000 ? 'B' : 'C');

                    const prediction = predictions.find(p => p.medicine_name.toLowerCase() === item.medicine_name.toLowerCase());
                    let velocity = 'Unknown';
                    let action = 'None';

                    if (prediction) {
                        if (prediction.avg_daily_sales > 2) velocity = 'Fast';
                        else if (prediction.avg_daily_sales > 0.5) velocity = 'Medium';
                        else velocity = 'Slow';
                    } else {
                        velocity = item.unit_price < 100 ? 'Medium' : 'Slow';
                    }

                    if (velocity === 'Fast' && item.quantity < 10) action = 'Reorder';
                    else if (velocity === 'Slow' && item.quantity > 50) action = 'Discount';
                    else if (velocity === 'Dead') action = 'Return';

                    return {
                        ...item,
                        insights: {
                            classification,
                            velocity,
                            action
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
    }, [shopId, predictions]);

    const updateDraftItem = (id: string, field: keyof StagingItem, value: any) => {
        setStagingItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const handleApproveDraft = async (item: StagingItem) => {
        if (!shopId) return;

        const { error: insertError } = await supabase.from("inventory").insert({
            shop_id: shopId,
            medicine_name: item.medicine_name,
            batch_number: item.batch_number,
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price) || 0,
            expiry_date: item.expiry_date,
            source: 'ai_scan'
        } as any);

        if (insertError) {
            toast.error("Failed to approve item: " + insertError.message);
            return;
        }

        // @ts-ignore
        await supabase.from("inventory_staging").update({ status: 'approved' }).eq('id', item.id);
        toast.success("Approved " + item.medicine_name);
        setStagingItems(prev => prev.filter(i => i.id !== item.id));
        onRefreshRequest();
    };

    const handleRejectDraft = async (id: string) => {
        // @ts-ignore
        await supabase.from("inventory_staging").update({ status: 'rejected' }).eq('id', id);
        toast.info("Draft rejected");
        setStagingItems(prev => prev.filter(i => i.id !== id));
    };

    const handleApproveAll = async () => {
        if (stagingItems.length === 0) return;
        toast.loading("Approving all items...");

        // Process in parallel for speed
        await Promise.all(stagingItems.map(item => handleApproveDraft(item)));

        toast.dismiss();
        toast.success("All items approved successfully!");
    };

    const handleDiscardAll = async () => {
        if (!confirm("Are you sure you want to discard all drafts?")) return;

        toast.loading("Discarding all items...");
        await Promise.all(stagingItems.map(item => handleRejectDraft(item.id)));
        toast.dismiss();
        toast.info("All drafts discarded");
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
        <Card className="border-none shadow-md bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        AI Draft Review
                    </CardTitle>
                    <CardDescription>
                        Review and edit items extracted from your scan before adding to inventory.
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    <input type="file" id="inventory-upload" className="hidden" accept="image/*" onChange={handleScanUpload} />
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('inventory-upload')?.click()}>
                        <Upload className="w-4 h-4 mr-2" /> Upload New Bill
                    </Button>
                    {stagingItems.length > 0 && (
                        <>
                            <Button variant="destructive" size="sm" onClick={handleDiscardAll}>
                                <Trash2 className="w-4 h-4 mr-2" /> Discard All
                            </Button>
                            <Button className="bg-green-600 hover:bg-green-700 text-white" size="sm" onClick={handleApproveAll}>
                                <CheckCheck className="w-4 h-4 mr-2" /> Approve All
                            </Button>
                        </>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Sparkles className="w-8 h-8 animate-spin mb-2 text-purple-400" />
                        <p>Analyzing drafts...</p>
                    </div>
                ) : stagingItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 text-muted-foreground bg-slate-50/50">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                            <FileText className="w-8 h-8 text-slate-300" />
                        </div>
                        <div>
                            <p className="font-medium text-slate-900">No Drafts Pending</p>
                            <p className="text-sm">Upload a bill to let AI extract medicines automatically.</p>
                        </div>
                        <Button variant="default" onClick={() => document.getElementById('inventory-upload')?.click()}>
                            <Upload className="w-4 h-4 mr-2" /> Upload Bill
                        </Button>
                    </div>
                ) : (
                    <div className="rounded-md border-b">
                        <Table>
                            <TableHeader className="bg-slate-50/75">
                                <TableRow>
                                    <TableHead className="w-[250px] font-semibold">Medicine Name</TableHead>
                                    <TableHead className="w-[120px] font-semibold">Batch No</TableHead>
                                    <TableHead className="w-[140px] font-semibold">Expiry</TableHead>
                                    <TableHead className="w-[100px] font-semibold">Qty</TableHead>
                                    <TableHead className="w-[120px] font-semibold text-right">MRP (₹)</TableHead>
                                    <TableHead className="w-[100px] font-semibold text-center">Insights</TableHead>
                                    <TableHead className="w-[100px] font-semibold text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stagingItems.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <TableCell>
                                            <Input
                                                value={item.medicine_name}
                                                onChange={(e) => updateDraftItem(item.id, 'medicine_name', e.target.value)}
                                                className="border-transparent bg-transparent hover:bg-white hover:border-input focus:bg-white transition-all font-medium h-9"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.batch_number || ''}
                                                onChange={(e) => updateDraftItem(item.id, 'batch_number', e.target.value)}
                                                placeholder="Batch"
                                                className="border-transparent bg-transparent hover:bg-white hover:border-input focus:bg-white transition-all h-9 text-xs"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.expiry_date || ''}
                                                onChange={(e) => updateDraftItem(item.id, 'expiry_date', e.target.value)}
                                                placeholder="YYYY-MM-DD"
                                                className={`border-transparent bg-transparent hover:bg-white hover:border-input focus:bg-white transition-all h-9 text-xs ${!item.expiry_date ? 'border-red-200 bg-red-50/50' : ''}`}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateDraftItem(item.id, 'quantity', e.target.value)}
                                                className="border-transparent bg-transparent hover:bg-white hover:border-input focus:bg-white transition-all h-9 w-20"
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="number"
                                                value={item.unit_price}
                                                onChange={(e) => updateDraftItem(item.id, 'unit_price', e.target.value)}
                                                className="border-transparent bg-transparent hover:bg-white hover:border-input focus:bg-white transition-all h-9 w-24 ml-auto text-right"
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {item.insights && (
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-[10px] px-2 h-6 ${item.insights.velocity === 'Fast' ? 'bg-green-100 text-green-700' :
                                                            item.insights.velocity === 'Dead' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                        }`}
                                                >
                                                    {item.insights.velocity}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={() => handleApproveDraft(item)}
                                                >
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleRejectDraft(item.id)}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
