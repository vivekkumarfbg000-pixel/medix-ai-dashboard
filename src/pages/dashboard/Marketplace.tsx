import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ShoppingCart, Truck, Package, Filter, Plus, Phone, Mail, MapPin, Edit, Trash2, ArrowLeftRight, FileText } from "lucide-react";
import { toast } from "sonner";
import { useUserShops } from "@/hooks/useUserShops";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseEntry } from "@/components/dashboard/PurchaseEntryModal";
import { PurchaseReturnModal } from "@/components/dashboard/PurchaseReturnModal";

// --- Marketplace Types ---
interface CatalogItem {
    id: number;
    drug_name: string;
    brand: string;
    price: number;
    min_order_qty: number;
    in_stock: boolean;
    distributor: {
        name: string;
    };
}

interface CartItem extends CatalogItem {
    orderQty: number;
}

// --- Supplier Types ---
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

// Sample data since B2B tables don't exist yet
const sampleItems: CatalogItem[] = [
    { id: 1, drug_name: "Paracetamol 500mg", brand: "Crocin", price: 25, min_order_qty: 100, in_stock: true, distributor: { name: "Apollo Distributors" } },
    { id: 2, drug_name: "Azithromycin 500mg", brand: "Azee", price: 120, min_order_qty: 50, in_stock: true, distributor: { name: "MedPlus Wholesale" } },
    { id: 3, drug_name: "Omeprazole 20mg", brand: "Omez", price: 85, min_order_qty: 100, in_stock: true, distributor: { name: "Apollo Distributors" } },
    { id: 4, drug_name: "Metformin 500mg", brand: "Glycomet", price: 45, min_order_qty: 200, in_stock: true, distributor: { name: "Pharma Direct" } },
];

