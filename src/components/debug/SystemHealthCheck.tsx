import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Database, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const SystemHealthCheck = () => {
  const [status, setStatus] = useState<'loading' | 'ok' | 'critical'>('loading');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const MIGRATION_SQL = `-- REPAIR SCRIPT
CREATE TABLE IF NOT EXISTS public.shop_settings (
    shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
    gstin TEXT,
    dl_number TEXT,
    invoice_footer_text TEXT,
    terms_and_conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY "Shop members can manage settings" ON public.shop_settings;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Shop members can manage settings" ON public.shop_settings
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()) OR
    shop_id IN (SELECT shop_id FROM public.profiles WHERE user_id = auth.uid())
);

GRANT ALL ON public.shop_settings TO authenticated;
`;

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      // 1. Check if shop_settings exists
      // @ts-ignore
      const { error: tableError } = await supabase.from('shop_settings').select('shop_id').limit(1);

      if (tableError) {
        if (tableError.code === '42P01') { // undefined_table
          setStatus('critical');
          setErrorDetails("Missing Database Table: 'shop_settings'");
          return;
        }
        console.error("Health Check Warning:", tableError);
      }

      setStatus('ok');
    } catch (e) {
      console.error("Health Check Failed:", e);
    }
  };

  const copySQL = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setCopied(true);
    toast.success("SQL copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (status !== 'critical') return null;

  return (
    <Alert variant="destructive" className="mb-6 border-2 border-red-500 bg-red-50 animate-in slide-in-from-top-2">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-lg font-bold flex items-center gap-2">
        System Update Required
      </AlertTitle>
      <AlertDescription className="mt-2 text-red-800">
        <p className="mb-2">Your database is missing critical tables required for <strong>Profile Saving</strong> and <strong>Inventory Import</strong>.</p>

        <div className="bg-slate-900 text-slate-50 p-4 rounded-lg font-mono text-xs overflow-x-auto relative mt-3 mb-3">
          <pre>{MIGRATION_SQL}</pre>
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 h-8"
            onClick={copySQL}
          >
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? "Copied" : "Copy SQL"}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-semibold underline">How to fix:</p>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>Click <strong>Copy SQL</strong> above.</li>
            <li>Go to your <strong>Supabase Dashboard</strong> {'>'} SQL Editor.</li>
            <li>Paste and click <strong>Run</strong>.</li>
            <li>Reload this page.</li>
          </ol>
        </div>
      </AlertDescription>
    </Alert>
  );
};
