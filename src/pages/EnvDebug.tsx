
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EnvDebug() {
    const env = import.meta.env;

    const getMaskedValue = (val: string | undefined) => {
        if (!val) return <span className="text-red-500 font-bold">UNDEFINED (Missing)</span>;
        if (val.length < 10) return val;
        return `${val.substring(0, 8)}...${val.substring(val.length - 4)}`;
    };

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Environment Variable Debugger</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-lg">Supabase Configuration</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
                            <div className="font-medium text-muted-foreground">VITE_SUPABASE_URL</div>
                            <div className="font-mono text-sm break-all">
                                {getMaskedValue(env.VITE_SUPABASE_URL)}
                            </div>

                            <div className="font-medium text-muted-foreground">VITE_SUPABASE_PUBLISHABLE_KEY</div>
                            <div className="font-mono text-sm break-all">
                                {getMaskedValue(env.VITE_SUPABASE_PUBLISHABLE_KEY)}
                            </div>

                            <div className="font-medium text-muted-foreground">VITE_SUPABASE_PROJECT_ID</div>
                            <div className="font-mono text-sm break-all">
                                {getMaskedValue(env.VITE_SUPABASE_PROJECT_ID)}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <h3 className="font-semibold text-lg">Raw Import Meta Env Keys</h3>
                        <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-60 text-xs font-mono">
                            {JSON.stringify(Object.keys(env).filter(k => k.startsWith('VITE_')), null, 2)}
                        </div>
                    </div>

                    <div className="text-sm text-yellow-600 bg-yellow-50 p-4 rounded border border-yellow-200">
                        <strong>Note:</strong> Sensitive keys are masked for security. If you see "UNDEFINED", the variable is missing.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
