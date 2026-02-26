import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { IndianRupee, CreditCard, Wallet, Smartphone, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DayStats {
    total: number;
    cash: number;
    upi: number;
    card: number;
    credit: number;
    profit: number;
    orderCount: number;
}

export function DayEndTally() {
    const { currentShop } = useUserShops();
    const [stats, setStats] = useState<DayStats>({ total: 0, cash: 0, upi: 0, card: 0, credit: 0, profit: 0, orderCount: 0 });
    const [loading, setLoading] = useState(false);

    const fetchDayStats = async () => {
        if (!currentShop?.id) return;
        setLoading(true);

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const start = `${today}T00:00:00`;
        const end = `${today}T23:59:59`;

        try {
            // Fetch orders with their items for real profit calculation
            const { data, error } = await supabase
                .from('orders')
                .select('payment_mode, total_amount, order_items')
                .eq('shop_id', currentShop?.id)
                .gte('created_at', start)
                .lte('created_at', end);

            if (error) throw error;

            const safeData = (data || []) as any[];

            if (safeData.length > 0) {
                const newStats = safeData.reduce((acc, curr) => {
                    const amount = Number(curr.total_amount) || 0;
                    acc.total += amount;
                    acc.orderCount += 1;

                    // Payment mode mapping: LitePOS uses 'online', DayEndTally shows 'UPI/Online'
                    const mode = curr.payment_mode;
                    if (mode === 'cash') acc.cash += amount;
                    else if (mode === 'online' || mode === 'upi') acc.upi += amount;
                    else if (mode === 'card') acc.card += amount;
                    else if (mode === 'credit') acc.credit += amount;

                    // Calculate real profit from order_items JSONB (contains purchase_price)
                    const items = curr.order_items;
                    if (Array.isArray(items)) {
                        items.forEach((item: any) => {
                            const qty = Number(item.qty || item.quantity || 0);
                            const sellPrice = Number(item.price || item.unit_price || 0);
                            const costPrice = Number(item.purchase_price || item.cost_price || 0);
                            acc.profit += (sellPrice - costPrice) * qty;
                        });
                    }

                    return acc;
                }, { total: 0, cash: 0, upi: 0, card: 0, credit: 0, profit: 0, orderCount: 0 });

                setStats(newStats);
            } else {
                setStats({ total: 0, cash: 0, upi: 0, card: 0, credit: 0, profit: 0, orderCount: 0 });
            }
        } catch (err) {
            console.error("DayEndTally Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDayStats();
    }, [currentShop]);

    const profitMargin = stats.total > 0 ? ((stats.profit / stats.total) * 100).toFixed(1) : '0';

    return (
        <Card className="h-full bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-blue-100 dark:border-blue-900/30 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                    <Wallet className="w-5 h-5" /> Today's Collection
                </CardTitle>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{stats.orderCount} orders</span>
                    <Button variant="ghost" size="icon" onClick={fetchDayStats} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="mb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Revenue</p>
                    <h3 className="text-3xl font-bold text-blue-600 dark:text-blue-400">₹{stats.total.toLocaleString()}</h3>
                </div>

                <div className="mb-4 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wider font-semibold flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> Net Profit
                            </p>
                            <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">₹{Math.round(stats.profit).toLocaleString()}</h3>
                        </div>
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded">
                            {profitMargin}%
                        </span>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full"><IndianRupee className="w-4 h-4" /></div>
                            <span className="font-medium text-sm">Cash (Drawer)</span>
                        </div>
                        <span className="font-bold text-green-700 dark:text-green-400">₹{stats.cash.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full"><Smartphone className="w-4 h-4" /></div>
                            <span className="font-medium text-sm">UPI / Online</span>
                        </div>
                        <span className="font-bold text-purple-700 dark:text-purple-400">₹{stats.upi.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full"><CreditCard className="w-4 h-4" /></div>
                            <span className="font-medium text-sm">Udhaar / Credit</span>
                        </div>
                        <span className="font-bold text-orange-700 dark:text-orange-400">₹{stats.credit.toLocaleString()}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
