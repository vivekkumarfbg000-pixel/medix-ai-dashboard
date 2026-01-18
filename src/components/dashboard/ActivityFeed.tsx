
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Plus, Trash2, Edit, ShoppingCart, Package, Users, Settings } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserShops } from "@/hooks/useUserShops";

interface AuditLog {
    id: string;
    table_name: string;
    action: "INSERT" | "UPDATE" | "DELETE";
    old_value: any;
    new_value: any;
    created_at: string;
    user_id?: string;
}

interface ActivityItem {
    id: string;
    icon: any;
    description: string;
    time: string;
    user: string;
    type: "create" | "update" | "delete" | "unknown";
}

export const ActivityFeed = () => {
    const { currentShop } = useUserShops();
    const [activities, setActivities] = useState<ActivityItem[]>([]);

    useEffect(() => {
        const fetchRecentActivity = async () => {
            if (!currentShop?.id) return;
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('shop_id', currentShop.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                const mappedActivities: ActivityItem[] = data.map((log: any) => {
                    let description = "System Action";
                    let icon = Activity;
                    let type: ActivityItem["type"] = "unknown";

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

                    // Determine Description based on Table & Data
                    if (log.table_name === "orders") {
                        const amount = log.new_value?.total_amount || log.old_value?.total_amount;
                        const customer = log.new_value?.customer_name || log.old_value?.customer_name || "Guest";
                        description = `${log.action === 'INSERT' ? 'New Order' : 'Order Updated'}: ${customer} (₹${amount})`;
                        if (log.action === 'DELETE') description = `Order Cancelled: ${customer}`;
                        icon = ShoppingCart;
                    } else if (log.table_name === "inventory") {
                        const item = log.new_value?.name || log.old_value?.name || "Item";
                        const stock = log.new_value?.stock || 0;
                        if (log.action === 'UPDATE') {
                            const oldStock = log.old_value?.stock || 0;
                            const diff = stock - oldStock;
                            description = `Stock ${diff > 0 ? 'Added' : 'Adjusted'}: ${item} (${diff > 0 ? '+' : ''}${diff})`;
                        } else if (log.action === 'INSERT') {
                            description = `New Product Added: ${item}`;
                        } else {
                            description = `Product Removed: ${item}`;
                        }
                        icon = Package;
                    } else if (log.table_name === "customers") {
                        const name = log.new_value?.name || log.old_value?.name || "Customer";
                        description = `Customer Record: ${name}`;
                        icon = Users;
                    } else if (log.table_name === "shops") {
                        description = "Shop Settings Updated";
                        icon = Settings;
                    }

                    return {
                        id: log.id,
                        icon,
                        description,
                        time: log.created_at,
                        user: "System", // Ideally fetch user name if user_id exists
                        type
                    };
                });
                setActivities(mappedActivities);
            }
        };

        if (currentShop?.id) {
            fetchRecentActivity();
        }

        // Real-time listener
        const channel = supabase
            .channel('audit-feed')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs', filter: `shop_id=eq.${currentShop?.id}` }, (payload) => {
                fetchRecentActivity(); // Simply re-fetch for simplicity/accuracy
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentShop?.id]);

    const getIconColor = (type: string) => {
        switch (type) {
            case "create": return "text-green-500 bg-green-100 dark:bg-green-900/20";
            case "delete": return "text-red-500 bg-red-100 dark:bg-red-900/20";
            case "update": return "text-blue-500 bg-blue-100 dark:bg-blue-900/20";
            default: return "text-gray-500 bg-gray-100 dark:bg-gray-800";
        }
    };

    return (
        <Card className="glass-card h-full">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="w-5 h-5 text-primary" />
                    Recent Activity
                </CardTitle>
                <CardDescription>Real-time audit log of shop operations</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[300px] w-full pr-4">
                    <div className="space-y-4">
                        {activities.map((log) => {
                            const IconComponent = log.icon;
                            return (
                                <div key={log.id} className="flex gap-3 items-start pb-3 border-b border-border/50 last:border-0">
                                    <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getIconColor(log.type)}`}>
                                        <IconComponent className="w-4 h-4" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-foreground leading-none">{log.description}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{format(new Date(log.time), "MMM dd, HH:mm")}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {activities.length === 0 && (
                            <p className="text-center text-muted-foreground text-sm py-4">No recent activity found.</p>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
