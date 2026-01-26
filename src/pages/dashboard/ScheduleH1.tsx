import { useState, useEffect } from "react";
import { useUserShops } from "@/hooks/useUserShops";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Search, Download, FileText, AlertTriangle } from "lucide-react";
import { safeFormat } from "@/utils/dateHelpers";
import { toast } from "sonner";

import { BillViewModal } from "./compliance/BillViewModal";

const ScheduleH1 = () => {
    const { currentShop } = useUserShops();
    const [search, setSearch] = useState("");
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

    useEffect(() => {
        if (currentShop?.id) fetchH1Records();
    }, [currentShop]);

    const fetchH1Records = async () => {
        setLoading(true);
        // In a real app, we would join with inventory to check 'schedule_h1' flag
        // For now, we will fetch sales and filter manually or assume all are for demo
        // Ideally: orders -> order_items -> inventory(where schedule_h1=true)

        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id, 
                    created_at, 
                    invoice_number, 
                    customer_name, 
                    doctor_name, 
                    order_items
                `)
                .eq('shop_id', currentShop?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Flatten items and filter roughly (in production, need robust 'is_h1' flag on inventory)
            const h1Items: any[] = [];
            (data as any[]).forEach(order => {
                let items: any[] = [];
                if (Array.isArray(order.order_items)) {
                    items = order.order_items;
                } else if (typeof order.order_items === 'string') {
                    try {
                        items = JSON.parse(order.order_items);
                    } catch (e) {
                        items = [];
                    }
                }

                items.forEach((item: any) => {
                    // Compliance Check: Only include if explicitly flagged
                    if (item.schedule_h1 === true || item.schedule_h1 === "true") {
                        h1Items.push({
                            id: order.id + (item.inventory_id || item.id || Math.random()),
                            date: order.created_at,
                            invoice: order.invoice_number,
                            patient: order.customer_name,
                            doctor: order.doctor_name || "Unknown",
                            medicine: item.name,
                            batch: item.batch || "N/A",
                            qty: item.qty
                        });
                    }
                    // Fallback for Demo Data (keep if needed, otherwise remove)
                    // if (item.name.includes("H1")) ...

                    h1Items.push({
                        id: order.id + (item.inventory_id || item.id || Math.random()),
                        date: order.created_at,
                        invoice: order.invoice_number,
                        patient: order.customer_name,
                        doctor: order.doctor_name || "Unknown", // Doctor name needs to be captured in POS
                        medicine: item.name,
                        batch: item.batch || "N/A",
                        qty: item.qty
                    });
                });
            });

            setRecords(h1Items);
        } catch (err: any) {
            toast.error("Failed to load register");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = records.filter(r =>
        r.medicine.toLowerCase().includes(search.toLowerCase()) ||
        r.patient.toLowerCase().includes(search.toLowerCase())
    );

    const handleExport = () => {
        // Simple CSV Export Logic
        const headers = ["Date", "Invoice", "Patient", "Doctor", "Medicine", "Batch", "Qty"];
        const csvContent = [
            headers.join(","),
            ...filtered.map(r => [
                safeFormat(r.date, "yyyy-MM-dd"),
                r.invoice,
                r.patient,
                r.doctor,
                r.medicine,
                r.batch,
                r.qty
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `H1_Register_${safeFormat(new Date(), 'yyyyMMdd')}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2 text-red-700">
                        <ClipboardList className="w-8 h-8" /> Schedule H1 Register
                    </h1>
                    <p className="text-muted-foreground">Mandatory Compliance Ledger for Narcotics & Psychotropics</p>
                </div>
                <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" /> Export for Inspector
                </Button>
            </div>

            <Card className="border-red-100 shadow-sm">
                <CardHeader className="bg-red-50/50 pb-4">
                    <div className="flex justify-between items-center">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by Medicine or Patient..."
                                className="pl-8 bg-white"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-red-600 font-medium">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Keep records for 3 years</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Invoice</TableHead>
                                <TableHead>Patient Name</TableHead>
                                <TableHead>Doctor Name</TableHead>
                                <TableHead>Medicine Name</TableHead>
                                <TableHead>Batch</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading Register...</TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No records found</TableCell></TableRow>
                            ) : (
                                filtered.map((record, idx) => (
                                    <TableRow key={idx} className="hover:bg-red-50/10">
                                        <TableCell>{safeFormat(record.date, "dd MMM yyyy")}</TableCell>
                                        <TableCell className="font-mono text-xs">
                                            <span
                                                className="text-blue-600 underline cursor-pointer hover:text-blue-800"
                                                onClick={() => setSelectedInvoice(record)}
                                            >
                                                {record.invoice}
                                            </span>
                                        </TableCell>
                                        <TableCell>{record.patient}</TableCell>
                                        <TableCell className="italic text-muted-foreground">{record.doctor}</TableCell>
                                        <TableCell className="font-medium">{record.medicine}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{record.batch}</TableCell>
                                        <TableCell className="text-right font-bold">{record.qty}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-50 border-dashed">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Compliance Tip</CardTitle></CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Ensure all Doctor names are captured correctly during billing for H1 drugs. Incomplete records can attract penalties.
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 border-dashed">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Retention Policy</CardTitle></CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Physical copies of prescriptions should be filed by date. This digital register serves as a quick reference index.
                    </CardContent>
                </Card>
            </div>

            {selectedInvoice && (
                <BillViewModal
                    open={!!selectedInvoice}
                    onOpenChange={(op) => !op && setSelectedInvoice(null)}
                    invoice={selectedInvoice}
                />
            )}
        </div>
    );
};

export default ScheduleH1;
