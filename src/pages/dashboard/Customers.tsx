import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Plus, User, MessageCircle, Wallet, History, ArrowUpRight, ArrowDownLeft, Users, Store, Clock, Tablet } from "lucide-react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUserShops } from "@/hooks/useUserShops";
import { useNavigate } from "react-router-dom";
import { PatientProfileSheet } from "@/components/dashboard/crm/PatientProfileSheet";
import { RefillReminderList } from "@/components/dashboard/crm/RefillReminderList";

interface Customer {
    id: string;
    name: string;
    phone: string;
    email?: string;
    credit_balance: number;
    total_spent: number;
    credit_limit?: number;
    is_blocked?: boolean;
    tags?: string[];
    notes?: string;
}

const Customers = () => {
    const { currentShop } = useUserShops();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const navigate = useNavigate();

    // CRM State
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || null;

    // Ledger State
    const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [transaction, setTransaction] = useState({ type: 'CREDIT', amount: '', description: '' });
    const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });

    const fetchCustomers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("customers")
            .select("*")
            .eq('shop_id', currentShop?.id)
            .order("name");

        if (error) {
            console.warn(error);
        } else {
            setCustomers((data || []) as Customer[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (currentShop?.id) fetchCustomers();
    }, [currentShop]);

    // Fetch Ledger History when a customer is selected for Khata view
    // (Note: PatientSheet fetches its own purchase history, this ledger is for credit)
    useEffect(() => {
        if (selectedCustomerId) fetchLedger(selectedCustomerId);
    }, [selectedCustomerId]);

    const fetchLedger = async (customerId: string) => {
        setLedgerLoading(true);
        const { data } = await supabase
            .from('ledger_entries')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });
        if (data) setLedgerEntries(data);
        setLedgerLoading(false);
    };

    const handleAddTransaction = async () => {
        if (!selectedCustomer || !transaction.amount) return;
        const amount = parseFloat(transaction.amount);
        if (isNaN(amount) || amount <= 0) return toast.error("Invalid amount");

        const newBalance = transaction.type === 'CREDIT'
            ? (selectedCustomer.credit_balance || 0) + amount
            : (selectedCustomer.credit_balance || 0) - amount;

        // 1. Add Entry
        const { error: entryError } = await supabase.from('ledger_entries').insert({
            shop_id: currentShop?.id,
            customer_id: selectedCustomer.id,
            amount: amount,
            transaction_type: transaction.type,
            description: transaction.description || (transaction.type === 'CREDIT' ? 'Credit Given' : 'Payment Received')
        });

        if (entryError) return toast.error("Failed to log transaction");

        // 2. Update Customer Balance
        const { error: updateError } = await supabase
            .from('customers')
            .update({ credit_balance: newBalance })
            .eq('id', selectedCustomer.id);

        if (updateError) {
            toast.error("Failed to update balance");
        } else {
            toast.success("Transaction Record Saved");
            setTransaction({ type: 'CREDIT', amount: '', description: '' });
            fetchLedger(selectedCustomer.id);
            fetchCustomers();
        }
    };

    const handleAddCustomer = async () => {
        if (!newCustomer.name || !newCustomer.phone) {
            toast.error("Name and Phone are required");
            return;
        }

        const { error } = await supabase.from("customers").insert({
            shop_id: currentShop?.id,
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

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone && c.phone.includes(search))
    );

    if (!currentShop) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center p-8 text-center animate-fade-in">
                <Store className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h2 className="text-xl font-semibold">No Shop Selected</h2>
                <p className="text-muted-foreground">Please select a shop from the dashboard to view Customers.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Users className="w-8 h-8 text-blue-600" /> Patient Relationship
                    </h1>
                    <p className="text-muted-foreground">Manage patients, reminders, and credit limits.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="w-4 h-4 mr-2" /> Add Patient</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add New Patient</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2"><Label>Name</Label><Input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Phone</Label><Input value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="98XXXXXXXX" /></div>
                            <div className="space-y-2"><Label>Email</Label><Input value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} /></div>
                            <Button className="w-full" onClick={handleAddCustomer}>Save</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="all" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="all">All Patients</TabsTrigger>
                    <TabsTrigger value="refills" className="hidden md:inline-flex">Refill Due</TabsTrigger>
                    <TabsTrigger value="khata">Smart Khata (Credit)</TabsTrigger>
                </TabsList>

                {/* ALL PATIENTS TAB */}
                <TabsContent value="all" className="space-y-4">
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
                                        <TableHead>Patient</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Balance</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No patients found</TableCell></TableRow>
                                    ) : filtered.map(c => (
                                        <TableRow key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedCustomerId(c.id)}>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><User className="w-4 h-4" /></div>
                                                <div>
                                                    <div>{c.name}</div>
                                                    {c.tags && c.tags.length > 0 && (
                                                        <div className="flex gap-1 mt-1">
                                                            {c.tags.map(t => <span key={t} className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded">{t}</span>)}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{c.phone}</TableCell>
                                            <TableCell className={c.credit_balance > 0 ? "text-red-600 font-bold" : "text-green-600"}>
                                                ₹{c.credit_balance}
                                            </TableCell>
                                            <TableCell className="text-right flex justify-end gap-2">
                                                <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate("/dashboard/sales/pos", { state: { customer: c } });
                                                }}>
                                                    <Tablet className="w-4 h-4 mr-1" /> Bill
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedCustomerId(c.id); }}>
                                                    View Profile
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* REFILLS TAB */}
                <TabsContent value="refills" className="space-y-4">
                    <RefillReminderList shopId={currentShop.id} />
                </TabsContent>

                {/* KHATA TAB */}
                <TabsContent value="khata" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Total Receivables</CardTitle>
                                <Wallet className="w-4 h-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                    ₹{customers.reduce((acc, c) => acc + (c.credit_balance || 0), 0).toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground">Across {customers.filter(c => c.credit_balance > 0).length} customers</p>
                            </CardContent>
                        </Card>
                        {/* More Khata Stats can go here */}
                    </div>

                    <Card>
                        <CardHeader><CardTitle>Credit Accounts</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {/* Reusing table for now, filtered by balance > 0 */}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Balance Due</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customers.filter(c => c.credit_balance > 0).map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell>{c.name}</TableCell>
                                            <TableCell className="font-bold text-red-600">₹{c.credit_balance}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="outline" onClick={() => setSelectedCustomerId(c.id)}>Settle</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {customers.filter(c => c.credit_balance > 0).length === 0 && (
                                        <TableRow><TableCell colSpan={3} className="text-center py-4 text-green-600">No pending dues! 🎉</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* SHARED PATIENT PROFILE & KHATA SHEET */}
            <PatientProfileSheet
                customer={selectedCustomer}
                open={!!selectedCustomerId}
                onOpenChange={(open) => !open && setSelectedCustomerId(null)}
                onUpdate={fetchCustomers}
            />
        </div>
    );
};

export default Customers;
