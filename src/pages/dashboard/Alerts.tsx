import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Clock, Package, Users, CheckCircle, ArrowRight } from "lucide-react";
import { format, differenceInDays, parseISO, isValid } from "date-fns";
import { useNavigate } from "react-router-dom";

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
  patient_phone?: string; // Enhanced
}

import { useUserShops } from "@/hooks/useUserShops";
import { whatsappService } from "@/services/whatsappService"; // Import

const Alerts = () => {
  const { currentShop } = useUserShops();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentShop?.id) return;
      setLoading(true);

      const { data: inventoryData } = await supabase.from("inventory").select("id, medicine_name, quantity, expiry_date, reorder_level").eq("shop_id", currentShop?.id);

      // Fetch Reminders
      const { data: reminderData } = await supabase.from("patient_reminders").select("*").eq("shop_id", currentShop?.id).order("reminder_date");

      // Ideally we should join with users/customers to get phone numbers if not in reminder table
      // Assuming for now simple fetch, but let's try to map phone if available in customer table
      // Optimization: Fetch customers matching names (Simple approach for MVP)
      let enhancedReminders: Reminder[] = (reminderData as Reminder[]) || [];

      if (enhancedReminders.length > 0) {
        const names = enhancedReminders.map(r => r.patient_name);
        const { data: customers } = await supabase.from('customers').select('name, phone').in('name', names).eq('shop_id', currentShop?.id);

        if (customers) {
          enhancedReminders = enhancedReminders.map(r => ({
            ...r,
            patient_phone: customers.find(c => c.name === r.patient_name)?.phone
          }));
        }
      }

      if (inventoryData) setInventory(inventoryData as InventoryItem[]);
      setReminders(enhancedReminders);

      setLoading(false);
    };

    fetchData();
  }, [currentShop?.id]);

  const generateAlerts = () => {
    const alerts: any[] = [];
    const today = new Date();

    inventory.forEach(item => {
      // Robust Date Parsing
      if (item.expiry_date) {
        try {
          const expiryTime = parseISO(item.expiry_date);
          if (!isValid(expiryTime)) return; // Use return to skip this item if date is invalid

          const daysToExpiry = differenceInDays(expiryTime, today);

          if (daysToExpiry < 0) { // Already expired
            alerts.push({
              id: `exp-${item.id}`,
              type: 'expiry',
              title: "Expired Medicine", // Retaining original title for consistency
              description: `${item.medicine_name} expired on ${format(expiryTime, 'PP')}`,
              severity: "critical",
              date: new Date()
            });
          } else if (daysToExpiry <= 90) { // Extended to 90 days for better visibility
            alerts.push({
              type: "expiry",
              title: "Expiring Soon",
              description: `${item.medicine_name} expires in ${daysToExpiry} days`,
              severity: daysToExpiry < 30 ? "high" : "medium",
              date: new Date()
            });
          }
        } catch (e) {
          // Skip invalid date
        }
      }

      if (item.quantity <= (item.reorder_level || 10)) { // Default reorder level if missing
        alerts.push({
          type: "stock",
          title: "Low Stock",
          description: `${item.medicine_name} is below reorder level (${item.quantity} left)`,
          severity: "high",
          date: new Date()
        });
      }
    });

    reminders.forEach(rem => {
      const due = new Date(rem.reminder_date);
      if (differenceInDays(due, today) <= 3 && rem.status === 'pending') { // 3 Day lookahead
        alerts.push({
          type: "reminder",
          title: "Patient Reminder",
          description: `Call ${rem.patient_name} for ${rem.medicine_name} refill`,
          severity: "medium",
          date: due,
          data: rem // Pass full object for action
        });
      }
    });

    return alerts;
  };

  const generatedAlerts = generateAlerts();

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
            Active ({generatedAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="w-4 h-4" />
            History (0)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <AlertsList alerts={generatedAlerts} loading={loading} />
        </TabsContent>

        <TabsContent value="history">
          <div className="text-center text-muted-foreground py-10">No history found.</div>
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
  const navigate = useNavigate(); // Needs import from react-router-dom

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

            {alert.type === 'reminder' ? (
              <Button
                size="sm"
                className="h-6 text-xs bg-[#25D366] hover:bg-[#128C7E] text-white border-0"
                onClick={() => {
                  // WhatsApp Logic
                  if (alert.data && alert.data.patient_phone) {
                    const link = whatsappService.generateRefillReminder(alert.data.patient_phone, {
                      patient_name: alert.data.patient_name,
                      medicine_name: alert.data.medicine_name
                    });
                    window.open(link, '_blank');
                  } else {
                    // Fallback if no phone
                    alert('No phone number linking found for this patient.');
                  }
                }}
              >
                Reminder <Users className="w-3 h-3 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs bg-background hover:bg-slate-100"
                onClick={() => {
                  if (alert.type === "stock") navigate("/dashboard/shortbook");
                  else if (alert.type === "expiry" || alert.type === "expired") navigate("/dashboard/inventory?filter=expiring");
                  else navigate("/dashboard/customers");
                }}
              >
                Resolve <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card >
      ))}
    </div >
  );
};

export default Alerts;
