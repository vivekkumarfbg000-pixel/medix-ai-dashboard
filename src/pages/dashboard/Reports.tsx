import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserShops } from "@/hooks/useUserShops";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Calendar as CalendarIcon, Download, TrendingUp, DollarSign, CreditCard } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Reports() {
    const { currentShop } = useUserShops();
    const [date, setDate] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);

    useEffect(() => {
        if (currentShop?.id && date?.from && date?.to) {
            fetchReport();
        }
    }, [currentShop?.id, date]);

    const fetchReport = async () => {
        if (!date?.from || !date?.to) return;
        setLoading(true);

        try {
            // Adjust dates to cover full days
            const startDate = new Date(date.from);
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(date.to);
            endDate.setHours(23, 59, 59, 999);

            const { data, error } = await supabase.rpc('get_sales_report', {
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                query_shop_id: currentShop?.id
            });

            if (error) throw error;
            setReportData(data);
        } catch (error: any) {
            console.error("Report Error:", error);
            toast.error("Failed to load report");
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = () => {
        if (!reportData?.sales_by_date) return;

        const headers = ["Date", "Orders", "Sales", "Profit"];
        const rows = reportData.sales_by_date.map((d: any) => [
            format(new Date(d.date), 'yyyy-MM-dd'),
            d.order_count,
            d.sales,
            d.profit
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map((e: any[]) => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `sales_report_${format(new Date(), 'yyyyMMdd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const profitMargin = reportData?.total_sales > 0
        ? ((reportData.total_profit / reportData.total_sales) * 100).toFixed(1)
        : 0;

    return (
        <div className="space-y-6 pb-10 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Financial Reports</h1>
                    <p className="text-slate-500 text-sm mt-1">Track your pharmacy's performance and profitability.</p>
                </div>

                <div className="flex gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                    date.to ? (
                                        <>
                                            {format(date.from, "LLL dd, y")} -{" "}
                                            {format(date.to, "LLL dd, y")}
                                        </>
                                    ) : (
                                        format(date.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span>Pick a date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>

                    <Button variant="outline" onClick={downloadCSV} disabled={!reportData}>
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/10 dark:to-slate-900 border-blue-100 dark:border-blue-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" /> Total Sales
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {loading ? "..." : `₹${reportData?.total_sales?.toLocaleString() || '0'}`}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Gross Revenue for selected period</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/10 dark:to-slate-900 border-emerald-100 dark:border-emerald-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Net Profit
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {loading ? "..." : `₹${reportData?.total_profit?.toLocaleString() || '0'}`}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Revenue - Cost of Goods Sold</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/10 dark:to-slate-900 border-purple-100 dark:border-purple-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-purple-600 dark:text-purple-400 flex items-center gap-2">
                            <CreditCard className="w-4 h-4" /> Profit Margin
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {loading ? "..." : `${profitMargin}%`}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Average margin across all sales</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Sales vs Profit Trend</CardTitle>
                        <CardDescription>Daily breakdown of revenue and net profit</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                        {reportData?.sales_by_date?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={reportData.sales_by_date}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(str) => format(new Date(str), 'MMM dd')}
                                        minTickGap={30}
                                    />
                                    <YAxis />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                                    />
                                    <Area type="monotone" dataKey="sales" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSales)" name="Sales" />
                                    <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" name="Profit" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                No sales data for the selected period
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