const Marketplace = () => {
    const { currentShop } = useUserShops();
    // Marketplace State
    const [items] = useState<CatalogItem[]>(sampleItems);
    const [loadingMarket, setLoadingMarket] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orders] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("browse");

    // Suppliers State
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [supplierSearch, setSupplierSearch] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
    const [isReturnOpen, setIsReturnOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Supplier>>({});

    // Debit Notes State
    const [debitNotes, setDebitNotes] = useState<any[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);

    useEffect(() => {
        if (currentShop?.id) {
            fetchSuppliers();
            fetchDebitNotes();
        }
    }, [currentShop]);

    // --- Supplier Functions ---
    const fetchSuppliers = async () => {
        setLoadingSuppliers(true);
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
        setLoadingSuppliers(false);
    };

    const fetchDebitNotes = async () => {
        setLoadingNotes(true);
        // @ts-ignore - Table exists
        const { data, error } = await supabase
            .from("purchase_returns")
            .select("*, suppliers(name)")
            .eq("shop_id", currentShop?.id)
            .order("created_at", { ascending: false });

        if (data) setDebitNotes(data);
        setLoadingNotes(false);
    };

    const handleSaveSupplier = async () => {
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

    const handleDeleteSupplier = async (id: string) => {
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

    // --- Marketplace Functions ---
    const addToCart = (item: CatalogItem) => {
        const existing = cart.find(c => c.id === item.id);
        if (existing) {
            setCart(cart.map(c => c.id === item.id ? { ...c, orderQty: c.orderQty + item.min_order_qty } : c));
            toast.success(`Updated Quantity for ${item.brand}`);
        } else {
            setCart([...cart, { ...item, orderQty: item.min_order_qty }]);
            toast.success(`Added ${item.brand} to B2B Cart`);
        }
    };

    const placeOrder = async () => {
        if (!currentShop?.id) {
            toast.error("Shop ID missing. Please refresh.");
            return;
        }

        setLoadingMarket(true);
        try {
            toast.info("B2B ordering coming soon! Tables not yet configured.");
            setCart([]);
        } catch (e: any) {
            toast.error("Failed to place order: " + e.message);
        } finally {
            setLoadingMarket(false);
        }
    };

    const filteredItems = items.filter(i =>
        i.drug_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.brand.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
        s.phone?.includes(supplierSearch)
    );

    return (
        <div className="space-y-6 animate-fade-in p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        Marketplace & Procurement
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage distributors, purchases, and restock instantly.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setIsReturnOpen(true)}>
                        <ArrowLeftRight className="w-4 h-4 mr-2" /> Purchase Return
                    </Button>
                    <Button variant="outline" onClick={() => setIsPurchaseOpen(true)}>
                        <Package className="w-4 h-4 mr-2" /> Purchase Entry
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 lg:w-[800px]">
                    <TabsTrigger value="browse">Global Marketplace</TabsTrigger>
                    <TabsTrigger value="suppliers">My Suppliers</TabsTrigger>
                    <TabsTrigger value="debit_notes">Returns / Credits</TabsTrigger>
                    <TabsTrigger value="orders">B2B Orders</TabsTrigger>
                </TabsList>

                {/* --- MARKETPLACE TAB --- */}
                <TabsContent value="browse" className="space-y-6">
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search medicines, brands, or distributors..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredItems.map(item => (
                            <Card key={item.id} className="hover:shadow-lg transition-all border-primary/10">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="bg-primary/5">{item.distributor.name}</Badge>
                                        <Badge variant={item.in_stock ? "default" : "destructive"} className="text-[10px] h-5">
                                            {item.in_stock ? "In Stock" : "Out of Stock"}
                                        </Badge>
                                    </div>
                                    <CardTitle className="mt-2 text-xl">{item.brand}</CardTitle>
                                    <CardDescription>{item.drug_name}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between items-end mb-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Wholesale Price</p>
                                            <p className="text-lg font-bold">₹{item.price.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">/ unit</span></p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">Min Qty</p>
                                            <p className="font-medium">{item.min_order_qty} Units</p>
                                        </div>
                                    </div>
                                    <Button className="w-full" onClick={() => addToCart(item)}>
                                        <ShoppingCart className="w-4 h-4 mr-2" /> Add to Order
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* --- SUPPLIERS TAB --- */}
                <TabsContent value="suppliers" className="space-y-4">
                    <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search suppliers..."
                                value={supplierSearch}
                                onChange={e => setSupplierSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Button onClick={openAdd}>
                            <Plus className="w-4 h-4 mr-2" /> Add Supplier
                        </Button>
                    </div>

                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle>Active Distributor Network</CardTitle>
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
                                    {loadingSuppliers ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                                    ) : filteredSuppliers.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No suppliers found.</TableCell></TableRow>
                                    ) : (
                                        filteredSuppliers.map(s => (
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
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteSupplier(s.id)}>
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
                </TabsContent>

                {/* --- RETURNS / DEBIT NOTES TAB --- */}
                <TabsContent value="debit_notes" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Debit Note History</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Supplier</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead>Total Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingNotes ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                                    ) : debitNotes.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No returns found.</TableCell></TableRow>
                                    ) : (
                                        debitNotes.map((note: any) => (
                                            <TableRow key={note.id}>
                                                <TableCell>{format(new Date(note.return_date), "dd MMM yyyy")}</TableCell>
                                                <TableCell className="font-medium">{note.suppliers?.name || "Unknown"}</TableCell>
                                                <TableCell>{note.reason}</TableCell>
                                                <TableCell className="font-bold text-red-600">₹{note.total_amount}</TableCell>
                                                <TableCell>
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
                                                        {note.status}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- ORDERS TAB --- */}
                <TabsContent value="orders">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent B2B Orders</CardTitle>
                            <CardDescription>Track your procurement status.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {orders.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No past orders found.</p>
                                    <Button variant="link" onClick={() => setActiveTab("browse")}>Start Browsing</Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {orders.map((order) => (
                                        <div key={order.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50">
                                            <div>
                                                <p className="font-bold">{order.distributor_name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* --- CART OVERLAY --- */}
            {cart.length > 0 && (
                <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
                    <Card className="w-80 shadow-2xl border-primary">
                        <CardHeader className="bg-primary text-primary-foreground py-3">
                            <CardTitle className="text-sm font-medium flex justify-between items-center text-white">
                                <span>Bulk Cart ({cart.length})</span>
                                <span>₹{cart.reduce((a, c) => a + (c.price * c.orderQty), 0).toFixed(2)}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="max-h-60 overflow-y-auto pt-4 text-sm space-y-2">
                            {cart.map((c, i) => (
                                <div key={i} className="flex justify-between">
                                    <span>{c.brand} (x{c.orderQty})</span>
                                    <span>₹{c.price * c.orderQty}</span>
                                </div>
                            ))}
                        </CardContent>
                        <CardFooter className="pt-2 pb-3">
                            <Button className="w-full" onClick={placeOrder} disabled={loadingMarket}>Confirm Order</Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

            {/* --- ADD/EDIT SUPPLIER DIALOG --- */}
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
                        <Button className="w-full" onClick={handleSaveSupplier}>Save Supplier</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <PurchaseEntry
                open={isPurchaseOpen}
                onOpenChange={setIsPurchaseOpen}
                onSuccess={() => { }}
            />

            <PurchaseReturnModal
                open={isReturnOpen}
                onOpenChange={setIsReturnOpen}
                onSuccess={() => {
                    fetchDebitNotes();
                }}
            />
        </div>
    );
};

export default Marketplace;
