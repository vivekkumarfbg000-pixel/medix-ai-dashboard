import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Calendar,
  Package,
  ArrowUpRight
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const Forecasting = () => {
  // Simulated forecast data
  const stockForecast = [
    { month: "Jan", actual: 450, predicted: null },
    { month: "Feb", actual: 380, predicted: null },
    { month: "Mar", actual: 520, predicted: null },
    { month: "Apr", actual: 410, predicted: null },
    { month: "May", actual: null, predicted: 380 },
    { month: "Jun", actual: null, predicted: 350 },
    { month: "Jul", actual: null, predicted: 290 },
  ];

  const salesTrend = [
    { day: "Mon", sales: 12500 },
    { day: "Tue", sales: 15800 },
    { day: "Wed", sales: 13200 },
    { day: "Thu", sales: 18900 },
    { day: "Fri", sales: 22100 },
    { day: "Sat", sales: 28500 },
    { day: "Sun", sales: 16700 },
  ];

  const stockoutPredictions = [
    { medicine: "Paracetamol 500mg", daysLeft: 5, currentStock: 23, avgDailySales: 4.5 },
    { medicine: "Amoxicillin 250mg", daysLeft: 8, currentStock: 40, avgDailySales: 5 },
    { medicine: "Omeprazole 20mg", daysLeft: 12, currentStock: 36, avgDailySales: 3 },
    { medicine: "Cetirizine 10mg", daysLeft: 15, currentStock: 75, avgDailySales: 5 },
    { medicine: "Metformin 500mg", daysLeft: 18, currentStock: 90, avgDailySales: 5 },
  ];

  const seasonalAlerts = [
    { season: "Flu Season", risk: "high", medicines: ["Paracetamol", "Ibuprofen", "Cough Syrup"] },
    { season: "Dengue Season", risk: "medium", medicines: ["ORS", "Paracetamol", "Platelet supplements"] },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Stock Forecasting</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered predictions for inventory management
          </p>
        </div>
        <Button variant="outline">
          <Calendar className="w-4 h-4 mr-2" />
          Last 30 Days
        </Button>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Level Forecast */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-warning" />
              Stock Level Forecast
            </CardTitle>
            <CardDescription>
              Predicted inventory levels for the next 3 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stockForecast}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="predicted" 
                    stroke="hsl(var(--warning))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "hsl(var(--warning))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-primary" />
                <span className="text-muted-foreground">Actual</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-warning" style={{ borderBottom: "2px dashed" }} />
                <span className="text-muted-foreground">Predicted</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              Weekly Sales Trend
            </CardTitle>
            <CardDescription>
              Revenue analysis for the current week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value) => [`₹${value}`, "Sales"]}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="hsl(var(--success))"
                    fill="hsl(var(--success) / 0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stockout Predictions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Stockout Predictions
              </CardTitle>
              <CardDescription>
                Medicines predicted to run out based on current sales velocity
              </CardDescription>
            </div>
            <Button size="sm">
              Generate Reorder List
              <ArrowUpRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stockoutPredictions.map((item, i) => (
              <div 
                key={i}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  item.daysLeft <= 7 ? "border-destructive/50 bg-destructive/5" :
                  item.daysLeft <= 14 ? "border-warning/50 bg-warning/5" :
                  "border-border"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    item.daysLeft <= 7 ? "bg-destructive/20" :
                    item.daysLeft <= 14 ? "bg-warning/20" :
                    "bg-muted"
                  }`}>
                    <Package className={`w-5 h-5 ${
                      item.daysLeft <= 7 ? "text-destructive" :
                      item.daysLeft <= 14 ? "text-warning" :
                      "text-muted-foreground"
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{item.medicine}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.currentStock} units • {item.avgDailySales} avg/day
                    </p>
                  </div>
                </div>
                <Badge variant={
                  item.daysLeft <= 7 ? "destructive" :
                  item.daysLeft <= 14 ? "secondary" : "outline"
                }>
                  {item.daysLeft} days left
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Seasonal Alerts */}
      <Card className="border-info/50 bg-info/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-info">
            <AlertTriangle className="w-5 h-5" />
            Seasonal Demand Alerts
          </CardTitle>
          <CardDescription>
            Prepare for upcoming seasonal demand spikes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {seasonalAlerts.map((alert, i) => (
              <div key={i} className="p-4 rounded-lg bg-card border">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">{alert.season}</span>
                  <Badge variant={alert.risk === "high" ? "destructive" : "secondary"}>
                    {alert.risk} risk
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {alert.medicines.map((med, j) => (
                    <Badge key={j} variant="outline" className="text-xs">
                      {med}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Forecasting;
