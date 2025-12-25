import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  IndianRupee,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShoppingCart,
  Pill,
  Users
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";

interface InventoryItem {
  id: string;
  medicine_name: string;
  quantity: number;
  expiry_date: string | null;
  unit_price: number;
}

interface Order {
  id: string;
  customer_name: string;
  status: string;
  total_amount: number;
  created_at: string;
}

const Overview = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [inventoryRes, ordersRes] = await Promise.all([
        supabase.from("inventory").select("*").limit(10),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(5)
      ]);

      if (inventoryRes.data) setInventory(inventoryRes.data);
      if (ordersRes.data) setOrders(ordersRes.data);
      setLoading(false);
    };

    fetchData();
  }, []);

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return "safe";
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0) return "expired";
    if (days <= 60) return "danger";
    if (days <= 90) return "warning";
    return "safe";
  };

  const expiringItems = inventory.filter(item => {
    const status = getExpiryStatus(item.expiry_date);
    return status === "danger" || status === "expired";
  });

  const lowStockItems = inventory.filter(item => item.quantity < 10);
  const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const pendingOrders = orders.filter(o => o.status === "pending").length;

  const stats = [
    {
      title: "Total Stock Value",
      value: `₹${totalValue.toLocaleString()}`,
      change: "+12.5%",
      trend: "up",
      icon: IndianRupee,
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      title: "Total Items",
      value: inventory.length.toString(),
      change: "+3 this week",
      trend: "up",
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Expiring Soon",
      value: expiringItems.length.toString(),
      change: "Within 60 days",
      trend: "warning",
      icon: AlertTriangle,
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    {
      title: "Pending Orders",
      value: pendingOrders.toString(),
      change: "Requires action",
      trend: "neutral",
      icon: ShoppingCart,
      color: "text-info",
      bgColor: "bg-info/10"
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's your pharmacy at a glance.
          </p>
        </div>
        <Button className="w-fit shadow-glow">
          <Pill className="w-4 h-4 mr-2" />
          Add Medicine
        </Button>
      </div>

      {/* Stats Grid - Glassmorphism Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="glass-card group hover:border-primary/30 transition-all duration-300 hover:shadow-glass-lg">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl lg:text-3xl font-bold text-foreground">{stat.value}</p>
                  <div className="flex items-center gap-1 text-sm">
                    {stat.trend === "up" && <ArrowUpRight className="w-4 h-4 text-success" />}
                    {stat.trend === "down" && <ArrowDownRight className="w-4 h-4 text-destructive" />}
                    <span className={stat.trend === "up" ? "text-success" : stat.trend === "down" ? "text-destructive" : "text-muted-foreground"}>
                      {stat.change}
                    </span>
                  </div>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-xl group-hover:scale-110 transition-transform backdrop-blur-sm`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expiry Alerts */}
        <Card className="lg:col-span-2 glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  Expiry Alerts
                </CardTitle>
                <CardDescription>Items expiring within 60 days</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="glass-card">View All</Button>
            </div>
          </CardHeader>
          <CardContent>
            {expiringItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No items expiring soon. Great job!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expiringItems.slice(0, 5).map((item) => {
                  const status = getExpiryStatus(item.expiry_date);
                  const days = item.expiry_date
                    ? differenceInDays(new Date(item.expiry_date), new Date())
                    : 0;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-lg border backdrop-blur-sm ${status === "expired" ? "bg-destructive/10 border-destructive/30" : "bg-warning/10 border-warning/30"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Pill className="w-5 h-5" />
                        <div>
                          <p className="font-medium">{item.medicine_name}</p>
                          <p className="text-sm opacity-80">
                            {item.expiry_date && format(new Date(item.expiry_date), "MMM dd, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge variant={status === "expired" ? "destructive" : "secondary"}>
                        {days < 0 ? "Expired" : `${days} days left`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  Recent Orders
                </CardTitle>
                <CardDescription>Latest WhatsApp orders</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No orders yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <div>
                      <p className="font-medium text-foreground">{order.customer_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(order.created_at), "MMM dd, HH:mm")}
                      </div>
                    </div>
                    <Badge
                      variant={
                        order.status === "pending" ? "secondary" :
                          order.status === "approved" ? "default" : "destructive"
                      }
                      className="backdrop-blur-sm"
                    >
                      {order.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ActivityFeed />
        {/* Recent Orders - Moved here or kept in 3-col grid above? 
              Based on design, let's keep Recent Orders in the top grid and Activity Feed below 
              or make a new row. The user specifically asked for Activity Feed on Overview page.
          */}
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="glass-card border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-warning">
              <TrendingUp className="w-5 h-5" />
              Low Stock Alert
            </CardTitle>
            <CardDescription>Items with less than 10 units in stock</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map((item) => (
                <Badge key={item.id} variant="outline" className="border-warning/50 text-warning backdrop-blur-sm">
                  {item.medicine_name} ({item.quantity})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Overview;
