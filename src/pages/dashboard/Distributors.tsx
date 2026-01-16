import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Phone, Mail, Building, Trash2, Edit } from "lucide-react";
import { useUserShops } from "@/hooks/useUserShops";

const Distributors = () => {
    const { currentShop } = useUserShops();
    const [distributors, setDistributors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newDistributor, setNewDistributor] = useState({ name: "", phone: "", email: "", gst_number: "" });

    useEffect(() => {
        if (currentShop?.id) fetchDistributors();
    }, [currentShop]);

    const fetchDistributors = async () => {
        setLoading(true);
        const { data } = await supabase.from('distributors').select('*').eq('shop_id', currentShop?.id).order('name');
        if (data) setDistributors(data);
        setLoading(false);
    };

    const addDistributor = async () => {
        if (!newDistributor.name) return toast.error("Name is required");

        const { error } = await supabase.from('distributors').insert({
            shop_id: currentShop?.id,
            ...newDistributor
        });

        if (error) {
            toast.error("Failed to add distributor");
        } else {
            toast.success("Distributor Added");
            setIsAddOpen(false);
            setNewDistributor({ name: "", phone: "", email: "", gst_number: "" });
            fetchDistributors();
        }
    };

    const deleteDistributor = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        await supabase.from('distributors').delete().eq('id', id);
        toast.success("Deleted");
        fetchDistributors();
    };

    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Building className="w-8 h-8 text-blue-600" /> Distributors
                    </h1>
                    <p className="text-muted-foreground">Manage your suppliers and contact details.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="w-4 h-4 mr-2" /> Add Distributor</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add New Distributor</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2"><Label>Name</Label><Input value={newDistributor.name} onChange={e => setNewDistributor({ ...newDistributor, name: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Phone</Label><Input value={newDistributor.phone} onChange={e => setNewDistributor({ ...newDistributor, phone: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Email</Label><Input value={newDistributor.email} onChange={e => setNewDistributor({ ...newDistributor, email: e.target.value })} /></div>
                            <div className="space-y-2"><Label>GST Number</Label><Input value={newDistributor.gst_number} onChange={e => setNewDistributor({ ...newDistributor, gst_number: e.target.value })} /></div>
                            <Button className="w-full" onClick={addDistributor}>Save Distributor</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>GST</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {distributors.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No distributors found.</TableCell></TableRow>
                            ) : distributors.map(d => (
                                <TableRow key={d.id}>
                                    <TableCell className="font-bold">{d.name}</TableCell>
                                    <TableCell className="flex items-center gap-2"><Phone className="w-3 h-3 text-muted-foreground" /> {d.phone}</TableCell>
                                    <TableCell>{d.email}</TableCell>
                                    <TableCell>{d.gst_number}</TableCell>
                                    <TableCell className="text-right">
                                        <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => deleteDistributor(d.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
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

export default Distributors;
