import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { Bell, Check, MessageCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface Reminder {
    order_id: string;
    customer_name: string;
    customer_phone?: string;
    medication_name: string;
    refill_due_date: string;
    days_overdue: number;
}

export const RefillReminderList = ({ shopId }: { shopId: string }) => {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (shopId) fetchReminders();
    }, [shopId]);

    const fetchReminders = async () => {
        setLoading(true);
        // Logic: Find orders where refill_due_date is in the past (or next 3 days)
        // and last_refill_reminder is null or old.
        // Since we don't have a direct join with customers easily in this view without complex queries,
        // we'll fetch orders and simple-filter client side or use the customer_name/phone stored in order or via ID.

        // For MVP: Fetch orders with refill_due_date populated
        const today = new Date();
        const threeDaysAhead = new Date();
        threeDaysAhead.setDate(today.getDate() + 3);

        const { data, error } = await supabase
            .from('orders')
            .select(`
                id, 
                customer_name,
                customer_phone, 
                refill_due_date,
                order_items
            `)
            .eq('shop_id', shopId)
            .not('refill_due_date', 'is', null)
            .lte('refill_due_date', threeDaysAhead.toISOString())
            .order('refill_due_date', { ascending: true })
            .limit(20);

        if (data) {
            const mapped: Reminder[] = data.map((o: any) => {
                let items: any[] = [];
                if (Array.isArray(o.order_items)) {
                    items = o.order_items;
                } else if (typeof o.order_items === 'string') {
                    try {
                        items = JSON.parse(o.order_items);
                    } catch (e) {
                        items = [];
                    }
                }

                // Determine main med (first item for now or logic to pick chronic)
                // Assuming first item
                const mainItem = items.length > 0
                    ? (items[0].name || items[0].medicine_name)
                    : "Medicine";

                return {
                    order_id: o.id,
                    customer_name: o.customer_name,
                    customer_phone: o.customer_phone,
                    medication_name: mainItem,
                    refill_due_date: o.refill_due_date,
                    days_overdue: differenceInDays(new Date(), new Date(o.refill_due_date))
                };
            });
            setReminders(mapped);
        }
        setLoading(false);
    };

    const sendReminder = async (r: Reminder) => {
        if (!r.customer_phone) {
            toast.error("No phone number for customer");
            return;
        }

        const text = `Hello ${r.customer_name}, your prescription for ${r.medication_name} is due for refill on ${format(new Date(r.refill_due_date), 'MMM dd')}. Reply YES to order. - Medix Pharmacy`;
        const link = `https://wa.me/91${r.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

        window.open(link, '_blank');

        // Update last_refill_reminder
        await supabase
            .from('orders')
            .update({ last_refill_reminder: new Date().toISOString() })
            .eq('id', r.order_id);

        toast.success("Reminder template opened!");
        // Optimistically remove or mark as sent? 
        // For now, let's just keep it.
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" /> Refill Reminders
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {loading ? <p>Loading...</p> :
                        reminders.length === 0 ? <p className="text-muted-foreground text-sm">No refills due soon.</p> :
                            reminders.map(r => (
                                <div key={r.order_id} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50/50">
                                    <div>
                                        <p className="font-bold text-sm text-slate-800">{r.medication_name}</p>
                                        <p className="text-xs text-slate-500">
                                            Customer: {r.customer_name} • Due: {format(new Date(r.refill_due_date), 'MMM dd')}
                                        </p>
                                    </div>
                                    <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-100" onClick={() => sendReminder(r)}>
                                        <MessageCircle className="w-4 h-4 mr-1" /> Remind
                                    </Button>
                                </div>
                            ))}
                </div>
            </CardContent>
        </Card>
    );
};
