/**
 * GoogleCallback — Handles the OAuth redirect from Google/Supabase.
 *
 * Route: /auth/google
 *
 * After Google authentication, Supabase redirects to the app root with tokens
 * in the URL hash. App.tsx's global interceptor rewrites these tokens so
 * HashRouter loads this component at /#/auth/google#access_token=...
 *
 * This component extracts the tokens, calls setSession, and redirects to
 * /dashboard on success.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { extractTokensFromHash, syncUserShop } from "./authHelpers";
import { toast } from "sonner";

export default function GoogleCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const processed = useRef(false);
    const [status, setStatus] = useState("Verifying login...");

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        const handleCallback = async () => {
            const startTime = Date.now();
            console.log("🚦 [GoogleCallback] Verification started at:", new Date(startTime).toLocaleTimeString());

            // 1. Setup Timeout Fallback (20 seconds)
            const timeoutId = setTimeout(() => {
                if (!processed.current) return; 
                console.error("❌ [GoogleCallback] Global Timeout triggered after 20s");
                setStatus("Verification timed out...");
                toast.error("Authentication timed out. Your ISP or proxy might be slow. Try using a VPN.");
                navigate("/login", { replace: true });
            }, 20000);

            // 1b. Setup Emergency Proxy Bypass (8 seconds)
            const bypassId = setTimeout(() => {
                if (!processed.current) return;
                console.warn("⚠️ [GoogleCallback] Hang detected. Attempting emergency proxy bypass...");
                window.dispatchEvent(new CustomEvent('medix_bypass_proxy'));
                setStatus("Still working: Attempting direct connection fallback...");
            }, 8000);

            const clearAuthTimeout = () => {
                clearTimeout(timeoutId);
                clearTimeout(bypassId);
            };

            try {
                // 2. Extract Tokens (Check ALL possible locations)
                setStatus("Step 1/3: Parsing security tokens...");
                
                // PKCE Search Params
                const queryParams = new URLSearchParams(location.search);
                const pkceCode = queryParams.get("code");
                const pkceError = queryParams.get("error");

                // Implicit Hash Params (using helper for double-hash handling)
                const hashParams = extractTokensFromHash();
                const hashError = hashParams?.get("error");

                // Fallback: Check if Search Params are stuck INSIDE the location search (HashRouter quirks)
                const combinedParams = new URLSearchParams(window.location.search || location.search);
                const finalCode = pkceCode || combinedParams.get("code");

                console.log("🔍 [GoogleCallback] Tokens — PKCE:", finalCode ? "YES" : "NO", "| Hash:", hashParams ? "YES" : "NO");

                if (pkceError || hashError) {
                    clearAuthTimeout();
                    const desc = pkceError || hashError || "Authorization failed";
                    console.error("❌ [GoogleCallback] OAuth Error:", desc);
                    toast.error(`Auth Error: ${desc}`);
                    navigate("/login", { replace: true });
                    return;
                }

                // 3. Establish Session
                setStatus("Step 2/3: Establishing secure session...");
                
                if (finalCode) {
                    console.log("⚡ [GoogleCallback] Exchanging PKCE code...");
                    const { error } = await supabase.auth.exchangeCodeForSession(finalCode);
                    if (error) throw error;
                } else if (hashParams) {
                    const accessToken = hashParams.get("access_token");
                    const refreshToken = hashParams.get("refresh_token");
                    if (accessToken && refreshToken) {
                        console.log("⚡ [GoogleCallback] Setting implicit session...");
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        if (error) throw error;
                    }
                }

                // 4. Verify & Sync Profile
                setStatus("Step 3/3: Synchronizing shop profile...");
                
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;

                if (user) {
                    console.log("⚡ [GoogleCallback] Fetching user shop link...");
                    await syncUserShop(user.id);
                    
                    clearAuthTimeout();
                    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`✅ [GoogleCallback] Success! Total time: ${duration}s`);
                    
                    toast.success("Login verified successfully!");
                    navigate("/dashboard", { replace: true });
                } else {
                    throw new Error("No user found in session after verification.");
                }

            } catch (err) {
                clearAuthTimeout();
                console.error("❌ [GoogleCallback] Critical Failure:", err);
                
                const errMsg = (err as Error).message || "Unknown auth error";
                if (errMsg.includes("401") || errMsg.includes("Unauthorized")) {
                    toast.error("Security session expired or API key invalid. Please login again.");
                } else {
                    toast.error("Connection failed. Your ISP may be blocking the session. Try a VPN.");
                }
                
                navigate("/login", { replace: true });
            }
        };

        handleCallback();
    }, [navigate, location.search]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-medical-canvas space-y-4">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">M</span>
                </div>
            </div>
            <div className="text-center">
                <h2 className="text-lg font-semibold text-foreground">{status}</h2>
                <p className="text-sm text-muted-foreground animate-pulse">
                    Please wait...
                </p>
            </div>
        </div>
    );
}
