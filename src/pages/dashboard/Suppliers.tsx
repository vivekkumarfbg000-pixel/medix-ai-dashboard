import { useState, useEffect } from "react";
import { useUserShops } from "@/hooks/useUserShops";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Truck, Phone, Trash2, Pencil } from "lucide-react";

export default function Suppliers() {
    const { currentShop } = useUserShops();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        contact_person: "",
        phone: "",
        gstin: "",
        credit_period_days: 30
    });

    useEffect(() => {
        if (currentShop?.id) fetchSuppliers();
    }, [currentShop]);

    const fetchSuppliers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("suppliers")
            .select("*")
            .eq("shop_id", currentShop?.id)
            .order("name");

        if (error) toast.error("Failed to load suppliers");
        else setSuppliers(data || []);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!formData.name) {
            toast.error("Supplier Name is required");
            return;
        }

        const { error } = await supabase.from("suppliers").insert({
            shop_id: currentShop?.id,
            ...formData
        });

        if (error) {
            toast.error(error.message);
        } else {
            toast.success("Supplier Added!");
            setIsDialogOpen(false);
            setFormData({ name: "", contact_person: "", phone: "", gstin: "", credit_period_days: 30 });
            fetchSuppliers();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will delete the supplier and unlink their history.")) return;
        const { error } = await supabase.from("suppliers").delete().eq("id", id);
        if (error) toast.error(error.message);
        else {
            toast.success("Supplier deleted");
            fetchSuppliers();
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.gstin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.includes(searchTerm)
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Truck className="w-8 h-8 text-blue-600" /> Supplier Directory
                    </h1>
                    <p className="text-muted-foreground">Manage your wholesalers and distributors.</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} size="lg" className="shadow-lg bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> Add Supplier
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>All Suppliers ({suppliers.length})</CardTitle>
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search name, phone, GST..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>GSTIN</TableHead>
                                <TableHead>Credit Days</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                                </TableRow>
                            ) : filteredSuppliers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No suppliers found.</TableCell>
                                </TableRow>
                            ) : (
                                filteredSuppliers.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-medium">
                                            {s.name}
                                            {s.contact_person && <div className="text-xs text-muted-foreground">{s.contact_person}</div>}
                                        </TableCell>
                                        <TableCell>
                                            {s.phone ? (
                                                <a href={`tel:${s.phone}`} className="flex items-center gap-1 hover:text-blue-600">
                                                    <Phone className="w-3 h-3" /> {s.phone}
                                                </a>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell>{s.gstin || '-'}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                {s.credit_period_days} Days
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Supplier</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Supplier Name *</Label>
                            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Mahaveer Pharma" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Contact Person</Label>
                                <Input value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Phone</Label>
                                <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>GSTIN</Label>
                                <Input value={formData.gstin} onChange={e => setFormData({ ...formData, gstin: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Credit Period (Days)</Label>
                                <Input type="number" value={formData.credit_period_days} onChange={e => setFormData({ ...formData, credit_period_days: parseInt(e.target.value) || 0 })} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Supplier</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
