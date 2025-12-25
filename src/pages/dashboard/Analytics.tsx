import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, IndianRupee, Package, Users, ArrowUpRight } from "lucide-react";
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
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
} from "recharts";

// Mock data for charts
const revenueData = [
  { month: "Jan", revenue: 45000, profit: 12000 },
  { month: "Feb", revenue: 52000, profit: 14500 },
  { month: "Mar", revenue: 48000, profit: 13200 },
  { month: "Apr", revenue: 61000, profit: 18300 },
  { month: "May", revenue: 55000, profit: 15800 },
  { month: "Jun", revenue: 67000, profit: 21000 },
];

const topSellingDrugs = [
  { name: "Paracetamol 500mg", sales: 1250, revenue: 31250 },
  { name: "Amoxicillin 250mg", sales: 890, revenue: 44500 },
  { name: "Omeprazole 20mg", sales: 780, revenue: 23400 },
  { name: "Metformin 500mg", sales: 650, revenue: 19500 },
  { name: "Amlodipine 5mg", sales: 520, revenue: 20800 },
  { name: "Cetirizine 10mg", sales: 480, revenue: 9600 },
  { name: "Losartan 50mg", sales: 420, revenue: 16800 },
  { name: "Aspirin 75mg", sales: 380, revenue: 5700 },
  { name: "Ibuprofen 400mg", sales: 350, revenue: 8750 },
  { name: "Vitamin D3", sales: 320, revenue: 9600 },
];

const categoryProfitData = [
  { category: "Antibiotics", profit: 28500, margin: 32 },
  { category: "Pain Relief", profit: 18200, margin: 28 },
  { category: "Cardiovascular", profit: 24800, margin: 35 },
  { category: "Diabetes", profit: 16500, margin: 25 },
  { category: "Supplements", profit: 12400, margin: 42 },
];

const dailySalesData = [
  { day: "Mon", sales: 8500 },
  { day: "Tue", sales: 7200 },
  { day: "Wed", sales: 9100 },
  { day: "Thu", sales: 8800 },
  { day: "Fri", sales: 11200 },
  { day: "Sat", sales: 13500 },
  { day: "Sun", sales: 6200 },
];

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function Analytics() {
  const currentMonthRevenue = 67000;
  const lastMonthRevenue = 55000;
  const revenueGrowth = ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Revenue & Growth</h1>
          <p className="text-muted-foreground">Financial analytics and insights</p>
        </div>
        <Badge variant="outline" className="gap-1 w-fit">
          <TrendingUp className="w-3 h-3 text-green-500" />
          <span className="text-green-600">+{revenueGrowth}% vs last month</span>
        </Badge>
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
            <div className="text-2xl font-bold">₹{currentMonthRevenue.toLocaleString()}</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" />
              +21.8% from last month
            </p>
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
            <div className="text-2xl font-bold">₹21,000</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" />
              +32.9% margin
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
            <div className="text-2xl font-bold">6,040</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across 245 products
            </p>
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
            <div className="text-2xl font-bold">1,284</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" />
              +12% new customers
            </p>
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
                </div>
              </CardContent>
            </Card>

            <Card className="medical-card">
              <CardHeader>
                <CardTitle>Daily Sales Pattern</CardTitle>
                <CardDescription>Sales distribution by day of week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
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
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="top-selling" className="space-y-4">
          <Card className="medical-card">
            <CardHeader>
              <CardTitle>Top 10 Selling Drugs</CardTitle>
              <CardDescription>Products with highest sales volume this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
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
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryProfitData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="profit"
                        label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {categoryProfitData.map((entry, index) => (
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
                </div>
              </CardContent>
            </Card>

            <Card className="medical-card">
              <CardHeader>
                <CardTitle>Profit Margins by Category</CardTitle>
                <CardDescription>Margin percentage comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryProfitData.map((category, index) => (
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
                            width: `${category.margin}%`,
                            backgroundColor: COLORS[index % COLORS.length]
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
