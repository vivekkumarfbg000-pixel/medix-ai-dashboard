import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserShops } from "@/hooks/useUserShops";
import { useDemandForecast } from "@/hooks/useDemandForecast";
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
import { FileText as FileTextIcon, History, Scan } from "lucide-react";
import AuditLogs from "@/pages/dashboard/AuditLogs";
import { StockAudit } from "@/components/dashboard/inventory/StockAudit";
import { pdfService } from "@/services/pdfService";
import { whatsappService } from "@/services/whatsappService";

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

  // AI Forecast Hook
  const { predictions } = useDemandForecast(currentShop?.id);

  /* Add Item State */
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  /* Debug Logging */
  /* Debug Logging */
  const fetchInventory = async () => {
    // Robust ID Check
    const activeShopId = currentShop?.id || localStorage.getItem("currentShopId");

    if (!activeShopId) {
      console.warn("fetchInventory: No shop ID found (Context or LocalStorage)");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq('shop_id', activeShopId) // Use the robust ID
        .order("medicine_name", { ascending: true });


      if (error) {
        console.error("fetchInventory Error:", error);
        toast.error("Failed to load inventory: " + error.message);
      } else {
        // Safe cast with fallback for missing fields
        const safeData = (data || []).map((item: any) => ({
          ...item,
          // Ensure critical fields exist to prevent render crashes
          medicine_name: item.medicine_name || "Unknown Item",
          quantity: item.quantity ?? 0,
          unit_price: item.unit_price ?? 0
        })) as InventoryItem[];
        setInventory(safeData);
      }
    } catch (e) {
      console.error("fetchInventory Exception:", e);
      toast.error("Critical Error loading inventory");
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
      // 3. Generate PDF
      try {
        pdfService.generateReturnNote(
          { name: currentShop?.name || "My Pharmacy" },
          supplierName,
          itemsToReturn
        );
      } catch (e) { console.error("PDF Gen Failed", e); }

      // 4. Success & WhatsApp Prompt
      toast.success("Return Note Created & PDF Downloaded!", {
        action: {
          label: "Share on WhatsApp",
          onClick: () => {
            const link = whatsappService.generateReturnMessage(null, {
              shop_name: currentShop?.name,
              supplier_name: supplierName,
              item_count: itemsToReturn.length
            });
            window.open(link, '_blank');
          }
        },
        duration: 6000
      });

      setIsReturnDialogOpen(false);
      setIsSelectMode(false);
      setSelectedItems([]);
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
        let consecutiveErrors = 0;
        let completedChunks = 0;
        let criticalError = false;

        const chunks = [];
        const CHUNK_SIZE = 20; // Reduced to 20 for maximum safety

        // Parse Logic
        const parsedData = rows.map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row: any = {};
          headers.forEach((h, i) => {
            row[h] = values[i];
          });
          return row;
        });


        // Helper: Strict Date Parser (YYYY-MM-DD)
        const parseDateSafe = (val: string): string | null => {
          if (!val) return null;
          try {
            const mkDate = new Date(val);
            if (isNaN(mkDate.getTime())) return null;
            return mkDate.toISOString().split('T')[0];
          } catch (e) { return null; }
        };

        // Parse and Format ALL Data First
        const formattedDataAll = parsedData.map((row: any) => {
          const name = row['medicine name'] || row['name'] || row['medicine'] || 'Unknown';
          const quantity = parseInt(row['qty'] || row['quantity'] || row['stock'] || '0');
          const price = parseFloat(row['mrp'] || row['price'] || row['unit price'] || '0');
          const cost = parseFloat(row['cost'] || row['purchase price'] || row['buying price'] || '0');

          // Strict Date Parsing
          const rawExpiry = row['expiry'] || row['expiry date'];
          const cleanExpiry = parseDateSafe(rawExpiry);

          return {
            shop_id: currentShop?.id,
            medicine_name: name,
            batch_number: row['batch'] || row['batch number'] || null,
            quantity: isNaN(quantity) ? 0 : quantity,
            unit_price: isNaN(price) ? 0 : price,
            purchase_price: isNaN(cost) ? 0 : cost,
            expiry_date: cleanExpiry,
            barcode: row['barcode'] || null,
            manufacturer: row['manufacturer'] || null,
            rack_number: row['rack'] || row['rack no'] || null,
            shelf_number: row['shelf'] || row['shelf no'] || null,
            gst_rate: parseFloat(row['gst'] || row['gst rate'] || '0'),
            hsn_code: row['hsn'] || row['hsn code'] || null,
            source: 'bulk_csv'
          };
        }).filter((item: any) => item.medicine_name !== 'Unknown');

        for (let i = 0; i < formattedDataAll.length; i += CHUNK_SIZE) {
          chunks.push(formattedDataAll.slice(i, i + CHUNK_SIZE));
        }

        // --- SKIP DRY RUN: Proceed directly to import ---
        toastId = toast.loading("Starting Import...");
        // -----------------------------------------------

        for (const chunk of chunks) {
          if (criticalError) break;
          // Abort if too many errors
          if (consecutiveErrors >= 3) {
            toast.error("Too many errors. Aborting.", { id: toastId });
            criticalError = true;
            break;
          }

          completedChunks++;
          if (completedChunks === 1 || completedChunks % 5 === 0 || completedChunks === chunks.length) {
            toast.loading(`Importing batch ${completedChunks}/${chunks.length}...`, { id: toastId });
          }

          const formattedData = chunk;
          if (formattedData.length === 0) continue;

          // console.log(`[CSV Import] Uploading Batch ${completedChunks}:`, formattedData);

          try {
            // Force Timeout after 15s to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const { error } = await supabase.from('inventory').insert(formattedData).abortSignal(controller.signal);

            clearTimeout(timeoutId);

            if (error) {

              // --- FALLBACK: Retry without 'source' column if schema is old ---
              if (error.code === '42703') { // undefined_column
                console.warn("Schema Mismatch: 'source' column missing. Retrying without it...");
                const fallbackData = formattedData.map((d: any) => {
                  const { source, ...rest } = d;
                  return rest;
                });
                const { error: retryError } = await supabase.from('inventory').insert(fallbackData);
                if (retryError) {
                  console.error("Fallback Failed:", retryError);
                  errorCount += chunk.length;
                  toast.error(`Batch ${completedChunks} failed (even after fallback): ${retryError.message}`, { id: toastId });
                } else {
                  successCount += chunk.length;
                  consecutiveErrors = 0;
                }
                // Continue to next chunk
                continue;
              }
              // -------------------------------------------------------------

              console.error("Bulk Insert Error:", error);
              errorCount += chunk.length;
              consecutiveErrors++;

              // If RLS error, ABORT immediately don't retry
              if (error.code === '42501' || error.message?.includes("security policy")) {
                toast.error(`Permission Error: Stopping import. ${error.message}`, { id: toastId });
                criticalError = true;
              } else {
                toast.error(`Batch ${completedChunks} failed: ${error.message}`, { id: toastId });
              }
            } else {
              successCount += chunk.length;
              consecutiveErrors = 0; // Reset
            }
          } catch (err: any) {
            console.error("Bulk Insert Exception:", err);
            errorCount += chunk.length;
            toast.error(`Network Error: ${err.message}`, { id: toastId });
            // Don't abort on network blip, just log error
          }
        }

        // --- FINAL STATUS CHECK ---
        if (criticalError) {
          // Ensure the user knows why it stopped
          toast.error("Import Aborted due to critical errors.", { id: toastId, duration: 5000 });
        } else if (successCount > 0) {
          toast.success(`Success! Imported ${successCount} items to Shop (${currentShop?.name}).`, { id: toastId });
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

        {/* Audit Mode Dialog - Self Contained */}
        <StockAudit
          open={isAuditOpen}
          onOpenChange={setIsAuditOpen}
          shopId={currentShop?.id || ""}
          onComplete={() => {
            fetchInventory(); // Refresh list after audit
            toast.success("Audit Completed & Stock Updated");
          }}
        />

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
          <Button variant="outline" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => setIsAuditOpen(true)}>
            <Scan className="w-4 h-4" /> Audit Mode
          </Button>

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

        {/* Audit Mode Dialog - Using the Self Contained Component Correctly */}
        <StockAudit
          open={isAuditOpen}
          onOpenChange={setIsAuditOpen}
          shopId={currentShop?.id || ""}
          onComplete={() => {
            fetchInventory();
            toast.success("Audit Completed");
          }}
        />

      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1">
          <TabsTrigger value="stock" className="gap-2 py-2">
            <Package className="w-4 h-4" /> Live Stock
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-2 relative py-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI Drafts
          </TabsTrigger>
          <TabsTrigger value="deadstock" className="gap-2 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Dead Stock
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2 py-2">
            <History className="w-4 h-4" /> Audit Logs
          </TabsTrigger>
        </TabsList>
        <TabsContent value="audit" className="space-y-6">
          <AuditLogs embedded={true} />
        </TabsContent>

        <TabsContent value="stock" className="space-y-6">
          {/* AI Reorder Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {predictions.filter(p => p.predicted_quantity > 0).slice(0, 2).map((pred, i) => (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-full">
                    <TrendingUp className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900">Reorder Alert: {pred.medicine_name}</p>
                    <p className="text-xs text-amber-700">Stock: {pred.current_stock} | Suggested: +{pred.predicted_quantity}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 h-7 text-xs">
                  Add to PO
                </Button>
              </div>
            ))}
          </div>

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

        <TabsContent value="drafts" className="space-y-6">
          <InventoryDrafts
            shopId={currentShop?.id || ""}
            onRefreshRequest={fetchInventory}
          />
        </TabsContent>

        <TabsContent value="deadstock" className="space-y-6">
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Non-Moving Stock (Dead Stock)
              </CardTitle>
              <CardDescription>
                Items with 0 predicted sales velocity based on recent history.
                Consider clearance to free up capital.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {predictions.filter(p => p.avg_daily_sales === 0 && p.current_stock > 0).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No dead stock detected! (Run "Forecast Analysis" to update)
                </div>
              ) : (
                <div className="space-y-4">
                  {predictions.filter(p => p.avg_daily_sales === 0 && p.current_stock > 0).map((item, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row justify-between items-center p-4 border rounded-lg bg-slate-50">
                      <div>
                        <h4 className="font-bold text-slate-800">{item.medicine_name}</h4>
                        <p className="text-sm text-slate-500">Current Stock: <span className="font-mono font-bold text-slate-700">{item.current_stock} units</span></p>
                      </div>
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                        0 Sales / 30 Days
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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

      <StockAudit
        open={isAuditOpen}
        onOpenChange={setIsAuditOpen}
        shopId={currentShop?.id || ''}
        onComplete={fetchInventory}
      />
    </div >
  );
};

export default Inventory;
