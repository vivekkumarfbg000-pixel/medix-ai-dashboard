import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Loader2, Users, ShoppingBag, CreditCard } from "lucide-react";

interface SalesAnalyticsProps {
    shopId: string;
}

export const SalesAnalytics = ({ shopId }: SalesAnalyticsProps) => {
    const [loading, setLoading] = useState(true);
    const [topItems, setTopItems] = useState<any[]>([]);
    const [topCustomers, setTopCustomers] = useState<any[]>([]);
    const [paymentStats, setPaymentStats] = useState<any[]>([]);

    useEffect(() => {
        if (shopId) fetchAnalytics();
    }, [shopId]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // Fetch last 30 days orders for detailed breakdown
            const startDate = subDays(new Date(), 30).toISOString();

            const { data: orders, error } = await supabase
                .from('orders')
                .select('*')
                .eq('shop_id', shopId)
                .gte('created_at', startDate)
                .eq('status', 'completed');

            if (error) throw error;

            if (!orders) return;

            // 1. Process Top Items
            const itemMap = new Map<string, { name: string, qty: number, revenue: number }>();

            // 2. Process Top Customers
            const customerMap = new Map<string, { name: string, visits: number, spend: number }>();

            // 3. Process Payment Modes
            const paymentMap = new Map<string, number>();

            orders.forEach(order => {
                // Payment Mode
                const mode = order.payment_mode || 'Cash';
                // Normalize legacy modes
                const cleanMode = mode.toLowerCase().includes('upi') ? 'UPI' :
                    mode.toLowerCase().includes('card') ? 'Card' :
                        'Cash';
                paymentMap.set(cleanMode, (paymentMap.get(cleanMode) || 0) + (order.total_amount || 0));

                // Customers
                const custName = order.customer_name || 'Walk-in';
                if (custName !== 'Walk-in') {
                    const existing = customerMap.get(custName) || { name: custName, visits: 0, spend: 0 };
                    existing.visits += 1;
                    existing.spend += (order.total_amount || 0);
                    customerMap.set(custName, existing);
                }

                // Items
                // Items
                let items: any[] = [];
                if (Array.isArray(order.order_items)) {
                    items = order.order_items;
                } else if (typeof order.order_items === 'string') {
                    try {
                        items = JSON.parse(order.order_items);
                    } catch (e) {
                        items = [];
                    }
                }

                items.forEach((item: any) => {
                    const name = item.name || item.medicine_name || 'Unknown';
                    const qty = parseInt(item.qty || item.quantity || 0);
                    const price = parseFloat(item.price || item.unit_price || 0);

                    const existing = itemMap.get(name) || { name, qty: 0, revenue: 0 };
                    existing.qty += qty;
                    existing.revenue += (qty * price);
                    itemMap.set(name, existing);
                });
            });

            // Convert and Sort
            const sortedItems = Array.from(itemMap.values())
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 5); // Start with top 5

            const sortedCustomers = Array.from(customerMap.values())
                .sort((a, b) => b.spend - a.spend)
                .slice(0, 5);

            const paymentData = Array.from(paymentMap.entries()).map(([name, value]) => ({ name, value }));

            setTopItems(sortedItems);
            setTopCustomers(sortedCustomers);
            setPaymentStats(paymentData);

        } catch (e) {
            console.error("Analytics Error:", e);
        } finally {
            setLoading(false);
        }
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

    if (loading) {
        return <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Selling Products */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5 text-blue-500" /> Top Products (30 Days)
                        </CardTitle>
                        <CardDescription>Most popular items by quantity sold</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={topItems} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Units Sold" barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Payment Mode Split */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-purple-500" /> Revenue Source
                        </CardTitle>
                        <CardDescription>Total sales breakdown by payment method</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={paymentStats}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {paymentStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Loyal Customers */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-green-600" /> Top Loyal Customers
                    </CardTitle>
                    <CardDescription>Highest spending regular customers</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {topCustomers.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No customer data available yet.</p>
                        ) : (
                            topCustomers.map((cust, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-100 text-green-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{cust.name}</p>
                                            <p className="text-xs text-slate-500">{cust.visits} Visits</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-green-700">₹{cust.spend.toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">Total Spend</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
