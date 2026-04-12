/**
 * Auth Helpers — Shared utilities for the authentication module.
 *
 * - getAuthErrorMessage: maps Supabase error objects to friendly strings.
 * - extractTokensFromHash: parses OAuth/email-verification tokens from the
 *   URL hash when running under HashRouter.
 * - checkSupabaseConnectivity: pings the Supabase health endpoint.
 * - syncUserShop: Fetches and stores the user's current shop ID in localStorage.
 */

import { supabase } from "@/integrations/supabase/client";

// ─── User-friendly error messages ───────────────────────────────────────────
export const getAuthErrorMessage = (error: unknown): string => {
    const msg =
        (error as { message?: string })?.message?.toLowerCase() ?? "";
    const status = (error as { status?: number })?.status;

    // ── Proxy / network failures ────────────────────────────────────────
    if (msg.includes("unexpected end of json") || msg.includes("unexpected token"))
        return "Connection Error: Cannot reach authentication server. Your ISP may be blocking the service. Try using a VPN or a different network.";
    if (msg.includes("is not valid json"))
        return "Server Configuration Error: The Supabase proxy returned an invalid response. Please contact support.";
    if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network error"))
        return "Network Error: Unable to connect. Please check your internet connection or try a VPN.";
    if (msg.includes("load failed"))
        return "Connection Failed: The authentication server is unreachable. Your ISP may be blocking it — try a VPN or mobile hotspot.";
    if (status === 500 || msg.includes("500") || msg.includes("internal server error"))
        return "Critical Error (500): The authentication proxy or database trigger failed. If using localhost, ensure your proxy bypass (Cloudflare/Production) is reachable. Check console for details.";
    if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("aborted"))
        return "Connection Timeout: The server took too long to respond. Your ISP may be blocking the service.";

    // ── Standard Supabase auth errors ───────────────────────────────────
    if (msg.includes("invalid login credentials"))
        return "Incorrect email or password.";
    if (msg.includes("email not confirmed"))
        return "Please verify your email before signing in. Check your inbox.";
    if (msg.includes("rate limit"))
        return "Too many attempts. Please wait a few minutes and try again.";
    if (msg.includes("already registered"))
        return "An account with this email already exists. Please sign in.";

    return (error as { message?: string })?.message ?? "An unexpected error occurred. Please try again.";
};

// ─── Token extraction for HashRouter ────────────────────────────────────────
// With HashRouter the URL after a Supabase callback looks like:
//   https://medixai.shop/#/auth/google#access_token=xxx&refresh_token=yyy&...
// window.location.hash gives:  #/auth/google#access_token=xxx&...
// We need the part AFTER the second '#'.
export const extractTokensFromHash = (): URLSearchParams | null => {
    const fullHash = window.location.hash; // e.g. "#/auth/google#access_token=..."
    if (!fullHash) return null;

    const secondHash = fullHash.indexOf("#", 1);
    if (secondHash === -1) return null;

    const tokenString = fullHash.substring(secondHash + 1); // "access_token=xxx&..."
    if (!tokenString) return null;

    return new URLSearchParams(tokenString);
};

// ─── Connectivity check ─────────────────────────────────────────────────────
// Pings the Supabase proxy health endpoint to determine if the backend is
// reachable.  Returns { reachable, latencyMs, error }.
export interface ConnectivityResult {
    reachable: boolean;
    latencyMs: number;
    error?: string;
}

export const checkSupabaseConnectivity = async (
    baseUrl: string,
    apiKey?: string,
): Promise<ConnectivityResult> => {
    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 16000); // Increased to 16s for slow proxies

        const headers: Record<string, string> = { Accept: "application/json" };
        if (apiKey) headers["apikey"] = apiKey;

        const res = await fetch(`${baseUrl}/auth/v1/health`, {
            method: "GET",
            signal: controller.signal,
            headers,
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - start;
        // 2xx = healthy, 401/403 = proxy works but auth endpoint needs auth
        // Either way, the server IS reachable
        if (res.ok || res.status === 401 || res.status === 403) {
            return { reachable: true, latencyMs };
        }
        return {
            reachable: false,
            latencyMs,
            error: `Server returned ${res.status}`,
        };
    } catch (err) {
        return {
            reachable: false,
            latencyMs: Date.now() - start,
            error:
                err instanceof DOMException && err.name === "AbortError"
                    ? `Connection timed out after ${Date.now() - start}ms. Your ISP or proxy might be slow.`
                    : (err as Error).message || "Network error",
        };
    }
};

