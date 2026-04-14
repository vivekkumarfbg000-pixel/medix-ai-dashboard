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
    const [status, setStatus] = useState("Initializing...");
    const [showReset, setShowReset] = useState(false);
    const isDoneRef = useRef(false);

    useEffect(() => {
        // Show emergency reset if we're stuck for 15s
        const timer = setTimeout(() => {
            if (!isDoneRef.current) setShowReset(true);
        }, 15000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;
        // ... rest of the auth logic ...

        let authTimeoutId: ReturnType<typeof setTimeout>;
        let sessionCheckerId: ReturnType<typeof setInterval>;
        let isDone = false;

        const handleCallback = async () => {
            const startTime = Date.now();
            let finalSession: any = null;
            console.log("🚦 [GoogleCallback] Verification started at:", new Date(startTime).toLocaleTimeString());

            // 1. Setup Timeout Fallback (30 seconds)
            authTimeoutId = setTimeout(() => {
                if (isDone) return;
                console.log("⏱️ [GoogleCallback] Safety Timeout — Redirecting to Dashboard");
                navigate("/dashboard", { replace: true });
            }, 12000);

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
                isDoneRef.current = true;
                clearTimeout(authTimeoutId);
                clearInterval(sessionCheckerId);
            };

            try {
                // 3. Extract Tokens
                setStatus("Securing connection...");
                
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
                setStatus("Verifying credentials...");
                
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                if (initialSession?.user) {
                    console.log("⚡ [GoogleCallback] Session detected immediately. Jumping to redirect.");
                    finalSession = initialSession;
                } else if (finalCode) {
                    console.log("⚡ [GoogleCallback] Exchanging PKCE code...");
                    
                    const PKCE_TIMEOUT = 4000; // 4s — Google/Supabase should be faster
                    const exchangePromise = supabase.auth.exchangeCodeForSession(finalCode);
                    const timeoutPromise = new Promise<{error: Error}>((_, reject) => 
                        setTimeout(() => reject(new Error("PKCE exchange timed out (4s)")), PKCE_TIMEOUT)
                    );

                    try {
                        const { error } = await Promise.race([exchangePromise, timeoutPromise]) as any;
                        if (error) {
                            if (error.message.includes("invalid_grant") || error.message.includes("PKCE")) {
                                console.warn("⚠️ PKCE Code might have been used. Checking session...");
                                const { data: maybeSession } = await supabase.auth.getSession();
                                if (!maybeSession?.session) throw error;
                                finalSession = maybeSession.session;
                            } else {
                                throw error;
                            }
                        }
                    } catch (err) {
                        console.warn("⚠️ PKCE Exchange failed/timed out, but session may still exist:", err);
                    }
                } else if (hashParams) {
                    const accessToken = hashParams.get("access_token");
                    const refreshToken = hashParams.get("refresh_token");
                    if (accessToken && refreshToken) {
                        const { error, data } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        if (error) throw error;
                        finalSession = data.session;
                    }
                }

                if (isDone) return;

                // 5. Verify & Sync Profile
                if (!finalSession) {
                    setStatus("Preparing your dashboard...");
                    let pollCount = 0;
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-medical-canvas p-6 relative overflow-hidden">
            {/* Background decorative glows */}
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-700" />

            <div className="relative z-10 w-full max-w-sm card-glass p-12 shadow-2xl animate-in fade-in zoom-in duration-700 text-center space-y-8">
                <div className="relative inline-block">
                    <div className="w-20 h-20 border-b-2 border-primary rounded-full animate-spin duration-[1500ms]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-glow flex items-center justify-center">
                            <span className="text-xl font-black text-white">M</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-foreground tracking-tight">{status}</h2>
                    <p className="text-xs text-muted-foreground font-medium animate-pulse">Finalizing secure session...</p>
                </div>
                
                {showReset && (
                    <div className="pt-4 animate-in slide-in-from-bottom-2 duration-500">
                        <p className="text-[10px] text-muted-foreground mb-4 leading-relaxed px-4">Verification is taking longer than usual. This may be due to a slow ISP or proxy.</p>
                        <button 
                            className="w-full py-2.5 px-4 bg-destructive text-destructive-foreground rounded-xl text-xs font-bold shadow-lg shadow-destructive/20 transition-all active:scale-95"
                            onClick={() => (window as any).medixFactoryReset?.()}
                        >
                            Emergency Factory Reset
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
