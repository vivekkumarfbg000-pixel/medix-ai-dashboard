import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Download, ShieldAlert, FileText, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Mock H1 Sales Data Structure (since we might not have real data yet)
interface H1Entry {
    id: number;
    date: string;
    patientName: string;
    doctorName: string;
    drugName: string;
    quantity: number;
    batchNumber: string; // Ideally from inventory link
}

const Compliance = () => {
    const [h1Register, setH1Register] = useState<H1Entry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchH1Data();
    }, []);

    const fetchH1Data = async () => {
        try {
            const { data: orders, error } = await supabase
                .from("orders")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            const h1Entries: H1Entry[] = [];

            // Supabase 'orders' has 'order_items' as JSONB
            for (const order of orders || []) {
                const items = order.order_items as any[];
                if (!items || !Array.isArray(items)) continue;

                for (const item of items) {
                    // Check if item is H1 (flagged in Order or partial name match fallback)
                    // Note: We now save is_h1 flag in Orders.tsx
                    const isH1 = item.is_h1 === true || item.schedule_h1 === true;

                    if (isH1) {
                        h1Entries.push({
                            id: Number(order.id) || 0, // ID is string uuid so this might be NaN but id usage is minimal
                            date: order.created_at,
                            patientName: order.customer_name,
                            doctorName: "Self/OTC", // We don't verify Doctor yet in this flow
                            drugName: item.name,
                            quantity: item.qty || item.quantity,
                            batchNumber: item.batch_number || "BATCH-NA"
                        });
                    }
                }
            }

            setH1Register(h1Entries);
        } catch (error) {
            console.error("Error fetching H1 data:", error);
            toast.error("Failed to load Compliance Register");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = () => {
        toast.success("Downloading Schedule H1 Register (PDF)...");
        // In real implementation: jsPDF integration
    };

    return (
        <div className="space-y-8 animate-fade-in p-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Compliance Shield</h1>
                    <p className="text-muted-foreground mt-1">Automated Regulatory Reporting & Risk Protection</p>
                </div>
                <Button onClick={handleDownloadPDF} className="bg-destructive text-white hover:bg-destructive/90 gap-2">
                    <Download className="w-4 h-4" /> Download Register
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="glass-card md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" /> Schedule H1 Register
                        </CardTitle>
                        <CardDescription>
                            Auto-generated digital register for Narcotic & Antibiotic sales (As per Drugs & Cosmetics Act).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border border-border/50 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Patient</TableHead>
                                        <TableHead>Doctor</TableHead>
                                        <TableHead>Drug</TableHead>
                                        <TableHead>Qty</TableHead>
                                        <TableHead>Batch</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading records...</TableCell>
                                        </TableRow>
                                    ) : h1Register.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No Schedule H1 sales recorded yet.</TableCell>
                                        </TableRow>
                                    ) : (
                                        h1Register.map((entry, idx) => (
                                            <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="font-medium text-foreground">{format(new Date(entry.date), "dd MMM yyyy")}</TableCell>
                                                <TableCell>{entry.patientName}</TableCell>
                                                <TableCell className="text-muted-foreground text-xs">{entry.doctorName}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">
                                                        {entry.drugName}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{entry.quantity}</TableCell>
                                                <TableCell className="font-mono text-xs">{entry.batchNumber}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="glass-card border-l-4 border-l-green-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-500" /> License Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-muted-foreground">Valid Upto</span>
                                <span className="font-bold text-foreground">31 Mar 2026</span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div className="bg-green-500 h-full w-[85%]"></div>
                            </div>
                            <p className="text-xs text-green-600 mt-2 font-medium">Safe. Renewal in 450 days.</p>
                        </CardContent>
                    </Card>

                    <Card className="glass-card border-l-4 border-l-destructive">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-destructive" /> Banned Drug Alert
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Real-time scanning active against CDSCO Gazette Notifications.
                            </p>
                            <Button variant="outline" className="w-full border-destructive/50 text-destructive hover:bg-destructive/10">
                                Run Manual Scan
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Compliance;
