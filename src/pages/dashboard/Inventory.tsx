import { useEffect, useState, lazy, Suspense } from "react";
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
import { Plus, Search, Package, AlertTriangle, Filter, Sparkles, Check, X, RefreshCw, Upload, Trash2, NotebookPen, TrendingUp, ShoppingCart } from "lucide-react";
// Lazy-loaded components for code splitting
const AddMedicineDialog = lazy(() => import("@/components/dashboard/inventory/AddMedicineDialog").then(module => ({ default: module.AddMedicineDialog })));
const StockAdjustmentDialog = lazy(() => import("@/components/dashboard/inventory/StockAdjustmentDialog").then(module => ({ default: module.StockAdjustmentDialog })));
const InventoryDrafts = lazy(() => import("@/components/dashboard/inventory/InventoryDrafts").then(module => ({ default: module.InventoryDrafts })));
import { aiService } from "@/services/aiService";
import { logger } from "@/utils/logger";
import { format, differenceInDays } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText as FileTextIcon, History, Scan } from "lucide-react";
const AuditLogs = lazy(() => import("@/pages/dashboard/AuditLogs"));
import { StockAudit } from "@/components/dashboard/inventory/StockAudit";
import { pdfService } from "@/services/pdfService";
import { whatsappService } from "@/services/whatsappService";
import Papa from "papaparse";

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

  // VERSION CHECK LOG
  useEffect(() => { console.log("Inventory Component v2.5 - CSV Fix + Timeout Loaded"); }, []);

  // stagingItems removed
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { currentShop, currentShopId } = useUserShops();
  const { canModify } = useUserRole(currentShopId); // Use ID directly
  const [activeTab, setActiveTab] = useState("stock");

  // AI Forecast Hook
  const { predictions } = useDemandForecast(currentShop?.id);

  /* Add Item State */
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isScanUnstructuredOpen, setIsScanUnstructuredOpen] = useState(false);
  const [scanText, setScanText] = useState("");
  const [scanImage, setScanImage] = useState<File | null>(null);
  const [isProcessingUnstructured, setIsProcessingUnstructured] = useState(false);

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

  const handleProcessUnstructured = async () => {
    if (!scanText && !scanImage) {
      toast.error("Please provide text, voice note, or an image.");
      return;
    }
    setIsProcessingUnstructured(true);
    const toastId = toast.loading("AI is analyzing your input...");
    try {
      const activeShopId = currentShop?.id || localStorage.getItem("currentShopId");
      if (!activeShopId) throw new Error("Shop ID missing");

      const items = await aiService.processUnstructuredInventory(scanText, scanImage || undefined);

      if (items && items.length > 0) {
        const formattedItems = items.map((item: any) => ({
          shop_id: activeShopId,
          brand_name: item.brand_name || "Unknown",
          salt: item.salt || null,
          quantity: item.quantity ? parseFloat(item.quantity) : 10,
          mrp: item.mrp ? parseFloat(item.mrp) : null,
          expiry: item.expiry || null,
          uom: item.uom || null,
          confidence_score: item.confidence_score || 0.9,
          status: 'Pending_Verification',
          reorder_threshold: typeof item.quantity === 'number' ? Math.ceil(item.quantity * 0.2) : 2,
          source: 'ai_unstructured'
        }));

        const { error } = await supabase.from('inventory_drafts').insert(formattedItems);
        if (error) throw error;

        toast.success(`Successfully drafted ${formattedItems.length} items!`, { id: toastId });
        setIsScanUnstructuredOpen(false);
        setScanText("");
        setScanImage(null);
        setActiveTab("drafts"); // Switch to drafts tab to see the items
      } else {
        toast.error("No items could be extracted.", { id: toastId });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to process.", { id: toastId });
    } finally {
      setIsProcessingUnstructured(false);
    }
  };

  // fetchStaging removed

  useEffect(() => {
    if (currentShopId) {
      setLoading(true);
      fetchInventory();
    } else {
      // Only set loading false if we really don't have an ID (and not just waiting for async)
      // If currentShopId is from localStorage, it's instant.
      if (!localStorage.getItem("currentShopId")) {
        setLoading(false);
      }
    }

    const channel = supabase
      .channel('inventory-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetchInventory)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentShopId]);

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

  const lowStockItems = inventory.filter(i => i.quantity <= (i.reorder_level || 10));

  const handleEmailPO = () => {
    if (lowStockItems.length === 0) return;

    const subject = `Purchase Order - ${currentShop?.name}`;
    const body = `Dear Supplier,\n\nPlease send the following items:\n\n` +
      lowStockItems.map(i => `- ${i.medicine_name}: ${Math.max(50, (i.reorder_level || 10) * 3)} units`).join('\n') +
      `\n\nRank Regards,\n${currentShop?.name}`;

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

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
    const returnPayload = {
      shop_id: currentShop?.id,
      supplier_name: supplierName,
      total_estimated_value: totalValue,
      status: 'draft',
      return_date: new Date().toISOString()
    };

    const { data: returnData, error: headerError } = await supabase
      .from('purchase_returns')
      .insert(returnPayload as any) // Type assertion until global types update
      .select()
      .single();

    if (headerError) {
      toast.error("Failed to create Return Note: " + headerError.message);
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
      reason: 'expired',
      purchase_price: i.cost_price || 0
    }));

    const { error: itemsError } = await supabase
      .from('purchase_return_items')
      .insert(returnItems as any);

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
      const confetti = (await import('canvas-confetti')).default;
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

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
    const { error } = await supabase.from('shortbook').insert({
      shop_id: currentShop?.id || '',
      product_name: item.medicine_name,
      quantity: 10, // Default suggestion
      priority: 'medium',
      added_from: 'inventory_card'
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

  // Feature: Bulk CSV Upload with Papaparse
  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentShop?.id) {
      toast.error("No Shop Selected");
      return;
    }

    const toastId = toast.loading("Parsing CSV...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.errors.length > 0) {
          console.error("CSV Parse Errors:", results.errors);
          toast.error(`CSV Error: ${results.errors[0].message}`, { id: toastId });
          return;
        }

        const rows: any[] = results.data;
        if (rows.length === 0) {
          toast.error("No data found in CSV", { id: toastId });
          return;
        }

        console.log(`Parsed ${rows.length} rows`);

        // Helper: Flexible Field Matcher
        const getField = (row: any, keys: string[]) => {
          const lowerKeys = keys.map(k => k.toLowerCase());
          const foundKey = Object.keys(row).find(k => lowerKeys.includes(k.toLowerCase().trim()));
          return foundKey ? row[foundKey] : null;
        };

        const formattedData = rows.map((row) => {
          const name = getField(row, ["Medicine Name", "Name", "Item Name", "Medicine"]);
          if (!name) return null;

          return {
            shop_id: currentShop?.id,
            medicine_name: name,
            batch_number: getField(row, ["Batch Number", "Batch", "Batch No"]),
            expiry_date: getField(row, ["Expiry Date", "Expiry", "Exp Date"]), // Date parsing needed?
            quantity: parseInt(getField(row, ["Quantity", "Qty", "Stock"]) || "0"),
            unit_price: parseFloat(getField(row, ["MRP", "Unit Price", "Price", "Selling Price"]) || "0"),
            purchase_price: parseFloat(getField(row, ["Purchase Price", "Cost", "Buying Price"]) || "0"),
            manufacturer: getField(row, ["Manufacturer", "Mfg"]),
            rack_number: getField(row, ["Rack", "Rack No"]),
            shelf_number: getField(row, ["Shelf", "Shelf No"]),
            source: 'bulk_csv_papa'
          };
        }).filter(Boolean); // Remove nulls

        if (formattedData.length === 0) {
          toast.error("No valid medicines found. Check column headers.", { id: toastId });
          return;
        }

        // Chunking
        const CHUNK_SIZE = 50;
        let successCount = 0;
        let errorCount = 0;

        toast.loading(`Importing ${formattedData.length} items...`, { id: toastId });

        for (let i = 0; i < formattedData.length; i += CHUNK_SIZE) {
          const chunk = formattedData.slice(i, i + CHUNK_SIZE);

          const promises = chunk.map(async (item: any) => {
            try {
              // 1. Try Secure RPC
              const payload = {
                p_shop_id: item.shop_id,
                p_medicine_name: item.medicine_name,
                p_quantity: item.quantity,
                p_unit_price: item.unit_price,
                p_purchase_price: item.purchase_price,
                p_batch_number: item.batch_number,
                p_expiry_date: item.expiry_date ? new Date(item.expiry_date).toISOString().split('T')[0] : null,
                p_manufacturer: item.manufacturer,
                p_category: null,
                p_generic_name: null,
                p_rack_number: item.rack_number,
                p_shelf_number: item.shelf_number,
                p_gst_rate: 0,
                p_hsn_code: null,
                p_source: 'bulk_csv'
              };

              const { data, error } = await supabase.rpc('add_inventory_secure', payload);
              if (error || (data && !data.success)) throw error || new Error(data?.error);
              return true;
            } catch (e) {
              // Fallback to direct insert
              const { error } = await supabase.from("inventory").insert({
                ...item,
                expiry_date: item.expiry_date ? new Date(item.expiry_date).toISOString().split('T')[0] : null
              });
              return !error;
            }
          });

          const results = await Promise.all(promises);
          const passed = results.filter(Boolean).length;
          successCount += passed;
          errorCount += (results.length - passed);
        }

        toast.success(`Import Complete: ${successCount} added, ${errorCount} failed`, { id: toastId });
        fetchInventory();
      },
      error: (err) => {
        toast.error(`CSV Parsing Failed: ${err.message}`, { id: toastId });
      }
    });

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
          <Suspense fallback={<div className="flex items-center justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin" /></div>}>
            <AuditLogs embedded={true} />
          </Suspense>
        </TabsContent>

        <TabsContent value="stock" className="space-y-6">
          {/* LOW STOCK ALERT BANNER */}
          {lowStockItems.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2 rounded-full">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-red-900">Low Stock Alert ({lowStockItems.length} Items)</h3>
                  <p className="text-sm text-red-700">Some critical medicines are running low.</p>
                </div>
              </div>
              <Button className="bg-red-600 hover:bg-red-700 text-white shadow-sm" onClick={handleEmailPO}>
                <NotebookPen className="w-4 h-4 mr-2" />
                Email Distributor (Generate PO)
              </Button>
            </div>
          )}

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
              <div className="flex gap-2">
                <Button size="lg" className="shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsScanUnstructuredOpen(true)}>
                  <Sparkles className="w-4 h-4 mr-2" /> Scan/Add Unstructured
                </Button>
                <Button size="lg" className="shadow-lg" variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Add Manual
                </Button>

                {/* Scan Unstructured Dialog */}
                <Dialog open={isScanUnstructuredOpen} onOpenChange={setIsScanUnstructuredOpen}>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-500" /> AI Inventory Architect</DialogTitle>
                      <DialogDescription>
                        Paste messy notes, voice-to-text, or upload a photo of medicines. AI will structure it automatically into Drafts.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="scanText">Unstructured Text / Voice Note</Label>
                        <textarea
                          id="scanText"
                          className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder='e.g. "Got 10 strips of Pan-D, expires March 27"'
                          value={scanText}
                          onChange={(e) => setScanText(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="scanImage">Or Upload Photo</Label>
                        <Input
                          id="scanImage"
                          type="file"
                          accept="image/*"
                          onChange={(e) => setScanImage(e.target.files?.[0] || null)}
                        />
                      </div>
                      <Button onClick={handleProcessUnstructured} disabled={isProcessingUnstructured} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                        {isProcessingUnstructured ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Process with AI
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Suspense fallback={<div />}>
                  <AddMedicineDialog
                    open={isAddDialogOpen}
                    onOpenChange={setIsAddDialogOpen}
                    onSuccess={fetchInventory}
                  />
                </Suspense>
              </div>
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

                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3 bg-muted p-2 rounded">
                            <div title="Location">📍 {item.rack_number ? `${item.rack_number}-${item.shelf_number || ''}` : 'No Loc'}</div>
                            <div title="Tax">🧾 GST: {item.gst_rate}%</div>
                          </div>

                          <div className="flex justify-between items-center text-sm mb-4">
                            <span className="font-bold text-base">₹{item.unit_price}</span>
                            <div className="flex gap-1">
                              {(item.unit_price > 0 && (item.cost_price || item.purchase_price)) ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50">
                                  Margin: {Math.round(((item.unit_price - (item.cost_price || item.purchase_price || 0)) / item.unit_price) * 100)}%
                                </Badge>
                              ) : null}
                              <Badge variant={status === 'expired' ? 'destructive' : 'outline'} className="text-[10px]">{!item.expiry_date ? 'No Expiry Data' : status === 'safe' ? `Exp: ${item.expiry_date}` : 'Check Expiry'}</Badge>
                            </div>
                          </div>
                        </div>

                        {/* Stock Actions */}
                        {canModify && (
                          <div className="flex gap-2 mt-auto pt-3 border-t items-center">
                            <Button variant="outline" size="sm" className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-500 dark:hover:bg-green-900/20 dark:hover:text-green-400 h-8" onClick={() => setAdjustmentDialog({ isOpen: true, item, type: 'IN' })}>
                              <Plus className="w-3 h-3 mr-1" /> In
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 h-8" onClick={() => setAdjustmentDialog({ isOpen: true, item, type: 'OUT' })}>
                              <X className="w-3 h-3 mr-1" /> Out
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="w-8 h-8 text-purple-600 hover:bg-purple-50 border-purple-200 dark:text-purple-400 dark:hover:bg-purple-900/20 dark:border-purple-800/50"
                              title="Add to Shortbook"
                              onClick={async () => {
                                const { error } = await supabase.from('shortbook').insert({
                                  shop_id: currentShop?.id,
                                  product_name: item.medicine_name,
                                  quantity: 10, // Default reorder qty
                                  priority: 'medium',
                                  added_from: 'inventory_card'
                                });
                                if (error) toast.error("Failed to add to shortbook");
                                else toast.success("Added to Shortbook!");
                              }}
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 h-8" onClick={() => handleAddToShortbook(item)}>
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
          <Suspense fallback={<div className="flex items-center justify-center py-8"><RefreshCw className="w-6 h-6 animate-spin" /></div>}>
            <InventoryDrafts
              shopId={currentShop?.id || ""}
              onRefreshRequest={fetchInventory}
              predictions={predictions}
            />
          </Suspense>
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
                        <h4 className="font-bold text-slate-800 dark:text-slate-200">{item.medicine_name}</h4>
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
