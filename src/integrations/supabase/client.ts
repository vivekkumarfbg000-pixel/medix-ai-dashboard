import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcnFweGJieWZpcGpxaHBhc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTEwNjEsImV4cCI6MjA4MjA4NzA2MX0.rWuk98xZ1wpJwK9agtZCeie3C9xQDb43UZK8FutCGss';

// ─── ISP Bypass Proxy Setup ───────────────────────────────────────────────────
// Indian ISPs (Jio/Airtel) block direct connections to *.supabase.co.
// All Supabase traffic is routed through a PHP proxy on Hostinger's servers,
// which then forwards the request server-side — bypassing the ISP block entirely.
//
// Production (medixai.shop): PHP proxy at /supabase-proxy/index.php
// Development (localhost):   Vite dev server proxy at /supabase-proxy → supabase.co
// ─────────────────────────────────────────────────────────────────────────────
function getSupabaseUrl(): string {
  if (typeof window === 'undefined') {
    // SSR / build time — use real URL
    return 'https://ykrqpxbbyfipjqhpaszf.supabase.co';
  }
  const { hostname, protocol, host } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Dev: Vite proxies /supabase-proxy → supabase.co (configured in vite.config.ts)
    return `${protocol}//${host}/supabase-proxy`;
  }
  // Production: PHP proxy at same origin
  return `${window.location.origin}/supabase-proxy`;
}

const SUPABASE_URL = getSupabaseUrl();

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  db: { schema: 'public' },
  global: { headers: { 'x-application-name': 'medix-ai-dashboard' } },
});

// Legacy compatibility exports used by useSessionEnforcement
export let isSupabaseReachable = true;
export const connectivityReady: Promise<boolean> = Promise.resolve(true);
export const checkConnection = async (): Promise<boolean> => true;