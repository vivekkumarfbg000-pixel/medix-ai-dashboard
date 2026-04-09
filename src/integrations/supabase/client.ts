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
  if (typeof window === 'undefined') return SUPABASE_URL_RAW;

  // For Native (Capacitor/Android/iOS), we must use the full URL as relative paths don't exist.
  const isNative = Capacitor.isNativePlatform();
  
  if (isNative) {
    // ALWAYS use the primary domain proxy for Native to bypass ISP blocks
    return 'https://medixai.shop/supabase-proxy';
  }

  // For Web/PWA, use a relative path. This ensures we use the same domain/protocol 
  // as the current page (medixai.shop, or localhost in dev).
  return '/supabase-proxy';
}

const SUPABASE_URL = getSupabaseUrl();

// Failsafe: Provide a way to bypass proxy if specifically requested via URL param (for debugging)
const getFinalUrl = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('no_proxy') === 'true') {
      console.warn('⚠️ [Supabase] Failsafe: Bypassing proxy for direct connection.');
      return SUPABASE_URL_RAW;
    }
    console.log('⚡ [Supabase] Client using URL:', SUPABASE_URL);
  }
  return SUPABASE_URL;
};

const FINAL_SUPABASE_URL = getFinalUrl();

/** Exposed so the connectivity checker can ping the right base URL. */
export const getSupabaseBaseUrl = () => SUPABASE_URL;

export const supabase = createClient<Database>(FINAL_SUPABASE_URL, SUPABASE_ANON_KEY, {
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

// ── Connectivity Check ────────────────────────────────────────────────────────
// Actual reachability check instead of hardcoded true
export let isSupabaseReachable = typeof navigator !== 'undefined' ? navigator.onLine : true;

export const checkConnection = async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        isSupabaseReachable = false;
        return false;
    }
    try {
        const url = getSupabaseUrl();
        const res = await fetch(`${url}/rest/v1/`, { 
            method: 'HEAD', 
            headers: { 'apikey': SUPABASE_ANON_KEY },
            signal: AbortSignal.timeout(5000)
        });
        isSupabaseReachable = res.ok;
        return res.ok;
    } catch {
        isSupabaseReachable = false;
        return false;
    }
};

// Run connectivity check once at startup, non-blocking
export const connectivityReady: Promise<boolean> = checkConnection().catch(() => {
    isSupabaseReachable = false;
    return false;
});

// Re-check on network status change
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { checkConnection(); });
    window.addEventListener('offline', () => { isSupabaseReachable = false; });
}