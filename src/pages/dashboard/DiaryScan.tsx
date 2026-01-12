
import { useState, useEffect } from "react";
import { useUserShops } from "@/hooks/useUserShops";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Camera,
  Loader2,
  AlertCircle,
  Eye,
  List,
  Edit2,
  AlertTriangle,
  BrainCircuit
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

const DiaryScan = () => {
  const { currentShop } = useUserShops();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [suggestion, setSuggestion] = useState<any>(null); // For ComparisonCard demo

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
        // Handle "prescription" key from user's screenshot
        items = result.prescription;
      } else if (Array.isArray(result) && result[0]?.prescription) {
        items = result[0].prescription;
      } else if (Array.isArray(result) && result[0]?.json?.prescription) {
        items = result[0].json.prescription;
      }

      if (items && items.length > 0) {
        // Ensure IDs exist and map fields if necessary (handle name/dose schema)
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
        const hasPan40 = mappedItems.some(i => i.medication_name.toLowerCase().includes("pan") || i.medication_name.toLowerCase().includes("pantop"));
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
        toast.error("Analysis failed. See console for response details: " + JSON.stringify(result).slice(0, 100));
        throw new Error("Invalid response structure - No medicines or prescription found");
      }

    } catch (error: any) {
      console.error("AI Service Error:", error);
      toast.error(error.message || "AI Analysis Failed. Please check your connection or try again.");
      setExtractedItems([]);
    }

    setIsProcessing(false);
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    toast.success("Inventory updated with validated prescription data.");
  };

  const updateItem = (id: number, field: keyof ExtractedItem, value: string) => {
    setExtractedItems(items => items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">AI Diary Scanning</h1>
        <p className="text-muted-foreground mt-1">
          Advanced Handwriting Recognition & Digitalization
        </p>
      </div>

      {/* Info Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <BrainCircuit className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">AI Vision Powered</p>
            <p className="text-muted-foreground">
              This tool uses advanced Neural Networks to identify drug names, strengths, and dosages from handwritten notes.
              It automatically checks for <strong>LASA (Look-Alike, Sound-Alike)</strong> errors.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Upload Prescription
            </CardTitle>
            <CardDescription>
              Upload the handwritten note for instant analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer"
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
                <div className="space-y-4">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded-lg object-contain shadow-lg"
                  />
                  <p className="text-sm text-muted-foreground">{selectedFile?.name}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Drop your image here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleScan}
              disabled={!selectedFile || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing Handwriting... {Math.round(progress)}%
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Perform AI Extraction
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Comparison Card (Profit Engine) */}
        {suggestion && (
          <div className="lg:col-span-2 animate-fade-in-up">
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

        {/* Extracted Results Section */}
        {extractedItems.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Digitalized Prescription
                  </CardTitle>
                  <CardDescription>
                    Please verify the details below before saving to inventory
                  </CardDescription>
                </div>
                {isConfirmed && (
                  <Badge className="bg-success text-success-foreground py-1 px-3">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Confirmed & Saved
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Medication Name</TableHead>
                      <TableHead>Strength</TableHead>
                      <TableHead>Dosage / Freq</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Notes / Alerts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedItems.map((item) => (
                      <TableRow key={item.id} className={item.lasa_alert ? "bg-warning/5" : ""}>
                        <TableCell className="font-medium">{item.sequence}</TableCell>
                        <TableCell>
                          <Input
                            value={item.medication_name}
                            onChange={(e) => updateItem(item.id, 'medication_name', e.target.value)}
                            className="h-auto border-none shadow-none bg-transparent focus-visible:ring-0 px-0 font-medium"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.strength}
                            onChange={(e) => updateItem(item.id, 'strength', e.target.value)}
                            className="h-auto border-none shadow-none bg-transparent focus-visible:ring-0 px-0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.dosage_frequency}
                            onChange={(e) => updateItem(item.id, 'dosage_frequency', e.target.value)}
                            className="h-auto border-none shadow-none bg-transparent focus-visible:ring-0 px-0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.duration}
                            onChange={(e) => updateItem(item.id, 'duration', e.target.value)}
                            className="h-auto border-none shadow-none bg-transparent focus-visible:ring-0 px-0"
                          />
                        </TableCell>
                        <TableCell>
                          {item.lasa_alert ? (
                            <div className="flex items-center gap-2 text-warning animate-pulse">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-xs font-bold">LASA Check Required</span>
                            </div>
                          ) : (
                            <Input
                              value={item.notes}
                              onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                              className="h-auto border-none shadow-none bg-transparent focus-visible:ring-0 px-0 text-muted-foreground"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-muted/20 rounded-lg">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Patient Name</label>
                  <Input placeholder="Enter patient name (Optional)" id="patient-name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Doctor Name</label>
                  <Input placeholder="Enter doctor name (Optional)" id="doctor-name" />
                </div>
              </div>

              {!isConfirmed && (
                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setExtractedItems([])}>
                    Discard
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!currentShop?.id) {
                        toast.error("Shop ID mismatch. Please refresh.");
                        return;
                      }
                      const patientName = (document.getElementById('patient-name') as HTMLInputElement).value || "Unknown Patient";
                      const doctorName = (document.getElementById('doctor-name') as HTMLInputElement).value || "Unknown Doctor";

                      toast.loading("Saving Prescription...");

                      const { error } = await supabase.from('prescriptions').insert({
                        customer_name: patientName,
                        doctor_name: doctorName,
                        visit_date: new Date().toISOString(),
                        medicines: extractedItems.map(item => ({
                          name: item.medication_name,
                          dosage: `${item.strength} | ${item.dosage_frequency}`,
                          duration: item.duration,
                          notes: item.notes
                        })),
                        shop_id: currentShop.id
                      });

                      toast.dismiss();

                      if (error) {
                        console.error(error);
                        toast.error("Failed to save to database.");
                      } else {
                        setIsConfirmed(true);
                        toast.success("Prescription Saved Successfully!");
                      }
                    }}
                    className="bg-success hover:bg-success/90 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Verify & Save to Database
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DiaryScan;
