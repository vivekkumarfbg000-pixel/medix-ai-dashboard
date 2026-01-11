
import { useState } from "react";
import { Upload, FileText, CheckCircle, AlertTriangle, Send, Activity, ArrowRight, Camera, Utensils, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { labService, LabAnalysisReport } from "@/services/labService";
import { whatsappService } from "@/services/whatsappService";

const LabAnalyzer = () => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [report, setReport] = useState<LabAnalysisReport | null>(null);

    const [patientPhone, setPatientPhone] = useState("");

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFile = async (uploadedFile: File) => {
        setFile(uploadedFile);
        setAnalyzing(true);
        setReport(null);
        setProgress(0);

        // Simulate progress
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) return prev;
                return prev + 10;
            });
        }, 300);

        try {
            const result = await labService.analyzeReport(uploadedFile);
            setReport(result);
            setProgress(100);
            toast.success("Analysis Complete! AI Insights Generated.");
        } catch (error) {
            console.error("Lab Analysis Error:", error);
            toast.error(`Failed to analyze report: ${error.message || "Unknown error"}`);
        } finally {
            clearInterval(interval);
            setAnalyzing(false);
        }
    };

    const handleShare = () => {
        if (!report) return;

        const link = whatsappService.generateReportLink(patientPhone, {
            summary: report.summary,
            diseasePossibility: report.diseasePossibility,
            diet: report.recommendations.diet,
            nextSteps: report.recommendations.nextSteps
        });

        window.open(link, '_blank');
        toast.success("WhatsApp opened with report summary!");
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Lab Report Analyzer</h1>
                    <p className="text-muted-foreground mt-1">AI-Powered Diagnostics & Interpretation from Lab Reports</p>
                </div>
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                    <Activity className="w-4 h-4 mr-1" /> Beta AI-v1
                </Badge>
            </div>

            {!report && (
                <Card
                    className={`border-2 border-dashed transition-all duration-300 ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDragging ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {analyzing ? <Activity className="w-8 h-8 animate-pulse" /> : <Upload className="w-8 h-8" />}
                        </div>

                        {analyzing ? (
                            <div className="w-full max-w-sm space-y-4">
                                <h3 className="text-lg font-semibold">Analyzing Medical Data...</h3>
                                <Progress value={progress} className="h-2" />
                                <p className="text-sm text-muted-foreground">Extracting values • Comparing Ranges • Generating Insights</p>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-lg font-semibold mb-2">Upload or Scan Report</h3>
                                <p className="text-sm text-muted-foreground mb-6">Supports PDF, JPG, PNG (Max 10MB)</p>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md">
                                    <div className="relative flex-1">
                                        <Button size="lg" variant="outline" className="w-full gap-2 border-primary/20 hover:bg-primary/5">
                                            <Upload className="w-4 h-4" /> Upload File
                                        </Button>
                                        <input
                                            type="file"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                            accept=".pdf,.jpg,.jpeg,.png"
                                        />
                                    </div>
                                    <div className="relative flex-1">
                                        <Button size="lg" className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20">
                                            <Camera className="w-4 h-4" /> Scan Report
                                        </Button>
                                        <input
                                            type="file"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                            accept="image/*"
                                            capture="environment"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {report && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    {/* Summary Header */}
                    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-blue-800">
                                <Activity className="w-5 h-5" /> AI Health Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-lg font-medium text-blue-900 mb-2">{report.summary}</p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {report.diseasePossibility.map((d, i) => (
                                    <Badge key={i} variant="destructive" className="text-sm">{d}</Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Detailed Parameters */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Extracted Parameters</CardTitle>
                                <CardDescription>Values extracted from the uploaded document</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {report.results.map((res, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                                            <div className="flex-1">
                                                <p className="font-semibold">{res.parameter}</p>
                                                <p className="text-xs text-muted-foreground">Range: {res.normalRange} {res.unit}</p>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div>
                                                    <p className={`font-bold text-lg ${res.color}`}>{res.value}</p>
                                                    <p className="text-xs text-muted-foreground">{res.unit}</p>
                                                </div>
                                                <Badge variant={res.status === "Normal" ? "outline" : "destructive"}>
                                                    {res.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* AI Action Plan */}
                        <div className="space-y-6">
                            <Card className="border-green-200 bg-green-50/50">
                                <CardHeader>
                                    <CardTitle className="text-green-800 flex items-center gap-2 text-lg">
                                        <CheckCircle className="w-5 h-5" /> Recommendations
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                                            <Utensils className="w-4 h-4" /> Diet & Nutrition
                                        </h4>
                                        <div className="space-y-2">
                                            {report.recommendations.diet.map((item, i) => (
                                                <div key={i} className="flex items-center p-2 bg-white/60 rounded-md shadow-sm border border-green-100">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 flex-shrink-0" />
                                                    <span className="text-sm text-green-800">{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                                            <Stethoscope className="w-4 h-4" /> Next Steps
                                        </h4>
                                        <div className="space-y-2">
                                            {report.recommendations.nextSteps.map((item, i) => (
                                                <div key={i} className="flex items-center p-2 bg-white/60 rounded-md shadow-sm border border-green-100">
                                                    <ArrowRight className="w-3 h-3 text-green-600 mr-2 flex-shrink-0" />
                                                    <span className="text-sm text-green-800">{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Patient Phone (+91)</label>
                                    <input
                                        type="tel"
                                        placeholder="9876543210"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={patientPhone}
                                        onChange={(e) => setPatientPhone(e.target.value)}
                                    />
                                </div>
                                <Button className="w-full h-12 text-lg shadow-lg bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={handleShare}>
                                    <Send className="w-5 h-5 mr-2" /> Share Report on WhatsApp
                                </Button>
                            </div>

                            <Button variant="outline" className="w-full" onClick={() => setReport(null)}>
                                Analyze Another Report
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LabAnalyzer;
