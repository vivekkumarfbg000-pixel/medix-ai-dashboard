import { useState, useEffect } from "react";
import { useUserShops } from "@/hooks/useUserShops";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDays, format, startOfMonth, endOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download, TrendingUp, TrendingDown, IndianRupee, FileText } from "lucide-react";

const Reports = () => {
    const { currentShop } = useUserShops();
    const [dateRange, setDateRange] = useState({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });

    const [salesData, setSalesData] = useState<any[]>([]);
    const [purchaseData, setPurchaseData] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [summary, setSummary] = useState({
        totalSales: 0,
        totalPurchases: 0,
        netCashFlow: 0,
        gstCollected: 0, // Estimated
        gstPaid: 0 // Estimated
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (currentShop?.id && dateRange.from && dateRange.to) {
            fetchData();
        }
    }, [currentShop, dateRange]);

    const fetchData = async () => {
        setLoading(true);
        const from = dateRange.from.toISOString();
        const to = addDays(dateRange.to, 1).toISOString(); // Inclusive

        // 1. Fetch Sales (Orders)
        // @ts-ignore
        const { data: sales, error: salesError } = await supabase
            .from('orders')
            .select('created_at, total_amount, status')
            .eq('shop_id', currentShop?.id)
            .gte('created_at', from)
            .lt('created_at', to)
            .eq('status', 'completed'); // Only completed sales

        // 2. Fetch Purchases
        // @ts-ignore
        const { data: purchases, error: purchaseError } = await supabase
            .from('purchases')
            .select('invoice_date, total_amount, status')
            .eq('shop_id', currentShop?.id)
            .gte('invoice_date', from)
            .lt('invoice_date', to)
            .eq('status', 'completed');

        if (sales && purchases) {
            processData(sales, purchases);
        }
        setLoading(false);
    };

    const processData = (sales: any[], purchases: any[]) => {
        let totalSales = 0;
        let totalPurchases = 0;

        // Group by Date for Chart
        const dailyMap = new Map();

        sales.forEach(s => {
            totalSales += Number(s.total_amount);
            const date = format(new Date(s.created_at), 'yyyy-MM-dd');
            if (!dailyMap.has(date)) dailyMap.set(date, { date, sales: 0, purchases: 0 });
            dailyMap.get(date).sales += Number(s.total_amount);
        });

        purchases.forEach(p => {
            totalPurchases += Number(p.total_amount);
            const date = format(new Date(p.invoice_date), 'yyyy-MM-dd');
            if (!dailyMap.has(date)) dailyMap.set(date, { date, sales: 0, purchases: 0 });
            dailyMap.get(date).purchases += Number(p.total_amount);
        });

        // Convert Map to Array & Sort
        const data = Array.from(dailyMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setChartData(data);

        setSummary({
            totalSales,
            totalPurchases,
            netCashFlow: totalSales - totalPurchases,
            gstCollected: totalSales * 0.12, // Approx 12% average (Wait, need exact? Estimating for now)
            gstPaid: totalPurchases * 0.12
        });
    };

    const handlePrint = () => {
        // Simple print
        window.print();
    };

    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <TrendingUp className="w-8 h-8 text-green-600" /> Financial Reports
                    </h1>
                    <p className="text-muted-foreground">GST, Profit & Loss, and Cash Flow Analysis</p>
                </div>
                <div className="flex gap-2 items-center">
                    {/* Date Picker would go here, simplistic placeholder for now */}
                    <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded">
                        {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd, yyyy')}
                    </span>
                    <Button variant="outline" onClick={handlePrint}>
                        <Download className="w-4 h-4 mr-2" /> Export
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-green-50 border-green-200">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-800">Total Sales</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">₹{summary.totalSales.toLocaleString()}</div>
                        <p className="text-xs text-green-600 mt-1">Est. GST Collected: ₹{summary.gstCollected.toFixed(2)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-800">Total Purchases</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-700">₹{summary.totalPurchases.toLocaleString()}</div>
                        <p className="text-xs text-red-600 mt-1">Est. GST Paid: ₹{summary.gstPaid.toFixed(2)}</p>
                    </CardContent>
                </Card>
                <Card className={`border-l-4 ${summary.netCashFlow >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle></CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${summary.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            ₹{summary.netCashFlow.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Sales - Purchases</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Cash Flow Trend</CardTitle>
                        <CardDescription>Daily Sales vs Purchases</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="sales" fill="#16a34a" name="Sales" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="purchases" fill="#dc2626" name="Purchases" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>GST Summary (Estimated)</CardTitle>
                        <CardDescription>Based on flat 12% average rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span>Output Tax (Sales)</span>
                                <span className="font-bold text-red-600">₹{summary.gstCollected.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                                <span>Input Tax (Purchases)</span>
                                <span className="font-bold text-green-600">₹{summary.gstPaid.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="font-bold">Net Payable / (Credit)</span>
                                <span className={`font-bold ${(summary.gstCollected - summary.gstPaid) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    ₹{(summary.gstCollected - summary.gstPaid).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Profit Analysis</CardTitle>
                        <CardDescription>Gross Margin Analysis</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span>Total Revenue</span>
                                <span className="font-bold">₹{summary.totalSales.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                                <span>COGS (Approx 70%)</span>
                                <span className="text-muted-foreground">₹{(summary.totalSales * 0.7).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="font-bold text-green-700">Gross Profit (Est. 30%)</span>
                                <span className="font-bold text-green-700">
                                    ₹{(summary.totalSales * 0.3).toLocaleString()}
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-2 bg-slate-50 p-2 rounded">
                                * Note: Exact profit requires strict batch-wise purchase price tracking. Currently estimated at standard pharmacy margin of 30%.
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Reports;
