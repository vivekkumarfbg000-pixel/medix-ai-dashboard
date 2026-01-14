import { useEffect, useState, Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { toast } from "sonner";
import { NotebookPen, Plus, Trash2, Share2, CheckCircle2, AlertCircle, Sparkles, FileText, Printer, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ShortbookItem {
    id: string;
    medicine_name: string;
    quantity_needed: string;
    priority: 'normal' | 'high';
    is_ordered: boolean;
    created_at: string;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(_: Error) {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Shortbook Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 text-center border-2 border-red-200 bg-red-50 rounded-lg">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                    <h3 className="text-lg font-bold text-red-700">Something went wrong</h3>
                    <p className="text-red-600 mb-4">The Shortbook component crashed. Please check your database connection.</p>
                    <Button variant="outline" onClick={() => this.setState({ hasError: false })}>Try Again</Button>
                </div>
            );
        }
        return this.props.children;
    }
}

const ShortbookContent = ({ embedded = false }: { embedded?: boolean }) => {
    const { currentShop } = useUserShops();
    const [items, setItems] = useState<ShortbookItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [newName, setNewName] = useState("");
    const [newQty, setNewQty] = useState("");
    const [isHighPriority, setIsHighPriority] = useState(false);

    const fetchItems = async () => {
        if (!currentShop?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('shortbook_items' as any)
                .select('*')
                .eq('shop_id', currentShop.id)
                .order('created_at', { ascending: false });

            if (error) {
                // If table doesn't exist, don't crash, just log logic error
                if (error.code === '42P01') {
                    console.warn("Table shortbook_items not found");
                } else {
                    toast.error("Failed to load shortbook");
                }
            } else {
                setItems(data as any[] || []);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (currentShop?.id) fetchItems();
    }, [currentShop]);

    const handleAddItem = async () => {
        if (!newName.trim()) return;
        if (!currentShop?.id) return;

        const { error } = await supabase.from('shortbook_items' as any).insert({
            shop_id: currentShop.id,
            medicine_name: newName,
            quantity_needed: newQty || "1 Box",
            priority: isHighPriority ? 'high' : 'normal'
        });

        if (error) {
            toast.error("Failed to add item");
        } else {
            toast.success("Added to Shortbook");
            setNewName("");
            setNewQty("");
            setIsHighPriority(false);
            fetchItems();
        }
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from('shortbook_items' as any).delete().eq('id', id);
        if (error) toast.error("Failed to delete");
        else fetchItems();
    };

    const toggleOrdered = async (item: ShortbookItem) => {
        const { error } = await supabase
            .from('shortbook_items' as any)
            .update({ is_ordered: !item.is_ordered })
            .eq('id', item.id);

        if (error) toast.error("Update failed");
        else fetchItems();
    };

    const handleShareWhatsApp = () => {
        const activeItems = items.filter(i => !i.is_ordered);
        if (activeItems.length === 0) {
            toast.info("No active items to order");
            return;
        }

        let message = `*Order List - ${new Date().toLocaleDateString()}*\n\n`;
        activeItems.forEach((item, idx) => {
            message += `${idx + 1}. ${item.medicine_name} - ${item.quantity_needed} ${item.priority === 'high' ? '(URGENT)' : ''}\n`;
        });

        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const clearOrdered = async () => {
        const { error } = await supabase
            .from('shortbook_items' as any)
            .delete()
            .eq('shop_id', currentShop?.id)
            .eq('is_ordered', true);

        if (error) toast.error("Failed to clear");
        else {
            toast.success("Cleared ordered items");
            fetchItems();
        }
    };

    const handleAutoAddLowStock = async () => {
        if (!currentShop?.id) return;
        toast.loading("Scanning inventory for low stock...");

        // 1. Fetch items with stock < 5 (Threshold)
        const { data: lowStockItems, error } = await supabase
            .from('inventory')
            .select('medicine_name, quantity')
            .eq('shop_id', currentShop.id)
            .lt('quantity', 5)
            .limit(20); // Safety limit

        if (error || !lowStockItems) {
            toast.dismiss();
            toast.error("Failed to scan inventory");
            return;
        }

        if (lowStockItems.length === 0) {
            toast.dismiss();
            toast.info("No low stock items found (< 5 qty)");
            return;
        }

        // 2. Add to Shortbook
        let addedCount = 0;
        for (const item of lowStockItems) {
            // Simple check if already in list
            if (items.some(i => i.medicine_name === item.medicine_name && !i.is_ordered)) continue;

            await supabase.from('shortbook_items' as any).insert({
                shop_id: currentShop.id,
                medicine_name: item.medicine_name,
                quantity_needed: "10 (Auto)", // Default reorder qty
                priority: 'high'
            });
            addedCount++;
        }

        toast.dismiss();
        if (addedCount > 0) {
            toast.success(`Added ${addedCount} low stock items to Shortbook`);
            fetchItems();
        } else {
            toast.info("Low stock items already in list");
        }
    };

    const handlePrintPO = () => {
        const activeItems = items.filter(i => !i.is_ordered);
        if (activeItems.length === 0) return toast.info("No items to print");

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>Purchase Order - ${new Date().toLocaleDateString()}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .header { margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Purchase Order / Shortbook</h1>
                        <p>Date: ${new Date().toLocaleDateString()}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Medicine Name</th>
                                <th>Quantity Needed</th>
                                <th>Priority</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeItems.map((item, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td>${item.medicine_name}</td>
                                    <td>${item.quantity_needed}</td>
                                    <td>${item.priority === 'high' ? 'URGENT' : 'Normal'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <script>window.print();</script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    return (
        <div className={`space-y-6 animate-fade-in ${embedded ? 'p-0' : 'p-2 md:p-0'}`}>
            {!embedded && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
                            <NotebookPen className="w-8 h-8 text-blue-600" /> Shortbook
                        </h1>
                        <p className="text-muted-foreground">Digital reorder notebook. Share with suppliers instantly.</p>
                    </div>
                </div>
            )}

            {embedded && (
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <NotebookPen className="w-5 h-5 text-indigo-600" /> Shortbook & Quick Reorder
                    </h3>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleAutoAddLowStock} className="text-amber-600 border-amber-200 hover:bg-amber-50">
                            <Sparkles className="w-3 h-3 mr-1" /> Auto-Fill
                        </Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleShareWhatsApp}>
                            <Share2 className="w-3 h-3 mr-1" /> Share
                        </Button>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <Card className="border-blue-100 bg-blue-50/30">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-3 items-end">
                        <div className="flex-1 w-full space-y-2">
                            <label className="text-sm font-medium">Medicine Name</label>
                            <Input
                                placeholder="e.g. Dolo 650"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                            />
                        </div>
                        <div className="w-full md:w-32 space-y-2">
                            <label className="text-sm font-medium">Qty</label>
                            <Input
                                placeholder="5 boxes"
                                value={newQty}
                                onChange={e => setNewQty(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                            />
                        </div>
                        <div className="flex items-center pb-3 px-2 gap-2">
                            <input
                                type="checkbox"
                                id="urgent"
                                className="w-4 h-4"
                                checked={isHighPriority}
                                onChange={e => setIsHighPriority(e.target.checked)}
                            />
                            <label htmlFor="urgent" className="text-sm font-medium cursor-pointer text-red-600">Urgent?</label>
                        </div>
                        <Button onClick={handleAddItem} className="w-full md:w-auto">
                            <Plus className="w-4 h-4 mr-1" /> Add
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* List */}
            <div className="grid gap-3">
                <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={clearOrdered} className="text-xs text-muted-foreground hover:text-red-500">
                        <Trash2 className="w-3 h-3 mr-1" /> Clear CompletedItems
                    </Button>
                </div>
                {items.map((item) => (
                    <Card key={item.id} className={`transition-all ${item.is_ordered ? 'opacity-60 bg-slate-50' : 'hover:shadow-md'}`}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button onClick={() => toggleOrdered(item)} className={`p-2 rounded-full transition-colors ${item.is_ordered ? 'text-green-600 bg-green-100' : 'text-slate-300 hover:text-slate-400'}`}>
                                    <CheckCircle2 className="w-6 h-6" />
                                </button>
                                <div>
                                    <h3 className={`font-semibold text-md ${item.is_ordered ? 'line-through text-muted-foreground' : ''}`}>
                                        {item.medicine_name}
                                    </h3>
                                    <div className="flex gap-2 text-sm text-muted-foreground">
                                        <span>Qty: {item.quantity_needed}</span>
                                        {item.priority === 'high' && (
                                            <Badge variant="destructive" className="h-5 text-[10px] px-1">URGENT</Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-muted-foreground hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default function Shortbook({ embedded = false }: { embedded?: boolean }) {
    return (
        <ErrorBoundary>
            <ShortbookContent embedded={embedded} />
        </ErrorBoundary>
    );
}
