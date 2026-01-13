import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserShops } from "@/hooks/useUserShops";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Search, Package, AlertTriangle, Filter, Sparkles, Check, X, RefreshCw, Upload, Trash2, NotebookPen, TrendingUp } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface InventoryItem {
  id: string;
  medicine_name: string;
  generic_name: string | null;
  batch_number: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number | null;
  expiry_date: string | null;
  manufacturer: string | null;
  category: string | null;
  reorder_level: number;
  hsn_code?: string;
  sgst_rate?: number;
  cgst_rate?: number;
  igst_rate?: number;
  schedule_h1?: boolean;
  salt_composition?: string;
}

interface StagingItem {
  id: string;
  medicine_name: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity: number;
  unit_price: number;
  source: string;
  created_at: string;
  insights?: {
    velocity: 'Fast' | 'Slow' | 'Dead';
    classification: 'A' | 'B' | 'C';
    action: 'Reorder' | 'Return' | 'Discount' | 'None';
  };
}

const Inventory = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { currentShop } = useUserShops();
  const { canModify } = useUserRole(currentShop?.id);
  const [activeTab, setActiveTab] = useState("stock");

  const [newItem, setNewItem] = useState({
    medicine_name: "",
    generic_name: "",
    batch_number: "",
    quantity: 0,
    unit_price: 0,
    expiry_date: "",
    manufacturer: "",
    category: "",
    hsn_code: "",
    gst_rate: 0,
    salt_composition: ""
  });

  /* Debug Logging */
  const fetchInventory = async () => {
    // Only fetch if we have a shop selected (though RLS handles security, this is good for UX)
    if (!currentShop?.id) return;

    const { data, error } = await supabase
      .from("inventory")
      // @ts-ignore
      .select("*")
      .order("medicine_name");

    if (error) {
      console.error(error);
      toast.error("Failed to load inventory");
    } else {
      // @ts-ignore
      const validData = data || [];
      if (validData.length > 0) {
        console.log("Inventory Loaded:", validData.length, "items", validData[0]);
      }
      setInventory(validData);
    }
    setLoading(false);
  };

  const fetchStaging = async () => {
    if (!currentShop?.id) return;

    try {
      // @ts-ignore - Table exists in database
      const { data, error } = await supabase
        .from("inventory_staging")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        // Graceful fallback if table missing
        if (error.code === '42P01') {
          console.warn("inventory_staging table missing");
          return;
        }
        console.error("Error fetching drafts:", error);
      } else {
        // Mock Enrichment (ABC-VEN Analysis)
        // In production, this data would come from the N8N analysis engine directly
        const enrichedData = (data || []).map((item: any) => {
          // Simple logic: Price > 500 is Class A. Random Velocity.
          const isExpensive = item.unit_price > 500;
          const velocity = Math.random() > 0.5 ? 'Fast' : (Math.random() > 0.5 ? 'Slow' : 'Dead');
          let action = 'None';

          if (velocity === 'Dead' && isExpensive) action = 'Return';
          else if (velocity === 'Slow' && !isExpensive) action = 'Discount';
          else if (velocity === 'Fast') action = 'Reorder';

          return {
            ...item,
            insights: {
              classification: isExpensive ? 'A' : 'C',
              velocity: velocity,
              action: action
            }
          };
        });
        setStagingItems(enrichedData as StagingItem[]);
      }
    } catch (e) {
      console.error("Staging Fetch Error:", e);
    }
  };

  useEffect(() => {
    if (currentShop?.id) {
      fetchInventory();
      fetchStaging();
    }

    const channel = supabase
      .channel('inventory-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetchInventory)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_staging' }, fetchStaging)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentShop?.id]); // Re-fetch when shop changes

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return "safe";
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0) return "expired";
    if (days <= 60) return "danger";
    if (days <= 90) return "warning";
    return "safe";
  };

  const handleApproveDraft = async (item: StagingItem) => {
    if (!currentShop?.id) {
      toast.error("No Shop Selected. Please switch shops or reload.");
      return;
    }

    if (!item.medicine_name || !item.medicine_name.trim()) {
      toast.error("Cannot approve item with empty name.");
      return;
    }

    // 1. Move to Main Inventory
    const { error: insertError } = await supabase.from("inventory").insert({
      shop_id: currentShop.id, // reliable shop_id
      medicine_name: item.medicine_name,
      batch_number: item.batch_number,
      quantity: item.quantity,
      unit_price: item.unit_price,
      expiry_date: item.expiry_date,
      source: 'ai_scan'
    } as any);

    if (insertError) {
      toast.error("Failed to approve item: " + insertError.message);
      console.error(insertError);
      return;
    }

    // 2. Mark as Approved in Staging
    // @ts-ignore - Table exists in database
    await supabase.from("inventory_staging").update({ status: 'approved' }).eq('id', item.id);

    toast.success(`Approved ${item.medicine_name}`);
    fetchStaging();
    fetchInventory();
  };

  const handleRejectDraft = async (id: string) => {
    // @ts-ignore - Table exists in database
    await supabase.from("inventory_staging").update({ status: 'rejected' }).eq('id', id);
    toast.info("Draft rejected");
    fetchStaging();
  };

  const handleAddItem = async () => {
    if (!currentShop?.id) {
      toast.error("No Shop Selected. Please reload.");
      return;
    }

    if (!newItem.medicine_name.trim()) {
      toast.error("Medicine name is required");
      return;
    }

    // --- "Satya-Check" (Compliance Shield) ---
    const toastId = toast.loading("Satya-Check: Verifying compliance with CDSCO...");

    let complianceResult = { is_banned: false, is_h1: false, reason: "", warning_level: "SAFE" };
    try {
      const checkQuery = newItem.generic_name || newItem.medicine_name;
      // @ts-ignore
      complianceResult = await import("@/services/aiService").then(m => m.aiService.checkCompliance(checkQuery));
    } catch (e) {
      console.warn("Compliance check offline, proceeding with caution.");
    }

    toast.dismiss(toastId);

    if (complianceResult.is_banned) {
      toast.error(`BLOCKED: ${newItem.medicine_name} is a BANNED DRUG!`, {
        description: complianceResult.reason || "CDSCO Regulatory Ban detected.",
        duration: 5000,
      });
      return;
    }

    if (complianceResult.is_h1 && !newItem.medicine_name.toLowerCase().includes('h1')) {
      toast.info("Note: This is a Schedule H1 Drug", {
        description: "It has been auto-tagged for the Compliance Register."
      });
    }

    const { error } = await supabase.from("inventory").insert({
      shop_id: currentShop.id, // reliable shop_id
      medicine_name: newItem.medicine_name,
      generic_name: newItem.generic_name,
      batch_number: newItem.batch_number,
      quantity: newItem.quantity,
      unit_price: newItem.unit_price,
      expiry_date: newItem.expiry_date || null,
      manufacturer: newItem.manufacturer,
      category: newItem.category,
      schedule_h1: complianceResult.is_h1
    } as any);

    if (error) {
      toast.error("Failed to add item: " + error.message);
      console.error(error);
    } else {
      toast.success("Item added successfully");
      setIsAddDialogOpen(false);
      setNewItem({
        medicine_name: "", generic_name: "", batch_number: "", quantity: 0, unit_price: 0,
        expiry_date: "", manufacturer: "", category: "", hsn_code: "", gst_rate: 0, salt_composition: ""
      });
      fetchInventory();
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.generic_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* New State for Stock Adjustment */
  const [adjustmentDialog, setAdjustmentDialog] = useState<{
    isOpen: boolean;
    item: InventoryItem | null;
    type: 'IN' | 'OUT';
  }>({ isOpen: false, item: null, type: 'IN' });

  const [adjustmentForm, setAdjustmentForm] = useState({ quantity: 1, reason: "" });

  const handleOpenAdjustment = (item: InventoryItem, type: 'IN' | 'OUT') => {
    setAdjustmentDialog({ isOpen: true, item, type });
    setAdjustmentForm({ quantity: 1, reason: "" });
  };

  const handleExecuteAdjustment = async () => {
    if (!adjustmentDialog.item) return;

    const qtyChange = adjustmentDialog.type === 'IN' ? adjustmentForm.quantity : -adjustmentForm.quantity;
    const reason = adjustmentForm.reason || (adjustmentDialog.type === 'IN' ? "Restock" : "Manual Deduction");

    const toastId = toast.loading("Updating Stock...");

    // @ts-ignore
    const { data, error } = await supabase.rpc('adjust_inventory_stock', {
      p_inventory_id: adjustmentDialog.item.id,
      p_quantity_change: qtyChange,
      p_movement_type: adjustmentDialog.type,
      p_reason: reason
    });

    toast.dismiss(toastId);

    if (error) {
      console.error(error);
      toast.error("Failed to update stock: " + error.message);
    } else {
      // @ts-ignore
      if (data && data.success) {
        toast.success(`Stock updated! New Qty: ${data.new_quantity}`);
        fetchInventory();
        setAdjustmentDialog({ ...adjustmentDialog, isOpen: false });
      } else {
        // @ts-ignore
        toast.error(data?.error || "Update failed");
      }
    }
  };

  const handleAddToShortbook = async (item: InventoryItem) => {
    if (!currentShop?.id) return;
    const { error } = await supabase.from('shortbook_items').insert({
      shop_id: currentShop.id,
      medicine_name: item.medicine_name,
      quantity_needed: "10 strips", // Default suggestion
      priority: 'normal'
    });

    if (error) toast.error("Failed to add to Shortbook");
    else toast.success(`Added ${item.medicine_name} to Shortbook`);
  };

  /* Delete Functionality */
  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name || "this item"}?`)) return;

    const { error } = await supabase.from("inventory").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete item");
      console.error(error);
    } else {
      toast.success("Item deleted");
      fetchInventory();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ... Headers ... */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Manage stocks, handle AI drafts, and track expiry.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="stock" className="gap-2">
            <Package className="w-4 h-4" /> Live Stock
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-2 relative">
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI Drafts
            {stagingItems.length > 0 && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span></span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <Card className="flex-1 w-full">
              <CardContent className="p-4 flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search medicine..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={fetchInventory}><RefreshCw className="w-4 h-4" /></Button>
              </CardContent>
            </Card>

            {canModify && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="shadow-lg"><Plus className="w-4 h-4 mr-2" /> Add Manual</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Medicine</DialogTitle>
                    <DialogDescription>Enter details manually.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Medicine Name</Label>
                        <Input value={newItem.medicine_name} onChange={(e) => setNewItem({ ...newItem, medicine_name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input type="number" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>MRP</Label>
                      <Input type="number" step="0.01" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button><Button onClick={handleAddItem}>Save</Button></div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Medicine Stock</CardTitle>
              <CardDescription>{filteredInventory.length} items found</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredInventory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No medicines found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredInventory.map((item) => {
                    const status = getExpiryStatus(item.expiry_date);
                    return (
                      <div key={item.id} className="medical-card group relative hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className={`font-semibold text-lg ${!item.medicine_name ? 'text-red-500' : ''}`}>
                                {item.medicine_name || "Unknown Item (Data Error)"}
                              </h3>
                              <p className="text-xs text-muted-foreground">{item.batch_number || "No Batch"}</p>
                            </div>
                            <Badge variant={item.quantity < 10 ? "destructive" : "secondary"}>{item.quantity} units</Badge>
                          </div>
                          <div className="flex justify-between items-center text-sm mb-4">
                            <span className="font-bold">₹{item.unit_price}</span>
                            <Badge variant={status === 'expired' ? 'destructive' : 'outline'} className="text-[10px]">{status === 'safe' ? 'Safe' : 'Check Expiry'}</Badge>
                          </div>
                        </div>

                        {/* Stock Actions */}
                        {canModify && (
                          <div className="flex gap-2 mt-auto pt-3 border-t items-center">
                            <Button variant="outline" size="sm" className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 h-8" onClick={() => handleOpenAdjustment(item, 'IN')}>
                              <Plus className="w-3 h-3 mr-1" /> Stock In
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 h-8" onClick={() => handleOpenAdjustment(item, 'OUT')}>
                              <X className="w-3 h-3 mr-1" /> Out
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8" onClick={() => handleAddToShortbook(item)}>
                              <NotebookPen className="w-3 h-3 mr-1" /> Note
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => handleDeleteItem(item.id, item.medicine_name)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ... Drafts Tab Content ... */}
        <TabsContent value="drafts" className="space-y-4">
          <Card className="border-purple-200 bg-purple-50/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-full bg-purple-100 text-purple-600"><Sparkles className="w-6 h-6" /></div>
                <div>
                  <h3 className="font-bold text-lg text-purple-900">AI Drafts</h3>
                  <p className="text-sm text-purple-700">Items identified by Gemini Vision. Review before adding to stock.</p>
                </div>
              </div>

              {/* Upload Section */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                  <div>
                    <h3 className="font-semibold text-lg">Upload Invoice / Medicine Strip</h3>
                    <p className="text-sm text-muted-foreground">Upload an image to auto-detect items (Batch & Expiry).</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="inventory-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        e.target.value = '';
                        const toastId = toast.loading("Uploading to AI Vision Engine...");
                        try {
                          const base64 = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                              const result = reader.result as string;
                              const b64 = result.includes(',') ? result.split(',')[1] : result;
                              resolve(b64);
                            };
                            reader.onerror = (error) => reject(error);
                            reader.readAsDataURL(file);
                          });

                          // @ts-ignore
                          const { aiService } = await import("@/services/aiService");
                          await aiService.analyzeDocument(file, 'inventory_list');
                          toast.success("Scan Complete! Drafts created.");
                          fetchStaging();
                        } catch (err: any) {
                          console.error("Scan Error:", err);
                          toast.error(err.message || "Scan Failed. Check N8N connection.");
                        } finally {
                          toast.dismiss(toastId);
                        }
                      }}
                    />
                    <Button onClick={() => document.getElementById('inventory-upload')?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Upload Scan
                    </Button>
                  </div>
                </div>

                {stagingItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground/60 border-2 border-dashed border-purple-200 rounded-lg">
                    No pending drafts. Upload an image above to start.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {stagingItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-lg">{item.medicine_name}</h4>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Package className="w-3 h-3" /> Qty: {item.quantity}</span>
                            <span>MRP: ₹{item.unit_price}</span>
                            {item.expiry_date && <span>Exp: {item.expiry_date}</span>}
                          </div>
                          {item.insights && (
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline" className={item.insights.classification === 'A' ? 'border-red-500 text-red-600' : 'border-slate-400'}>
                                Class {item.insights.classification}
                              </Badge>
                              <Badge variant="secondary" className={
                                item.insights.velocity === 'Fast' ? 'bg-green-100 text-green-700' :
                                  item.insights.velocity === 'Dead' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                              }>
                                {item.insights.velocity} Mover
                              </Badge>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {/* AI Action Buttons */}
                          {item.insights?.action === 'Return' && (
                            <Button size="sm" variant="outline" className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100">
                              <Trash2 className="w-3 h-3 mr-1" /> Return to Vendor
                            </Button>
                          )}
                          {item.insights?.action === 'Discount' && (
                            <Button size="sm" variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100">
                              <TrendingUp className="w-3 h-3 mr-1" /> Apply 10% Off
                            </Button>
                          )}

                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleRejectDraft(item.id)}>
                            <X className="w-4 h-4 mr-1" /> Reject
                          </Button>
                          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => handleApproveDraft(item)}>
                            <Check className="w-4 h-4 mr-1" /> Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Stock Adjustment Dialog */}
      <Dialog open={adjustmentDialog.isOpen} onOpenChange={(open) => setAdjustmentDialog({ ...adjustmentDialog, isOpen: open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{adjustmentDialog.type === 'IN' ? 'Stock In (Restock)' : 'Stock Out (Deduction)'}</DialogTitle>
            <DialogDescription>
              Adjusting stock for: <strong>{adjustmentDialog.item?.medicine_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={adjustmentForm.quantity}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity: Math.abs(parseInt(e.target.value)) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Input
                placeholder={adjustmentDialog.type === 'IN' ? "e.g., Vendor Delivery" : "e.g., Damaged, Expired"}
                value={adjustmentForm.reason}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setAdjustmentDialog({ ...adjustmentDialog, isOpen: false })}>Cancel</Button>
            <Button
              variant={adjustmentDialog.type === 'IN' ? 'default' : 'destructive'}
              onClick={handleExecuteAdjustment}
            >
              Confirm {adjustmentDialog.type === 'IN' ? 'Restock' : 'Deduction'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;
