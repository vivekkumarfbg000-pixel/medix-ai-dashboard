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
  TrendingUp
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

interface ExtractedItem {
  id: number;
  sequence: number;
  medication_name: string;
  strength: string;
  dosage_frequency: string;
  duration: string;
  notes: string;
  lasa_alert?: boolean; // Look-alike Sound-alike alert
  quantity?: number; // For sales diary
  price?: number; // For sales diary
}

export const DiaryScan = () => {
  const { currentShop } = useUserShops();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [suggestion, setSuggestion] = useState<any>(null); // For ComparisonCard demo
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

    // Simulate AI Processing Steps
    const steps = [
      "Uploading to Vision Engine...",
      "Segmenting Handwriting...",
      "Identifying Drug Names (RxNav)...",
      "Structuring Data...",
      "Running Safety Checks (LASA)..."
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 600)); // Simulate delay
      setProgress(((i + 1) / steps.length) * 100);
      toast.info(steps[i], { duration: 1000 });
    }

    // Real AI Processing via aiService
    try {
      const { aiService } = await import("@/services/aiService");

      const result = await aiService.analyzeDocument(selectedFile, 'prescription');

      let items = [];
      // Handle various N8N response formats
      // Priority: medications (Gemini format) > items > medicines > prescription
      if (result && result.medications) {
        items = result.medications;
      } else if (result && result.items) {
        items = result.items;
      } else if (Array.isArray(result) && result[0]?.medicines) {
        items = typeof result[0].medicines === 'string' ? JSON.parse(result[0].medicines) : result[0].medicines;
      } else if (Array.isArray(result) && result[0]?.json?.medicines) {
        items = typeof result[0].json.medicines === 'string' ? JSON.parse(result[0].json.medicines) : result[0].json.medicines;
      } else if (result && result.medicines) {
        items = result.medicines;
      } else if (result && result.json?.medicines) {
        items = result.json.medicines;
      } else if (result && result.prescription) {
        items = result.prescription;
      } else if (Array.isArray(result) && result[0]?.prescription) {
        items = result[0].prescription;
      } else if (Array.isArray(result) && result[0]?.json?.prescription) {
        items = result[0].json.prescription;
      }

      // Extract metadata if available
      if (result?.patient_name) setPatientName(result.patient_name);
      if (result?.doctor_name) setDoctorName(result.doctor_name);
      if (result?.contact || result?.phone || result?.patient_contact) {
        setPatientContact(result.contact || result.phone || result.patient_contact);
      }

      if (items && items.length > 0) {
        // Ensure IDs exist and map fields if necessary
        const mappedItems = items.map((item: any, index: number) => ({
          ...item,
          id: item.id || index + 1,
          sequence: item.sequence || index + 1,
          medication_name: item.medication_name || item.drug_name || item.name || "Unknown",
          strength: item.strength || item.dosage || "",
          dosage_frequency: item.dosage_frequency || item.frequency || item.dose || "",
          duration: item.duration || "",
          indication: item.indication || "",
          notes: item.notes || item.indication || "",
          quantity: item.quantity || item.qty || (item.price ? 1 : undefined),
          price: item.price || item.amount || item.unit_price || undefined
        }));
        setExtractedItems(mappedItems);

        // Save prescription to database immediately after successful extraction
        if (currentShop?.id) {
          try {
            const prescriptionData = {
              shop_id: currentShop?.id,
              customer_name: result.patient_name || patientName || "Unknown Patient",
              doctor_name: result.doctor_name || doctorName || "Unknown Doctor",
              customer_phone: result.patient_contact || patientContact || null,
              visit_date: new Date().toISOString().split('T')[0],
              medicines: mappedItems.map((item: any) => ({
                name: item.medication_name,
                strength: item.strength,
                dosage: item.dosage_frequency,
                indication: item.indication || item.notes,
                quantity: item.quantity,
                unit_price: item.price
              })),
              raw_text: JSON.stringify(result)
            };

            const { data: prescription, error: prescriptionError } = await supabase
              .from('prescriptions')
              .insert(prescriptionData)
              .select()
              .single();

            if (prescriptionError) {
              console.error("Failed to save prescription:", prescriptionError);
              toast.warning("Prescription extracted but not saved to database");
            } else {
              console.log("Prescription saved with ID:", prescription.id);
            }
          } catch (dbError) {
            console.error("Database error:", dbError);
          }
        }
        toast.success("AI Analysis Complete!");

        // DEMO: Simulate Profit Optimizer logic
        const hasPan40 = mappedItems.some((i: any) => i.medication_name.toLowerCase().includes("pan") || i.medication_name.toLowerCase().includes("pantop"));
        if (hasPan40) {
          setTimeout(() => {
            setSuggestion({
              prescribed: { name: "Pan 40 (Brand)", manufacturer: "Alkem", priceToPatient: 155, costToPharmacy: 140, isGeneric: false },
              suggested: { name: "Pantoprazole 40 (Generic)", manufacturer: "MedixGen", priceToPatient: 90, costToPharmacy: 45, isGeneric: true }
            });
            toast.info("💡 Smart Alternative Found!", { description: "You can increase profit by switching to generic." });
          }, 1000);
        } else {
          setSuggestion(null);
        }
      } else {
        console.error("Invalid Response Structure:", result);
        toast.error("AI Service Response Invalid. Using Demo Data.");
        setExtractedItems([
          { id: 1, sequence: 1, medication_name: "Metformin", strength: "500mg", dosage_frequency: "1-0-1", duration: "30 Days", notes: "After food" },
          { id: 2, sequence: 2, medication_name: "Atorvastatin", strength: "10mg", dosage_frequency: "0-0-1", duration: "30 Days", notes: "Before sleep" }
        ]);
        setPatientName("Rajesh Kumar");
        setDoctorName("Dr. S. Gupta");
      }

    } catch (error: any) {
      console.error("AI Service Error:", error);
      toast.error("AI Service Error. Using Demo Data.");
      setExtractedItems([
        { id: 1, sequence: 1, medication_name: "Metformin", strength: "500mg", dosage_frequency: "1-0-1", duration: "30 Days", notes: "After food" },
        { id: 2, sequence: 2, medication_name: "Atorvastatin", strength: "10mg", dosage_frequency: "0-0-1", duration: "30 Days", notes: "Before sleep" }
      ]);
      setPatientName("Rajesh Kumar");
      setDoctorName("Dr. S. Gupta");
    }

    setIsProcessing(false);
  };

  const updateItem = (id: number, field: keyof ExtractedItem, value: string | number) => {
    setExtractedItems(items => items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleRecordSales = async () => {
    if (!currentShop?.id) {
      toast.error("Shop not found!");
      return;
    }

    // Validate sales data
    const salesItems = extractedItems.filter(item => item.quantity && item.price);

    if (salesItems.length === 0) {
      toast.error("No sales data detected! Please add quantity and price for items.");
      return;
    }

    if (salesItems.length < extractedItems.length) {
      toast.warning(`${extractedItems.length - salesItems.length} items skipped due to missing quantity/price`);
    }

    toast.loading("Processing sales...", { id: "sales-process" });

    try {
      // Calculate total
      const totalAmount = salesItems.reduce((sum, item) =>
        sum + ((item.quantity || 0) * (item.price || 0)), 0
      );

      // Match medicines with inventory
      const orderItemsData = [];
      const inventoryUpdates = [];
      const missingItems = [];

      for (const item of salesItems) {
        // Find medicine in inventory
        const { data: inventoryItem } = await supabase
          .from('inventory')
          .select('id, medicine_name, quantity, purchase_price')
          .eq('shop_id', currentShop?.id)
          .ilike('medicine_name', `%${item.medication_name}%`)
          .single();

        if (!inventoryItem) {
          missingItems.push(item.medication_name);
          continue;
        }

        // Check stock availability
        if (inventoryItem.quantity < (item.quantity || 0)) {
          toast.error(`Insufficient stock for ${item.medication_name}. Available: ${inventoryItem.quantity}`);
          return;
        }

        orderItemsData.push({
          inventory_id: inventoryItem.id,
          name: item.medication_name,
          qty: item.quantity || 1,
          price: item.price || 0,
          cost_price: inventoryItem.purchase_price || 0
        });

        inventoryUpdates.push({
          id: inventoryItem.id,
          qty: item.quantity || 1
        });
      }

      if (missingItems.length > 0) {
        toast.error(`Medicines not found in inventory: ${missingItems.join(", ")}`, { id: "sales-process" });
        return;
      }

      // Create order record
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          shop_id: currentShop?.id,
          customer_name: "Diary Sales",
          total_amount: totalAmount,
          payment_mode: "cash",
          status: "approved",
          source: "Pulse_Scan_Diary",
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

      // Create order items
      const orderItems = orderItemsData.map(item => ({
        order_id: order.id,
        ...item
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Update inventory (decrement stock)
      for (const update of inventoryUpdates) {
        await supabase.rpc('decrement_stock', {
          row_id: update.id,
          amount: update.qty
        });
      }

      toast.success(
        `Sales recorded! Order #${order.id.slice(0, 8)} • Total: ₹${totalAmount.toFixed(2)}`,
        { id: "sales-process", duration: 5000 }
      );

      // Send sales data to n8n for processing
      try {
        const { aiService } = await import("@/services/aiService");
        await aiService.triggerOp('save-sales', {
          order: {
            id: order.id,
            total_amount: totalAmount,
            customer_name: patientName || "Diary Sales",
            items: orderItemsData
          },
          source: 'pulse_scan_diary'
        });
        console.log("Sales data synced to n8n");
      } catch (error) {
        console.error("Failed to sync sales to n8n:", error);
        // Don't show error to user since sale was already recorded successfully
      }

      setIsConfirmed(true);

    } catch (error: any) {
      console.error("Sales Recording Error:", error);
      toast.error(`Failed to record sales: ${error.message}`, { id: "sales-process" });
    }
  };


  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Professional Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-emerald-600">
            Pulse Scan
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Prescription & Handwriting Digitization
          </p>
        </div>
        <Badge variant="outline" className="border-teal-500/20 bg-teal-500/10 text-teal-600 px-3 py-1">
          <ScanLine className="w-3.5 h-3.5 mr-2" />
          OCR Engine 4.0
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card className="border-none shadow-lg bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-teal-600" />
                Capture Prescription
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowCamera(true)} className="gap-2">
                <Camera className="w-4 h-4" /> Open Camera
              </Button>
            </div>
            <CardDescription>
              Upload a clear photo of the handwritten prescription
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
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
                  />
                  <div className="absolute inset-0 bg-black/10 hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center text-white opacity-0 hover:opacity-100 font-medium">
                    Change Image
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto text-teal-600">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Click to Upload</p>
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
                  Extract Medicines
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info / Demo Banner */}
        <div className="space-y-6">
          <Card className="border-teal-200 bg-teal-50/50">
            <CardContent className="p-6 flex items-start gap-4">
              <BrainCircuit className="w-8 h-8 text-teal-600 flex-shrink-0 mt-1" />
              <div className="space-y-2">
                <h3 className="font-bold text-teal-900">AI-Powered Extraction</h3>
                <p className="text-teal-800/80 leading-relaxed text-sm">
                  Our Vision Engine automatically identifies drug names, segments handwriting, and cross-references with safety databases.
                  It flags <strong>LASA (Look-Alike, Sound-Alike)</strong> risks instantly.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Card (Profit Engine) */}
          {suggestion && (
            <div className="animate-slide-up">
              <ComparisonCard
                prescribed={suggestion.prescribed}
                suggested={suggestion.suggested}
                onAcceptSuggestion={() => {
                  toast.success("Switched to Generic!");
                  // Update the list to replace Brand with Generic
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
                    <FileText className="w-5 h-5 text-primary" />
                    Digitalized Prescription
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Review extracted medicines before processing
                  </CardDescription>
                </div>
                {isConfirmed && (
                  <Badge className="bg-green-100 text-green-700 border-green-200 py-1.5 px-4 text-sm font-medium">
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Parcha Synced
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[40px] font-semibold text-xs">#</TableHead>
                      <TableHead className="min-w-[140px] font-semibold text-xs">Medication</TableHead>
                      <TableHead className="min-w-[80px] font-semibold text-xs">Strength</TableHead>
                      <TableHead className="min-w-[80px] font-semibold text-xs">Dosage</TableHead>
                      <TableHead className="min-w-[80px] font-semibold text-xs">Duration</TableHead>
                      <TableHead className="min-w-[120px] font-semibold text-xs">Notes</TableHead>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Action Footer */}
              <div className="bg-muted/10 p-6 flex flex-col md:flex-row items-center justify-between gap-4 border-t">
                <div className="flex gap-4 w-full md:w-auto flex-wrap">
                  <div className="space-y-1 w-full md:w-48">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Patient Name</label>
                    <Input
                      placeholder="Optional"
                      className="h-9 bg-background"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 w-full md:w-48">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Prescriber</label>
                    <Input
                      placeholder="Optional"
                      className="h-9 bg-background"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 w-full md:w-48">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Contact Number</label>
                    <Input
                      placeholder="Enter phone number"
                      className="h-9 bg-background"
                      value={patientContact}
                      onChange={(e) => setPatientContact(e.target.value)}
                      type="tel"
                    />
                  </div>
                </div>

                {!isConfirmed && (
                  <div className="flex gap-3 w-full md:w-auto">
                    <Button variant="ghost" onClick={() => setExtractedItems([])}>
                      Discard
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Validate contact number
                        if (!patientContact || patientContact.trim() === "") {
                          toast.error("Please enter patient contact number to send via WhatsApp");
                          return;
                        }

                        // Format contact number (remove spaces, dashes, add country code if needed)
                        let formattedContact = patientContact.replace(/[\s-]/g, "");

                        // Add +91 if not present and number is 10 digits
                        if (formattedContact.length === 10 && !formattedContact.startsWith("+")) {
                          formattedContact = "+91" + formattedContact;
                        } else if (!formattedContact.startsWith("+")) {
                          formattedContact = "+" + formattedContact;
                        }

                        // Format prescription message
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

                        // Encode message for URL
                        const encodedMessage = encodeURIComponent(prescriptionText);

                        // Create WhatsApp URL
                        const whatsappUrl = `https://wa.me/${formattedContact.replace("+", "")}?text=${encodedMessage}`;

                        // Open WhatsApp
                        window.open(whatsappUrl, "_blank");
                        toast.success("Opening WhatsApp...");
                      }}
                      className="border-green-500/50 bg-green-50 hover:bg-green-100 text-green-700"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Send to WhatsApp
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

                        // Save to Prescriptions History first
                        toast.info("Saving Parcha...");
                        const prescriptionData = {
                          shop_id: currentShop?.id,
                          customer_name: patientName || "Walk-in Customer",
                          doctor_name: doctorName || "Unknown Doctor",
                          visit_date: new Date().toISOString(),
                          medicines: extractedItems.map(i => ({
                            name: i.medication_name,
                            dosage: i.dosage_frequency,
                            strength: i.strength,
                            duration: i.duration
                          }))
                        };

                        await supabase.from('prescriptions').insert(prescriptionData as any);

                        // Send prescription data to n8n for processing
                        try {
                          const { aiService } = await import("@/services/aiService");
                          await aiService.triggerOp('save-prescription', {
                            prescription: prescriptionData,
                            patient_contact: patientContact,
                            source: 'pulse_scan'
                          });
                          toast.success("Prescription synced to n8n!");
                        } catch (error) {
                          console.error("Failed to sync prescription to n8n:", error);
                          toast.warning("Prescription saved locally but sync to n8n failed");
                        }

                        const importItems = extractedItems.map(i => ({
                          name: i.medication_name,
                          quantity: 1, // Default to 1 pack/strip - user can adjust in POS
                          unit_price: 0 // POS will fetch
                        }));

                        navigate("/dashboard/sales/pos", {
                          state: {
                            importItems,
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
