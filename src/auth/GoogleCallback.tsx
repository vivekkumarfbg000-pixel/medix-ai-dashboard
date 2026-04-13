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
        let sessionCheckerId: ReturnType<typeof setInterval>;
        let isDone = false;

        const handleCallback = async () => {
            const startTime = Date.now();
            console.log("🚦 [GoogleCallback] Verification started at:", new Date(startTime).toLocaleTimeString());

            // 1. Setup Timeout Fallback (30 seconds)
            authTimeoutId = setTimeout(() => {
                if (isDone) return;
                console.error("❌ [GoogleCallback] Global Timeout triggered after 30s");
                setStatus("Verification timed out...");
                toast.error("Authentication timed out. If this keeps happening, use the 'Bypass Proxy' button on the Login page.");
                navigate("/login", { replace: true });
            }, 30000);

            // 2. Background Session Checker (Self-Healing)
            // If the official exchange call hangs, this interval will detect if a session
            // was successfully created in local storage by the Supabase core.
            sessionCheckerId = setInterval(async () => {
                if (isDone) return;
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    console.log("🩹 [GoogleCallback] Session found by background checker! Proceeding...");
                    isDone = true;
                    clearInterval(sessionCheckerId);
                    clearTimeout(authTimeoutId);
                    
                    // Sync shop if possible
                    try { await syncUserShop(session.user.id); } catch(e) { console.error(e); }
                    
                    toast.success("Login verified (recovered)!");
                    navigate("/dashboard", { replace: true });
                }
            }, 2000);

            const cleanup = () => {
                isDone = true;
                clearTimeout(authTimeoutId);
                clearInterval(sessionCheckerId);
            };

            try {
                // 3. Extract Tokens (Check ALL possible locations)
                setStatus("Step 1/3: Parsing security tokens...");
                
                const queryParams = new URLSearchParams(location.search);
                const pkceCode = queryParams.get("code");
                const pkceError = queryParams.get("error");
                const hashParams = extractTokensFromHash();
                const hashError = hashParams?.get("error");
                const combinedParams = new URLSearchParams(window.location.search || location.search);
                const finalCode = pkceCode || combinedParams.get("code");

                console.log("🔍 [GoogleCallback] Tokens — PKCE:", finalCode ? "YES" : "NO", "| Hash:", hashParams ? "YES" : "NO");

                // Immediately wipe the URL search params so a refresh doesn't reuse the spent code
                if (typeof window !== "undefined" && window.location.search.includes("code=")) {
                    const urlObj = new URL(window.location.href);
                    urlObj.search = "";
                    window.history.replaceState({}, document.title, urlObj.toString());
                }

                if (pkceError || hashError) {
                    cleanup();
                    const desc = pkceError || hashError || "Authorization failed";
                    console.error("❌ [GoogleCallback] OAuth Error:", desc);
                    toast.error(`Auth Error: ${desc}`);
                    navigate("/login", { replace: true });
                    return;
                }

                // 4. Establish Session
                setStatus("Step 2/3: Establishing secure session...");
                
                // PRE-CHECK: If we already have a session (e.g. background sync or redirect retry),
                // don't try to exchange the code again (which would cause a 400).
                const { data: { session: existingSession } } = await supabase.auth.getSession();
                if (existingSession?.user) {
                    console.log("⚡ [GoogleCallback] Valid session already exists. Skipping exchange.");
                } else if (finalCode) {
                    console.log("⚡ [GoogleCallback] Exchanging PKCE code...");
                    
                    // Failsafe: Hard timeout for the exchange call to prevent complete freeze
                    const MAX_TIMEOUT = 12000;
                    const exchangePromise = supabase.auth.exchangeCodeForSession(finalCode);
                    const timeoutPromise = new Promise<{error: Error}>((_, reject) => 
                        setTimeout(() => reject(new Error(`Timeout: PKCE exchange took longer than ${MAX_TIMEOUT}ms.`)), MAX_TIMEOUT)
                    );

                    const { error } = await Promise.race([exchangePromise, timeoutPromise]);
                    
                    if (error) {
                        // If it's a 400 Bad Request regarding PKCE, it means the code was already used.
                        if (error.message.includes("invalid_grant") || error.message.includes("PKCE") || (error as any).status === 400) {
                            console.warn("⚠️ PKCE Code already used or invalid. Let's check if session is already active.");
                            const { data: maybeSession } = await supabase.auth.getSession();
                            if (!maybeSession?.session) {
                                throw error;
                            }
                        } else {
                            throw error;
                        }
                    }
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

                if (isDone) return;

                // 5. Verify & Sync Profile
                setStatus("Step 3/3: Synchronizing shop profile...");
                
                const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;
                const user = currentSession?.user ?? null;

                if (user) {
                    console.log("⚡ [GoogleCallback] Fetching user shop link...");
                    await syncUserShop(user.id);
                    
                    cleanup();
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
                        cleanup();
                        navigate("/dashboard", { replace: true });
                    } else {
                        throw new Error("No user found in session after verification.");
                    }
                }

            } catch (err) {
                if (isDone) return;
                cleanup();
                console.error("❌ [GoogleCallback] Critical Failure:", err);
                
                // FORCE CLEANUP: If the auth exchange fails, wipe any corrupted state to prevent loops
                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('sb-') && key.includes('auth-token')) {
                            localStorage.removeItem(key);
                        }
                    }
                } catch(e) {}

                const errMsg = (err as Error).message || "Unknown auth error";
                if (errMsg.includes("401") || errMsg.includes("Unauthorized")) {
                    toast.error("Security session expired or API key invalid. Please login again.");
                } else if (errMsg.includes("Timeout")) {
                    toast.error("Authentication timed out. Your connection might be unstable.");
                } else {
                    toast.error("Connection failed. Your ISP may be blocking the session. Try a VPN.");
                }
                
                navigate("/login", { replace: true });
            }
        };

        handleCallback();

        return () => {
            isDone = true;
            if (authTimeoutId) clearTimeout(authTimeoutId);
            if (sessionCheckerId) clearInterval(sessionCheckerId);
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
