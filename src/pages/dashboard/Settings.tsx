import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Store,
  Bell,
  Shield,
  Save,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Smartphone,
  Mail,
  Building,
  MapPin,
  MapPin,
  Phone,
  FileText,
  Database,
  Download
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface ShopData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

interface ShopSettingsData {
  gstin: string;
  dl_number: string;
  invoice_footer_text: string;
  terms_and_conditions: string;
}

const Settings = () => {
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Notifications - In a real app, save to user_metadata or separate table
  const [notifications, setNotifications] = useState({
    expiryAlerts: true,
    lowStockAlerts: true,
    orderNotifications: true,
    refillReminders: true
  });

  const [shopSettings, setShopSettings] = useState<ShopSettingsData>({
    gstin: "",
    dl_number: "",
    invoice_footer_text: "",
    terms_and_conditions: ""
  });

  useEffect(() => {
    const fetchShop = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserEmail(user.email || "");

        // 1. Try to find shop via profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("shop_id")
          .eq('user_id', user.id)
          .maybeSingle();

        let currentShopId = profile?.shop_id;

        // 2. Fallback: Try to find shop via ownership if profile link is missing
        if (!currentShopId) {
          const { data: ownedShop } = await supabase.from('shops').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
          if (ownedShop) currentShopId = ownedShop.id;
        }

        if (currentShopId) {
          console.log("Found shop:", currentShopId);
          const { data: shopData, error: shopError } = await supabase
            .from("shops")
            .select("*")
            .eq("id", currentShopId)
            .single();

          if (shopError) {
            console.error("Shop fetch error:", shopError);
            // Don't throw, just allow creating a new one if this fails
          }
          if (shopData) setShop(shopData);

          // Fetch Settings
          const { data: settingsData } = await supabase
            .from("shop_settings")
            .select("*")
            .eq("shop_id", currentShopId)
            .maybeSingle();

          if (settingsData) {
            setShopSettings({
              gstin: settingsData.gstin || "",
              dl_number: settingsData.dl_number || "",
              invoice_footer_text: settingsData.invoice_footer_text || "",
              terms_and_conditions: settingsData.terms_and_conditions || ""
            });
          }
        } else {
          console.warn("No shop found. Initializing empty for creation.");
          // Initialize empty shop for creation flow
          setShop({ id: "", name: "", address: "", phone: "" });
        }
      } catch (e: any) {
        console.error("Error fetching shop details:", e);
        toast.error(`Load Error: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchShop();
  }, []);

  const handleSaveShop = async () => {
    if (!shop) return;
    setSaving(true);
    const toastId = toast.loading("Processing...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let activeShopId = shop.id;

      // SCENARIO 1: CREATE NEW SHOP
      if (!activeShopId) {
        toast.loading("Creating new shop...", { id: toastId });

        const { data: newShop, error: createError } = await supabase
          .from("shops")
          .insert({
            name: shop.name || "My Pharmacy",
            address: shop.address,
            phone: shop.phone,
            owner_id: user.id
          })
          .select()
          .single();

        if (createError) throw createError;
        if (!newShop) throw new Error("Failed to create shop");

        activeShopId = newShop.id;
        setShop(newShop); // Update local state

        // Link to Profile
        const { error: linkError } = await supabase
          .from("profiles")
          .upsert({
            user_id: user.id,
            shop_id: activeShopId,
            role: 'owner'
          });

        // Link to User Shops
        await supabase.from("user_shops").insert({
          user_id: user.id,
          shop_id: activeShopId,
          is_primary: true
        });

        if (linkError) console.error("Link Error:", linkError);

        toast.success("Shop Created Successfully!", { id: toastId });
        // Set local storage for immediate recover
        localStorage.setItem("currentShopId", activeShopId);

        // Force reload after short delay to sync all hooks
        setTimeout(() => window.location.reload(), 1500);
        return;
      }

      // SCENARIO 2: UPDATE EXISTING SHOP
      const { error: shopError } = await supabase
        .from("shops")
        .update({
          name: shop.name,
          address: shop.address,
          phone: shop.phone
        })
        .eq("id", activeShopId);

      if (shopError) throw shopError;

      // 2. Upsert Settings
      const { error: settingsError } = await supabase
        .from("shop_settings")
        .upsert({
          shop_id: activeShopId,
          gstin: shopSettings.gstin,
          dl_number: shopSettings.dl_number,
          invoice_footer_text: shopSettings.invoice_footer_text,
          terms_and_conditions: shopSettings.terms_and_conditions
        });

      if (settingsError) throw settingsError;

      toast.success("Settings updated successfully", { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to save: ${error.message}`, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    if (!shop) return;
    const toastId = toast.loading("Generating Backup...");

    try {
      const { data: inventory } = await supabase.from('inventory').select('*').eq('shop_id', shop.id);
      const { data: customers } = await supabase.from('customers').select('*').eq('shop_id', shop.id);
      const { data: orders } = await supabase.from('orders').select('*').eq('shop_id', shop.id).limit(1000); // Limit for safety

      const backupData = {
        timestamp: new Date().toISOString(),
        shop: { ...shop, settings: shopSettings },
        inventory,
        customers,
        orders,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medix_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Backup downloaded successfully");
    } catch (e) {
      toast.error("Backup failed");
    } finally {
      toast.dismiss(toastId);
    }
  };

  const updateShopField = (field: keyof ShopData, value: string) => {
    if (shop) setShop({ ...shop, [field]: value });
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      toast.success("Password updated!");
      setPasswordDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-6">
        <div className="h-48 bg-muted rounded-2xl animate-pulse" />
        <div className="h-64 bg-muted rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-5xl mx-auto">
      {/* Premium Header */}
      <div className="relative rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-8 shadow-xl overflow-hidden text-white">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <SettingsIcon className="w-8 h-8 text-slate-400" />
              Settings & Preferences
            </h1>
            <p className="text-slate-300 max-w-xl text-lg opacity-90">
              Manage your pharmacy profile, notifications, and improved security.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-sm font-medium">System Online</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Profile & Main Settings */}
        <div className="lg:col-span-2 space-y-6">

          {/* Shop Details Card */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Store className="w-5 h-5 text-indigo-600" />
                Pharmacy Profile
              </CardTitle>
              <CardDescription>Public information regarding your medical shop.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-slate-600 flex items-center gap-2"><Building className="w-4 h-4" /> Shop Name</Label>
                  <Input
                    value={shop?.name || ""}
                    onChange={(e) => updateShopField('name', e.target.value)}
                    className="bg-slate-50/50 border-slate-200 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-600 flex items-center gap-2"><Phone className="w-4 h-4" /> Contact Number</Label>
                  <Input
                    value={shop?.phone || ""}
                    onChange={(e) => updateShopField('phone', e.target.value)}
                    className="bg-slate-50/50 border-slate-200 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 flex items-center gap-2"><MapPin className="w-4 h-4" /> Address</Label>
                <Input
                  value={shop?.address || ""}
                  onChange={(e) => updateShopField('address', e.target.value)}
                  className="bg-slate-50/50 border-slate-200 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleSaveShop}
                  disabled={saving || !shop}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {shop?.id ? "Save Changes" : "Create & Link Shop"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Bell className="w-5 h-5 text-amber-500" />
                Alert Preferences
              </CardTitle>
              <CardDescription>Customize what you want to be notified about.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100">
              {[
                { id: 'expiryAlerts', label: 'Expiry Alerts', desc: 'Notify when medicines expire soon (60 days)', color: 'bg-red-100 text-red-600' },
                { id: 'lowStockAlerts', label: 'Low Stock Warnings', desc: 'Notify when inventory drops below reorder level', color: 'bg-amber-100 text-amber-600' },
                { id: 'orderNotifications', label: 'Order Updates', desc: 'Receive alerts for new digital parchas', color: 'bg-blue-100 text-blue-600' },
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between p-6 hover:bg-slate-50/50 transition-colors">
                  <div className="flex gap-4">
                    <div className={`p-2 rounded-lg ${item.color}`}>
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{item.label}</p>
                      <p className="text-sm text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={(notifications as any)[item.id]}
                    onCheckedChange={(c) => setNotifications(prev => ({ ...prev, [item.id]: c }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Invoice Customization */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <FileText className="w-5 h-5 text-indigo-600" />
                Invoice Customization
              </CardTitle>
              <CardDescription>Details that appear on your printed receipts.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-slate-600">GSTIN</Label>
                  <Input
                    value={shopSettings.gstin}
                    onChange={(e) => setShopSettings({ ...shopSettings, gstin: e.target.value })}
                    placeholder="e.g. 29AAAAA0000A1Z5"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-600">Drug License (DL) No.</Label>
                  <Input
                    value={shopSettings.dl_number}
                    onChange={(e) => setShopSettings({ ...shopSettings, dl_number: e.target.value })}
                    placeholder="e.g. KA-BNG-1234"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600">Terms & Conditions</Label>
                <Input
                  value={shopSettings.terms_and_conditions}
                  onChange={(e) => setShopSettings({ ...shopSettings, terms_and_conditions: e.target.value })}
                  placeholder="e.g. No returns after 7 days"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600">Footer Text</Label>
                <Input
                  value={shopSettings.invoice_footer_text}
                  onChange={(e) => setShopSettings({ ...shopSettings, invoice_footer_text: e.target.value })}
                  placeholder="e.g. Thank you for visiting!"
                />
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Database className="w-5 h-5 text-indigo-600" />
                Data Management
              </CardTitle>
              <CardDescription>Backup your data locally.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Button onClick={handleBackup} variant="outline" className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" /> Download Full Backup (JSON)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Security & Session */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm h-fit">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Shield className="w-5 h-5 text-emerald-600" />
                Security & Session
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-full text-emerald-600 shadow-sm">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-900">Current Session</p>
                      <p className="text-xs text-emerald-700">Active Device</p>
                    </div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs uppercase text-slate-400 font-bold tracking-wider">Account Email</Label>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <Mail className="w-4 h-4" /> {userEmail || "Loading..."}
                  </div>
                </div>
              </div>

              <Separator />

              <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full border-slate-200 hover:bg-slate-50">
                    Change Password
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Password</DialogTitle>
                    <DialogDescription>Enter a strong new password.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleChangePassword} disabled={changingPassword} className="w-full">
                      {changingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="destructive"
                className="w-full bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 shadow-none"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/auth";
                }}
              >
                <LogOut className="w-4 h-4 mr-2" /> Log Out
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default Settings;
