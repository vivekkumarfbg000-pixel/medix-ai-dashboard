import { useState } from "react";
import { aiService, ENDPOINTS } from "@/services/aiService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TestAIFallback() {
    const [log, setLog] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const addLog = (msg: string) => setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    const runTest = async () => {
        setLoading(true);
        addLog("--- STARTED TEST ---");

        // 1. Save Original
        const originalUrl = ENDPOINTS.CHAT;
        addLog(`Original URL: ${originalUrl}`);

        // 2. Break URL
        // @ts-ignore
        ENDPOINTS.CHAT = "https://invalid-n8n-url-xyz.com/webhook/broken";
        addLog(`Simulating Failure: ENDPOINTS.CHAT set to invalid URL`);

        try {
            // 3. Call Service
            addLog("Calling aiService.chatWithAgent('Test Query')...");
            const start = Date.now();
            const response = await aiService.chatWithAgent("Test Query: Do we have Dolo?");
            const duration = Date.now() - start;

            addLog(`Response Received in ${duration}ms`);
            addLog(`Reply: ${response.reply.substring(0, 100)}...`);
            addLog(`Sources: ${JSON.stringify(response.sources)}`);
            addLog(`Mock Status: ${response.isMock ? "MOCK" : "REAL (Groq Fallback)"}`);

            if (response.sources && response.sources.some(s => s.includes("Groq") || s.includes("Llama"))) {
                addLog("✅ PASS: Fallback to Groq/Llama successful!");
            } else {
                addLog("⚠️ CHECK: Source isn't explicitly Groq.");
            }

        } catch (error: any) {
            addLog(`❌ FAILED: ${error.message}`);
        } finally {
            // 4. Restore
            // @ts-ignore
            ENDPOINTS.CHAT = originalUrl;
            addLog("Restored Original URL");
            setLoading(false);
        }
    };

    return (
        <div className="p-10 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">AI Fallback Verification</h1>
            <Button onClick={runTest} disabled={loading} className="mb-4">
                {loading ? "Testing..." : "Simulate N8N Failure & Test Fallback"}
            </Button>

            <Card>
                <CardContent className="p-4 bg-slate-950 text-green-400 font-mono text-xs h-[400px] overflow-auto">
                    {log.map((l, i) => <div key={i}>{l}</div>)}
                </CardContent>
            </Card>
        </div>
    );
}
