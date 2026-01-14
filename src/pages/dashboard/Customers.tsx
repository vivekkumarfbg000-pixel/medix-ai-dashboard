import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Plus, User, MessageCircle, Wallet, History, ArrowUpRight, ArrowDownLeft, Users, Store } from "lucide-react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUserShops } from "@/hooks/useUserShops";

interface Customer {
    id: string;
    name: string;
    phone: string;
    email?: string;
    credit_balance: number;
    total_spent: number;
    credit_limit?: number;
    is_blocked?: boolean;
}

const Customers = () => {
    const { currentShop } = useUserShops();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [transaction, setTransaction] = useState({ type: 'CREDIT', amount: '', description: '' });
    const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });

    const fetchCustomers = async () => {
        setLoading(true);
        // @ts-ignore - Table exists in database
        const { data, error } = await supabase
            .from("customers")
            .select("*")
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

    // Fetch Ledger History when a customer is selected
    useEffect(() => {
        if (selectedCustomer) fetchLedger(selectedCustomer.id);
    }, [selectedCustomer]);

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
            // Refresh UI
            fetchLedger(selectedCustomer.id);
            fetchCustomers(); // Update main list balance
            // Update local selected state to reflect new balance immediately
            setSelectedCustomer({ ...selectedCustomer, credit_balance: newBalance });
        }
    };

    const handleAddCustomer = async () => {
        if (!newCustomer.name || !newCustomer.phone) {
            toast.error("Name and Phone are required");
            return;
        }

        const { data: profile } = await supabase.from('profiles').select('shop_id').single();

        // @ts-ignore - Table exists in database
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

    if (!currentShop) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center p-8 text-center animate-fade-in">
                <Store className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h2 className="text-xl font-semibold">No Shop Selected</h2>
                <p className="text-muted-foreground">Please select a shop from the dashboard to view Smart Khata.</p>
            </div>
        );
    }

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

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Top Debtor</CardTitle>
                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        {customers.length > 0 ? (
                            <>
                                <div className="text-2xl font-bold truncate">
                                    {customers.sort((a, b) => b.credit_balance - a.credit_balance)[0]?.name || "None"}
                                </div>
                                <p className="text-xs text-red-600 font-medium">
                                    Owes ₹{customers.sort((a, b) => b.credit_balance - a.credit_balance)[0]?.credit_balance?.toLocaleString() || 0}
                                </p>
                            </>
                        ) : (
                            <div className="text-2xl font-bold">--</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
                        <Users className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{customers.length}</div>
                        <p className="text-xs text-muted-foreground">Total registered customers</p>
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
                                <TableRow key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedCustomer(c)}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><User className="w-4 h-4" /></div>
                                        {c.name}
                                    </TableCell>
                                    <TableCell>{c.phone}</TableCell>
                                    <TableCell className="font-bold text-red-600">
                                        {c.credit_balance > 0 ? `₹${c.credit_balance}` : <span className="text-green-600">₹0</span>}
                                    </TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => setSelectedCustomer(c)}>
                                            <History className="w-4 h-4 mr-1" /> View Ledger
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* LEDGER SHEET (Slide-over) */}
            <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                    {selectedCustomer && (<>
                        <div className="space-y-6">
                            <SheetHeader>
                                <SheetTitle className="flex items-center gap-2 text-xl">
                                    <User className="w-5 h-5 text-primary" /> {selectedCustomer.name}
                                </SheetTitle>
                                <SheetDescription>
                                    Phone: {selectedCustomer.phone}
                                </SheetDescription>
                            </SheetHeader>

                            {/* Balance Card */}
                            <div className={`p-6 rounded-xl border ${selectedCustomer.credit_balance > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                <div className="text-sm font-medium text-muted-foreground mb-1">Current Balance Due</div>
                                <div className={`text-3xl font-bold ${selectedCustomer.credit_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    ₹{selectedCustomer.credit_balance}
                                </div>
                                {selectedCustomer.credit_balance > 0 && (
                                    <Button size="sm" variant="outline" className="mt-4 w-full border-red-200 text-red-700 hover:bg-red-100" onClick={() => sendPaymentReminder(selectedCustomer)}>
                                        <MessageCircle className="w-4 h-4 mr-2" /> Send WhatsApp Reminder
                                    </Button>
                                )}
                            </div>

                            {/* Add Transaction */}
                            <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                                <h3 className="font-bold text-sm">Add New Transaction</h3>
                                <Tabs value={transaction.type} onValueChange={(v) => setTransaction({ ...transaction, type: v })}>
                                    <TabsList className="w-full">
                                        <TabsTrigger value="CREDIT" className="flex-1 text-red-600 data-[state=active]:bg-red-100">Give Credit (Udhaar)</TabsTrigger>
                                        <TabsTrigger value="PAYMENT" className="flex-1 text-green-600 data-[state=active]:bg-green-100">Receive Payment</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        placeholder="Amount (₹)"
                                        value={transaction.amount}
                                        onChange={(e) => setTransaction({ ...transaction, amount: e.target.value })}
                                    />
                                    <Input
                                        placeholder="Description (e.g. Paracetamol)"
                                        value={transaction.description}
                                        onChange={(e) => setTransaction({ ...transaction, description: e.target.value })}
                                    />
                                </div>
                                <Button className="w-full" onClick={handleAddTransaction}>
                                    {transaction.type === 'CREDIT' ? 'Add to Due' : 'Accept Payment'}
                                </Button>
                            </div>

                            {/* History */}
                            <div>
                                <h3 className="font-bold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Transaction History</h3>
                                <div className="space-y-3">
                                    {ledgerLoading ? <p className="text-center text-sm text-muted-foreground">Loading history...</p> :
                                        ledgerEntries.length === 0 ? <p className="text-center text-sm text-muted-foreground py-4 border rounded-lg border-dashed">No transactions found.</p> :
                                            ledgerEntries.map(entry => (
                                                <div key={entry.id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-full ${entry.transaction_type === 'CREDIT' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                            {entry.transaction_type === 'CREDIT' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-sm">{entry.description || (entry.transaction_type === 'CREDIT' ? 'Credit' : 'Payment')}</div>
                                                            <div className="text-xs text-muted-foreground">{format(new Date(entry.created_at), "dd MMM, hh:mm a")}</div>
                                                        </div>
                                                    </div>
                                                    <div className={`font-bold ${entry.transaction_type === 'CREDIT' ? 'text-red-600' : 'text-green-600'}`}>
                                                        {entry.transaction_type === 'CREDIT' ? '+' : '-'}₹{entry.amount}
                                                    </div>
                                                </div>
                                            ))
                                    }
                                </div>
                            </div>
                        </div>
                        {/* Settings Tab */}
                        <div className="pt-4 border-t">
                            <h3 className="font-bold text-sm mb-3">Account Settings</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Credit Limit (₹)</Label>
                                        <p className="text-xs text-muted-foreground">Max allowed balance</p>
                                    </div>
                                    <Input
                                        type="number"
                                        className="w-32"
                                        value={selectedCustomer.credit_limit || ''}
                                        onChange={async (e) => {
                                            const val = parseFloat(e.target.value);
                                            const newLimit = isNaN(val) ? null : val;
                                            // Optimistic Update
                                            setSelectedCustomer({ ...selectedCustomer, credit_limit: newLimit });
                                            // Real Update
                                            await supabase.from('customers').update({ credit_limit: newLimit }).eq('id', selectedCustomer.id);
                                        }}
                                        placeholder="No Limit"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                                    <div className="space-y-0.5">
                                        <Label className="text-base text-red-600">Block Customer</Label>
                                        <p className="text-xs text-muted-foreground">Prevent new credit sales</p>
                                    </div>
                                    <Button
                                        variant={selectedCustomer.is_blocked ? "destructive" : "outline"}
                                        size="sm"
                                        onClick={async () => {
                                            const newVal = !selectedCustomer.is_blocked;
                                            setSelectedCustomer({ ...selectedCustomer, is_blocked: newVal });
                                            await supabase.from('customers').update({ is_blocked: newVal }).eq('id', selectedCustomer.id);
                                            if (newVal) toast.warning("Customer Blocked!");
                                            else toast.success("Customer Unblocked");
                                        }}
                                    >
                                        {selectedCustomer.is_blocked ? "Blocked 🚫" : "Active ✅"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>)}
                </SheetContent>
            </Sheet>
        </div >
    );
}

export default Customers;
