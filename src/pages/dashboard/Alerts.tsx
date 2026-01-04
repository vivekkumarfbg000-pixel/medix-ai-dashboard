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
  // Fetch persistent notifications
  const [persistentAlerts, setPersistentAlerts] = useState<any[]>([]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setPersistentAlerts(data);
  };

  useEffect(() => {
    const fetchData = async () => {
      const [inventoryRes, remindersRes] = await Promise.all([
        supabase.from("inventory").select("id, medicine_name, quantity, expiry_date, reorder_level"),
        supabase.from("patient_reminders").select("*").order("reminder_date")
      ]);

      if (inventoryRes.data) setInventory(inventoryRes.data);
      if (remindersRes.data) setReminders(remindersRes.data);

      await fetchNotifications(); // Fetch persistent history
      setLoading(false);
    };

    fetchData();
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    fetchNotifications(); // Refresh
  };

  // ... existing calculation logic ...
  // Merging persistent alerts into the UI or creating a new tab

  // existing filter logic ...
  const historyAlerts = persistentAlerts.map(n => ({
    type: "history",
    title: n.title,
    description: n.message,
    severity: "info",
    date: new Date(n.created_at),
    is_read: n.is_read,
    id: n.id
  }));

  // ... Update Return JSX ...
  <TabsTrigger value="history" className="gap-2">
    <Clock className="w-4 h-4" />
    History ({persistentAlerts.length})
  </TabsTrigger>
        </TabsList >

  <TabsContent value="all">
    <AlertsList alerts={allAlerts} loading={loading} />
  </TabsContent>

{/* ... existing tabs ... */ }

<TabsContent value="history">
  <div className="space-y-3">
    {historyAlerts.map((alert, i) => (
      <Card key={i} className={`border-l-4 ${alert.is_read ? 'opacity-60' : 'border-primary'}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">{alert.title}</p>
            <p className="text-sm text-muted-foreground">{alert.description}</p>
            <p className="text-xs text-muted-foreground mt-1">{format(alert.date, "PP p")}</p>
          </div>
          {!alert.is_read && (
            <Button variant="outline" size="sm" onClick={() => markAsRead(alert.id)}>Mark Read</Button>
          )}
        </CardContent>
      </Card>
    ))}
    {historyAlerts.length === 0 && <p className="text-center text-muted-foreground py-10">No history found.</p>}
  </div>
</TabsContent>
      </Tabs >
    </div >
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
              <div className={`p-2 rounded-lg ${alert.severity === "critical" ? "bg-destructive/20" :
                alert.severity === "high" ? "bg-warning/20" :
                  alert.severity === "medium" ? "bg-muted" : "bg-info/20"
                }`}>
                {alert.type === "expiry" || alert.type === "expired" ? (
                  <Clock className={`w-5 h-5 ${alert.severity === "critical" ? "text-destructive" :
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
