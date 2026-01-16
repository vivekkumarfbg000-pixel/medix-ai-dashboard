import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface GSTExportPanelProps {
    shopId: string;
}

export const GSTExportPanel = ({ shopId }: GSTExportPanelProps) => {
    const [loading, setLoading] = useState(false);
    const [reportType, setReportType] = useState("gstr1");
    const [month, setMonth] = useState(new Date().getMonth().toString());
    const [year, setYear] = useState(new Date().getFullYear().toString());

    const generateGSTR1 = async () => {
        if (!shopId) return;
        setLoading(true);

        try {
            const startDate = new Date(parseInt(year), parseInt(month), 1).toISOString();
            const endDate = new Date(parseInt(year), parseInt(month) + 1, 0).toISOString();

            // Fetch B2C (Business to Consumer) Invoices
            const { data: orders, error } = await supabase
                .from('orders')
                .select('*')
                .eq('shop_id', shopId)
                .gte('created_at', startDate)
                .lte('created_at', endDate)
                .eq('status', 'completed');

            if (error) throw error;

            if (!orders || orders.length === 0) {
                toast.info("No data found for the selected period");
                return;
            }

            // Transform to CSV
            // Header: GSTIN/UIN of Recipient, Receiver Name, Invoice Number, Invoice date, Invoice Value, Place Of Supply, Reverse Charge, Invoice Type, E-Commerce GSTIN, Rate, Taxable Value, Cess Amount
            const headers = [
                "GSTIN/UIN of Recipient",
                "Receiver Name",
                "Invoice Number",
                "Invoice Date",
                "Invoice Value",
                "Place Of Supply",
                "Reverse Charge",
                "Invoice Type",
                "E-Commerce GSTIN",
                "Rate",
                "Taxable Value",
                "Cess Amount"
            ];

            const rows = orders.map(order => {
                // Determine rate implicitly or from meta.
                // For simplified pharmacy bills:
                // Rate = 12% (Estimate), Taxable = Total / 1.12
                // Ideally this should come from order_items aggregation but for GSTR-1 summary this is often acceptable for B2CS (Small)

                const total = order.total_amount || 0;
                // Simplified assumptions for MVP export
                const rate = 12;
                const taxable = (total * 100) / (100 + rate);

                return [
                    "", // Recipient GSTIN (B2C)
                    order.customer_name || "Walk-in Customer",
                    order.id.slice(0, 8), // Invoice No
                    format(new Date(order.created_at), 'dd-MMM-yyyy'),
                    total.toFixed(2),
                    "State Code", // Needs state mapping
                    "N", // Reverse Charge
                    "Regular",
                    "",
                    rate,
                    taxable.toFixed(2),
                    "0"
                ].join(",");
            });

            const csvContent = "data:text/csv;charset=utf-8,"
                + headers.join(",") + "\n"
                + rows.join("\n");

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `GSTR1_${format(new Date(parseInt(year), parseInt(month)), 'MMM_yyyy')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success("GSTR-1 Exported Successfully");

        } catch (e: any) {
            console.error(e);
            toast.error("Failed to generate report: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" /> GST Compliance Exports
                </CardTitle>
                <CardDescription>Generate monthly GSTR reports for tax filing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Report Type</label>
                        <Select value={reportType} onValueChange={setReportType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="gstr1">GSTR-1 (Sales)</SelectItem>
                                <SelectItem value="gstr3b">GSTR-3B (Summary)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Month</label>
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <SelectItem key={i} value={i.toString()}>
                                        {format(new Date(2024, i, 1), 'MMMM')}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Year</label>
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button onClick={generateGSTR1} disabled={loading} className="w-full">
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Download CSV
                    </Button>
                </div>

                <div className="p-4 bg-yellow-50 text-yellow-800 text-sm rounded-md border border-yellow-200">
                    <strong>Note:</strong> This report assumes a flat 12% GST rate for simplified pharmacy accounting.
                    For precise HSN-wise exports, please ensure all inventory items have correct GST rates configured.
                </div>
            </CardContent>
        </Card>
    );
};
