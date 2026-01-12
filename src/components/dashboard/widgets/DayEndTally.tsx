import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { IndianRupee, CreditCard, Wallet, Smartphone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DayStats {
    total: number;
    cash: number;
    upi: number;
    card: number;
    credit: number;
}

export function DayEndTally() {
    const { currentShop } = useUserShops();
    const [stats, setStats] = useState<DayStats>({ total: 0, cash: 0, upi: 0, card: 0, credit: 0 });
    const [loading, setLoading] = useState(false);

    const fetchDayStats = async () => {
        if (!currentShop?.id) return;
        setLoading(true);

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const start = `${today}T00:00:00`;
        const end = `${today}T23:59:59`;

        const { data, error } = await supabase
            .from('sales')
            .select('payment_mode, total_amount')
            .eq('shop_id', currentShop?.id)
            .gte('created_at', start)
            .gte('created_at', start)
            .lte('created_at', end);

        const safeData = (data || []) as any[];

        if (safeData.length > 0) {
            const newStats = safeData.reduce((acc, curr) => {
                const amount = Number(curr.total_amount) || 0;
                acc.total += amount;
                if (curr.payment_mode === 'cash') acc.cash += amount;
                else if (curr.payment_mode === 'upi') acc.upi += amount;
                else if (curr.payment_mode === 'card') acc.card += amount;
                else if (curr.payment_mode === 'credit') acc.credit += amount;
                return acc;
            }, { total: 0, cash: 0, upi: 0, card: 0, credit: 0 });

            setStats(newStats);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchDayStats();
    }, [currentShop]);

    return (
        <Card className="h-full bg-gradient-to-br from-white to-slate-50 border-blue-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold text-blue-900 flex items-center gap-2">
                    <Wallet className="w-5 h-5" /> Today's Collection
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={fetchDayStats} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </CardHeader>
            <CardContent>
                <div className="mb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Revenue</p>
                    <h3 className="text-3xl font-bold text-blue-600">₹{stats.total.toLocaleString()}</h3>
                </div>

                <div className="mb-4 p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <p className="text-xs text-emerald-800 uppercase tracking-wider font-semibold">Est. Net Profit (18%)</p>
                    <h3 className="text-xl font-bold text-emerald-700">₹{(stats.total * 0.18).toLocaleString()}</h3>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-green-100 text-green-700 rounded-full"><IndianRupee className="w-4 h-4" /></div>
                            <span className="font-medium text-sm">Cash (Drawer)</span>
                        </div>
                        <span className="font-bold text-green-700">₹{stats.cash.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-purple-100 text-purple-700 rounded-full"><Smartphone className="w-4 h-4" /></div>
                            <span className="font-medium text-sm">UPI / Online</span>
                        </div>
                        <span className="font-bold text-purple-700">₹{stats.upi.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-orange-100 text-orange-700 rounded-full"><CreditCard className="w-4 h-4" /></div>
                            <span className="font-medium text-sm">Udhaar / Credit</span>
                        </div>
                        <span className="font-bold text-orange-700">₹{stats.credit.toLocaleString()}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
