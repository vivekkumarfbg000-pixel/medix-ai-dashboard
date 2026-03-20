
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

export const Diagnostic = () => {
    const [results, setResults] = useState<any>({});
    const [loading, setLoading] = useState<any>({});

    const runTest = async (testName: string, fn: () => Promise<any>) => {
        setLoading(prev => ({ ...prev, [testName]: true }));
        try {
            const result = await fn();
            setResults(prev => ({ ...prev, [testName]: { ok: true, data: result } }));
            toast.success(`${testName} Passed!`);
        } catch (e: any) {
            setResults(prev => ({ ...prev, [testName]: { ok: false, error: e.message } }));
            toast.error(`${testName} Failed!`);
        } finally {
            setLoading(prev => ({ ...prev, [testName]: false }));
        }
    };

    const testGroq = async () => {
        const res = await fetch('/groq-proxy/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'Say OK' }],
                model: 'llama-3.1-8b-instant',
                max_tokens: 5
            })
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`HTTP ${res.status}: ${err}`);
        }
        return res.json();
    };

    const testGemini = async () => {
        const res = await fetch('/gemini-proxy/v1beta/models/gemini-2.0-flash:generateContent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'Say OK' }] }]
            })
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`HTTP ${res.status}: ${err}`);
        }
        return res.json();
    };

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-3xl font-bold">System Diagnostics</h1>
            <p className="text-muted-foreground">Use this page to verify if your AI API keys are properly configured in Cloudflare.</p>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Groq Test */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            Groq AI (Chatbot)
                            <Button size="sm" onClick={() => runTest('GROQ', testGroq)} disabled={loading['GROQ']}>
                                {loading['GROQ'] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                                Run Test
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {results['GROQ'] && (
                            <Alert variant={results['GROQ'].ok ? "default" : "destructive"}>
                                {results['GROQ'].ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                <AlertTitle>{results['GROQ'].ok ? "Success" : "Failed"}</AlertTitle>
                                <AlertDescription className="mt-2 font-mono text-xs break-all">
                                    {results['GROQ'].ok ? "Proxy is communicating with Groq API correctly." : results['GROQ'].error}
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* Gemini Test */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            Gemini AI (Vision/Reports)
                            <Button size="sm" onClick={() => runTest('GEMINI', testGemini)} disabled={loading['GEMINI']}>
                                {loading['GEMINI'] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                                Run Test
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {results['GEMINI'] && (
                            <Alert variant={results['GEMINI'].ok ? "default" : "destructive"}>
                                {results['GEMINI'].ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                <AlertTitle>{results['GEMINI'].ok ? "Success" : "Failed"}</AlertTitle>
                                <AlertDescription className="mt-2 font-mono text-xs break-all">
                                    {results['GEMINI'].ok ? "Proxy is communicating with Gemini API correctly." : results['GEMINI'].error}
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                    If both tests fail with <b>HTTP 500</b>, check your Cloudflare Dashboard. Ensure your secrets (GROQ_API_KEY and GEMINI_API_KEY) are added and you have clicked <b>"Deploy"</b> or <b>"Save"</b>.
                </AlertDescription>
            </Alert>
        </div>
    );
};
export default Diagnostic;
