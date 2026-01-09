
import React, { useState } from 'react';
import { aiService } from '@/services/aiService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function AiDebug() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const addLog = (feature: string, type: 'req' | 'res' | 'err', data: any) => {
        setLogs(prev => [{
            timestamp: new Date().toISOString(),
            feature,
            type,
            data
        }, ...prev]);
    };

    const runTest = async (name: string, fn: () => Promise<any>) => {
        setLoading(true);
        addLog(name, 'req', "Testing...");
        try {
            const result = await fn();
            addLog(name, 'res', result);
        } catch (error: any) {
            addLog(name, 'err', error.message || error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold mb-4">AI Feature Diagnostic Console</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader><CardTitle>1. General Chat</CardTitle></CardHeader>
                    <CardContent>
                        <Button
                            onClick={() => runTest('Chat', () => aiService.chatWithAgent("What are the side effects of Metformin?"))}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Test Chat (Metformin)
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>2. Interaction Checker</CardTitle></CardHeader>
                    <CardContent>
                        <Button
                            onClick={() => runTest('Interactions', () => aiService.checkInteractions(["Aspirin", "Warfarin"]))}
                            disabled={loading}
                        >
                            Test Interactions (Aspirin + Warfarin)
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>3. Market Intelligence</CardTitle></CardHeader>
                    <CardContent>
                        <Button
                            onClick={() => runTest('Market', () => aiService.getMarketData("Dolo 650"))}
                            disabled={loading}
                        >
                            Test Market Data (Dolo 650)
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>4. Compliance Check</CardTitle></CardHeader>
                    <CardContent>
                        <Button
                            onClick={() => runTest('Compliance', () => aiService.checkCompliance("Corex"))}
                            disabled={loading}
                        >
                            Test Compliance (Corex)
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>5. Forecasting</CardTitle></CardHeader>
                    <CardContent>
                        <Button
                            onClick={() => runTest('Forecast', () => aiService.getInventoryForecast([
                                { date: "2023-01-01", sales: 100 },
                                { date: "2023-02-01", sales: 120 },
                                { date: "2023-03-01", sales: 110 }
                            ]))}
                            disabled={loading}
                        >
                            Test Forecast (Dummy History)
                        </Button>
                    </CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-2 border-dashed border-2 border-indigo-500">
                    <CardHeader><CardTitle className="text-indigo-600">🛠️ Developer Tools: Seed Data</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Injects 5 dummy medicines and 5 past orders to enable Market & Forecast features.
                        </p>
                        <Button
                            variant="destructive"
                            onClick={() => runTest('Seeding', async () => {
                                const { supabase } = await import('@/integrations/supabase/client');
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) throw new Error("Must be logged in to seed data");

                                // 1. Seed Inventory
                                const drugs = [
                                    { name: "Dolo 650", stock: 100, price: 30, expiry: "2026-01-01" },
                                    { name: "Pan D", stock: 50, price: 120, expiry: "2025-12-01" },
                                    { name: "Azithral 500", stock: 200, price: 15, expiry: "2026-06-01" },
                                    { name: "Zincovit", stock: 45, price: 110, expiry: "2024-12-01" },
                                    { name: "Montek LC", stock: 80, price: 180, expiry: "2025-08-01" }
                                ];

                                for (const d of drugs) {
                                    await supabase.from('inventory').insert({
                                        user_id: user.id,
                                        drug_name: d.name,
                                        quantity: d.stock,
                                        unit_price: d.price,
                                        expiry_date: d.expiry,
                                        batch_number: `BATCH-${Math.floor(Math.random() * 1000)}`
                                    });
                                }

                                // 2. Seed Orders (Past 3 months)
                                for (let i = 0; i < 5; i++) {
                                    const { data: order } = await supabase.from('orders').insert({
                                        user_id: user.id,
                                        customer_name: `Test Customer ${i}`,
                                        total_amount: Math.floor(Math.random() * 500) + 50,
                                        status: 'completed',
                                        payment_method: 'cash',
                                        created_at: new Date(Date.now() - (i * 86400000 * 10)).toISOString() // Past dates
                                    }).select().single();

                                    if (order) {
                                        await supabase.from('order_items').insert({
                                            order_id: order.id,
                                            drug_name: drugs[i % drugs.length].name,
                                            quantity: 2,
                                            price: drugs[i % drugs.length].price
                                        });
                                    }
                                }

                                return "Database Seeded Successfully! You can now test Market & Forecast.";
                            })}
                            disabled={loading}
                        >
                            🌱 Seed Test Data (Medicines + Orders)
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card className="mt-8">
                <CardHeader><CardTitle>Live Logs</CardTitle></CardHeader>
                <CardContent>
                    <div className="bg-slate-950 text-slate-50 p-4 rounded-md h-96 overflow-auto font-mono text-sm">
                        {logs.map((log, i) => (
                            <div key={i} className="mb-4 border-b border-slate-800 pb-2">
                                <div className="flex gap-2 text-xs text-slate-400 mb-1">
                                    <span className={
                                        log.type === 'req' ? 'text-blue-400' :
                                            log.type === 'err' ? 'text-red-400' : 'text-green-400'
                                    }>
                                        [{log.type.toUpperCase()}]
                                    </span>
                                    <span>{log.feature}</span>
                                    <span>{log.timestamp}</span>
                                </div>
                                <pre className="whitespace-pre-wrap">
                                    {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                                </pre>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
