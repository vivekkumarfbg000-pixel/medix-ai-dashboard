import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, Activity, Database, Zap } from "lucide-react";

const StressTest = () => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [requestStatus, setRequestStatus] = useState<string>("");

    // 1. RAM/UI Stress: Generate 10k Items
    const generateItems = () => {
        setLoading(true);
        setTimeout(() => {
            const newItems = Array.from({ length: 10000 }, (_, i) => ({
                id: i + 1,
                name: `Medicine ${i + 1} - ${Math.random().toString(36).substring(7)}`,
                batch: `BATCH-${Math.floor(Math.random() * 10000)}`,
                expiry: new Date().toISOString(),
                stock: Math.floor(Math.random() * 100)
            }));
            setItems(newItems);
            setLoading(false);
            toast.success("Generated 10,000 items in memory");
        }, 100);
    };

    // 2. Network Stress: Fire 50 concurrent requests
    const fireRequests = async () => {
        setRequestStatus("Starting 50 requests...");
        const requests = Array.from({ length: 50 }, (_, i) => // Creating 50 promises
            new Promise((resolve) => setTimeout(() => resolve(`Req ${i} Done`), Math.random() * 2000))
        );

        try {
            await Promise.all(requests);
            setRequestStatus("✅ All 50 Requests Completed Successfully");
            toast.success("Network Stress Test Passed");
        } catch (e) {
            setRequestStatus("❌ Network Test Failed");
            toast.error("Network Stress Test Failed");
        }
    };

    // 3. Crash Trigger
    const triggerCrash = () => {
        // @ts-ignore
        throw new Error("Manual Crash Triggered for Testing Error Boundary");
    };

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <Activity className="w-8 h-8 text-orange-500" />
                System Stress Test
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Memory Test */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="w-5 h-5" /> Memory / UI Load
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-4">Generates and renders 10,000 table rows to test rendering performance.</p>
                        <Button onClick={generateItems} disabled={loading} className="w-full">
                            {loading ? "Generating..." : "Generate 10k Items"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Network Test */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="w-5 h-5" /> Network Concurrency
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-4">Simulates 50 simultaneous Async requests.</p>
                        <Button onClick={fireRequests} variant="secondary" className="w-full">
                            Fire 50 Requests
                        </Button>
                        {requestStatus && <p className="mt-2 text-xs font-mono">{requestStatus}</p>}
                    </CardContent>
                </Card>

                {/* Crash Test */}
                <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                            <AlertTriangle className="w-5 h-5" /> Crash Recovery
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-red-600 mb-4">Intentionally crashes the React tree to test Error Boundary.</p>
                        <Button onClick={triggerCrash} variant="destructive" className="w-full">
                            Trigger Crash
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {items.length > 0 && (
                <div className="border rounded-lg overflow-auto h-[500px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Batch</TableHead>
                                <TableHead>Stock</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{item.id}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.batch}</TableCell>
                                    <TableCell>{item.stock}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default StressTest;
