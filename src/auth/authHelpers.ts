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
export const syncUserShop = async (userId: string, maxRetries = 5): Promise<string | null> => {
    // Increase retries to 5 for high-latency mobile networks
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 [AuthHelpers] Synchronizing Shop ID for user: ${userId} (attempt ${attempt}/${maxRetries})`);
            
            // CRITICAL: Ensure we have a fresh session context
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                console.warn("⚠️ [AuthHelpers] No active session during sync retry. Waiting...");
            } else {
                const { data: userShops, error } = await supabase
                    .from("user_shops")
                    .select("shop_id, is_primary")
                    .eq("user_id", userId);

                if (error) {
                    console.error("❌ [AuthHelpers] Shop sync fetch error:", error);
                } else if (userShops && userShops.length > 0) {
                    const primaryShop = userShops.find(s => s.is_primary) || userShops[0];
                    const shopId = primaryShop.shop_id;
                    
                    if (shopId) {
                        localStorage.setItem("currentShopId", shopId);
                        
                        // Cache shops for instant UI response next time
                        const { data: fullShops } = await supabase.from('shops').select('id, name').in('id', userShops.map(s => s.shop_id));
                        const mapped = userShops.map(us => {
                             const s = fullShops?.find(fs => fs.id === us.shop_id);
                             return { id: us.shop_id, name: s?.name || "My Pharmacy", is_primary: us.is_primary };
                        });
                        localStorage.setItem("medix_cached_shops", JSON.stringify(mapped));

                        window.dispatchEvent(new CustomEvent("medix_shop_sync", { detail: { shopId } }));
                        console.log(`✅ [AuthHelpers] Shop ID synchronized on attempt ${attempt}:`, shopId);
                        return shopId;
                    }
                }
            }
        } catch (err) {
            console.error(`❌ [AuthHelpers] Shop sync exception on attempt ${attempt}:`, err);
        }

        if (attempt < maxRetries) {
            const delay = Math.min(attempt * 1000, 3000); // 1s, 2s, 3s, 3s...
            await new Promise(r => setTimeout(r, delay));
        }
    }

    console.warn("⚠️ [AuthHelpers] All shop sync retries exhausted. Attempting client-side fallback provisioning...");
    
    try {
        // Double check session one last time
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        const fallbackName = session.user.user_metadata?.shop_name || "My Medical Shop";
        console.log(`[AuthHelpers] Creating fallback shop: ${fallbackName}`);
        
        // 1. Create Shop (Allowed by new RLS 'Owner can insert own shop')
        const { data: newShop, error: createErr } = await supabase
            .from("shops")
            .insert({ name: fallbackName, owner_id: userId })
            .select("id")
            .single();

        let shopId = newShop?.id;

        if (createErr) {
            // If it failed because a shop already exists for this owner (conflict), fetch it
            if (createErr.code === '23505') {
                const { data: existing } = await supabase.from('shops').select('id').eq('owner_id', userId).maybeSingle();
                shopId = existing?.id;
            } else {
                console.error("❌ [AuthHelpers] Fallback shop creation failed:", createErr.message);
            }
        }

        if (shopId) {
            // 2. Link User Shops (Allowed by new RLS 'Users can insert own shop links')
            await supabase.from("user_shops").upsert({ 
                user_id: userId, 
                shop_id: shopId, 
                is_primary: true 
            }, { onConflict: 'user_id, shop_id' });
            
            // 3. Update Profile (Allowed by RLS 'Users can update own profile')
            await supabase.from("profiles").upsert({ 
                user_id: userId, 
                shop_id: shopId,
                full_name: session.user.user_metadata?.full_name || "Pharmacist"
            }, { onConflict: 'user_id' });

            localStorage.setItem("currentShopId", shopId);
            window.dispatchEvent(new CustomEvent("medix_shop_sync", { detail: { shopId } }));
            return shopId;
        }
    } catch (fallbackErr) {
        console.error("❌ [AuthHelpers] Fallback provisioning exception:", fallbackErr);
    }

    return null;
};