// ─── Shop Synchronization ───────────────────────────────────────────────────
/**
 * syncUserShop — Fetches the user's shops and ensures a valid shop_id is in localStorage.
 *
 * FIX BUG-4: Added retry-with-backoff (max 3 attempts, 1s/2s/3s delays).
 * Reason: For new Google OAuth users, the `handle_new_user` Postgres trigger may not
 * have committed the `user_shops` row by the time this runs immediately after SIGNED_IN.
 * Retrying gives the DB trigger time to complete before we give up.
 */
export const syncUserShop = async (userId: string, maxRetries = 3): Promise<string | null> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 [AuthHelpers] Synchronizing Shop ID for user: ${userId} (attempt ${attempt}/${maxRetries})`);
            
            const { data: userShops, error } = await supabase
                .from("user_shops")
                .select("shop_id, is_primary")
                .eq("user_id", userId);

            if (error) {
                console.error("❌ [AuthHelpers] Shop sync fetch error:", error);
                // Don't retry on permission errors
                if (error.code === 'PGRST301' || error.message?.includes('JWT')) return null;
            } else if (userShops && userShops.length > 0) {
                // Priority: Primary Shop -> First Shop
                const primaryShop = userShops.find(s => s.is_primary) || userShops[0];
                const shopId = primaryShop.shop_id;
                
                if (shopId) {
                    localStorage.setItem("currentShopId", shopId);
                    
                    // DISPATCH CUSTOM EVENT for same-window reactivity
                    window.dispatchEvent(new CustomEvent("medix_shop_sync", { detail: { shopId } }));
                    
                    console.log(`✅ [AuthHelpers] Shop ID synchronized on attempt ${attempt}:`, shopId);
                    return shopId;
                }
            } else {
                console.warn(`⚠️ [AuthHelpers] No shops found on attempt ${attempt} for user:`, userId);
            }
        } catch (err) {
            console.error(`❌ [AuthHelpers] Shop sync exception on attempt ${attempt}:`, err);
        }

        // Wait before next retry (1s, 2s, 3s...)
        if (attempt < maxRetries) {
            const delay = attempt * 1000;
            console.log(`⏳ [AuthHelpers] Retrying shop sync in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    console.warn("⚠️ [AuthHelpers] All shop sync retries exhausted. Attempting client-side fallback provisioning...");
    
    try {
        // FALLBACK: Auto-provision shop if trigger failed or user is legacy
        const { data: userProfile } = await supabase.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle();
        const fallbackName = userProfile?.full_name ? `${userProfile.full_name}'s Pharmacy` : "My Medical Shop";

        console.log(`[AuthHelpers] Creating fallback shop: ${fallbackName}`);
        
        // 1. Create Shop
        const { data: newShop, error: createErr } = await supabase
            .from("shops")
            .insert({ name: fallbackName, owner_id: userId })
            .select("id")
            .single();

            if (newShop?.id && !createErr) {
                console.log(`[AuthHelpers] Fallback shop record created: ${newShop.id}. Linking...`);
                
                // 2. Link Profile
                const { error: profileErr } = await supabase.from("profiles").upsert({ user_id: userId, shop_id: newShop.id, role: 'owner' });
                if (profileErr) console.error("❌ [AuthHelpers] Fallback profile link failed:", profileErr);
                
                // 3. Link User Shops (Junction)
                const { error: junctionErr } = await supabase.from("user_shops").insert({ user_id: userId, shop_id: newShop.id, is_primary: true });
                if (junctionErr) {
                    console.error("❌ [AuthHelpers] Fallback junction link failed (Check RLS!):", junctionErr);
                } else {
                    console.log(`✅ [AuthHelpers] Fallback junction link success`);
                }

                localStorage.setItem("currentShopId", newShop.id);
                // DISPATCH EVENT so hooks can pick it up immediately
                window.dispatchEvent(new CustomEvent("medix_shop_sync", { detail: { shopId: newShop.id } }));
                
                console.log(`✅ [AuthHelpers] Fallback shop provisioned automatically:`, newShop.id);
                return newShop.id;
            } else if (createErr) {
                console.error("❌ [AuthHelpers] Fallback shop creation failed (Check RLS!):", createErr);
            }
        } catch (fallbackErr) {
            console.error("❌ [AuthHelpers] Fallback provisioning exception:", fallbackErr);
        }

    return null;
};
