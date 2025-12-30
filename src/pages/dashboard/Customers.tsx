import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Plus, User, MessageCircle, Wallet } from "lucide-react";

interface Customer {
    id: string;
    name: string;
    phone: string;
    email?: string;
    credit_balance: number;
    total_spent: number;
}

const Customers = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });

    const fetchCustomers = async () => {
        setLoading(true);
        // @ts-ignore
        const { data, error } = await supabase
            .from("customers")
            .select("*")
            .order("name");

        if (error) {
            console.warn(error);
        } else {
            // @ts-ignore
            setCustomers(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const handleAddCustomer = async () => {
        if (!newCustomer.name || !newCustomer.phone) {
            toast.error("Name and Phone are required");
            return;
        }

        const { data: profile } = await supabase.from('profiles').select('shop_id').single();

        // @ts-ignore
        const { error } = await supabase.from("customers").insert({
            shop_id: profile?.shop_id,
            name: newCustomer.name,
            phone: newCustomer.phone,
            email: newCustomer.email,
            credit_balance: 0
        });

        if (error) {
            toast.error("Failed to add customer");
            console.error(error);
        } else {
            toast.success("Customer added!");
            setIsAddOpen(false);
            setNewCustomer({ name: "", phone: "", email: "" });
            fetchCustomers();
        }
    };

    const sendPaymentReminder = (customer: Customer) => {
        if (!customer.phone) return;
        if (customer.credit_balance <= 0) {
            toast.info("No balance due!");
            return;
        }

        const text = `🙏 *Namaste ${customer.name} ji*%0A%0A` +
            `Your pending balance at *Medix Pharmacy* is *₹${customer.credit_balance}*.%0A` +
            `Please pay at your earliest convenience.%0A%0A` +
            `Thank you!`;

        const cleanPhone = customer.phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        window.open(`https://wa.me/${finalPhone}?text=${text}`, '_blank');
    };

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone && c.phone.includes(search))
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Smart Khata 📒</h1>
                    <p className="text-muted-foreground">Manage customers and credit reminders</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="w-4 h-4 mr-2" /> Add Customer</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add New Customer</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2"><Label>Name</Label><Input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Phone</Label><Input value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="98XXXXXXXX" /></div>
                            <div className="space-y-2"><Label>Email</Label><Input value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} /></div>
                            <Button className="w-full" onClick={handleAddCustomer}>Save</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Receivables</CardTitle>
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ₹{customers.reduce((acc, c) => acc + (c.credit_balance || 0), 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">Across {customers.filter(c => c.credit_balance > 0).length} customers</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border max-w-sm">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                    className="border-0 focus-visible:ring-0"
                    placeholder="Search by name or phone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Credit Due</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow>
                            ) : filtered.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><User className="w-4 h-4" /></div>
                                        {c.name}
                                    </TableCell>
                                    <TableCell>{c.phone}</TableCell>
                                    <TableCell className="font-bold text-red-600">
                                        {c.credit_balance > 0 ? `₹${c.credit_balance}` : <span className="text-green-600">₹0</span>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {c.credit_balance > 0 && (
                                            <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => sendPaymentReminder(c)}>
                                                <MessageCircle className="w-4 h-4 mr-1" /> Remind
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

export default Customers;
