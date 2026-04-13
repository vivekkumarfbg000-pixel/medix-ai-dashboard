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
                toast.dismiss(); // Clear any "Parsing..." toasts
                toast.error("Connecting... If loading takes too long, you can skip from the dashboard screen.");
                navigate("/dashboard", { replace: true }); // Fallback to Dashboard instead of Login
            }, 30000);

            // 2. Background Session Checker (Self-Healing)
            sessionCheckerId = setInterval(async () => {
                if (isDone) return;
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    console.log("🩹 [GoogleCallback] Session found by background checker! Proceeding...");
                    isDone = true;
                    clearInterval(sessionCheckerId);
                    clearTimeout(authTimeoutId);
                    
                    try { await syncUserShop(session.user.id); } catch(e) { console.error(e); }
                    
                    toast.success("Login verified (recovered)!");
                    navigate("/dashboard", { replace: true });
                }
            }, 1000); // 1s interval for faster recovery

            const cleanup = () => {
                isDone = true;
                clearTimeout(authTimeoutId);
                clearInterval(sessionCheckerId);
            };

            try {
                // 3. Extract Tokens
                setStatus("Step 1/3: Parsing security tokens...");
                
                const queryParams = new URLSearchParams(location.search);
                const pkceCode = queryParams.get("code");
                const pkceError = queryParams.get("error");
                const hashParams = extractTokensFromHash();
                const hashError = hashParams?.get("error");
                const combinedParams = new URLSearchParams(window.location.search || location.search);
                const finalCode = pkceCode || combinedParams.get("code");

                console.log("🔍 [GoogleCallback] Tokens — PKCE:", finalCode ? "YES" : "NO", "| Hash:", hashParams ? "YES" : "NO");

                // Immediately wipe the URL search params
                if (typeof window !== "undefined" && (window.location.search.includes("code=") || location.search.includes("code="))) {
                    console.log("🧹 [GoogleCallback] Wiping code from URL...");
                    const urlObj = new URL(window.location.href);
                    urlObj.search = "";
                    if (urlObj.hash.includes("?")) urlObj.hash = urlObj.hash.split("?")[0];
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
                
                const { data: { session: existingSession } } = await supabase.auth.getSession();
                if (existingSession?.user) {
                    console.log("⚡ [GoogleCallback] Valid session already exists. Skipping exchange.");
                } else if (finalCode) {
                    console.log("⚡ [GoogleCallback] Exchanging PKCE code...");
                    
                    const MAX_TIMEOUT = 12000;
                    const exchangePromise = supabase.auth.exchangeCodeForSession(finalCode);
                    const timeoutPromise = new Promise<{error: Error}>((_, reject) => 
                        setTimeout(() => reject(new Error(`Timeout: PKCE exchange took longer than ${MAX_TIMEOUT}ms.`)), MAX_TIMEOUT)
                    );

                    const { error } = await Promise.race([exchangePromise, timeoutPromise]);
                    
                    if (error) {
                        if (error.message.includes("invalid_grant") || error.message.includes("PKCE") || (error as any).status === 400) {
                            console.warn("⚠️ PKCE Code used. Checking if session is active...");
                            const { data: maybeSession } = await supabase.auth.getSession();
                            if (!maybeSession?.session) throw error;
                        } else {
                            throw error;
                        }
                    }
                } else if (hashParams) {
                    const accessToken = hashParams.get("access_token");
                    const refreshToken = hashParams.get("refresh_token");
                    if (accessToken && refreshToken) {
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
                
                let pollCount = 0;
                let finalSession = null;
                while (pollCount < 6 && !isDone) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        finalSession = session;
                        break;
                    }
                    console.info(`⏳ [GoogleCallback] Waiting for session sync (Poll ${pollCount + 1})...`);
                    await new Promise(r => setTimeout(r, 1000));
                    pollCount++;
                }

                if (finalSession?.user) {
                    console.log("✅ [GoogleCallback] Session verified. Triggering background sync and redirecting.");
                    
                    // Background sync (Non-blocking)
                    syncUserShop(finalSession.user.id).catch(err => {
                        console.error("❌ [GoogleCallback] Background sync error:", err);
                    });

                    cleanup();
                    toast.success("Login verified successfully!");
                    navigate("/dashboard", { replace: true });
                } else {
                    throw new Error("Session verification failed. Your connection might be too slow.");
                }

            } catch (err) {
                if (isDone) return;
                cleanup();
                console.error("❌ [GoogleCallback] Critical Failure:", err);
                
                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('sb-') && key.includes('auth-token')) localStorage.removeItem(key);
                    }
                } catch(e) {}

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
                <p className="text-sm text-muted-foreground animate-pulse">Please wait...</p>
                {showFailsafe && (
                    <div className="mt-8 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <p className="text-xs text-muted-foreground max-w-xs px-4">
                            ISP or Proxy slow? If your login with Google was already successful, you can try entering the dashboard directly.
                        </p>
                        <button 
                            onClick={() => navigate("/dashboard", { replace: true })}
                            className="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-sm font-medium border border-primary/20"
                        >
                            Skip to Dashboard →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
