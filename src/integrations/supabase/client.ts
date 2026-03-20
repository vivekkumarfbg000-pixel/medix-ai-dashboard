import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import type { Database } from './types';

export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const SUPABASE_URL_RAW = import.meta.env.VITE_SUPABASE_URL || 'https://ykrqpxbbyfipjqhpaszf.supabase.co';

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
    return SUPABASE_URL_RAW;
  }

  // App running as a Native Mobile App on device (usually resolves to http://localhost)
  if (Capacitor.isNativePlatform()) {
    return 'https://medixai.shop/supabase-proxy';
  }

  const { hostname, protocol, host } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Dev: Vite proxies /supabase-proxy → supabase.co (configured in vite.config.ts)
    return `${protocol}//${host}/supabase-proxy`;
  }
  // Production Web: PHP proxy at same origin
  // Requires .htaccess to rewrite /supabase-proxy/* -> /supabase-proxy/index.php
  return `${window.location.origin}/supabase-proxy`;
}

const SUPABASE_URL = getSupabaseUrl();

/** Exposed so the connectivity checker can ping the right base URL. */
export const getSupabaseBaseUrl = () => SUPABASE_URL;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  db: { schema: 'public' },
  global: {
    headers: { 'x-application-name': 'medix-ai-dashboard' }
  },
});

// Legacy compatibility exports used by useSessionEnforcement
export const isSupabaseReachable = true;
export const connectivityReady: Promise<boolean> = Promise.resolve(true);
export const checkConnection = async (): Promise<boolean> => true;