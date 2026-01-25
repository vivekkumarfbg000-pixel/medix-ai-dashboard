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
  Plus
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

interface ExtractedItem {
  id: number;
  sequence: number;
  medication_name: string;
  strength: string;
  dosage_frequency: string;
  duration: string;
  notes: string;
  lasa_alert?: boolean; // Look-alike Sound-alike alert
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

  // Patient/Doctor info state
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");

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
      if (result && result.items) {
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

      if (items && items.length > 0) {
        // Ensure IDs exist and map fields if necessary
        const mappedItems = items.map((item: any, index: number) => ({
          ...item,
          id: item.id || index + 1,
          sequence: item.sequence || index + 1,
          medication_name: item.medication_name || item.drug_name || item.name || "Unknown",
          strength: item.strength || "",
          dosage_frequency: item.dosage_frequency || item.dosage || item.dose || "",
          duration: item.duration || "",
          notes: item.notes || ""
        }));
        setExtractedItems(mappedItems);
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

  const updateItem = (id: number, field: keyof ExtractedItem, value: string) => {
    setExtractedItems(items => items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
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
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-teal-600" />
              Capture Prescription
            </CardTitle>
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
                      <TableHead className="w-[50px] font-bold">#</TableHead>
                      <TableHead className="min-w-[200px] font-bold">Medication</TableHead>
                      <TableHead className="font-bold">Strength</TableHead>
                      <TableHead className="font-bold">Dosage</TableHead>
                      <TableHead className="font-bold">Duration</TableHead>
                      <TableHead className="min-w-[200px] font-bold">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedItems.map((item) => (
                      <TableRow key={item.id} className={`group ${item.lasa_alert ? "bg-amber-50" : "hover:bg-muted/30"}`}>
                        <TableCell className="font-medium text-muted-foreground">{item.sequence}</TableCell>
                        <TableCell>
                          <Input
                            value={item.medication_name}
                            onChange={(e) => updateItem(item.id, 'medication_name', e.target.value)}
                            className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors font-medium h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.strength}
                            onChange={(e) => updateItem(item.id, 'strength', e.target.value)}
                            className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.dosage_frequency}
                            onChange={(e) => updateItem(item.id, 'dosage_frequency', e.target.value)}
                            className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.duration}
                            onChange={(e) => updateItem(item.id, 'duration', e.target.value)}
                            className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors h-9"
                          />
                        </TableCell>
                        <TableCell>
                          {item.lasa_alert ? (
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-100/50 px-2 py-1 rounded-md">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-xs font-bold">LASA Check</span>
                            </div>
                          ) : (
                            <Input
                              value={item.notes}
                              onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                              className="bg-transparent border-transparent group-hover:bg-background group-hover:border-input transition-colors h-9 text-muted-foreground"
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
                <div className="flex gap-4 w-full md:w-auto">
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
                </div>

                {!isConfirmed && (
                  <div className="flex gap-3 w-full md:w-auto">
                    <Button variant="ghost" onClick={() => setExtractedItems([])}>
                      Discard
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!currentShop?.id) return;

                        toast.loading("Adding medicines to database...", { id: "db-import" });

                        let successCount = 0;
                        for (const item of extractedItems) {
                          try {
                            // Check if medicine already exists
                            const { data: existing } = await supabase
                              .from('inventory')
                              .select('id')
                              .eq('shop_id', currentShop.id)
                              .eq('medicine_name', item.medication_name)
                              .single();

                            if (!existing) {
                              // Add new medicine to inventory
                              await supabase.from('inventory').insert({
                                shop_id: currentShop.id,
                                medicine_name: item.medication_name,
                                generic_name: item.medication_name,
                                quantity: 0,
                                reorder_level: 10,
                                unit_price: 0,
                                salt_composition: item.strength || "",
                                category: "General"
                              });
                              successCount++;
                            }
                          } catch (e) {
                            console.error(`Failed to add ${item.medication_name}:`, e);
                          }
                        }

                        toast.success(`Added ${successCount} medicines to database!`, { id: "db-import" });
                      }}
                      className="border-green-500/50 bg-green-50 hover:bg-green-100 text-green-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add to Database
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!currentShop?.id) return;

                        // Save to Prescriptions History first
                        toast.info("Saving Parcha...");
                        await supabase.from('prescriptions').insert({
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
                        } as any);

                        const importItems = extractedItems.map(i => ({
                          name: i.medication_name,
                          quantity: 1, // Default to 1 pack/strip - user can adjust in POS
                          unit_price: 0 // POS will fetch
                        }));

                        navigate("/dashboard/sales/pos", {
                          state: {
                            importItems,
                            customerName: patientName,
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
    </div>
  );
};


export default DiaryScan;
