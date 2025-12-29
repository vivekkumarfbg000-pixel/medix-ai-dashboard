import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, IndianRupee, Package, Users, ArrowUpRight, RefreshCw, Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

interface Sale {
  id: string;
  total_amount: number;
  quantity_sold: number;
  sale_date: string;
  customer_name: string | null;
  inventory_id: string | null;
}

interface InventoryItem {
  id: string;
  medicine_name: string;
  category: string | null;
  unit_price: number;
  cost_price: number | null;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [lastMonthRevenue, setLastMonthRevenue] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalItemsSold, setTotalItemsSold] = useState(0);
  const [uniqueCustomers, setUniqueCustomers] = useState(0);
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number; profit: number }[]>([]);
  const [topSellingDrugs, setTopSellingDrugs] = useState<{ name: string; sales: number; revenue: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ category: string; profit: number; margin: number }[]>([]);
  const [dailySalesData, setDailySalesData] = useState<{ day: string; sales: number }[]>([]);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  async function fetchAnalyticsData() {
    setLoading(true);
    try {
      // Fetch sales data
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("*")
        .order("sale_date", { ascending: false });

      if (salesError) throw salesError;

      // Fetch inventory data
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory")
        .select("id, medicine_name, category, unit_price, cost_price");

      if (inventoryError) throw inventoryError;

      setSales(salesData || []);
      setInventory(inventoryData || []);

      // Calculate metrics
      calculateMetrics(salesData || [], inventoryData || []);
    } catch (error: any) {
      toast.error("Failed to fetch analytics: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  function calculateMetrics(salesData: Sale[], inventoryData: InventoryItem[]) {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Create inventory lookup
    const inventoryMap = new Map(inventoryData.map(item => [item.id, item]));

    // Current month sales
    const currentMonthSales = salesData.filter(sale => {
      const saleDate = new Date(sale.sale_date);
      return saleDate >= currentMonthStart && saleDate <= currentMonthEnd;
    });

    // Last month sales
    const lastMonthSales = salesData.filter(sale => {
      const saleDate = new Date(sale.sale_date);
      return saleDate >= lastMonthStart && saleDate <= lastMonthEnd;
    });

    // Total revenue this month
    const currentRevenue = currentMonthSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
    setTotalRevenue(currentRevenue);

    // Last month revenue
    const prevRevenue = lastMonthSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
    setLastMonthRevenue(prevRevenue);

    // Calculate profit (revenue - cost)
    let profit = 0;
    currentMonthSales.forEach(sale => {
      const item = sale.inventory_id ? inventoryMap.get(sale.inventory_id) : null;
      if (item && item.cost_price) {
        profit += (Number(sale.total_amount) - (Number(item.cost_price) * sale.quantity_sold));
      } else {
        profit += Number(sale.total_amount) * 0.25; // Assume 25% margin if no cost data
      }
    });
    setTotalProfit(Math.round(profit));

    // Total items sold this month
    const itemsSold = currentMonthSales.reduce((sum, sale) => sum + sale.quantity_sold, 0);
    setTotalItemsSold(itemsSold);

    // Unique customers
    const customers = new Set(salesData.filter(s => s.customer_name).map(s => s.customer_name));
    setUniqueCustomers(customers.size);

    // Monthly revenue trend (last 6 months)
    const monthlyData: { month: string; revenue: number; profit: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));
      const monthSales = salesData.filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return saleDate >= monthStart && saleDate <= monthEnd;
      });
      const monthRevenue = monthSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
      let monthProfit = 0;
      monthSales.forEach(sale => {
        const item = sale.inventory_id ? inventoryMap.get(sale.inventory_id) : null;
        if (item && item.cost_price) {
          monthProfit += (Number(sale.total_amount) - (Number(item.cost_price) * sale.quantity_sold));
        } else {
          monthProfit += Number(sale.total_amount) * 0.25;
        }
      });
      monthlyData.push({
        month: format(monthStart, "MMM"),
        revenue: monthRevenue,
        profit: Math.round(monthProfit)
      });
    }
    setRevenueData(monthlyData);

    // Top selling drugs
    const drugSales = new Map<string, { sales: number; revenue: number }>();
    salesData.forEach(sale => {
      const item = sale.inventory_id ? inventoryMap.get(sale.inventory_id) : null;
      const name = item?.medicine_name || "Unknown";
      const existing = drugSales.get(name) || { sales: 0, revenue: 0 };
      drugSales.set(name, {
        sales: existing.sales + sale.quantity_sold,
        revenue: existing.revenue + Number(sale.total_amount)
      });
    });
    const topDrugs = Array.from(drugSales.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
    setTopSellingDrugs(topDrugs);

    // Category profit data
    const categoryProfits = new Map<string, { profit: number; revenue: number }>();
    salesData.forEach(sale => {
      const item = sale.inventory_id ? inventoryMap.get(sale.inventory_id) : null;
      const category = item?.category || "Uncategorized";
      const existing = categoryProfits.get(category) || { profit: 0, revenue: 0 };
      let saleProfit = 0;
      if (item && item.cost_price) {
        saleProfit = Number(sale.total_amount) - (Number(item.cost_price) * sale.quantity_sold);
      } else {
        saleProfit = Number(sale.total_amount) * 0.25;
      }
      categoryProfits.set(category, {
        profit: existing.profit + saleProfit,
        revenue: existing.revenue + Number(sale.total_amount)
      });
    });
    const catData = Array.from(categoryProfits.entries())
      .map(([category, data]) => ({
        category,
        profit: Math.round(data.profit),
        margin: data.revenue > 0 ? Math.round((data.profit / data.revenue) * 100) : 0
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
    setCategoryData(catData);

    // Daily sales (this week)
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const dailyData = days.map(day => {
      const daySales = salesData.filter(sale => {
        const saleDate = new Date(sale.sale_date);
        return format(saleDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
      });
      return {
        day: format(day, "EEE"),
        sales: daySales.reduce((sum, sale) => sum + Number(sale.total_amount), 0)
      };
    });
    setDailySalesData(dailyData);
  }

  const revenueGrowth = lastMonthRevenue > 0 
    ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
    : "0";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Revenue & Growth</h1>
          <p className="text-muted-foreground">Financial analytics and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAnalyticsData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Badge variant="outline" className="gap-1">
            {Number(revenueGrowth) >= 0 ? (
              <TrendingUp className="w-3 h-3 text-green-500" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-500" />
            )}
            <span className={Number(revenueGrowth) >= 0 ? "text-green-600" : "text-red-600"}>
              {Number(revenueGrowth) >= 0 ? "+" : ""}{revenueGrowth}% vs last month
            </span>
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="medical-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <IndianRupee className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card className="medical-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Profit
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalProfit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalRevenue > 0 ? `${Math.round((totalProfit / totalRevenue) * 100)}% margin` : "No sales"}
            </p>
          </CardContent>
        </Card>

        <Card className="medical-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Items Sold
            </CardTitle>
            <Package className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItemsSold.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card className="medical-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique Customers
            </CardTitle>
            <Users className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueCustomers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue Trend</TabsTrigger>
          <TabsTrigger value="top-selling">Top Selling</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="medical-card">
              <CardHeader>
                <CardTitle>Revenue & Profit Trend</CardTitle>
                <CardDescription>Monthly revenue and profit over 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {revenueData.some(d => d.revenue > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(value) => `₹${value / 1000}k`} />
                        <Tooltip
                          formatter={(value: number) => [`₹${value.toLocaleString()}`, ""]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="hsl(var(--primary))"
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                          name="Revenue"
                        />
                        <Area
                          type="monotone"
                          dataKey="profit"
                          stroke="hsl(var(--chart-2))"
                          fillOpacity={1}
                          fill="url(#colorProfit)"
                          name="Profit"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No sales data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="medical-card">
              <CardHeader>
                <CardTitle>Daily Sales Pattern</CardTitle>
                <CardDescription>Sales distribution this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {dailySalesData.some(d => d.sales > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailySalesData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="day" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(value) => `₹${value / 1000}k`} />
                        <Tooltip
                          formatter={(value: number) => [`₹${value.toLocaleString()}`, "Sales"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                        <Bar
                          dataKey="sales"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No sales this week
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="top-selling" className="space-y-4">
          <Card className="medical-card">
            <CardHeader>
              <CardTitle>Top 10 Selling Drugs</CardTitle>
              <CardDescription>Products with highest sales volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                {topSellingDrugs.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSellingDrugs} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        className="text-xs"
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          name === "sales" ? `${value} units` : `₹${value.toLocaleString()}`,
                          name === "sales" ? "Units Sold" : "Revenue"
                        ]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                      />
                      <Legend />
                      <Bar dataKey="sales" fill="hsl(var(--primary))" name="Units Sold" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No sales data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="medical-card">
              <CardHeader>
                <CardTitle>Profit by Category</CardTitle>
                <CardDescription>Category-wise profit distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="profit"
                          label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`₹${value.toLocaleString()}`, "Profit"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No category data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="medical-card">
              <CardHeader>
                <CardTitle>Profit Margins by Category</CardTitle>
                <CardDescription>Margin percentage comparison</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryData.length > 0 ? (
                  <div className="space-y-4">
                    {categoryData.map((category, index) => (
                      <div key={category.category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-sm font-medium">{category.category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              ₹{category.profit.toLocaleString()}
                            </span>
                            <Badge variant="outline">{category.margin}%</Badge>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(category.margin, 100)}%`,
                              backgroundColor: COLORS[index % COLORS.length]
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    No category data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}