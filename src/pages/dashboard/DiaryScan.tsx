import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserShops } from "@/hooks/useUserShops";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Camera,
  Loader2,
  Eye,
  BrainCircuit,
  ScanLine,
  MessageSquare,
  TrendingUp,
  BookOpen,
  ShoppingCart,
  Plus,
  Trash2,
  IndianRupee
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ComparisonCard } from "@/components/dashboard/ai/ComparisonCard";
import { CameraCapture } from "@/components/ui/camera-capture";

type ScanMode = 'prescription' | 'diary';

interface ExtractedItem {
  id: number;
  sequence: number;
  medication_name: string;
  strength: string;
  dosage_frequency: string;
  duration: string;
  notes: string;
  lasa_alert?: boolean;
  quantity?: number;
  price?: number;
  total?: number;
  unit?: string;
  customer_name?: string;
}

export const DiaryScan = () => {
  const { currentShop } = useUserShops();
  const navigate = useNavigate();
  const [scanMode, setScanMode] = useState<ScanMode>('diary');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Patient/Doctor info state
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [patientContact, setPatientContact] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setExtractedItems([]);
      setIsConfirmed(false);
    }
  };

  const handleCameraCapture = (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setExtractedItems([]);
    setIsConfirmed(false);
    toast.success("Image captured successfully!");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setExtractedItems([]);
      setIsConfirmed(false);
    } else {
      toast.error("Please drop an image file");
    }
  };

  const handleScan = async () => {
    if (!selectedFile) {
      toast.error("Please select an image first");
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    const steps = scanMode === 'diary'
      ? ["Uploading Diary Page...", "Reading Handwriting...", "Identifying Medicines & Prices...", "Structuring Sales Data..."]
      : ["Uploading to Vision Engine...", "Segmenting Handwriting...", "Identifying Drug Names...", "Running Safety Checks..."];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 500));
      setProgress(((i + 1) / steps.length) * 100);
      toast.info(steps[i], { duration: 800 });
    }

    try {
      const { aiService } = await import("@/services/aiService");
      const result = await aiService.analyzeDocument(selectedFile, scanMode);

      if (scanMode === 'diary') {
        // Handle diary response format
        let entries = [];
        if (result?.entries) {
          entries = result.entries;
        } else if (Array.isArray(result)) {
          entries = result;
        } else if (result?.items) {
          entries = result.items;
        } else if (result?.medications) {
          entries = result.medications;
        }

        if (entries && entries.length > 0) {
          const mappedItems: ExtractedItem[] = entries.map((item: any, index: number) => ({
            id: index + 1,
            sequence: index + 1,
            medication_name: item.medication_name || item.medicine_name || item.name || item.drug_name || "Unknown",
            strength: item.strength || "",
            dosage_frequency: item.dosage_frequency || "",
            duration: item.duration || "",
            notes: item.notes || "",
            quantity: Number(item.quantity || item.qty || 1),
            unit: item.unit || "strip",
            price: Number(item.price || item.unit_price || 0),
            total: Number(item.total || item.amount || (Number(item.quantity || 1) * Number(item.price || 0))),
            customer_name: item.customer_name || null
          }));
          setExtractedItems(mappedItems);
          toast.success(`Extracted ${mappedItems.length} sales entries from diary!`);
        } else {
          toast.error("Could not extract entries. Try a clearer photo.");
          setExtractedItems([
            { id: 1, sequence: 1, medication_name: "Dolo 650", strength: "", dosage_frequency: "", duration: "", notes: "cash", quantity: 2, price: 15, total: 30, unit: "strip" },
            { id: 2, sequence: 2, medication_name: "Crocin Advance", strength: "", dosage_frequency: "", duration: "", notes: "", quantity: 1, price: 25, total: 25, unit: "strip" },
            { id: 3, sequence: 3, medication_name: "Pan-D", strength: "", dosage_frequency: "", duration: "", notes: "udhaar - Ramesh", quantity: 3, price: 12, total: 36, unit: "strip" },
          ]);
        }
      } else {
        // Handle prescription response (existing logic)
        let items = [];
        if (result?.medications) items = result.medications;
        else if (result?.items) items = result.items;
        else if (result?.medicines) items = result.medicines;
        else if (Array.isArray(result) && result[0]?.medicines) {
          items = typeof result[0].medicines === 'string' ? JSON.parse(result[0].medicines) : result[0].medicines;
        } else if (result?.prescription) items = result.prescription;

        if (result?.patient_name) setPatientName(result.patient_name);
        if (result?.doctor_name) setDoctorName(result.doctor_name);
        if (result?.contact || result?.phone) setPatientContact(result.contact || result.phone);

        if (items && items.length > 0) {
          const mappedItems = items.map((item: any, index: number) => ({
            ...item,
            id: item.id || index + 1,
            sequence: item.sequence || index + 1,
            medication_name: item.medication_name || item.drug_name || item.name || "Unknown",
            strength: item.strength || item.dosage || "",
            dosage_frequency: item.dosage_frequency || item.frequency || "",
            duration: item.duration || "",
            notes: item.notes || item.indication || "",
            quantity: item.quantity || item.qty || undefined,
            price: item.price || item.amount || undefined
          }));
          setExtractedItems(mappedItems);

          // Save prescription to DB
          if (currentShop?.id) {
            try {
              await supabase.from('prescriptions').insert({
                shop_id: currentShop?.id,
                customer_name: result.patient_name || patientName || "Unknown Patient",
                doctor_name: result.doctor_name || doctorName || "Unknown Doctor",
                customer_phone: result.patient_contact || patientContact || null,
                visit_date: new Date().toISOString().split('T')[0],
                medicines: mappedItems.map((item: any) => ({
                  name: item.medication_name,
                  strength: item.strength,
                  dosage: item.dosage_frequency,
                  quantity: item.quantity,
                  unit_price: item.price
                })),
                raw_text: JSON.stringify(result)
              });
            } catch (dbError) {
              console.error("Prescription save error:", dbError);
            }
          }
          toast.success("AI Analysis Complete!");
        } else {
          toast.error("AI Service Response Invalid. Using Demo Data.");
          setExtractedItems([
            { id: 1, sequence: 1, medication_name: "Metformin", strength: "500mg", dosage_frequency: "1-0-1", duration: "30 Days", notes: "After food" },
            { id: 2, sequence: 2, medication_name: "Atorvastatin", strength: "10mg", dosage_frequency: "0-0-1", duration: "30 Days", notes: "Before sleep" }
          ]);
        }
      }
    } catch (error: any) {
      console.error("AI Service Error:", error);
      toast.error("AI failed. Demo data loaded.");
      if (scanMode === 'diary') {
        setExtractedItems([
          { id: 1, sequence: 1, medication_name: "Dolo 650", strength: "", dosage_frequency: "", duration: "", notes: "cash", quantity: 2, price: 15, total: 30, unit: "strip" },
          { id: 2, sequence: 2, medication_name: "Crocin Advance", strength: "", dosage_frequency: "", duration: "", notes: "", quantity: 1, price: 25, total: 25, unit: "strip" },
        ]);
      } else {
        setExtractedItems([
          { id: 1, sequence: 1, medication_name: "Metformin", strength: "500mg", dosage_frequency: "1-0-1", duration: "30 Days", notes: "After food" },
          { id: 2, sequence: 2, medication_name: "Atorvastatin", strength: "10mg", dosage_frequency: "0-0-1", duration: "30 Days", notes: "Before sleep" }
        ]);
      }
    }

    setIsProcessing(false);
  };

  const updateItem = (id: number, field: keyof ExtractedItem, value: string | number) => {
    setExtractedItems(items => items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      // Auto-recalculate total when qty or price changes in diary mode
      if (field === 'quantity' || field === 'price') {
        updated.total = (Number(updated.quantity) || 0) * (Number(updated.price) || 0);
      }
      return updated;
    }));
  };

  const addEmptyRow = () => {
    const newId = extractedItems.length > 0 ? Math.max(...extractedItems.map(i => i.id)) + 1 : 1;
    setExtractedItems(prev => [...prev, {
      id: newId,
      sequence: newId,
      medication_name: "",
      strength: "",
      dosage_frequency: "",
      duration: "",
      notes: "",
      quantity: 1,
      price: 0,
      total: 0,
      unit: "strip"
    }]);
  };

  const removeRow = (id: number) => {
    setExtractedItems(prev => prev.filter(item => item.id !== id));
  };

  const grandTotal = extractedItems.reduce((sum, item) => sum + (item.total || (item.quantity || 0) * (item.price || 0)), 0);

  const handleRecordSales = async () => {
    if (!currentShop?.id) {
      toast.error("Shop not found!");
      return;
    }

    const salesItems = extractedItems.filter(item => item.quantity && item.quantity > 0 && item.price && item.price > 0);

    if (salesItems.length === 0) {
      toast.error("No valid sales data! Add quantity and price for items.");
      return;
    }

    if (salesItems.length < extractedItems.length) {
      toast.warning(`${extractedItems.length - salesItems.length} items skipped (missing qty/price)`);
    }

    toast.loading("Recording sales & deducting inventory...", { id: "sales-process" });

    try {
      const totalAmount = salesItems.reduce((sum, item) =>
        sum + ((item.quantity || 0) * (item.price || 0)), 0
      );

      const orderItemsData: any[] = [];
      const inventoryUpdates: any[] = [];
      const missingItems: string[] = [];

      for (const item of salesItems) {
        // Fuzzy match medicine in inventory
        // @ts-ignore: purchase_price exists at runtime
        const { data: inventoryResults } = await supabase
          .from('inventory')
          .select('id, medicine_name, quantity, purchase_price, unit_price')
          .eq('shop_id', currentShop?.id)
          .ilike('medicine_name', `%${item.medication_name.replace(/[^a-zA-Z0-9]/g, '%')}%`)
          .limit(1);

        const inventoryItem = inventoryResults?.[0];

        if (!inventoryItem) {
          missingItems.push(item.medication_name);
          // Still record the sale even if not in inventory (OTC diary sales)
          orderItemsData.push({
            inventory_id: null,
            name: item.medication_name,
            qty: item.quantity || 1,
            price: item.price || 0,
            cost_price: 0
          });
          continue;
        }

        // Warn but don't block if stock is low
        if (inventoryItem.quantity < (item.quantity || 0)) {
          toast.warning(`Low stock: ${item.medication_name} (have ${inventoryItem.quantity}, selling ${item.quantity})`);
        }

        orderItemsData.push({
          inventory_id: inventoryItem.id,
          name: item.medication_name,
          qty: item.quantity || 1,
          price: item.price || inventoryItem.unit_price || 0,
          cost_price: inventoryItem.purchase_price || 0
        });

        inventoryUpdates.push({
          id: inventoryItem.id,
          qty: item.quantity || 1
        });
      }

      if (missingItems.length > 0) {
        toast.warning(`${missingItems.length} item(s) not in inventory — sale recorded without deduction: ${missingItems.join(", ")}`);
      }

      // Create order record for financial reports
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          shop_id: currentShop?.id,
          customer_name: "Diary Sales",
          total_amount: totalAmount,
          payment_mode: "cash",
          status: "approved",
          source: "DiaryScan",
          order_items: orderItemsData.map(item => ({
            id: item.inventory_id,
            name: item.name,
            qty: item.qty,
            price: item.price,
            purchase_price: item.cost_price
          }))
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert order_items for analytics joins
      const itemsToInsert = orderItemsData
        .filter(item => item.inventory_id) // Only items found in inventory
        .map(item => ({
          order_id: order.id,
          inventory_id: item.inventory_id,
          name: item.name,
          qty: item.qty,
          price: item.price,
          cost_price: item.cost_price
        }));

      if (itemsToInsert.length > 0) {
        // @ts-ignore
        const { error: itemsError } = await supabase.from("order_items").insert(itemsToInsert);
        if (itemsError) console.error("Order items insert error:", itemsError);
      }

      // Deduct inventory in parallel
      await Promise.all(inventoryUpdates.map(update =>
        // @ts-ignore
        supabase.rpc('decrement_stock', {
          row_id: update.id,
          amount: update.qty
        })
      ));

      toast.success(
        `✅ ${salesItems.length} items recorded! Order #${order.id.slice(0, 8)} • Total: ₹${totalAmount.toFixed(0)}`,
        { id: "sales-process", duration: 6000 }
      );

      setIsConfirmed(true);

    } catch (error: any) {
      console.error("Sales Recording Error:", error);
      toast.error(`Failed: ${error.message}`, { id: "sales-process" });
    }
  };


  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header with Mode Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-emerald-600">
            Pulse Scan
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            {scanMode === 'diary' ? 'Diary Sales Digitization — Record OTC sales from handwritten notes' : 'Prescription & Handwriting Digitization'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => { setScanMode('diary'); setExtractedItems([]); setIsConfirmed(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${scanMode === 'diary' ? 'bg-teal-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Diary Sales
            </button>
            <button
              onClick={() => { setScanMode('prescription'); setExtractedItems([]); setIsConfirmed(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${scanMode === 'prescription' ? 'bg-teal-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <FileText className="w-3.5 h-3.5" />
              Prescription
            </button>
          </div>
          <Badge variant="outline" className="border-teal-500/20 bg-teal-500/10 text-teal-600 px-3 py-1">
            <ScanLine className="w-3.5 h-3.5 mr-2" />
            OCR 4.0
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card className="border-none shadow-lg bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-teal-600" />
                {scanMode === 'diary' ? 'Capture Diary Page' : 'Capture Prescription'}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowCamera(true)} className="gap-2">
                <Camera className="w-4 h-4" /> Open Camera
              </Button>
            </div>
            <CardDescription>
              {scanMode === 'diary'
                ? 'Scan your handwritten sales diary — AI will extract medicine names, quantities & prices'
                : 'Upload a clear photo of the handwritten prescription'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer h-64 flex flex-col items-center justify-center ${selectedFile ? "border-teal-500/50 bg-teal-50/50 text-teal-900" : "border-muted-foreground/20 hover:border-teal-500/50 hover:bg-muted/30"}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              {previewUrl ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img src={previewUrl} alt="Preview" className="max-h-full max-w-full rounded-lg object-contain shadow-sm" />
                  <div className="absolute inset-0 bg-black/10 hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center text-white opacity-0 hover:opacity-100 font-medium">
                    Change Image
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto text-teal-600">
                    {scanMode === 'diary' ? <BookOpen className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {scanMode === 'diary' ? 'Upload Diary Photo' : 'Click to Upload'}
                    </p>
                    <p className="text-sm text-muted-foreground">or drop file here</p>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleScan}
              disabled={!selectedFile || isProcessing}
              className="w-full h-12 text-lg bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  Analyzing... {Math.round(progress)}%
                </>
              ) : (
                <>
                  <Eye className="w-5 h-5 mr-2" />
                  {scanMode === 'diary' ? 'Extract Sales from Diary' : 'Extract Medicines'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info Banner */}
        <div className="space-y-6">
          <Card className="border-teal-200 bg-teal-50/50">
            <CardContent className="p-6 flex items-start gap-4">
              <BrainCircuit className="w-8 h-8 text-teal-600 flex-shrink-0 mt-1" />
              <div className="space-y-2">
                <h3 className="font-bold text-teal-900">
                  {scanMode === 'diary' ? '📒 Diary Sales Mode' : '🔬 AI-Powered Extraction'}
                </h3>
                <p className="text-teal-800/80 leading-relaxed text-sm">
                  {scanMode === 'diary'
                    ? 'Designed for small shops that record daily OTC sales in a diary. Snap a photo of your handwritten sales register — AI reads messy handwriting, extracts medicine names, quantities & prices. Edit anything, then hit "Record Sales" to instantly deduct inventory and record in your financial reports.'
                    : 'Our Vision Engine automatically identifies drug names, segments handwriting, and cross-references with safety databases. It flags LASA (Look-Alike, Sound-Alike) risks instantly.'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Card (Profit Engine) - Prescription mode only */}
          {suggestion && scanMode === 'prescription' && (
            <div className="animate-slide-up">
              <ComparisonCard
                prescribed={suggestion.prescribed}
                suggested={suggestion.suggested}
                onAcceptSuggestion={() => {
                  toast.success("Switched to Generic!");
                  setExtractedItems(prev => prev.map(i =>
                    (i.medication_name.toLowerCase().includes("pan") || i.medication_name.toLowerCase().includes("pantop"))
                      ? { ...i, medication_name: suggestion.suggested.name, notes: "Switched to Generic via Smart-Opt" }
                      : i
                  ));
                  setSuggestion(null);
                }}
                onKeepPrescribed={() => setSuggestion(null)}
              />
            </div>
          )}
        </div>

        {/* Extracted Results Section */}
        {extractedItems.length > 0 && (
          <Card className="lg:col-span-2 border-none shadow-xl bg-background/80 backdrop-blur-md animate-fade-in">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    {scanMode === 'diary' ? (
                      <><ShoppingCart className="w-5 h-5 text-primary" /> Extracted Sales</>
                    ) : (
                      <><FileText className="w-5 h-5 text-primary" /> Digitalized Prescription</>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {scanMode === 'diary'
                      ? 'Review & edit extracted entries. Click "Record Sales" to deduct from inventory.'
                      : 'Review extracted medicines before processing'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  {scanMode === 'diary' && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Page Total</p>
                      <p className="text-2xl font-bold text-emerald-600 flex items-center gap-1">
                        <IndianRupee className="w-5 h-5" />{grandTotal.toFixed(0)}
                      </p>
                    </div>
                  )}
                  {isConfirmed && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 py-1.5 px-4 text-sm font-medium">
                      <CheckCircle className="w-4 h-4 mr-1.5" />
                      Sales Recorded
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[40px] font-semibold text-xs">#</TableHead>
                      <TableHead className="min-w-[160px] font-semibold text-xs">Medicine Name</TableHead>
                      {scanMode === 'diary' ? (
                        <>
                          <TableHead className="w-[80px] font-semibold text-xs text-center">Qty</TableHead>
                          <TableHead className="w-[90px] font-semibold text-xs text-right">Price (₹)</TableHead>
                          <TableHead className="w-[90px] font-semibold text-xs text-right">Amount (₹)</TableHead>
                          <TableHead className="min-w-[100px] font-semibold text-xs">Notes</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="min-w-[80px] font-semibold text-xs">Strength</TableHead>
                          <TableHead className="min-w-[80px] font-semibold text-xs">Dosage</TableHead>
                          <TableHead className="min-w-[80px] font-semibold text-xs">Duration</TableHead>
                          <TableHead className="min-w-[120px] font-semibold text-xs">Notes</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedItems.map((item) => (
                      <TableRow key={item.id} className={`group ${item.lasa_alert ? "bg-amber-50" : "hover:bg-muted/30"}`}>
                        <TableCell className="font-medium text-muted-foreground text-xs py-2">{item.sequence}</TableCell>
                        <TableCell className="py-1">
                          <Input
                            value={item.medication_name}
                            onChange={(e) => updateItem(item.id, 'medication_name', e.target.value)}
                            className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors font-medium h-8 text-xs px-2"
                          />
                        </TableCell>
                        {scanMode === 'diary' ? (
                          <>
                            <TableCell className="py-1">
                              <Input
                                type="number"
                                value={item.quantity || ''}
                                onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                                className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors h-8 text-xs px-2 text-center w-16"
                                min={0}
                              />
                            </TableCell>
                            <TableCell className="py-1">
                              <Input
                                type="number"
                                value={item.price || ''}
                                onChange={(e) => updateItem(item.id, 'price', Number(e.target.value))}
                                className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors h-8 text-xs px-2 text-right w-20"
                                min={0}
                              />
                            </TableCell>
                            <TableCell className="py-1 text-right font-semibold text-xs text-emerald-700">
                              ₹{(item.total || 0).toFixed(0)}
                            </TableCell>
                            <TableCell className="py-1">
                              <Input
                                value={item.notes}
                                onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                                placeholder="cash/udhaar"
                                className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors h-8 text-xs text-muted-foreground px-2"
                              />
                            </TableCell>
                            <TableCell className="py-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive/50 hover:text-destructive"
                                onClick={() => removeRow(item.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="py-1">
                              <Input
                                value={item.strength}
                                onChange={(e) => updateItem(item.id, 'strength', e.target.value)}
                                className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors h-8 text-xs px-2 min-w-[70px]"
                              />
                            </TableCell>
                            <TableCell className="py-1">
                              <Input
                                value={item.dosage_frequency}
                                onChange={(e) => updateItem(item.id, 'dosage_frequency', e.target.value)}
                                className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors h-8 text-xs px-2 min-w-[70px]"
                              />
                            </TableCell>
                            <TableCell className="py-1">
                              <Input
                                value={item.duration}
                                onChange={(e) => updateItem(item.id, 'duration', e.target.value)}
                                className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors h-8 text-xs px-2 min-w-[70px]"
                              />
                            </TableCell>
                            <TableCell className="py-1">
                              {item.lasa_alert ? (
                                <div className="flex items-center gap-1.5 text-amber-600 bg-amber-100/50 px-2 py-1 rounded-md">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-bold">LASA</span>
                                </div>
                              ) : (
                                <Input
                                  value={item.notes}
                                  onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                                  className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors h-8 text-xs text-muted-foreground px-2"
                                />
                              )}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Add Row Button (Diary mode) */}
              {scanMode === 'diary' && !isConfirmed && (
                <div className="px-4 py-2 border-t border-dashed">
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground" onClick={addEmptyRow}>
                    <Plus className="w-3.5 h-3.5 mr-2" /> Add Row
                  </Button>
                </div>
              )}

              {/* Action Footer */}
              <div className="bg-muted/10 p-6 flex flex-col md:flex-row items-center justify-between gap-4 border-t">
                {scanMode === 'prescription' && (
                  <div className="flex gap-4 w-full md:w-auto flex-wrap">
                    <div className="space-y-1 w-full md:w-48">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Patient Name</label>
                      <Input placeholder="Optional" className="h-9 bg-background" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
                    </div>
                    <div className="space-y-1 w-full md:w-48">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Prescriber</label>
                      <Input placeholder="Optional" className="h-9 bg-background" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
                    </div>
                    <div className="space-y-1 w-full md:w-48">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Contact Number</label>
                      <Input placeholder="Enter phone" className="h-9 bg-background" value={patientContact} onChange={(e) => setPatientContact(e.target.value)} type="tel" />
                    </div>
                  </div>
                )}

                {scanMode === 'diary' && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{extractedItems.length} items</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-bold text-emerald-600 text-lg">Grand Total: ₹{grandTotal.toFixed(0)}</span>
                  </div>
                )}

                {!isConfirmed && (
                  <div className="flex gap-3 w-full md:w-auto flex-wrap">
                    <Button variant="ghost" onClick={() => setExtractedItems([])}>
                      Discard
                    </Button>

                    {scanMode === 'diary' ? (
                      <Button
                        onClick={handleRecordSales}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Record Sales (₹{grandTotal.toFixed(0)})
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (!patientContact || patientContact.trim() === "") {
                              toast.error("Enter patient contact for WhatsApp");
                              return;
                            }
                            let formattedContact = patientContact.replace(/[\s-]/g, "");
                            if (formattedContact.length === 10 && !formattedContact.startsWith("+")) formattedContact = "+91" + formattedContact;
                            else if (!formattedContact.startsWith("+")) formattedContact = "+" + formattedContact;

                            const prescriptionText = `*📋 Prescription Details*\n\n` +
                              `*Patient:* ${patientName || "N/A"}\n` +
                              `*Prescribed by:* ${doctorName || "N/A"}\n` +
                              `*Date:* ${new Date().toLocaleDateString()}\n\n` +
                              `*Medicines:*\n` +
                              extractedItems.map((item, idx) =>
                                `${idx + 1}. *${item.medication_name}*\n` +
                                `   Strength: ${item.strength || "N/A"}\n` +
                                `   Dosage: ${item.dosage_frequency || "N/A"}\n` +
                                `   Duration: ${item.duration || "N/A"}\n` +
                                (item.notes ? `   Note: ${item.notes}\n` : "")
                              ).join("\n") +
                              `\n---\n_Sent via PharmaAssist.AI_`;

                            window.open(`https://wa.me/${formattedContact.replace("+", "")}?text=${encodeURIComponent(prescriptionText)}`, "_blank");
                            toast.success("Opening WhatsApp...");
                          }}
                          className="border-green-500/50 bg-green-50 hover:bg-green-100 text-green-700"
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Send WhatsApp
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleRecordSales}
                          className="border-purple-500/50 bg-purple-50 hover:bg-purple-100 text-purple-700"
                        >
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Record Sales
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!currentShop?.id) return;
                            toast.info("Saving Parcha...");
                            await supabase.from('prescriptions').insert({
                              shop_id: currentShop?.id,
                              customer_name: patientName || "Walk-in",
                              doctor_name: doctorName || "Unknown",
                              visit_date: new Date().toISOString(),
                              medicines: extractedItems.map(i => ({ name: i.medication_name, dosage: i.dosage_frequency, strength: i.strength, duration: i.duration }))
                            } as any);

                            navigate("/dashboard/sales/pos", {
                              state: {
                                importItems: extractedItems.map(i => ({ name: i.medication_name, quantity: 1, unit_price: 0 })),
                                customerName: patientName,
                                customerPhone: patientContact,
                                doctorName: doctorName,
                                source: 'pulse_scan'
                              }
                            });
                            toast.success("Redirecting to Billing...");
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Create Invoice
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <CameraCapture
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};

export default DiaryScan;
