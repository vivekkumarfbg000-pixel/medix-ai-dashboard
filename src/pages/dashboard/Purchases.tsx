import { useState, useEffect } from "react";
import { useUserShops } from "@/hooks/useUserShops";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PurchaseEntry } from "@/components/dashboard/PurchaseEntryModal";
import { Plus, Search, FileText, Calendar } from "lucide-react";
import { safeFormat } from "@/utils/dateHelpers";
import { toast } from "sonner";

export default function Purchases({ embedded = false }: { embedded?: boolean }) {
    const { currentShop } = useUserShops();
    const [purchases, setPurchases] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isEntryOpen, setIsEntryOpen] = useState(false);

    useEffect(() => {
        if (currentShop?.id) fetchPurchases();
    }, [currentShop]);

    const fetchPurchases = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("purchases")
            .select("*, suppliers(name)")
            .eq("shop_id", currentShop?.id)
            .order("invoice_date", { ascending: false });

        if (error) toast.error("Failed to fetch purchases");
        else setPurchases(data || []);
        setLoading(false);
    };

    const filteredPurchases = purchases.filter(p =>
        p.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={`space-y-6 animate-fade-in ${embedded ? 'p-0' : ''}`}>
            {!embedded && (
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <FileText className="w-8 h-8 text-indigo-600" /> Purchase History
                        </h1>
                        <p className="text-muted-foreground">Track all inward stock invoices from suppliers.</p>
                    </div>
                </div>
            )}

            <div className="flex justify-end mb-4">
                <Button onClick={() => setIsEntryOpen(true)} size={embedded ? "sm" : "lg"} className="shadow-lg bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" /> New Entry (Stock In)
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Recent Invoices</CardTitle>
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search invoice #"
                            className="pl-8"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                            ) : filteredPurchases.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No purchases recorded.</TableCell></TableRow>
                            ) : (
                                filteredPurchases.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3 text-muted-foreground" />
                                            {safeFormat(p.invoice_date, 'dd MMM yyyy')}
                                        </TableCell>
                                        <TableCell className="font-mono">{p.invoice_number}</TableCell>
                                        <TableCell className="font-medium">{p.suppliers?.name || 'Unknown'}</TableCell>
                                        <TableCell className="font-bold text-emerald-600">₹{p.total_amount.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge variant={p.status === 'completed' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                                                {p.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <PurchaseEntry
                open={isEntryOpen}
                onOpenChange={setIsEntryOpen}
                onSuccess={fetchPurchases}
            />
        </div>
    );
}
