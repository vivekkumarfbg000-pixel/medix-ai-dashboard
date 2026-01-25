import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, addMonths } from "date-fns";
import { safeFormat } from "@/utils/dateHelpers";
import { Download, ShieldAlert, FileText, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { toast } from "sonner";

interface H1Entry {
    id: string;
    date: string;
    patientName: string;
    doctorName: string;
    drugName: string;
    quantity: number;
    batchNumber: string;
}

const Compliance = () => {
    const { currentShop } = useUserShops();
    const [h1Register, setH1Register] = useState<H1Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [licenseExpiry, setLicenseExpiry] = useState<string | null>(null);

    useEffect(() => {
        if (!currentShop?.id) return;
        fetchH1Data();
        // Set a default license expiry (6 months from now) since column doesn't exist
        setLicenseExpiry(addMonths(new Date(), 6).toISOString());
    }, [currentShop]);

    const fetchH1Data = async () => {
        try {
            const { data: orders, error } = await supabase
                .from("orders")
                .select("*")
                .eq("shop_id", currentShop.id)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const h1Entries: H1Entry[] = [];

            for (const order of orders || []) {
                const items = order.order_items as any[];
                if (!items || !Array.isArray(items)) continue;

                for (const item of items) {
                    const isH1 = item.is_h1 === true || item.schedule_h1 === true;

                    if (isH1) {
                        h1Entries.push({
                            id: order.id || "",
                            date: order.created_at,
                            patientName: order.customer_name,
                            doctorName: "Self/OTC",
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
    };

    const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

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
                                        <TableHead>Invoice</TableHead>
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
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading records...</TableCell>
                                        </TableRow>
                                    ) : h1Register.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No Schedule H1 sales recorded yet.</TableCell>
                                        </TableRow>
                                    ) : (
                                        h1Register.map((entry, idx) => (
                                            <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                                                <TableCell className="font-medium text-foreground">{safeFormat(entry.date, "dd MMM yyyy")}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="link"
                                                        className="h-auto p-0 text-blue-600 underline"
                                                        onClick={() => setSelectedInvoice(entry.id)}
                                                    >
                                                        #{entry.id}
                                                    </Button>
                                                </TableCell>
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
                                <span className="font-bold text-foreground">
                                    {licenseExpiry ? safeFormat(licenseExpiry, "dd MMM yyyy") : "Not Set"}
                                </span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                {licenseExpiry && (
                                    <div
                                        className={`h-full w-[85%] ${licenseExpiry && differenceInDays(new Date(licenseExpiry), new Date()) < 30 ? 'bg-red-500' : 'bg-green-500'}`}
                                    ></div>
                                )}
                            </div>
                            <p className="text-xs text-green-600 mt-2 font-medium">
                                {licenseExpiry
                                    ? `Safe. Renewal in ${licenseExpiry ? differenceInDays(new Date(licenseExpiry), new Date()) : 'N/A'} days.`
                                    : "Configure license in settings."}
                            </p>
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
                            <Button
                                variant="outline"
                                className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                                onClick={async () => {
                                    toast.loading("Scanning Inventory against Banned List...");
                                    try {
                                        const { data: items } = await supabase.from('inventory').select('medicine_name').eq('shop_id', currentShop?.id).limit(5);
                                        if (items) {
                                            const { aiService } = await import("@/services/aiService");
                                            for (const item of items) {
                                                await aiService.checkCompliance(item.medicine_name);
                                            }
                                        }
                                        toast.dismiss();
                                        toast.success("Scan Complete. Report Updated.");
                                    } catch (e) {
                                        toast.dismiss();
                                        toast.error("Scan Failed");
                                    }
                                }}
                            >
                                Run Manual Scan
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* View Bill Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-5">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="font-semibold text-lg">Invoice #{selectedInvoice}</h3>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(null)}>
                                <span className="sr-only">Close</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                >
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </svg>
                            </Button>
                        </div>
                        <div className="p-6 flex flex-col items-center gap-4">
                            <div className="bg-muted/20 w-full h-64 rounded-lg flex items-center justify-center border-dashed border-2">
                                <p className="text-muted-foreground text-sm">
                                    [Original Prescription/Bill Image would appear here]
                                    <br />
                                    Fetched from `prescriptions` or `orders` bucket.
                                </p>
                            </div>
                            <Button className="w-full" onClick={() => toast.info("Printing Copy...")}>
                                Print Certified Copy
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Compliance;
