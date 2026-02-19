import React, { useState } from 'react';
import { aiService } from '@/services/aiService';

const DebugAI = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const log = (msg: string | object) => {
        const text = typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg;
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev]);
    };

    const runTest = async (name: string, fn: () => Promise<any>) => {
        setLoading(true);
        log(`--- Testing ${name} ---`);
        try {
            const result = await fn();
            log(`✅ SUCCESS:`);
            log(result);
        } catch (e: any) {
            log(`❌ FAILED:`);
            log(e.message || e.toString());
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 20, fontFamily: 'monospace', maxWidth: 800, margin: '0 auto' }}>
            <h1>AI Diagnostics</h1>
            <p>Use this page to test if AI services are connecting correctly.</p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <button
                    disabled={loading}
                    onClick={() => runTest('Chat (Router)', () => aiService.chatWithAgent('Hello', undefined, [{ role: 'user', text: 'Hello' }]))}
                    style={{ padding: '10px 20px', cursor: 'pointer' }}>
                    Test Chat
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #ccc', padding: '0 10px', borderRadius: 4 }}>
                    <input
                        type="checkbox"
                        checked={localStorage.getItem("FORCE_AI_FAIL") === "true"}
                        onChange={(e) => {
                            if (e.target.checked) localStorage.setItem("FORCE_AI_FAIL", "true");
                            else localStorage.removeItem("FORCE_AI_FAIL");
                            // Force re-render not really needed as we read from LS, but for UI feedback:
                            setLoading(prev => !prev); setTimeout(() => setLoading(false), 50);
                        }}
                    />
                    <label>Force Primary AI Fail</label>
                </div>
                <button
                    disabled={loading}
                    onClick={() => runTest('Market Data', () => aiService.getMarketData('Dolo 650'))}
                    style={{ padding: '10px 20px', cursor: 'pointer' }}>
                    Test Market
                </button>
                <button
                    disabled={loading}
                    onClick={() => runTest('Compliance', () => aiService.checkCompliance('Corex'))}
                    style={{ padding: '10px 20px', cursor: 'pointer' }}>
                    Test Compliance
                </button>
                <button
                    disabled={loading}
                    onClick={() => runTest('Forecast', () => aiService.getInventoryForecast([{ medicine_name: 'Dolo', quantity: 10 }] as any))}
                    style={{ padding: '10px 20px', cursor: 'pointer' }}>
                    Test Forecast
                </button>
                <button
                    disabled={loading}
                    onClick={() => {
                        const health = {
                            localStorage: typeof localStorage !== 'undefined',
                            indexedDB: typeof indexedDB !== 'undefined',
                            online: navigator.onLine,
                            userAgent: navigator.userAgent
                        };
                        log(health);
                    }}
                    style={{ padding: '10px 20px', cursor: 'pointer', background: '#e0f7fa' }}>
                    System Health
                </button>
                <button
                    disabled={loading}
                    onClick={() => setLogs([])}
                    style={{ padding: '10px 20px', cursor: 'pointer', background: '#ccc' }}>
                    Clear Logs
                </button>
            </div>

            <div style={{ background: '#f5f5f5', padding: 15, borderRadius: 5, minHeight: 400, whiteSpace: 'pre-wrap', border: '1px solid #ddd' }}>
                {logs.length === 0 ? 'Ready to test...' : logs.join('\n\n')}
            </div>
        </div>
    );
};

export default DebugAI;
