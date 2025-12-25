import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings as SettingsIcon, Store, Bell, Shield, Save } from "lucide-react";

interface ShopData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

const Settings = () => {
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notifications, setNotifications] = useState({
    expiryAlerts: true,
    lowStockAlerts: true,
    orderNotifications: true,
    refillReminders: true
  });

  useEffect(() => {
    const fetchShop = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("shop_id")
        .single();

      if (profile?.shop_id) {
        const { data: shopData } = await supabase
          .from("shops")
          .select("*")
          .eq("id", profile.shop_id)
          .single();

        if (shopData) {
          setShop(shopData);
        }
      }
      setLoading(false);
    };

    fetchShop();
  }, []);

  const handleSaveShop = async () => {
    if (!shop) return;
    
    setSaving(true);
    const { error } = await supabase
      .from("shops")
      .update({
        name: shop.name,
        address: shop.address,
        phone: shop.phone
      })
      .eq("id", shop.id);

    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Settings saved successfully");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-32 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your shop and notification preferences
        </p>
      </div>

      {/* Shop Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Shop Details
          </CardTitle>
          <CardDescription>
            Update your medical shop information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shop-name">Shop Name</Label>
            <Input
              id="shop-name"
              value={shop?.name || ""}
              onChange={(e) => setShop(shop ? { ...shop, name: e.target.value } : null)}
              placeholder="Enter shop name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={shop?.address || ""}
              onChange={(e) => setShop(shop ? { ...shop, address: e.target.value } : null)}
              placeholder="Enter shop address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={shop?.phone || ""}
              onChange={(e) => setShop(shop ? { ...shop, phone: e.target.value } : null)}
              placeholder="Enter phone number"
            />
          </div>
          <Button onClick={handleSaveShop} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure which alerts you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Expiry Alerts</p>
              <p className="text-sm text-muted-foreground">
                Get notified when medicines are about to expire
              </p>
            </div>
            <Switch
              checked={notifications.expiryAlerts}
              onCheckedChange={(checked) => 
                setNotifications({ ...notifications, expiryAlerts: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Low Stock Alerts</p>
              <p className="text-sm text-muted-foreground">
                Get notified when stock falls below reorder level
              </p>
            </div>
            <Switch
              checked={notifications.lowStockAlerts}
              onCheckedChange={(checked) => 
                setNotifications({ ...notifications, lowStockAlerts: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Order Notifications</p>
              <p className="text-sm text-muted-foreground">
                Get notified for new WhatsApp orders
              </p>
            </div>
            <Switch
              checked={notifications.orderNotifications}
              onCheckedChange={(checked) => 
                setNotifications({ ...notifications, orderNotifications: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Refill Reminders</p>
              <p className="text-sm text-muted-foreground">
                Get reminded about patient refills
              </p>
            </div>
            <Switch
              checked={notifications.refillReminders}
              onCheckedChange={(checked) => 
                setNotifications({ ...notifications, refillReminders: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Security
          </CardTitle>
          <CardDescription>
            Manage your account security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline">Change Password</Button>
          <p className="text-sm text-muted-foreground">
            We recommend using a strong, unique password for your account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
