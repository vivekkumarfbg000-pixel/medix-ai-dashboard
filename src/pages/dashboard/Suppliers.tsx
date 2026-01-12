import { useState, useEffect } from "react";
import { useUserShops } from "@/hooks/useUserShops";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Search, Truck, Phone, Mail, MapPin, Edit, Trash2 } from "lucide-react";

interface Supplier {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    gstin?: string;
    address?: string;
    credit_period_days?: number;
}

import { PurchaseEntry } from "@/components/dashboard/PurchaseEntryModal";

const Suppliers = () => {
    const { currentShop } = useUserShops();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Supplier>>({});

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

        if (error) {
            console.error(error);
            toast.error("Failed to load suppliers");
        } else {
            setSuppliers(data || []);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!formData.name) {
            toast.error("Supplier Name is required");
            return;
        }

        const payload = {
            ...formData,
            shop_id: currentShop?.id,
            credit_period_days: formData.credit_period_days || 30
        };

        let error;
        if (isEditing && formData.id) {
            const { error: updateError } = await supabase
                .from("suppliers")
                .update(payload)
                .eq("id", formData.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from("suppliers")
                .insert(payload);
            error = insertError;
        }

        if (error) {
            console.error(error);
            toast.error("Failed to save supplier");
        } else {
            toast.success(isEditing ? "Supplier updated" : "Supplier added");
            setIsDialogOpen(false);
            setFormData({});
            fetchSuppliers();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will delete the supplier.")) return;

        const { error } = await supabase.from("suppliers").delete().eq("id", id);
        if (error) {
            toast.error("Failed to delete supplier");
        } else {
            toast.success("Supplier deleted");
            fetchSuppliers();
        }
    };

    const openEdit = (supplier: Supplier) => {
        setFormData(supplier);
        setIsEditing(true);
        setIsDialogOpen(true);
    };

    const openAdd = () => {
        setFormData({});
        setIsEditing(false);
        setIsDialogOpen(true);
    };

    const filtered = suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.phone?.includes(search)
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Supplier Management 🚚</h1>
                    <p className="text-muted-foreground">Manage distributors and wholesalers</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsPurchaseOpen(true)}>
                        <Package className="w-4 h-4 mr-2" /> Purchase Entry (Inward)
                    </Button>
                    <Button onClick={openAdd}>
                        <Plus className="w-4 h-4 mr-2" /> Add Supplier
                    </Button>
                </div>
            </div>

            <div className="flex gap-4">
                <Card className="flex-1">
                    <CardHeader className="py-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search suppliers..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Phone / Contact</TableHead>
                                    <TableHead>GSTIN</TableHead>
                                    <TableHead>Credit Days</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No suppliers found.</TableCell></TableRow>
                                ) : (
                                    filtered.map(s => (
                                        <TableRow key={s.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                        <Truck className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div>{s.name}</div>
                                                        <div className="text-xs text-muted-foreground">{s.address}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{s.phone}</div>
                                                <div className="text-xs text-muted-foreground">{s.contact_person}</div>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">{s.gstin || "-"}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                    {s.credit_period_days} Days
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                                                    <Edit className="w-4 h-4 text-muted-foreground" />
                                                </Button>
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
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Supplier Name *</Label>
                                <Input value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Contact Person</Label>
                                <Input value={formData.contact_person || ""} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input value={formData.phone || ""} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input value={formData.email || ""} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>GSTIN</Label>
                                <Input value={formData.gstin || ""} onChange={e => setFormData({ ...formData, gstin: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Credit Period (Days)</Label>
                                <Input type="number" value={formData.credit_period_days || 30} onChange={e => setFormData({ ...formData, credit_period_days: parseInt(e.target.value) })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Address</Label>
                            <Input value={formData.address || ""} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                        </div>
                        <Button className="w-full" onClick={handleSave}>Save Supplier</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <PurchaseEntry
                open={isPurchaseOpen}
                onOpenChange={setIsPurchaseOpen}
                onSuccess={() => {
                    // Optional: refresh something if needed, or just show toast
                }}
            />
        </div>
    );
};

export default Suppliers;
