import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  Package, 
  Users,
  Calendar,
  CheckCircle,
  Pill
} from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";

interface InventoryItem {
  id: string;
  medicine_name: string;
  quantity: number;
  expiry_date: string | null;
  reorder_level: number;
}

interface Reminder {
  id: string;
  patient_name: string;
  medicine_name: string;
  reminder_date: string;
  status: string;
}

const Alerts = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [inventoryRes, remindersRes] = await Promise.all([
        supabase.from("inventory").select("id, medicine_name, quantity, expiry_date, reorder_level"),
        supabase.from("patient_reminders").select("*").order("reminder_date")
      ]);

      if (inventoryRes.data) setInventory(inventoryRes.data);
      if (remindersRes.data) setReminders(remindersRes.data);
      setLoading(false);
    };

    fetchData();
  }, []);

  // Calculate alerts
  const expiryAlerts = inventory.filter(item => {
    if (!item.expiry_date) return false;
    const days = differenceInDays(new Date(item.expiry_date), new Date());
    return days <= 60 && days >= 0;
  });

  const expiredItems = inventory.filter(item => {
    if (!item.expiry_date) return false;
    return differenceInDays(new Date(item.expiry_date), new Date()) < 0;
  });

  const lowStockItems = inventory.filter(item => 
    item.quantity < (item.reorder_level || 10)
  );

  const upcomingReminders = reminders.filter(r => {
    const days = differenceInDays(new Date(r.reminder_date), new Date());
    return days >= 0 && days <= 5;
  });

  const allAlerts = [
    ...expiredItems.map(item => ({
      type: "expired",
      title: `${item.medicine_name} has expired`,
      description: `Expired on ${item.expiry_date ? format(new Date(item.expiry_date), "MMM dd, yyyy") : "N/A"}`,
      severity: "critical"
    })),
    ...expiryAlerts.map(item => ({
      type: "expiry",
      title: `${item.medicine_name} expiring soon`,
      description: `Expires on ${item.expiry_date ? format(new Date(item.expiry_date), "MMM dd, yyyy") : "N/A"}`,
      severity: differenceInDays(new Date(item.expiry_date!), new Date()) <= 30 ? "high" : "medium"
    })),
    ...lowStockItems.map(item => ({
      type: "stock",
      title: `Low stock: ${item.medicine_name}`,
      description: `Only ${item.quantity} units remaining`,
      severity: item.quantity <= 5 ? "high" : "medium"
    })),
    ...upcomingReminders.map(r => ({
      type: "reminder",
      title: `Refill reminder for ${r.patient_name}`,
      description: `${r.medicine_name} - ${format(new Date(r.reminder_date), "MMM dd")}`,
      severity: "info"
    }))
  ];

  const criticalCount = allAlerts.filter(a => a.severity === "critical" || a.severity === "high").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Alerts & Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Stay updated on inventory, expiry, and patient reminders
          </p>
        </div>
        {criticalCount > 0 && (
          <Badge variant="destructive" className="w-fit">
            {criticalCount} Critical Alerts
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={expiredItems.length > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${expiredItems.length > 0 ? "bg-destructive/20" : "bg-muted"}`}>
                <AlertTriangle className={`w-5 h-5 ${expiredItems.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{expiredItems.length}</p>
                <p className="text-sm text-muted-foreground">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={expiryAlerts.length > 0 ? "border-warning/50 bg-warning/5" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${expiryAlerts.length > 0 ? "bg-warning/20" : "bg-muted"}`}>
                <Clock className={`w-5 h-5 ${expiryAlerts.length > 0 ? "text-warning" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{expiryAlerts.length}</p>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={lowStockItems.length > 0 ? "border-info/50 bg-info/5" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${lowStockItems.length > 0 ? "bg-info/20" : "bg-muted"}`}>
                <Package className={`w-5 h-5 ${lowStockItems.length > 0 ? "text-info" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{lowStockItems.length}</p>
                <p className="text-sm text-muted-foreground">Low Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingReminders.length}</p>
                <p className="text-sm text-muted-foreground">Refill Reminders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <Bell className="w-4 h-4" />
            All ({allAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="expiry" className="gap-2">
            <Clock className="w-4 h-4" />
            Expiry ({expiryAlerts.length + expiredItems.length})
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-2">
            <Package className="w-4 h-4" />
            Stock ({lowStockItems.length})
          </TabsTrigger>
          <TabsTrigger value="reminders" className="gap-2">
            <Users className="w-4 h-4" />
            Reminders ({upcomingReminders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <AlertsList alerts={allAlerts} loading={loading} />
        </TabsContent>

        <TabsContent value="expiry">
          <AlertsList 
            alerts={allAlerts.filter(a => a.type === "expiry" || a.type === "expired")} 
            loading={loading}
            emptyMessage="No expiry alerts"
          />
        </TabsContent>

        <TabsContent value="stock">
          <AlertsList 
            alerts={allAlerts.filter(a => a.type === "stock")} 
            loading={loading}
            emptyMessage="All stock levels are healthy"
          />
        </TabsContent>

        <TabsContent value="reminders">
          <AlertsList 
            alerts={allAlerts.filter(a => a.type === "reminder")} 
            loading={loading}
            emptyMessage="No upcoming refill reminders"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface AlertsListProps {
  alerts: any[];
  loading: boolean;
  emptyMessage?: string;
}

const AlertsList = ({ alerts, loading, emptyMessage = "No alerts" }: AlertsListProps) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <CheckCircle className="w-16 h-16 mx-auto text-success/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{emptyMessage}</h3>
          <p className="text-muted-foreground">Everything looks good!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => (
        <Card 
          key={i}
          className={
            alert.severity === "critical" ? "border-destructive/50 bg-destructive/5" :
            alert.severity === "high" ? "border-warning/50 bg-warning/5" :
            alert.severity === "medium" ? "border-border" : "border-info/50 bg-info/5"
          }
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${
                alert.severity === "critical" ? "bg-destructive/20" :
                alert.severity === "high" ? "bg-warning/20" :
                alert.severity === "medium" ? "bg-muted" : "bg-info/20"
              }`}>
                {alert.type === "expiry" || alert.type === "expired" ? (
                  <Clock className={`w-5 h-5 ${
                    alert.severity === "critical" ? "text-destructive" :
                    alert.severity === "high" ? "text-warning" : "text-muted-foreground"
                  }`} />
                ) : alert.type === "stock" ? (
                  <Package className="w-5 h-5 text-info" />
                ) : (
                  <Users className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">{alert.title}</p>
                <p className="text-sm text-muted-foreground">{alert.description}</p>
              </div>
            </div>
            <Badge variant={
              alert.severity === "critical" ? "destructive" :
              alert.severity === "high" ? "secondary" : "outline"
            }>
              {alert.severity}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default Alerts;
