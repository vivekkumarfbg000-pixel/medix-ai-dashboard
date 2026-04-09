import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Globe, Shield, Activity, RefreshCw } from 'lucide-react';
import { supabase, getSupabaseBaseUrl } from '@/integrations/supabase/client';

const AuthDebug = () => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    setResults([]);
    const reports: any[] = [];

    const addReport = (name: string, status: 'success' | 'error' | 'info', message: string, detail?: any) => {
      reports.push({ name, status, message, detail });
      setResults([...reports]);
    };

    // 1. Environment Check
    addReport('Environment', 'info', `Host: ${window.location.hostname}, Protocol: ${window.location.protocol}`);

    // 2. Base URL Check
    const baseUrl = getSupabaseBaseUrl();
    addReport('Proxy Config', baseUrl.includes('medixai.shop') ? 'success' : 'info', `Effective Supabase URL: ${baseUrl}`);

    // 3. Connectivity Test
    try {
      const start = Date.now();
      const response = await fetch(`${baseUrl}/auth/v1/health`);
      const latency = Date.now() - start;
      
      if (response.ok) {
        addReport('Network', 'success', `Successfully reached Supabase proxy. Latency: ${latency}ms`);
      } else {
        const text = await response.text();
        addReport('Network', 'error', `Proxy returned status ${response.status}.`, text);
      }
    } catch (err: any) {
      addReport('Network', 'error', 'Failed to reach proxy. Likely a CORS or ISP block.', err.message);
    }

    // 4. API Key Test
    try {
      const { data, error } = await supabase.from('shops').select('id').limit(1);
      if (error) {
        if (error.message.includes('JWT')) {
          addReport('Auth Key', 'error', 'Invalid or expired Anon Key / JWT configuration.', error);
        } else {
          addReport('Auth Key', 'success', 'Anon Key acknowledged by server, but data access restricted (Normal for unauthenticated).');
        }
      } else {
        addReport('Auth Key', 'success', 'Successfully performed a restricted query.');
      }
    } catch (err: any) {
      addReport('Auth Key', 'error', 'Error during key verification.', err.message);
    }

    // 5. Google Auth Configuration
    const expectedRedirect = `${window.location.origin}/`;
    addReport('OAuth Config', 'info', `Current Redirect URI: ${expectedRedirect}`);

    setLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="container max-w-2xl py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Diagnostic</h1>
          <p className="text-muted-foreground mt-2">Checking connectivity to the authentication proxy.</p>
        </div>
        <Button onClick={runDiagnostics} disabled={loading} variant="outline" size="sm">
          {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
          Re-run
        </Button>
      </div>

      <div className="grid gap-4">
        {results.map((res, i) => (
          <Card key={i} className="overflow-hidden border-l-4" style={{ borderLeftColor: res.status === 'success' ? '#22c55e' : res.status === 'error' ? '#ef4444' : '#3b82f6' }}>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {res.status === 'success' ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : 
                   res.status === 'error' ? <AlertCircle className="text-red-500 h-5 w-5" /> : 
                   <Globe className="text-blue-500 h-5 w-5" />}
                  <CardTitle className="text-base">{res.name}</CardTitle>
                </div>
                <Badge variant={res.status === 'success' ? 'default' : res.status === 'error' ? 'destructive' : 'secondary'}>
                  {res.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="text-sm font-medium">{res.message}</p>
              {res.detail && (
                <pre className="mt-2 text-xs bg-slate-100 p-2 rounded overflow-auto max-h-32 dark:bg-slate-800">
                  {typeof res.detail === 'string' ? res.detail : JSON.stringify(res.detail, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
        <div className="flex space-x-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Recommended Action</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              If the <strong>Network</strong> or <strong>Auth Key</strong> tests fail, check your Cloudflare Worker logs and ensure all environment variables are correctly set in your deployment dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthDebug;
