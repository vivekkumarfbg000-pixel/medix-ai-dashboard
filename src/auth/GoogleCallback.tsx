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
            try {
                // 1. Check for PKCE flow tokens (query parameters like ?code=)
                const queryParams = new URLSearchParams(location.search);
                const pkceCode = queryParams.get("code");
                const pkceError = queryParams.get("error");

                // 2. Fallback to Implicit flow tokens (hash fragments like #access_token=)
                const hashParams = extractTokensFromHash();
                const hashError = hashParams?.get("error");

                const hasError = pkceError || hashError;
                
                console.log("🔍 [GoogleCallback] PKCE Code:", pkceCode ? "Found" : "None");
                console.log("🔍 [GoogleCallback] PHASH:", hashParams ? "Found" : "None");
                if (hasError) console.error("❌ [GoogleCallback] Auth Error:", pkceError || hashError);

                // --- 2. Add Timeout Protection ---
                const timeoutId = setTimeout(() => {
                    if (!processed.current) return; // Should not happen but safety first
                    setStatus("Authentication timed out...");
                    toast.error("Authentication timed out. Your connection might be slow or blocked.");
                    navigate("/login", { replace: true });
                }, 15000); // 15 seconds max

                const clearAuthTimeout = () => clearTimeout(timeoutId);

                if (hasError) {
                    clearAuthTimeout();
                    const desc =
                        queryParams.get("error_description")?.replace(/\+/g, " ") ||
                        hashParams?.get("error_description")?.replace(/\+/g, " ") ||
                        "Verification failed";
                    toast.error(desc);
                    window.history.replaceState(null, "", window.location.pathname + "#/login");
                    navigate("/login", { replace: true });
                    return;
                }

                if (pkceCode) {
                    setStatus("Setting up session via secure code...");
                    const { error } = await supabase.auth.exchangeCodeForSession(pkceCode);
                    clearAuthTimeout();

                    if (!error) {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) await syncUserShop(user.id);
                        toast.success("Login verified!");
                        navigate("/dashboard", { replace: true });
                        return;
                    } else {
                        console.error("❌ [GoogleCallback] PKCE Error:", error);
                        toast.error(error.message || "Session verification failed.");
                    }
                } else if (hashParams) {
                    const accessToken = hashParams.get("access_token");
                    const refreshToken = hashParams.get("refresh_token");

                    if (accessToken && refreshToken) {
                        setStatus("Setting up session...");
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        clearAuthTimeout();

                        if (!error) {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (user) await syncUserShop(user.id);
                            toast.success("Login verified!");
                            navigate("/dashboard", { replace: true });
                            return;
                        } else {
                            console.error("❌ [GoogleCallback] Session Error:", error);
                            toast.error(error.message || "Session setup failed.");
                        }
                    }
                }

                // Fallback check
                const { data: { session } } = await supabase.auth.getSession();
                clearAuthTimeout();
                
                if (session?.user) {
                    await syncUserShop(session.user.id);
                    navigate("/dashboard", { replace: true });
                } else {
                    setStatus("Authentication failed...");
                    toast.error("Authentication failed. Please try again.");
                    navigate("/login", { replace: true });
                }
            } catch (err) {
                console.error("[GoogleCallback] Critical Error:", err);
                toast.error("Authentication error. Check your internet or try a VPN.");
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
