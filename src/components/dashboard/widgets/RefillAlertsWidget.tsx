
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, RefreshCw, Calendar, Phone } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";

import { useUserShops } from "@/hooks/useUserShops";

export const RefillAlertsWidget = () => {
    const { currentShop } = useUserShops();
    const [refills, setRefills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRefills = async () => {
        if (!currentShop?.id) return;
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];

        // Fetch orders with refill_due_date coming up (e.g. >= today)
        // For demo, just fetching any with refill_due_date
        const { data, error } = await supabase
            .from('orders')
            .select('id, customer_name, customer_phone, refill_due_date, order_items')
            .eq('shop_id', currentShop.id) // Secure Filter
            .not('refill_due_date', 'is', null)
            .order('refill_due_date', { ascending: true })
            .limit(5);

        if (!error && data) {
            setRefills(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (currentShop?.id) fetchRefills();

        // Subscribe to changes
        const channel = supabase
            .channel('refill-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${currentShop?.id}` }, fetchRefills)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentShop?.id]);

    return (
        <Card className="h-full border-l-4 border-l-blue-400">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Bell className="w-5 h-5 text-blue-500" /> Refill Radar
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={fetchRefills} className="h-6 w-6">
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                <CardDescription className="text-xs">Customers nearing refill dates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {refills.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">No pending refills</div>
                ) : (
                    <div className="space-y-2">
                        {refills.map((order) => (
                            <div key={order.id} className="flex flex-col p-2 bg-muted/30 rounded-lg text-sm border hover:bg-muted/50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <span className="font-semibold">{order.customer_name || 'Unknown'}</span>
                                    <Badge variant={isSameDay(parseISO(order.refill_due_date), new Date()) ? "destructive" : "outline"} className="text-[10px] h-5">
                                        {format(parseISO(order.refill_due_date), 'MMM d')}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <Phone className="w-3 h-3" />
                                    <span>{order.customer_phone || 'N/A'}</span>
                                </div>
                                {/* Naive extraction of first medicine name if array */}
                                <div className="mt-1 text-xs font-medium text-blue-600 truncate">
                                    {Array.isArray(order.order_items) && order.order_items.length > 0
                                        ? (order.order_items[0].name || 'Medicine') + (order.order_items.length > 1 ? ` +${order.order_items.length - 1} more` : '')
                                        : 'Medicines'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
