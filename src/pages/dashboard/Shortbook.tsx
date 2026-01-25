import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Send, ShoppingCart, Loader2 } from "lucide-react";
import { useUserShops } from "@/hooks/useUserShops";
import { safeFormat } from "@/utils/dateHelpers";

const Shortbook = () => {
    const { currentShop } = useUserShops();
    const [items, setItems] = useState<any[]>([]);
    const [distributors, setDistributors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [newItem, setNewItem] = useState({ product_name: "", quantity: 1, priority: "medium", distributor_id: "any" });
    const [isAddOpen, setIsAddOpen] = useState(false);

    useEffect(() => {
        if (currentShop?.id) {
            fetchShortbook();
            fetchDistributors();
        }
    }, [currentShop]);

    const fetchShortbook = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('shortbook')
            .select('*, distributors(name)')
            .eq('shop_id', currentShop?.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (data) setItems(data);
        setLoading(false);
    };

    const fetchDistributors = async () => {
        const { data } = await supabase
            .from('distributors')
            .select('*')
            .eq('shop_id', currentShop?.id);
        if (data) setDistributors(data);
    };

    const addItem = async () => {
        if (!newItem.product_name) return toast.error("Product name is required");

        const payload: any = {
            shop_id: currentShop?.id,
            product_name: newItem.product_name,
            quantity: newItem.quantity,
            priority: newItem.priority,
            added_from: 'manual'
        };

        if (newItem.distributor_id !== "any") {
            payload.distributor_id = newItem.distributor_id;
        }

        const { error } = await supabase.from('shortbook').insert(payload);
        if (error) {
            toast.error("Failed to add item");
        } else {
            toast.success("Added to Shortbook");
            setIsAddOpen(false);
            setNewItem({ product_name: "", quantity: 1, priority: "medium", distributor_id: "any" });
            fetchShortbook();
        }
    };

    const markOrdered = async (id: string) => {
        await supabase.from('shortbook').update({ status: 'ordered' }).eq('id', id);
        toast.success("Marked as ordered");
        fetchShortbook();
    };

    const sendToDistributor = (distributorId: string, distributorName: string, phone: string | null) => {
        const orderItems = items.filter(i => i.distributor_id === distributorId || (!i.distributor_id && distributorName === "General"));
        if (orderItems.length === 0) return toast.info("No items for this distributor");

        const text = `*Order for ${currentShop?.name || 'Pharmacy'}*%0A%0A` +
            orderItems.map(i => `- ${i.product_name} x${i.quantity}`).join('%0A') +
            `%0A%0APlease confirm delivery.`;

        if (phone) {
            const cleanPhone = phone.replace(/\D/g, '');
            const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
            window.open(`https://wa.me/${finalPhone}?text=${text}`, '_blank');
        } else {
            // Fallback for general list sharing
            if (navigator.share) {
                navigator.share({ title: 'Pharmacy Order', text: text.replace(/%0A/g, '\n') });
            } else {
                navigator.clipboard.writeText(text.replace(/%0A/g, '\n'));
                toast.success("Order copied to clipboard!");
            }
        }
    };

    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <ShoppingCart className="w-8 h-8 text-purple-600" /> Shortbook
                    </h1>
                    <p className="text-muted-foreground">Track out-of-stock items and send orders to distributors.</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Add to Shortbook</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2"><Label>Product Name</Label><Input value={newItem.product_name} onChange={e => setNewItem({ ...newItem, product_name: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Quantity</Label><Input type="number" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })} /></div>
                                <div className="space-y-2">
                                    <Label>Preferred Distributor</Label>
                                    <Select value={newItem.distributor_id} onValueChange={v => setNewItem({ ...newItem, distributor_id: v })}>
                                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="any">Any Distributor</SelectItem>
                                            {distributors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Priority</Label>
                                    <Select value={newItem.priority} onValueChange={v => setNewItem({ ...newItem, priority: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="urgent">Urgent 🚨</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button className="w-full" onClick={addItem}>Add to List</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Distributor Quick Actions */}
                {loading ? <Loader2 className="animate-spin" /> :
                    distributors.map(d => {
                        const count = items.filter(i => i.distributor_id === d.id).length;
                        if (count === 0) return null;
                        return (
                            <Card key={d.id} className="bg-purple-50 border-purple-100">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-purple-900">{d.name}</div>
                                        <div className="text-xs text-purple-600">{count} items pending</div>
                                    </div>
                                    <Button size="sm" variant="outline" className="border-green-400 text-green-700 bg-white hover:bg-green-50" onClick={() => sendToDistributor(d.id, d.name, d.phone)}>
                                        <Send className="w-4 h-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })
                }
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Distributor</TableHead>
                                <TableHead>Added</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Shortbook is empty.</TableCell></TableRow>
                            ) : items.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.product_name}</TableCell>
                                    <TableCell>{item.quantity}</TableCell>
                                    <TableCell>
                                        <Badge variant={item.priority === 'urgent' ? 'destructive' : 'secondary'}>
                                            {item.priority}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{item.distributors?.name || 'Any'}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{safeFormat(item.created_at, 'dd MMM')}</TableCell>
                                    <TableCell className="text-right flex justify-end gap-2">
                                        <Button size="sm" variant="outline" className="text-green-600" onClick={() => markOrdered(item.id)}>Ordered</Button>
                                        <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-600" onClick={async () => {
                                            await supabase.from('shortbook').delete().eq('id', item.id);
                                            fetchShortbook();
                                        }}><Trash2 className="w-4 h-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default Shortbook;
