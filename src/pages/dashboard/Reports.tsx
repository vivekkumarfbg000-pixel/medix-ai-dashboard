import { useState, useEffect } from "react";
import { useUserShops } from "@/hooks/useUserShops";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, addDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GSTExportPanel } from "@/components/dashboard/reports/GSTExportPanel";
import { SalesAnalytics } from "@/components/dashboard/reports/SalesAnalytics";
import { Download, TrendingUp } from "lucide-react";

interface ReportSummary {
    totalSales: number;
    totalPurchases: number;
    netCashFlow: number;
    gstCollected: number;
    gstPaid: number;
    gstNet: number;
    grossMargin: number;
}

const Reports = () => {
    // ... (state remains same)
    const [summary, setSummary] = useState<ReportSummary>({
        totalSales: 0,
        totalPurchases: 0,
        netCashFlow: 0,
        gstCollected: 0,
        gstPaid: 0,
        gstNet: 0,
        grossMargin: 0
    });

    // ... (fetchData remains same)

    const processData = (sales: any[], purchases: any[]) => {
        let totalSales = 0;
        let totalPurchases = 0;
        let totalGSTCollected = 0;
        let totalGrossMargin = 0;

        // Group by Date for Chart
        const dailyMap = new Map();

        sales.forEach(s => {
            const amount = Number(s.total_amount) || 0;
            totalSales += amount;

            // Calculate GST & Margin from items
            if (s.order_items && Array.isArray(s.order_items)) {
                s.order_items.forEach((item: any) => {
                    const price = Number(item.price || 0);
                    const qty = Number(item.qty || 0);
                    const cost = Number(item.purchase_price || (price * 0.7)); // Fallback to 70% cost (30% margin) if missing
                    const gstRate = Number(item.gst || 0);

                    // Margin Calc
                    // Revenue from this item = price * qty (Includes Tax usually in MRP)
                    // But Cost is usually Ex-Tax.
                    // Strictly: Margin = (Net Sales - COGS).
                    // Net Sales = (Price * Qty) - Tax
                    // Tax = (Price * Qty) * (gstRate / (100+gstRate))

                    const lineTotal = price * qty;
                    let taxComponent = 0;

                    if (gstRate > 0) {
                        taxComponent = lineTotal * (gstRate / (100 + gstRate));
                        totalGSTCollected += taxComponent;
                    }

                    const netSales = lineTotal - taxComponent;
                    const cogs = cost * qty;
                    totalGrossMargin += (netSales - cogs);
                });
            } else {
                // Fallback estimate if no items (Legacy data)
                totalGSTCollected += (amount * (12 / 112));
                totalGrossMargin += (amount * 0.20); // Conservative 20% margin on old data
            }

            const date = format(new Date(s.created_at), 'yyyy-MM-dd');
            if (!dailyMap.has(date)) dailyMap.set(date, { date, sales: 0, purchases: 0 });
            dailyMap.get(date).sales += amount;
        });

        purchases.forEach(p => {
            const amount = Number(p.total_amount) || 0;
            totalPurchases += amount;
            const date = format(new Date(p.invoice_date), 'yyyy-MM-dd');
            if (!dailyMap.has(date)) dailyMap.set(date, { date, sales: 0, purchases: 0 });
            dailyMap.get(date).purchases += amount;
        });

        const data = Array.from(dailyMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setChartData(data);

        const totalGSTPaid = totalPurchases * (12 / 112);

        setSummary({
            totalSales,
            totalPurchases,
            netCashFlow: totalSales - totalPurchases,
            gstCollected: totalGSTCollected,
            gstPaid: totalGSTPaid,
            gstNet: totalGSTCollected - totalGSTPaid,
            grossMargin: totalGrossMargin
        });
    };

    // ... (handlePrint)

    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-0">
            {/* ... Header ... */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* ... same as before ... */}
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <TrendingUp className="w-8 h-8 text-green-600" /> Business Intelligence
                    </h1>
                    <p className="text-muted-foreground">Financial Reports • GST Compliance • Growth Analytics</p>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded">
                        {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd, yyyy')}
                    </span>
                    <Button variant="outline" onClick={fetchData} disabled={loading}>
                        {loading ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                {/* ... TabsList ... */}
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="sales">Sales Analytics</TabsTrigger>
                    <TabsTrigger value="gst">GST Reports</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* ... Sales & Purchase Cards ... */}
                        <Card className="bg-green-50 border-green-200">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-800">Total Sales</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-700">₹{summary.totalSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                <p className="text-xs text-green-600 mt-1">Found {summary.gstCollected > 0 ? 'Verified' : 'Estimated'} Tax Data</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-red-50 border-red-200">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-800">Total Purchases</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-700">₹{summary.totalPurchases.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                <p className="text-xs text-red-600 mt-1">Input Credit Available</p>
                            </CardContent>
                        </Card>
                        <Card className={`border-l-4 ${summary.netCashFlow >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle></CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${summary.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    ₹{summary.netCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Realized Liquidity</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* ... Chart & GST Cards ... */}
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Cash Flow Trend</CardTitle>
                                <CardDescription>Daily Sales vs Purchases (Inclusive of Tax)</CardDescription>
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
                                <CardTitle>GST Liability (Approx)</CardTitle>
                                <CardDescription>Output Tax vs Input Tax Credit</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b pb-2">
                                        <span>Output Tax (Sales)</span>
                                        <span className="font-bold text-red-600">₹{summary.gstCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b pb-2">
                                        <span>Input Tax (Purchases)</span>
                                        <span className="font-bold text-green-600">₹{summary.gstPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 text-lg">
                                        <span className="font-bold">Net Payable</span>
                                        <span className={`font-bold ${summary.gstNet > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                            ₹{Math.abs(summary.gstNet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            {summary.gstNet < 0 && " (Credit)"}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Margin Analysis</CardTitle>
                                <CardDescription>Profitability Metrics</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-slate-50 rounded-lg text-center">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Sale Value</p>
                                            <p className="text-xl font-bold mt-1">
                                                ₹{summary.totalSales > 0 ? (summary.totalSales / (chartData.reduce((acc, curr) => acc + (curr.sales > 0 ? 1 : 0), 0) || 1)).toFixed(0) : 0}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-green-50 rounded-lg text-center border border-green-100">
                                            <p className="text-xs text-green-800 uppercase tracking-wide">Gross Margin</p>
                                            <p className="text-xl font-bold mt-1 text-green-700">
                                                ₹{summary.grossMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </p>
                                            <p className="text-[10px] text-green-600">
                                                {summary.totalSales > 0 ? ((summary.grossMargin / summary.totalSales) * 100).toFixed(1) : 0}% of Sales
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">* Calculated as (Net Sales - Cost of Goods Sold). Takes taxes into account.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ... Other Tabs ... */}
                <TabsContent value="sales">
                    <SalesAnalytics shopId={currentShop?.id || ''} />
                </TabsContent>

                <TabsContent value="gst">
                    <GSTExportPanel shopId={currentShop?.id || ''} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default Reports;
