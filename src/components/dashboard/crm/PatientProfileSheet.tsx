import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { User, Phone, ShoppingBag, Tag, Plus, X, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface Customer {
    id: string;
    name: string;
    phone: string;
    credit_balance: number;
    total_spent: number;
    tags?: string[];
    notes?: string;
}

interface Props {
    customer: Customer | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate?: () => void;
}

export const PatientProfileSheet = ({ customer, open, onOpenChange, onUpdate }: Props) => {
    const [activeTab, setActiveTab] = useState("history");
    const [orders, setOrders] = useState<any[]>([]);
    const [notes, setNotes] = useState("");
    const [newTag, setNewTag] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (customer && open) {
            fetchDetails();
            setNotes(customer.notes || "");
            setTags(customer.tags || []);
        }
    }, [customer, open]);

    const fetchDetails = async () => {
        if (!customer) return;
        setLoading(true);
        // Fetch Orders
        const { data: orderData } = await supabase
            .from('orders')
            .select('*')
            .eq('customer_name', customer.name) // Linking by Name for now as explicit ID might vary in simplified schema
            .order('created_at', { ascending: false })
            .limit(20);

        if (orderData) setOrders(orderData);
        setLoading(false);
    };

    const saveCRM = async () => {
        if (!customer) return;
        const { error } = await supabase
            .from('customers')
            .update({ notes, tags })
            .eq('id', customer.id);

        if (error) toast.error("Failed to save changes");
        else {
            toast.success("Profile Updated");
            if (onUpdate) onUpdate();
        }
    };

    const addTag = () => {
        if (newTag && !tags.includes(newTag)) {
            setTags([...tags, newTag]);
            setNewTag("");
        }
    };

    const removeTag = (tag: string) => {
        setTags(tags.filter(t => t !== tag));
    };

    const sendWhatsApp = () => {
        if (!customer?.phone) return;
        const cleanPhone = customer.phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        window.open(`https://wa.me/${finalPhone}`, '_blank');
    };

    if (!customer) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[600px] flex flex-col h-full">
                <SheetHeader className="pb-4 border-b">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">
                                {customer.name.charAt(0)}
                            </div>
                            <div>
                                <SheetTitle className="text-xl">{customer.name}</SheetTitle>
                                <SheetDescription className="flex items-center gap-2">
                                    <Phone className="w-3 h-3" /> {customer.phone}
                                </SheetDescription>
                            </div>
                        </div>
                        <Button size="icon" variant="outline" className="rounded-full text-green-600 border-green-200 hover:bg-green-50" onClick={sendWhatsApp}>
                            <MessageCircle className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                        {tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="gap-1">
                                {tag} <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => removeTag(tag)} />
                            </Badge>
                        ))}
                        <div className="flex items-center gap-1">
                            <Input
                                className="h-6 w-20 text-xs"
                                placeholder="+ Tag"
                                value={newTag}
                                onChange={e => setNewTag(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addTag()}
                            />
                        </div>
                    </div>
                </SheetHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col mt-4">
                    <TabsList className="w-full">
                        <TabsTrigger value="history" className="flex-1">Puchase History</TabsTrigger>
                        <TabsTrigger value="reports" className="flex-1">Lab Reports</TabsTrigger>
                        <TabsTrigger value="notes" className="flex-1">Clinical Notes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="history" className="flex-1 overflow-hidden relative">
                        <ScrollArea className="h-full pr-4">
                            {loading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> :
                                orders.length === 0 ? <p className="text-center py-10 text-muted-foreground">No orders found.</p> : (
                                    <div className="space-y-4 pt-2">
                                        {orders.map(order => (
                                            <div key={order.id} className="border rounded-lg p-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                                                <div className="flex justify-between mb-2">
                                                    <span className="font-bold text-sm">₹{order.total_amount}</span>
                                                    <span className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd MMM yyyy')}</span>
                                                </div>
                                                <div className="text-xs text-slate-600 space-y-1">
                                                    {Array.isArray(order.order_items) && order.order_items.slice(0, 3).map((item: any, i: number) => (
                                                        <div key={i} className="flex justify-between">
                                                            <span>{item.name || item.medicine_name}</span>
                                                            <span className="text-slate-400">x{item.qty}</span>
                                                        </div>
                                                    ))}
                                                    {Array.isArray(order.order_items) && order.order_items.length > 3 && (
                                                        <div className="text-slate-400 italic">+ {order.order_items.length - 3} more</div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="reports" className="flex-1 overflow-hidden relative">
                        <LabReportsList customerId={customer.id} />
                    </TabsContent>

                    <TabsContent value="notes" className="flex-1 flex flex-col">
                        <div className="flex-1 p-1">
                            <Textarea
                                className="h-full resize-none bg-yellow-50 border-yellow-200 text-slate-700"
                                placeholder="Add clinical notes, patient preferences, or known allergies..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>
                        <div className="pt-4">
                            <Button className="w-full" onClick={saveCRM}>Save Notes & Tags</Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
};

const LabReportsList = ({ customerId }: { customerId: string }) => {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true);
            // @ts-ignore
            const { data } = await supabase
                .from('lab_reports' as any)
                .select('*')
                .eq('patient_id', customerId)
                .order('created_at', { ascending: false });

            if (data) setReports(data);
            setLoading(false);
        };
        fetchReports();
    }, [customerId]);

    if (loading) return <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">Loading reports...</div>;

    if (reports.length === 0) return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
            <ShoppingBag className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm">No lab reports found.</p>
            <p className="text-xs">Upload in Lab Analyzer and save to patient.</p>
        </div>
    );

    return (
        <ScrollArea className="h-full pr-4">
            <div className="space-y-3 pt-2">
                {reports.map(report => (
                    <div key={report.id} className="border border-blue-100 bg-blue-50/30 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="font-semibold text-sm text-blue-900">Lab Analysis</h4>
                                <span className="text-[10px] text-blue-600/80">{format(new Date(report.created_at), 'PP p')}</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] border-blue-200 bg-white">AI Analyzed</Badge>
                        </div>

                        {report.summary_json?.recommendations?.diet && (
                            <div className="text-xs text-slate-600 mb-2">
                                <span className="font-semibold text-slate-800">Diet:</span> {report.summary_json.recommendations.diet.slice(0, 2).join(", ")}...
                            </div>
                        )}

                        <div className="flex gap-2 mt-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs w-full bg-white hover:bg-blue-50" onClick={() => {
                                // Ideally open a detailed view
                                // For now, simple toast
                                toast.info("Opening Report functionality coming soon");
                            }}>
                                View Full Report
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
};
