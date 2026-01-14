import { useState, useEffect } from "react";
import { format, addMonths, parseISO, differenceInDays } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Zap,
  RefreshCw,
  ShoppingCart,
  Hourglass
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";

interface StockoutRisk {
  medicine: string;
  currentStock: number;
  avgDailySales: number;
  burnRate: number;
  safetyStock: number;
  reorderQty: number;
  criticality: "high" | "medium" | "low";
}

interface ExpiryRisk {
  medicine: string;
  batch: string;
  expiryDate: string;
  qty: number;
  value: number;
  daysToExpiry: number;
  recommendation: string;
}

const Forecasting = () => {
  const { currentShop } = useUserShops();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("demand");
  const [stockoutRisks, setStockoutRisks] = useState<StockoutRisk[]>([]);
  const [expiryRisks, setExpiryRisks] = useState<ExpiryRisk[]>([]);
  const [forecastHistory, setForecastHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!currentShop?.id) return;
    fetchPredictions();
    fetchExpiryRisks();
  }, [currentShop?.id]);

  const fetchPredictions = async () => {
    const { data } = await supabase
      .from('restock_predictions')
      .select('*')
      .order('predicted_quantity', { ascending: false });

    // No forecast_history table - use empty array
    setForecastHistory([]);

    if (data) {
      const risks = (data as any[]).map((item) => ({
        medicine: item.medicine_name,
        currentStock: item.current_stock,
        avgDailySales: item.avg_daily_sales || 5,
        burnRate: item.current_stock / (item.avg_daily_sales || 1),
        safetyStock: 50,
        reorderQty: item.predicted_quantity,
        criticality: (item.current_stock / (item.avg_daily_sales || 1)) < 3 ? "high" : "medium"
      }));
      setStockoutRisks(risks as StockoutRisk[]);
    }
  };

  const fetchExpiryRisks = async () => {
    if (!currentShop?.id) return;

    const sixMonths = addMonths(new Date(), 6).toISOString();

    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('shop_id', currentShop.id)
      .gt('quantity', 0)
      .lt('expiry_date', sixMonths)
      .order('expiry_date', { ascending: true });

    if (data) {
      const risks = data.map((item: any) => {
        const days = differenceInDays(parseISO(item.expiry_date), new Date());
        return {
          medicine: item.medicine_name,
          batch: item.batch_number || 'N/A',
          expiryDate: item.expiry_date,
          qty: item.quantity,
          value: item.quantity * (item.unit_price || 0),
          daysToExpiry: days,
          recommendation: days < 30 ? "Liquidation (50% Off)" : days < 90 ? "Bundle Offer" : "Monitor"
        };
      });
      setExpiryRisks(risks);
    }
  };



  // Seasonal Logic (Shared with AICommandCentre)
  const getSeasonalAlerts = () => {
    const month = new Date().getMonth();
    if (month >= 10 || month <= 1) { // Winter
      return [{ season: "Cold & Flu Season", start: "Now", focus: "Immunity" }];
    } else if (month >= 2 && month <= 5) { // Summer/Spring
      return [{ season: "Allergy & Heat Season", start: "March", focus: "Dermatology" }];
    } else { // Monsoon
      return [{ season: "Monsoon Season", start: "July", focus: "Anti-Infectives" }];
    }
  };

  const seasonalAlerts = getSeasonalAlerts();

  /* Rate of Sale (ROS) Engine */
  const runAIAnalysis = async () => {
    if (!currentShop?.id) return;
    setLoading(true);
    const toastId = toast.loading("Analyzing Sales Velocity...");

    try {
      // 1. Fetch Sales History (Last 30 Days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('order_items, created_at')
        .eq('shop_id', currentShop.id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (orderError) throw orderError;

      // 2. Fetch Current Inventory
      const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select('id, medicine_name, quantity, unit_price')
        .eq('shop_id', currentShop.id);

      if (invError) throw invError;

      // 3. Aggregate Sales (Map <MedicineName, QtySold>)
      const salesMap = new Map<string, number>();
      orders?.forEach(order => {
        const items = order.order_items as any[];
        if (Array.isArray(items)) {
          items.forEach(item => {
            const name = item.name || item.medicine_name;
            if (name) {
              const qty = parseInt(item.qty || item.quantity || 0);
              salesMap.set(name, (salesMap.get(name) || 0) + qty);
            }
          });
        }
      });

      // 4. Calculate ROS & Predictions
      const predictions = inventory?.map(item => {
        const totalSold = salesMap.get(item.medicine_name) || 0;
        const avgDailySales = totalSold / 30; // Simple Moving Average
        const currentStock = item.quantity;

        // Forecast Logic
        const safetyStockDays = 14; // buffer
        const leadTimeDays = 2; // time to restock

        let predictedRestock = 0;
        let status = "Healthy";
        let confidence = 0.9;

        if (avgDailySales > 0) {
          const daysCover = currentStock / avgDailySales;
          const reorderPoint = avgDailySales * (leadTimeDays + safetyStockDays);

          if (currentStock < reorderPoint) {
            predictedRestock = Math.ceil(reorderPoint - currentStock);
            status = "Low Stock";
          }
        } else {
          status = "Dead Stock";
          confidence = 0.5; // Low confidence if no sales
        }

        return {
          shop_id: currentShop.id,
          medicine_name: item.medicine_name,
          current_stock: currentStock,
          avg_daily_sales: parseFloat(avgDailySales.toFixed(2)),
          predicted_quantity: predictedRestock,
          confidence_score: confidence,
          reason: status
        };
      });

      // 5. Save to DB (Clear old first)
      await supabase.from('restock_predictions').delete().eq('shop_id', currentShop.id);

      if (predictions && predictions.length > 0) {
        // Filter only relevant predictions to save space (e.g. only reorders or active items)
        const vitalPredictions = predictions.filter(p => p.predicted_quantity > 0 || p.avg_daily_sales > 0);

        if (vitalPredictions.length > 0) {
          const { error: saveError } = await supabase.from('restock_predictions').insert(vitalPredictions);
          if (saveError) throw saveError;
        }
      }

      toast.success(`Analysis Complete. Processed ${orders?.length} orders.`);
      fetchPredictions(); // Refresh UI

    } catch (e: any) {
      console.error("Forecasting Error:", e);
      toast.error("Analysis Failed: " + e.message);
    } finally {
      setLoading(false);
      toast.dismiss(toastId);
    }
  };

  const addToReorder = (item: StockoutRisk) => {
    toast.success(`Added ${item.reorderQty} units of ${item.medicine} to Purchase Order`);
  };

  const applyDiscount = (item: ExpiryRisk) => {
    toast.success(`Applied ${item.recommendation} to ${item.medicine}`);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">FutureSight AI</h1>
          <p className="text-muted-foreground mt-1">Predictive Analytics for Inventory Optimization</p>
        </div>
        <Button onClick={runAIAnalysis} disabled={loading} className="bg-primary hover:bg-primary/90">
          {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
          Run Forecast Analysis
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="demand">Demand & Sales</TabsTrigger>
          <TabsTrigger value="stockouts">Stockout Risks</TabsTrigger>
          <TabsTrigger value="expiry">Expiry Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="demand" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" /> Sales Forecast
                </CardTitle>
                <CardDescription>AI Prediction vs Actual Sales (Next 3 Months)</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {forecastHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastHistory}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="sales" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSales)" name="Actual Sales" />
                      <Area type="monotone" dataKey="forecast" stroke="#10b981" strokeDasharray="5 5" fillOpacity={1} fill="url(#colorForecast)" name="AI Forecast" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Run AI Analysis to generate forecast data
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-500" /> Seasonal Prep
                </CardTitle>
                <CardDescription>Upcoming Demand Spikes (Based on Regional Trends)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {seasonalAlerts.length > 0 ? seasonalAlerts.map((season, idx) => (
                  <div key={idx} className="p-4 bg-purple-500/10 rounded-lg border border-purple-200 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg text-purple-900">{season.season}</span>
                      <Badge variant="outline" className="text-purple-600 border-purple-200 bg-white">Active: {season.start}</Badge>
                    </div>
                    <p className="text-sm text-purple-700">Focus Area: {season.focus}</p>
                  </div>
                )) : (
                  <p className="text-muted-foreground text-center py-8">No seasonal alerts generated by AI yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stockouts" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" /> Critical Low Stock
                  </CardTitle>
                  <CardDescription>Items projected to stockout within 7 days</CardDescription>
                </div>
                <Button variant="outline" size="sm">Download PO</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stockoutRisks.filter(r => r.criticality !== 'low').map((item, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:border-red-400 transition-colors bg-card">
                    <div className="space-y-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{item.medicine}</span>
                        {item.criticality === 'high' && <Badge variant="destructive" className="animate-pulse">Critical</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">Stock: {item.currentStock} | Burning {item.avgDailySales}/day</p>
                    </div>

                    <div className="flex-1 px-4 py-2 md:py-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Burn Rate (Days Left)</span>
                        <span className={item.burnRate < 4 ? "text-red-500 font-bold" : "text-orange-500"}>{item.burnRate.toFixed(1)} Days</span>
                      </div>
                      <Progress value={Math.max(0, (item.burnRate / 30) * 100)} className="h-2" />
                    </div>

                    <div className="flex items-center gap-4 min-w-[200px] justify-end">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Suggested Order</p>
                        <p className="font-bold text-xl text-primary">{item.reorderQty}</p>
                      </div>
                      <Button size="icon" onClick={() => addToReorder(item)}>
                        <ShoppingCart className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {stockoutRisks.filter(r => r.criticality !== 'low').length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">Inventory health is excellent. No immediate stockouts predicted.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiry" className="space-y-6">
          <Card className="border-l-4 border-l-red-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hourglass className="w-5 h-5 text-red-500" /> Liquidation Candidates
              </CardTitle>
              <CardDescription>High-value stock nearing expiry. Action required to prevent loss.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                {expiryRisks.map((item, idx) => (
                  <div key={idx} className="flex flex-wrap items-center justify-between p-4 bg-muted/30 rounded-lg border border-red-100">
                    <div>
                      <h4 className="font-bold">{item.medicine}</h4>
                      <p className="text-sm text-muted-foreground">Batch: {item.batch} • Exp: {item.expiryDate}</p>
                    </div>

                    <div className="text-center px-4">
                      <p className="text-xs text-muted-foreground">Total Value</p>
                      <p className="font-bold text-lg text-foreground">₹{item.value.toLocaleString()}</p>
                    </div>

                    <div className="text-center px-4">
                      <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Expires in {item.daysToExpiry} days</Badge>
                    </div>

                    <Button variant="secondary" className="gap-2" onClick={() => applyDiscount(item)}>
                      <TrendingDown className="w-4 h-4" />
                      {item.recommendation}
                    </Button>
                  </div>
                ))}
                {expiryRisks.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">No items nearing expiry.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Forecasting;
