import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Eye
} from "lucide-react";

const DiaryScan = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

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
    
    // Simulate OCR processing - In production, this would call n8n webhook
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulated extracted text
    const simulatedText = `Patient Name: John Doe
Date: ${new Date().toLocaleDateString()}

Prescription:
1. Paracetamol 500mg - 10 tablets
   Dosage: 1 tablet twice daily after meals
   
2. Amoxicillin 250mg - 15 capsules
   Dosage: 1 capsule thrice daily
   
3. Omeprazole 20mg - 10 tablets
   Dosage: 1 tablet before breakfast

Doctor: Dr. Smith
License: MED-12345`;

    setExtractedText(simulatedText);
    setIsProcessing(false);
    toast.success("Text extracted successfully!");
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    toast.success("Prescription confirmed! Items will be added to daily sales.");
  };

  const handleReject = () => {
    setExtractedText("");
    setIsConfirmed(false);
    toast.info("Please edit the extracted text and try again");
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
                  Processing...
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
                  Extracted Text
                </CardTitle>
                <CardDescription>
                  Review and edit before confirming
                </CardDescription>
              </div>
              {isConfirmed && (
                <Badge className="bg-success text-success-foreground">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Confirmed
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Extracted text will appear here after scanning..."
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              disabled={isConfirmed}
            />

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
                  Items have been added to today's sales record
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
