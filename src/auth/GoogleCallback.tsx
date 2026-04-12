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
    const [showFailsafe, setShowFailsafe] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowFailsafe(true), 6000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        let authTimeoutId: ReturnType<typeof setTimeout>;

        const handleCallback = async () => {
            const startTime = Date.now();
            console.log("🚦 [GoogleCallback] Verification started at:", new Date(startTime).toLocaleTimeString());

            // 1. Setup Timeout Fallback (20 seconds)
            authTimeoutId = setTimeout(() => {
                if (!processed.current) return; 
                console.error("❌ [GoogleCallback] Global Timeout triggered after 20s");
                setStatus("Verification timed out...");
                toast.error("Authentication timed out. If this keeps happening, use the 'Bypass Proxy' button on the Login page.");
                navigate("/login", { replace: true });
            }, 20000);

            const clearAuthTimeout = () => {
                clearTimeout(authTimeoutId);
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
                // FIX BUG-1: Use getSession() instead of getUser().
                // getUser() makes a live network call to /auth/v1/user through the PHP proxy,
                // which can return 401 or hang if the proxy strips the Authorization header.
                // getSession() reads the locally-cached session token — zero network calls.
                setStatus("Step 3/3: Synchronizing shop profile...");
                
                const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;
                const user = currentSession?.user ?? null;

                if (user) {
                    console.log("⚡ [GoogleCallback] Fetching user shop link...");
                    await syncUserShop(user.id);
                    
                    clearAuthTimeout();
                    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`✅ [GoogleCallback] Success! Total time: ${duration}s`);
                    
                    toast.success("Login verified successfully!");
                    navigate("/dashboard", { replace: true });
                } else {
                    // One last check: even if session.user is null in the local state, 
                    // maybe the session IS there but the state is lagging.
                    const { data: { session: retrySession } } = await supabase.auth.getSession();
                    if (retrySession?.user) {
                        console.log("⚡ [GoogleCallback] Session found on retry. Proceeding.");
                        navigate("/dashboard", { replace: true });
                    } else {
                        throw new Error("No user found in session after verification.");
                    }
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

        return () => {
            if (authTimeoutId) clearTimeout(authTimeoutId);
        };
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
                {showFailsafe && (
                    <div className="mt-8 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <p className="text-xs text-muted-foreground max-w-xs px-4">
                            ISP or Proxy slow? If your login with Google was already successful, you can try entering the dashboard directly.
                        </p>
                        <button 
                            onClick={() => navigate("/dashboard", { replace: true })}
                            className="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-sm font-medium transition-colors border border-primary/20"
                        >
                            Skip to Dashboard →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
