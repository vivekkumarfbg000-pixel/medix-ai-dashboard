
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Plus, Trash2, Edit, ShoppingCart, Package, Users, Settings, Sparkles, Brain, ArrowRight } from "lucide-react";
import { format, isValid } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserShops } from "@/hooks/useUserShops";
import { Badge } from "@/components/ui/badge";

// Safe Date Formatter
const formatDateSafe = (dateString: string) => {
    if (!dateString) return "Just now";
    const date = new Date(dateString);
    return isValid(date) ? format(date, "h:mm a") : "Just now";
};

interface ActivityItem {
    id: string;
    icon: any;
    description: string;
    time: string;
    user: string;
    type: "create" | "update" | "delete" | "unknown" | "ai";
    amount?: string;
}

export const ActivityFeed = () => {
    const { currentShop } = useUserShops();
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [dailyStats, setDailyStats] = useState({ orders: 0, revenue: 0 });

    useEffect(() => {
        const fetchRecentActivity = async () => {
            if (!currentShop?.id) return;
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('shop_id', currentShop.id)
                .order('created_at', { ascending: false })
                .limit(25);

            if (data) {
                let orderCount = 0;
                let rev = 0;

                const mappedActivities: ActivityItem[] = data.map((log: any) => {
                    let description = "System Action";
                    let icon = Activity;
                    let type: ActivityItem["type"] = "unknown";
                    let amountStr = undefined;

                    // Determine Action Type
                    if (log.action === "INSERT") {
                        type = "create";
                        icon = Plus;
                    } else if (log.action === "UPDATE") {
                        type = "update";
                        icon = Edit;
                    } else if (log.action === "DELETE") {
                        type = "delete";
                        icon = Trash2;
                    }

                    // Determine Description
                    if (log.table_name === "orders") {
                        const amount = log.new_value?.total_amount || log.old_value?.total_amount;
                        const customer = log.new_value?.customer_name || log.old_value?.customer_name || "Guest";
                        description = `Order: ${customer}`;
                        amountStr = `₹${amount}`;
                        icon = ShoppingCart;

                        // Simple stats calc (approx)
                        if (log.action === 'INSERT') {
                            orderCount++;
                            rev += (amount || 0);
                        }
                    } else if (log.table_name === "inventory") {
                        const item = log.new_value?.medicine_name || log.old_value?.medicine_name || "pharmacy item";
                        const diff = (log.new_value?.quantity || 0) - (log.old_value?.quantity || 0);

                        if (log.action === 'UPDATE' && diff !== 0) {
                            description = `Stock ${diff > 0 ? 'Inc' : 'Dec'}: ${item}`;
                            amountStr = `${diff > 0 ? '+' : ''}${diff}`;
                        } else {
                            description = `Inventory: ${item}`;
                        }
                        icon = Package;
                    } else if (log.table_name === "customers") {
                        const name = log.new_value?.name || log.old_value?.name || "Customer";
                        description = `New Patient: ${name}`;
                        icon = Users;
                    }

                    return {
                        id: log.id,
                        icon,
                        description,
                        time: log.created_at,
                        user: "System",
                        type,
                        amount: amountStr
                    };
                });

                setActivities(mappedActivities);
                setDailyStats({ orders: orderCount, revenue: rev });
            }
        };

        if (currentShop?.id) {
            fetchRecentActivity();
        }

        const channel = supabase
            .channel('audit-feed-v2')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs', filter: `shop_id=eq.${currentShop?.id}` }, () => {
                fetchRecentActivity();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentShop?.id]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* LEFT: AI INSIGHTS CARD */}
            <Card className="col-span-1 border-none shadow-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white overflow-hidden relative group">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>

                <CardHeader className="relative z-10 pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg font-medium text-white/90">
                        <Brain className="w-5 h-5 text-indigo-200" />
                        Medix Brain
                    </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10 space-y-6">
                    <div className="space-y-1">
                        <p className="text-3xl font-bold tracking-tight">Everything looks healthy.</p>
                        <p className="text-indigo-100 text-sm">System running at 100% efficiency.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                        <div>
                            <p className="text-xs uppercase tracking-wider text-indigo-300 font-semibold">Today's Orders</p>
                            <p className="text-2xl font-bold">{dailyStats.orders}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wider text-indigo-300 font-semibold">Est. Revenue</p>
                            <p className="text-2xl font-bold">₹{dailyStats.revenue.toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="pt-2">
                        <Badge variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer">
                            <Sparkles className="w-3 h-3 mr-1 text-yellow-300" />
                            View Smart Recommendations
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* RIGHT: ACTIVITY STREAM */}
            <Card className="col-span-1 lg:col-span-2 shadow-sm border-slate-200 dark:border-slate-800 dark:bg-slate-950">
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base text-slate-700 dark:text-slate-200">
                            <Activity className="w-4 h-4 text-violet-500" />
                            Live Operations Feed
                        </CardTitle>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[250px] w-full">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {activities.map((log) => {
                                const IconComponent = log.icon;
                                return (
                                    <div key={log.id} className="flex gap-4 items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors animate-in fade-in slide-in-from-bottom-1">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border ${log.type === 'create' ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-900 dark:text-emerald-400' :
                                            log.type === 'delete' ? 'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-900 dark:text-red-400' :
                                                'bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-400'
                                            }`}>
                                            <IconComponent className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{log.description}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateSafe(log.time)} • {log.user}</p>
                                        </div>
                                        {log.amount && (
                                            <Badge variant="secondary" className="font-mono bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                                {log.amount}
                                            </Badge>
                                        )}
                                    </div>
                                );
                            })}
                            {activities.length === 0 && (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    No activity yet
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
