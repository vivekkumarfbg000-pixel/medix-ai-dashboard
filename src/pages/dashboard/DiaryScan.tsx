import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Tesseract from 'tesseract.js';
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
  Edit2
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

interface ExtractedItem {
  id: number;
  name: string;
  qty: string;
  price: string;
  dosage: string;
  type: "detailed" | "simple";
}

const DiaryScan = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [showRawText, setShowRawText] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const parseTextToItems = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const items: ExtractedItem[] = [];

    lines.forEach((line, index) => {
      // Basic heuristic to detect structure
      // Check for price (e.g., $10, 10.00, Rs. 100) and Qty (e.g., 10 qty, x10)
      const priceMatch = line.match(/(\$|Rs\.?|₹)\s?(\d+(\.\d{2})?)/i);
      const qtyMatch = line.match(/(\d+)\s*(qty|tabs|caps|tablets|capsules|units)/i) || line.match(/x\s*(\d+)/i);
      const dosageMatch = line.match(/(\d+)\s*(mg|ml|g|mcg)/i);

      // Clean the name by removing matched parts and leading numbers
      let name = line
        .replace(priceMatch?.[0] || '', '')
        .replace(qtyMatch?.[0] || '', '')
        .replace(dosageMatch?.[0] || '', '')
        .replace(/^\d+[\.|)]\s*/, '') // Remove "1. " or "1) "
        .trim();

      if (priceMatch || qtyMatch || dosageMatch) {
        items.push({
          id: Date.now() + index,
          name: name || "Unknown Item",
          qty: qtyMatch?.[1] || qtyMatch?.[0] || "",
          price: priceMatch?.[0] || "",
          dosage: dosageMatch?.[0] || "",
          type: "detailed"
        });
      } else {
        // Simple item (just name)
        if (name.length > 2) { // Filter out noise
          items.push({
            id: Date.now() + index,
            name: name,
            qty: "",
            price: "",
            dosage: "",
            type: "simple"
          });
        }
      }
    });
    setExtractedItems(items);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setExtractedText("");
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
      setExtractedText("");
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

    try {
      const result = await Tesseract.recognize(
        selectedFile,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      const text = result.data.text;
      setExtractedText(text);
      parseTextToItems(text);

      toast.success("Text extracted and parsed successfully!");
    } catch (error) {
      console.error("OCR Error:", error);
      toast.error("Failed to extract text. Please try again.");
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    toast.success("Prescription confirmed! Items will be added to daily sales.");
  };

  const handleReject = () => {
    setExtractedText("");
    setExtractedItems([]);
    setIsConfirmed(false);
    toast.info("Please edit the extracted text and try again");
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
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Diary Scanning</h1>
        <p className="text-muted-foreground mt-1">
          Upload prescription images for OCR text extraction
        </p>
      </div>

      {/* Info Banner */}
      <Card className="border-info/50 bg-info/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Human-in-the-Loop Verification</p>
            <p className="text-muted-foreground">
              Always verify extracted text before confirming. AI may misread "10mg" as "100mg" - your review ensures patient safety.
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
              Drag & drop or click to upload a prescription image
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
                    className="max-h-64 mx-auto rounded-lg object-contain"
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
                  <p className="text-xs text-muted-foreground">
                    Supports: JPG, PNG, WEBP (Max 10MB)
                  </p>
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
                  Processing... {progress > 0 && `${progress}%`}
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Extract Text (OCR)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Extracted Text Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Extracted Items
                </CardTitle>
                <CardDescription>
                  Review and edit before confirming
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRawText(!showRawText)}
                >
                  {showRawText ? <List className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                </Button>
                {isConfirmed && (
                  <Badge className="bg-success text-success-foreground">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Confirmed
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {!showRawText && extractedItems.length > 0 ? (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine Name</TableHead>
                      <TableHead className="w-[80px]">Qty</TableHead>
                      <TableHead className="w-[80px]">Price</TableHead>
                      <TableHead className="w-[100px]">Dosage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Input
                            value={item.name}
                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          {/* Only show input if it was detected as detailed or user wants to add */}
                          <Input
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                            className="h-8"
                            placeholder="-"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.price}
                            onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                            className="h-8"
                            placeholder="-"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.dosage}
                            onChange={(e) => updateItem(item.id, 'dosage', e.target.value)}
                            className="h-8"
                            placeholder="-"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Textarea
                placeholder="Extracted text will appear here after scanning..."
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                disabled={isConfirmed}
              />
            )}

            {extractedText && !isConfirmed && (
              <div className="flex gap-3">
                <Button onClick={handleConfirm} className="flex-1 bg-success hover:bg-success/90">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm & Process
                </Button>
                <Button onClick={handleReject} variant="outline" className="flex-1">
                  <XCircle className="w-4 h-4 mr-2" />
                  Edit Required
                </Button>
              </div>
            )}

            {isConfirmed && (
              <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                <p className="text-sm text-success font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Prescription verified and processed
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {extractedItems.length} items have been added to today's sales record
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DiaryScan;
