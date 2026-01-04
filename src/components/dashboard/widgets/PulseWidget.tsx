import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertOctagon, Lightbulb, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { format, subDays, startOfDay, isSameDay, parseISO } from "date-fns";

export const PulseWidget = () => {
    const { currentShop } = useUserShops();
    const [data, setData] = useState<any[]>([]);
    const [totalRevenueToday, setTotalRevenueToday] = useState(0);
    const [trend, setTrend] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentShop?.id) return;
        fetchSalesPulse();
    }, [currentShop]);

    const fetchSalesPulse = async () => {
        setLoading(true);
        const today = new Date();
        const sevenDaysAgo = subDays(today, 6); // Last 7 days including today

        // Fetch sales
        const { data: sales } = await supabase
            .from('sales')
            .select('total_amount, sale_date')
            .eq('shop_id', currentShop?.id)
            .gte('sale_date', startOfDay(sevenDaysAgo).toISOString());

        if (sales) {
            // Process data for Chart (Last 7 Days)
            const chartData = [];
            let todayRev = 0;
            let yesterdayRev = 0;

            for (let i = 6; i >= 0; i--) {
                const date = subDays(today, i);
                const dateStr = format(date, 'yyyy-MM-dd');

                // Sum sales for this day
                const daySales = sales
                    .filter(s => isSameDay(parseISO(s.sale_date), date))
                    .reduce((sum, s) => sum + Number(s.total_amount), 0);

                chartData.push({
                    name: format(date, 'EEE'), // Mon, Tue
                    revenue: daySales
                });

                if (i === 0) todayRev = daySales; // Today
                if (i === 1) yesterdayRev = daySales; // Yesterday
            }

            setData(chartData);
            setTotalRevenueToday(todayRev);

            // Calculate Trend
            if (yesterdayRev > 0) {
                const change = ((todayRev - yesterdayRev) / yesterdayRev) * 100;
                setTrend(Math.round(change));
            } else if (todayRev > 0) {
                setTrend(100);
            } else {
                setTrend(0);
            }
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Revenue Graph */}
            <Card className="glass-card flex-1 min-h-[250px]">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-500" /> Revenue Pulse
                        </CardTitle>
                        <div className="flex flex-col items-end">
                            <Badge variant="outline" className={`${trend >= 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"} border-opacity-50`}>
                                {trend >= 0 ? "+" : ""}{trend}% vs Yesterday
                            </Badge>
                            <span className="text-xs text-muted-foreground mt-1">Today: ₹{totalRevenueToday.toLocaleString()}</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Stock Health & AI Insight */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stock Health */}
                <Card className="glass-card bg-red-50/50 border-red-100 dark:bg-slate-800 dark:border-red-900/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                            <AlertOctagon className="w-4 h-4" /> Critical Stock
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold text-red-600 dark:text-red-400">0</span>
                            <span className="text-xs text-red-600/80 dark:text-red-300/80 mb-1 font-medium">Items near zero</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                            <PackageX className="w-3 h-3" /> Auto-reorder suggested
                        </div>
                    </CardContent>
                </Card>

                {/* AI Insight */}
                <Card className="glass-card bg-blue-50/50 border-blue-100 dark:bg-slate-800 dark:border-blue-900/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Lightbulb className="w-12 h-12 text-blue-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-blue-700 dark:text-[#0ea5e9] flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" /> AI Pro Tip
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm font-medium text-foreground leading-snug">
                            "Revenue trending {trend >= 0 ? 'up' : 'down'}. Check <span className="underline decoration-wavy decoration-[#0ea5e9]">Analytics</span> for detailed insights."
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
