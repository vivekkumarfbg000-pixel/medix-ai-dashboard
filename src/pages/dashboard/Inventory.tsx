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
import { AddMedicineDialog } from "@/components/dashboard/inventory/AddMedicineDialog";
import { StockAdjustmentDialog } from "@/components/dashboard/inventory/StockAdjustmentDialog";
import { InventoryDrafts } from "@/components/dashboard/inventory/InventoryDrafts";
import { aiService } from "@/services/aiService";
import { logger } from "@/utils/logger";
import { format, differenceInDays } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText as FileTextIcon, History } from "lucide-react";
import AuditLogs from "@/pages/dashboard/AuditLogs";

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
  rack_number?: string;
  shelf_number?: string;
  gst_rate?: number;
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
  // stagingItems removed
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { currentShop } = useUserShops();
  const { canModify } = useUserRole(currentShop?.id);
  const [activeTab, setActiveTab] = useState("stock");

  /* Add Item State */
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  /* Debug Logging */
  /* Debug Logging */
  const fetchInventory = async () => {
    if (!currentShop?.id) {
      console.warn("fetchInventory: No shop ID");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("inventory")
        // @ts-ignore
        .select("*")
        .eq("shop_id", currentShop.id) // EXPLICIT FILTER
        .order("medicine_name");

      if (error) {
        console.error("fetchInventory Error:", error);
        toast.error("Failed to load inventory: " + error.message);
      } else {
        // @ts-ignore
        setInventory(data || []);
      }
    } catch (e) {
      console.error("fetchInventory Exception:", e);
    } finally {
      setLoading(false);
    }
  };

  // fetchStaging removed

  useEffect(() => {
    if (currentShop?.id) {
      setLoading(true);
      fetchInventory();
    } else {
      setLoading(false);
    }

    const channel = supabase
      .channel('inventory-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetchInventory)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentShop?.id]);

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return "safe";
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0) return "expired";
    if (days <= 60) return "danger";
    if (days <= 90) return "warning";
    return "safe";
  };

  // handleApproveDraft and handleRejectDraft removed

  /* Expiry Filter Logic */
  const [searchParams] = useSearchParams();
  const filterType = searchParams.get("filter");
  const isExpiryFilter = filterType === "expiring";

  /* Bulk Actions State */
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");

  const filteredInventory = inventory.filter(item => {
    // 1. Text Search
    const matchesSearch = item.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.generic_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Expiry Filter (90 Days)
    if (isExpiryFilter) {
      if (!item.expiry_date) return false;
      const days = differenceInDays(new Date(item.expiry_date), new Date());
      return days < 90 && matchesSearch;
    }

    return matchesSearch;
  });

  const handleSelectToggle = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleCreateReturnNote = async () => {
    if (!supplierName) {
      toast.error("Please enter a Supplier Name for the text note.");
      return;
    }

    const itemsToReturn = inventory.filter(i => selectedItems.includes(i.id));
    const totalValue = itemsToReturn.reduce((acc, i) => acc + (i.quantity * (i.cost_price || i.unit_price * 0.7)), 0); // Est cost

    // 1. Create Return Header
    // @ts-ignore
    const { data: returnData, error: headerError } = await supabase.from('purchase_returns').insert({
      shop_id: currentShop?.id,
      supplier_name: supplierName,
      total_estimated_value: totalValue,
      status: 'draft'
    }).select().single();

    if (headerError) {
      toast.error("Failed to create Return Note");
      console.error(headerError);
      return;
    }

    // 2. Create Items
    const returnItems = itemsToReturn.map(i => ({
      return_id: returnData.id,
      inventory_id: i.id,
      medicine_name: i.medicine_name,
      batch_number: i.batch_number,
      quantity: i.quantity,
      reason: 'expired'
    }));

    // @ts-ignore
    const { error: itemsError } = await supabase.from('purchase_return_items').insert(returnItems);

    if (itemsError) {
      toast.error("Failed to add items to Note");
    } else {
      toast.success("Return Note Created!");
      setIsReturnDialogOpen(false);
      setIsSelectMode(false);
      setSelectedItems([]);
      // Ideally redirect to "Purchases -> Returns" tab, but for now just show success
    }
  };

  /* New State for Stock Adjustment */
  const [adjustmentDialog, setAdjustmentDialog] = useState<{
    isOpen: boolean;
    item: InventoryItem | null;
    type: 'IN' | 'OUT';
  }>({ isOpen: false, item: null, type: 'IN' });

  // adjustmentForm and handleExecuteAdjustment removed

  const handleAddToShortbook = async (item: InventoryItem) => {
    if (!currentShop?.id) return;
    const { error } = await supabase.from('shortbook_items' as any).insert({
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
      toast.error("Failed to add item: " + error.message);
      logger.error(error);
    } else {
      toast.success("Item deleted");
      fetchInventory();
    }
  };

  // ... imports
  // ... imports


  // ... inside Inventory component

  // Feature: Barcode Scanning
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  useEffect(() => {
    // Hidden global listener for handheld scanners
    const handleKeyPress = (e: KeyboardEvent) => {
      // Most scanners act as keyboards sending text + Enter
      if (e.target instanceof HTMLInputElement) return; // Ignore if typing in an input

      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 3) {
          // console.log("Scanned:", barcodeBuffer);
          setSearchQuery(barcodeBuffer); // Simple search for now
          toast.info(`Scanned Code: ${barcodeBuffer}`);
        }
        setBarcodeBuffer("");
      } else {
        setBarcodeBuffer(prev => prev + e.key);
      }
    };
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [barcodeBuffer]);

  // Feature: Bulk CSV Upload
  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentShop?.id) {
      toast.error("No Shop Selected");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      let toastId: string | number | undefined;
      try {
        const text = event.target?.result as string;
        if (!text) {
          toast.error("Empty file");
          return;
        }

        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
          toast.error("Invalid CSV format: Header missing or empty");
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const rows = lines.slice(1);


        let successCount = 0;
        let errorCount = 0;

        const chunks = [];
        const CHUNK_SIZE = 100;

        // Parse Logic
        const parsedData = rows.map(line => {
          // Handle quotes if needed, but for simple usage simple split is okay for now
          // For robust parsing without lib, we assume standard CSV without comma in values for now
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row: any = {};
          headers.forEach((h, i) => {
            row[h] = values[i];
          });
          return row;
        });

        for (let i = 0; i < parsedData.length; i += CHUNK_SIZE) {
          chunks.push(parsedData.slice(i, i + CHUNK_SIZE));
        }

        toastId = toast.loading(`Preparing to import ${rows.length} items...`);
        const timeoutPromise = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), ms));

        // Track progress
        let completedChunks = 0;

        for (const chunk of chunks) {
          completedChunks++;
          toast.loading(`Importing batch ${completedChunks}/${chunks.length} (${Math.round((completedChunks / chunks.length) * 100)}%)...`, { id: toastId });

          const formattedData = chunk.map((row: any) => {
            // Map common CSV headers to DB columns
            const name = row['medicine name'] || row['name'] || row['medicine'] || 'Unknown';
            const quantity = parseInt(row['qty'] || row['quantity'] || row['stock'] || '0');
            const price = parseFloat(row['mrp'] || row['price'] || row['unit price'] || '0');

            return {
              shop_id: currentShop.id,
              medicine_name: name,
              batch_number: row['batch'] || row['batch number'] || null,
              quantity: isNaN(quantity) ? 0 : quantity,
              unit_price: isNaN(price) ? 0 : price,
              expiry_date: row['expiry'] || row['expiry date'] || null,
              barcode: row['barcode'] || null,
              manufacturer: row['manufacturer'] || null,
              rack_number: row['rack'] || row['rack no'] || null,
              shelf_number: row['shelf'] || row['shelf no'] || null,
              gst_rate: parseFloat(row['gst'] || row['gst rate'] || '0'),
              hsn_code: row['hsn'] || row['hsn code'] || null,
              source: 'bulk_csv'
            };
          }).filter((item: any) => item.medicine_name !== 'Unknown');

          if (formattedData.length === 0) continue;

          try {
            // @ts-ignore
            const { error } = await Promise.race([
              supabase.from('inventory').insert(formattedData),
              timeoutPromise(20000) // 20s timeout per chunk
            ]) as any;

            if (error) {
              console.error("Bulk Insert Error:", error);
              errorCount += chunk.length;
              toast.error(`Batch ${completedChunks} failed: ${error.message} (Check Console)`);
            } else {
              successCount += chunk.length;
            }
          } catch (err: any) {
            console.error("Bulk Insert Exception:", err);
            errorCount += chunk.length;
            toast.error(`Chunk error: ${err.message}`);
          }
        }

        if (successCount > 0) {
          toast.success(`Complete! Imported ${successCount} medicines.`, { id: toastId });
        } else if (errorCount > 0) {
          toast.warning(`Import finished with ${errorCount} errors. Check console.`, { id: toastId });
        } else {
          toast.dismiss(toastId);
        }

        // Allow UI to update before fetching large inventory
        setTimeout(() => {
          fetchInventory();
        }, 500);

      } catch (err: any) {
        console.error("CSV Import Error:", err);
        toast.error("Failed to parse CSV: " + err.message, { id: toastId });
      }
    };
    reader.readAsText(file);

    e.target.value = ''; // Reset input
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Stock...</p>
        </div>
      </div>
    );
  }

  if (!currentShop?.id) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <Package className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Shop Selected</h2>
        <p className="text-muted-foreground">Please select or create a shop in Settings.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry Connection</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ... Headers ... */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            {isExpiryFilter ? "⚠️ Expiry Management" : "Inventory Management"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isExpiryFilter ? "Identify and return near-expiry stock (90 Days Monitor)" : "Manage stocks, handle AI drafts, and track expiry."}
          </p>
        </div>

        {/* Bulk Actions Toolbar */}
        <div className="flex gap-2 items-center">
          {/* Default Actions */}
          {!isSelectMode && !isExpiryFilter && (
            <>
              <Button variant="outline" className="border-dashed" onClick={() => document.getElementById('csv-upload')?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Import CSV
              </Button>
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleBulkUpload}
              />
            </>
          )}

          {/* Expiry Actions */}
          {(isExpiryFilter || isSelectMode) && (
            <div className="flex gap-2 animate-in fade-in slide-in-from-right-5">
              {selectedItems.length > 0 ? (
                <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="shadow-lg animate-pulse">
                      <FileTextIcon className="w-4 h-4 mr-2" />
                      Return {selectedItems.length} Items
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Return Note</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Supplier Name</Label>
                        <Input placeholder="Example: Mahaveer Pharma" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
                      </div>
                      <div className="p-4 bg-slate-50 rounded border text-sm text-muted-foreground">
                        Generating a Return Note will create a formal record for {selectedItems.length} items.
                        You can then print/share this with the supplier.
                      </div>
                      <Button className="w-full" onClick={handleCreateReturnNote}>Generate Return Note</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button variant={isSelectMode ? "secondary" : "outline"} onClick={() => setIsSelectMode(!isSelectMode)}>
                  {isSelectMode ? "Cancel Selection" : "Select Multiple"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger value="stock" className="gap-2 py-2">
            <Package className="w-4 h-4" /> Live Stock
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-2 relative py-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI Drafts
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2 py-2">
            <History className="w-4 h-4" /> Audit Logs
          </TabsTrigger>
        </TabsList>
        <TabsContent value="audit" className="space-y-6">
          <AuditLogs embedded={true} />
        </TabsContent>

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
              <>
                <Button size="lg" className="shadow-lg" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Add Manual
                </Button>
                <AddMedicineDialog
                  open={isAddDialogOpen}
                  onOpenChange={setIsAddDialogOpen}
                  onSuccess={fetchInventory}
                />
              </>
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
                      <div key={item.id} className={`medical-card group relative hover:shadow-xl transition-all duration-300 flex flex-col justify-between ${selectedItems.includes(item.id) ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex gap-2 items-start">
                              {isSelectMode && (
                                <Checkbox
                                  checked={selectedItems.includes(item.id)}
                                  onCheckedChange={() => handleSelectToggle(item.id)}
                                />
                              )}
                              <div>
                                <h3 className={`font-semibold text-lg ${!item.medicine_name ? 'text-red-500' : ''}`}>
                                  {item.medicine_name || "Unknown Item (Data Error)"}
                                </h3>
                                <p className="text-xs text-muted-foreground font-mono">{item.batch_number || "No Batch"}</p>
                              </div>
                            </div>
                            <Badge variant={item.quantity < 10 ? "destructive" : "secondary"}>{item.quantity} units</Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3 bg-slate-50 p-2 rounded">
                            <div title="Location">📍 {item.rack_number ? `${item.rack_number}-${item.shelf_number || ''}` : 'No Loc'}</div>
                            <div title="Tax">🧾 GST: {item.gst_rate}%</div>
                          </div>

                          <div className="flex justify-between items-center text-sm mb-4">
                            <span className="font-bold text-base">₹{item.unit_price}</span>
                            <Badge variant={status === 'expired' ? 'destructive' : 'outline'} className="text-[10px]">{status === 'safe' ? `Exp: ${item.expiry_date}` : 'Check Expiry'}</Badge>
                          </div>
                        </div>

                        {/* Stock Actions */}
                        {canModify && (
                          <div className="flex gap-2 mt-auto pt-3 border-t items-center">
                            <Button variant="outline" size="sm" className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 h-8" onClick={() => setAdjustmentDialog({ isOpen: true, item, type: 'IN' })}>
                              <Plus className="w-3 h-3 mr-1" /> Stock In
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 h-8" onClick={() => setAdjustmentDialog({ isOpen: true, item, type: 'OUT' })}>
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
          <InventoryDrafts
            shopId={currentShop?.id || ""}
            onRefreshRequest={fetchInventory}
          />
        </TabsContent>
      </Tabs>

      {/* Stock Adjustment Dialog */}
      <StockAdjustmentDialog
        open={adjustmentDialog.isOpen}
        onOpenChange={(open) => setAdjustmentDialog({ ...adjustmentDialog, isOpen: open })}
        item={adjustmentDialog.item}
        mode={adjustmentDialog.type}
        onSuccess={fetchInventory}
      />
    </div >
  );
};

export default Inventory;
