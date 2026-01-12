import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { toast } from "sonner";
import { NotebookPen, Plus, Trash2, Share2, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ShortbookItem {
    id: string;
    medicine_name: string;
    quantity_needed: string;
    priority: 'normal' | 'high';
    is_ordered: boolean;
    created_at: string;
}

const Shortbook = () => {
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
        const { data, error } = await supabase
            .from('shortbook_items')
            .select('*')
            .eq('shop_id', currentShop.id)
            .order('created_at', { ascending: false });

        if (error) {
            toast.error("Failed to load shortbook");
        } else {
            setItems(data as any[] || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchItems();
    }, [currentShop]);

    const handleAddItem = async () => {
        if (!newName.trim()) return;

        const { error } = await supabase.from('shortbook_items').insert({
            shop_id: currentShop?.id,
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
        const { error } = await supabase.from('shortbook_items').delete().eq('id', id);
        if (error) toast.error("Failed to delete");
        else fetchItems();
    };

    const toggleOrdered = async (item: ShortbookItem) => {
        const { error } = await supabase
            .from('shortbook_items')
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
            .from('shortbook_items')
            .delete()
            .eq('shop_id', currentShop?.id)
            .eq('is_ordered', true);

        if (error) toast.error("Failed to clear");
        else {
            toast.success("Cleared ordered items");
            fetchItems();
        }
    };

    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
                        <NotebookPen className="w-8 h-8 text-blue-600" /> Shortbook
                    </h1>
                    <p className="text-muted-foreground">Digital reorder notebook. Share with suppliers instantly.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={clearOrdered}>
                        Clean Ordered
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleShareWhatsApp}>
                        <Share2 className="w-4 h-4 mr-2" /> Share Order
                    </Button>
                </div>
            </div>

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
                            <Plus className="w-4 h-4 mr-1" /> Add Note
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* List */}
            <div className="grid gap-3">
                {items.map((item) => (
                    <Card key={item.id} className={`transition-all ${item.is_ordered ? 'opacity-60 bg-slate-50' : 'hover:shadow-md'}`}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button onClick={() => toggleOrdered(item)} className={`p-2 rounded-full transition-colors ${item.is_ordered ? 'text-green-600 bg-green-100' : 'text-slate-300 hover:text-slate-400'}`}>
                                    <CheckCircle2 className="w-6 h-6" />
                                </button>
                                <div>
                                    <h3 className={`font-semibold text-lg ${item.is_ordered ? 'line-through text-muted-foreground' : ''}`}>
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
                {items.length === 0 && !loading && (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <NotebookPen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Your shortbook is empty</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Shortbook;
