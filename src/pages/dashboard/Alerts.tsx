
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  Clock,
  Package,
  Users,
  CheckCircle,
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
  const [persistentAlerts, setPersistentAlerts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('shop_id')
        .eq('id', user.id)
        .single();

      if (!profile?.shop_id) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('shop_id', profile.shop_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPersistentAlerts(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setPersistentAlerts([]);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [inventoryRes, remindersRes] = await Promise.all([
        supabase.from("inventory").select("id, medicine_name, quantity, expiry_date, reorder_level"),
        supabase.from("patient_reminders").select("*").order("reminder_date")
      ]);

      if (inventoryRes.data) setInventory(inventoryRes.data as InventoryItem[]);
      if (remindersRes.data) setReminders(remindersRes.data as Reminder[]);

      await fetchNotifications();
      setLoading(false);
    };

    fetchData();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (error) throw error;
      await fetchNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Logic to generate alerts from inventory
  const generateAlerts = () => {
    const alerts: any[] = [];
    const today = new Date();

    // 1. Expiry Alerts
    inventory.forEach(item => {
      if (item.expiry_date) {
        const daysToExpiry = differenceInDays(new Date(item.expiry_date), today);
        if (daysToExpiry < 0) {
          alerts.push({
            type: "expired",
            title: "Expired Medicine",
            description: `${item.medicine_name} expired on ${format(new Date(item.expiry_date), 'PP')}`,
            severity: "critical",
            date: new Date()
          });
        } else if (daysToExpiry <= 30) {
          alerts.push({
            type: "expiry",
            title: "Expiring Soon",
            description: `${item.medicine_name} expires in ${daysToExpiry} days`,
            severity: "high",
            date: new Date()
          });
        }
      }

      // 2. Stock Alerts
      if (item.quantity <= item.reorder_level) {
        alerts.push({
          type: "stock",
          title: "Low Stock",
          description: `${item.medicine_name} is below reorder level (${item.quantity} left)`,
          severity: "high",
          date: new Date()
        });
      }
    });

    // 3. Reminder Alerts
    reminders.forEach(rem => {
      const due = new Date(rem.reminder_date);
      if (differenceInDays(due, today) <= 1 && rem.status === 'pending') {
        alerts.push({
          type: "reminder",
          title: "Patient Reminder",
          description: `Call ${rem.patient_name} for ${rem.medicine_name} refill`,
          severity: "medium",
          date: due
        });
      }
    });

    return alerts;
  };

  const generatedAlerts = generateAlerts();

  const historyAlerts = persistentAlerts.map(n => ({
    type: "history",
    title: n.title,
    description: n.message,
    severity: "info",
    date: new Date(n.created_at),
    is_read: n.is_read,
    id: n.id
  }));

  const allAlerts = [...generatedAlerts, ...historyAlerts.filter(h => !h.is_read)];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Alerts & Notifications</h2>
        <p className="text-muted-foreground">Monitor expired stock, low inventory, and patient reminders.</p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <Bell className="w-4 h-4" />
            Active ({allAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="w-4 h-4" />
            History ({persistentAlerts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <AlertsList alerts={allAlerts} loading={loading} />
        </TabsContent>

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
          <CheckCircle className="w-16 h-16 mx-auto text-green-500/50 mb-4" />
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
              alert.severity === "high" ? "border-amber-500/50 bg-amber-500/5" :
                alert.severity === "medium" ? "border-border" : "border-blue-500/50 bg-blue-500/5"
          }
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${alert.severity === "critical" ? "bg-destructive/20" :
                alert.severity === "high" ? "bg-amber-500/20" :
                  alert.severity === "medium" ? "bg-muted" : "bg-blue-500/20"
                }`}>
                {alert.type === "expiry" || alert.type === "expired" ? (
                  <Clock className={`w-5 h-5 ${alert.severity === "critical" ? "text-destructive" :
                    alert.severity === "high" ? "text-amber-500" : "text-muted-foreground"
                    }`} />
                ) : alert.type === "stock" ? (
                  <Package className="w-5 h-5 text-blue-500" />
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
