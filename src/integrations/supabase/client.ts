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

  // For Native/Production, or if we want to bypass local ISP blocks via the remote proxy
  const useRemoteProxy = Capacitor.isNativePlatform() || window.location.hostname !== 'localhost';
  
  if (useRemoteProxy) {
    // Standardize on medixai.shop/supabase-proxy as the primary entry point
    return 'https://medixai.shop/supabase-proxy';
  }

  // Local development hits the Vite proxy
  const { protocol, host } = window.location;
  return `${protocol}//${host}/supabase-proxy`;
}

const SUPABASE_URL = getSupabaseUrl();
if (typeof window !== 'undefined') {
  console.log('⚡ [Supabase] Client initialized with URL:', SUPABASE_URL);
}

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