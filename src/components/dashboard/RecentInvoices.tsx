import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Printer, Search, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function RecentInvoices({ shopId }: { shopId?: string }) {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);

    const fetchOrders = async () => {
        if (!shopId) return;
        setLoading(true);
        try {
            let query = supabase
                .from('orders')
                .select('*')
                .eq('shop_id', shopId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (search) {
                query = query.ilike('customer_name', `%${search}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setOrders(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchOrders();
    }, [isOpen, search]);

    const handlePrint = (order: any) => {
        // In a real scenario, this would generate a PDF or open a print window
        // For now, we simulate with a window open or console log
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head><title>Invoice ${order.invoice_number}</title></head>
                    <body style="font-family: monospace; padding: 20px;">
                        <h1>INVOICE: ${order.invoice_number}</h1>
                        <p>Date: ${new Date(order.created_at).toLocaleString()}</p>
                        <p>Customer: ${order.customer_name}</p>
                        <hr/>
                        <h3>Items</h3>
                        <ul>
                            ${Array.isArray(order.order_items)
                    ? order.order_items.map((i: any) => `<li>${i.name} x ${i.qty} = ${i.price * i.qty}</li>`).join('')
                    : '<li>Items not available</li>'}
                        </ul>
                        <hr/>
                        <h2>Total: ₹${order.total_amount}</h2>
                        <p>Status: ${order.payment_status}</p>
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 hover:text-white">
                    <History className="w-4 h-4 mr-1" />
                    History
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full bg-slate-50 dark:bg-slate-900">
                <SheetHeader>
                    <SheetTitle>Recent Invoices</SheetTitle>
                    <SheetDescription>View and manage recent transactions.</SheetDescription>
                </SheetHeader>

                <div className="py-4">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by customer..."
                            className="pl-8 bg-white"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1 -mx-6 px-6">
                    {loading ? (
                        <div className="text-center py-10 text-muted-foreground">Loading...</div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">No invoices found.</div>
                    ) : (
                        <div className="space-y-3 pb-8">
                            {orders.map((order) => (
                                <div key={order.id} className="bg-white dark:bg-slate-800 p-4 rounded-lg border shadow-sm flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                                {order.customer_name}
                                                <Badge variant={order.payment_status === 'paid' ? 'default' : 'destructive'} className="text-[10px] h-5">
                                                    {order.payment_status}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')} • {order.invoice_number}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-emerald-600">₹{order.total_amount}</div>
                                            <div className="text-xs text-slate-500 capitalize">{order.payment_mode}</div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
                                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handlePrint(order)}>
                                            <Printer className="w-3 h-3 mr-1" /> Reprint
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-8 text-xs">
                                            <FileText className="w-3 h-3 mr-1" /> Details
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
