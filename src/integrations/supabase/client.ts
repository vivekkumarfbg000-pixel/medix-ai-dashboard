import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import type { Database } from './types';

export const SUPABASE_ANON_KEY = 
    import.meta.env.VITE_SUPABASE_ANON_KEY || 
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
    '';
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

  // For Native (Capacitor/Android/iOS), we must use a full URL.
  const isNative = Capacitor.isNativePlatform();
  
  if (isNative) {
    // ALWAYS use the primary domain proxy for Native to bypass ISP blocks
    return 'https://medixai.shop/supabase-proxy';
  }

  // Construct absolute URL for the proxy to satisfy Supabase client requirements.
  // Using window.location.origin ensures the same protocol/domain is used.
  const proxyPath = import.meta.env.VITE_SUPABASE_PROXY_URL || '/supabase-proxy';
  
  // If it's already absolute (starts with http), use it as is
  if (proxyPath.startsWith('http')) return proxyPath;
  
  // Otherwise, prefix with origin
  return `${window.location.origin}${proxyPath.startsWith('/') ? '' : '/'}${proxyPath}`;
}

const SUPABASE_URL = getSupabaseUrl();

// ─── Proxy Management ────────────────────────────────────────────────────────
const getFinalUrl = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const forceNoProxy = localStorage.getItem('medix_force_no_proxy') === 'true';
    if (params.get('no_proxy') === 'true' || forceNoProxy) {
      console.warn('⚠️ [Supabase] Failsafe: Connecting DIRECTLY to supabase.co');
      return SUPABASE_URL_RAW;
    }
  }
  
  // Validation: ensure the URL is absolute and valid.
  try {
    const urlObj = new URL(SUPABASE_URL);
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      return SUPABASE_URL;
    }
  } catch (e) {
    console.warn('⚠️ [Supabase] Invalid Proxy URL, falling back to raw.');
  }
  
  return SUPABASE_URL_RAW;
};

const FINAL_SUPABASE_URL = getFinalUrl();

/** Exposed so the connectivity checker can ping the right base URL. */
export const getSupabaseBaseUrl = () => SUPABASE_URL;

export const supabase = createClient<Database>(FINAL_SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // FIX BUG-2: Keep detectSessionInUrl FALSE.
    // If true, it causes a known deadlock with manual exchangeCodeForSession
    // in GoogleCallback.tsx. Our hash router prevents this from working reliably anyway.
    detectSessionInUrl: false,
  },
  db: { schema: 'public' },
  global: {
    headers: { 'x-application-name': 'medix-ai-dashboard' },
    fetch: (url, options) => {
      // FIX BUG-5: Add a global 15-second timeout to ALL Supabase requests.
      // This prevents the UI from hanging forever (e.g. on "Signing in...")
      // if the user's ISP drops connections to the proxy or supabase.co silently.
      const timeoutMatch = options?.signal ? undefined : AbortSignal.timeout(15000);
      return fetch(url, {
        ...options,
        signal: options?.signal || timeoutMatch
      });
    }
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