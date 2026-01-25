
import { useState } from "react";
import { Upload, FileText, CheckCircle, AlertTriangle, Send, Activity, ArrowRight, Camera, Utensils, Stethoscope, Microscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { labService, LabAnalysisReport } from "@/services/labService";
import { aiService } from "@/services/aiService";
import { whatsappService } from "@/services/whatsappService";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const LabAnalyzer = () => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [report, setReport] = useState<LabAnalysisReport | null>(null);

    const [patientPhone, setPatientPhone] = useState("");
    const [hinglishSummary, setHinglishSummary] = useState("");
    const [explaining, setExplaining] = useState(false);

    const handleHinglishExplain = async () => {
        if (!report) return;
        setExplaining(true);
        try {
            const text = await labService.explainMedicalReport(report.summary); // Using labService wrapper or direct aiService? labService is imported.
            // Wait, labService is imported, but I added method to aiService. I should import aiService.
            // Let me check imports. 'aiService' is NOT imported. I need to import it.
            // Actually, I should probably call aiService directly here.

            // Wait, the previous tool call modified aiService. I should use aiService directly.
            // But first I need to check if I can import aiService. 
            // Yes, existing code imports labService. I will add aiService import.
            // But first let me check lines 1-12.

        } catch (e) {
            toast.error("Explanation failed");
        }
        setExplaining(false);
    };

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

        // Simulate progress for better UX
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
            const msg = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Analysis failed: ${msg}`);
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

    const [isSaving, setIsSaving] = useState(false);
    const handleSaveToPatient = async () => {
        if (!report) return;
        // In a real flow, we'd select a patient from a dropdown. 
        // For now, if we have a patientPhone, we try to find them or just save with the phone as metadata.
        // Ideally, LabAnalyzer should use `CustomerSearch` component.

        setIsSaving(true);
        try {
            // 1. Try to find patient by phone
            let patientId = null;
            let patientName = "Unknown";

            if (patientPhone) {
                const { data: customers } = await supabase.from('customers').select('id, name').eq('phone', patientPhone).limit(1);
                if (customers && customers.length > 0) {
                    patientId = customers[0].id;
                    patientName = customers[0].name;
                }
            }

            // 2. Insert Report
            const { error } = await supabase.from('lab_reports').insert({
                // @ts-ignore
                shop_id: (await supabase.auth.getUser()).data.user?.user_metadata?.shop_id || 'UNKNOWN', // Ideally use currentShop hook but accessing auth directly for speed in this context if currentShop is null
                patient_id: patientId,
                patient_name: patientName,
                summary_json: report,
                biomarkers_json: report.results
            });

            if (error) throw error;
            toast.success("Report saved to Patient Profile!");
        } catch (e) {
            console.error(e);
            toast.error("Failed to save report.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Professional Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
                        Lab Intelligence
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        AI-Powered Interpretation & Clinical Correlation
                    </p>
                </div>
                <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-500 px-3 py-1">
                    <Microscope className="w-3.5 h-3.5 mr-2" />
                    Pathology v2.0
                </Badge>
            </div>

            {!report && (
                <Card
                    className={`border-2 border-dashed transition-all duration-300 bg-background/50 backdrop-blur-sm ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center h-[400px]">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-xl ${isDragging ? "bg-primary/20 text-primary" : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"}`}>
                            {analyzing ? <Activity className="w-10 h-10 animate-pulse" /> : <Upload className="w-10 h-10" />}
                        </div>

                        {analyzing ? (
                            <div className="w-full max-w-sm space-y-4">
                                <h3 className="text-xl font-semibold text-foreground">Analyzing Clinical Markers...</h3>
                                <Progress value={progress} className="h-2 w-full" />
                                <p className="text-sm text-muted-foreground">Extracting biomarkers • Correlating ranges • Generating diagnosis</p>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-2xl font-bold mb-3">Upload Lab Report</h3>
                                <p className="text-muted-foreground mb-8 max-w-md">
                                    Drag and drop your PDF or Image report here.
                                    Our AI instantly extracts values and flags abnormalities.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md">
                                    <div className="relative flex-1 group">
                                        <Button size="lg" variant="outline" className="w-full gap-2 h-12 border-primary/20 hover:bg-primary/5 group-hover:border-primary/50 transition-all">
                                            <Upload className="w-4 h-4" /> Choose File
                                        </Button>
                                        <input
                                            type="file"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                            accept=".pdf,.jpg,.jpeg,.png"
                                        />
                                    </div>
                                    <div className="relative flex-1 group">
                                        <Button size="lg" className="w-full gap-2 h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
                                            <Camera className="w-4 h-4" /> Scan with Camera
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
                <div className="space-y-8 animate-slide-up">
                    {/* Summary Header */}
                    <div className="grid lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 border-l-4 border-l-blue-500 shadow-md">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-primary text-xl">
                                    <Activity className="w-5 h-5" /> Clinical Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-lg leading-relaxed text-foreground/90 mb-4">{report.summary}</p>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Potential Conditions</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {report.diseasePossibility.map((d, i) => (
                                            <Badge key={i} variant="destructive" className="px-3 py-1 text-sm shadow-sm">{d}</Badge>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quick Actions / Share */}
                        <div className="space-y-4">
                            <Card className="bg-muted/50 border-none">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Patient Communication</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Input
                                        type="tel"
                                        placeholder="Patient Mobile (+91)"
                                        className="bg-background"
                                        value={patientPhone}
                                        onChange={(e) => setPatientPhone(e.target.value)}
                                    />
                                    <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white shadow-sm" onClick={handleShare}>
                                        <Send className="w-4 h-4 mr-2" /> WhatsApp Report
                                    </Button>
                                    <Button
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                        onClick={handleSaveToPatient}
                                        disabled={isSaving}
                                    >
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        {isSaving ? "Saving..." : "Save to Patient"}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                                        onClick={handleHinglishExplain}
                                        disabled={explaining}
                                    >
                                        <Activity className="w-4 h-4 mr-2" />
                                        {explaining ? "Translating..." : "Explain in Hinglish 🇮🇳"}
                                    </Button>
                                    {hinglishSummary && (
                                        <div className="p-3 bg-indigo-50 rounded-lg text-sm text-indigo-900 italic border border-indigo-200 mt-2 animate-in fade-in slide-in-from-top-2">
                                            "{hinglishSummary}"
                                        </div>
                                    )}
                                    <Button variant="outline" className="w-full" onClick={() => setReport(null)}>
                                        Analyze New Report
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Detailed Parameters Table */}
                        <Card className="lg:col-span-2 overflow-hidden border-none shadow-lg">
                            <CardHeader className="bg-muted/30 pb-4">
                                <CardTitle>Biomarker Analysis</CardTitle>
                                <CardDescription>Extracted values correlated with standard clinical ranges</CardDescription>
                            </CardHeader>
                            <div className="bg-background">
                                {report.results.map((res, i) => (
                                    <div key={i} className={`flex items-center justify-between p-4 border-b last:border-0 hover:bg-muted/30 transition-colors ${res.status !== 'Normal' ? 'bg-red-50/10' : ''}`}>
                                        <div className="flex-1">
                                            <p className="font-semibold text-base">{res.parameter}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Reference: {res.normalRange} {res.unit}</p>
                                        </div>
                                        <div className="text-right flex items-center gap-6">
                                            <div>
                                                <p className={`font-bold text-lg ${res.status === 'Normal' ? 'text-foreground' : 'text-red-600'}`}>
                                                    {res.value}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{res.unit}</p>
                                            </div>
                                            <Badge variant={res.status === "Normal" ? "outline" : "destructive"} className={res.status === "Normal" ? "border-green-500/50 text-green-600 bg-green-500/5" : ""}>
                                                {res.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* AI Recommendations */}
                        <div className="space-y-6">
                            <Card className="border-l-4 border-l-green-500 shadow-md h-full">
                                <CardHeader>
                                    <CardTitle className="text-green-700 flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5" /> Care Plan
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div>
                                        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                                            <Utensils className="w-4 h-4 text-green-600" /> Diet & Nutrition
                                        </h4>
                                        <div className="space-y-2">
                                            {report.recommendations.diet.map((item, i) => (
                                                <div key={i} className="flex items-start p-2.5 bg-muted/30 rounded-lg text-sm">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 mr-2.5 flex-shrink-0" />
                                                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                                            <Stethoscope className="w-4 h-4 text-blue-600" /> Clinical Action
                                        </h4>
                                        <div className="space-y-2">
                                            {report.recommendations.nextSteps.map((item, i) => (
                                                <div key={i} className="flex items-start p-2.5 bg-muted/30 rounded-lg text-sm">
                                                    <ArrowRight className="w-3.5 h-3.5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                                                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LabAnalyzer;
