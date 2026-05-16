// eslint-disable-file react-refresh/only-export-components
/* eslint-disable react-refresh/only-export-components */
/**
 * AuthProvider — Global authentication context.
 *
 * Wraps the application to provide auth state (user, session, loading)
 * and actions (signIn, signUp, signInWithGoogle, signOut) to all children.
 *
 * Supabase handles bcrypt password hashing and JWT token management
 * server-side. This provider simply surfaces that state to React.
 *
 * Note: AuthContext is intentionally co-located with AuthProvider.
 * Splitting them would break standard React context patterns.
 */

import {
    createContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage, syncUserShop } from "./authHelpers";
import type { User, Session } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";

// ─── Context shape ──────────────────────────────────────────────────────────
export interface AuthContextValue {
    /** The currently authenticated Supabase user, or null. */
    user: User | null;
    /** The current Supabase session (contains JWT access/refresh tokens). */
    session: Session | null;
    /** True while the initial session check is in progress. */
    loading: boolean;

    // ─── Actions ────────────────────────────────────────────────────────────
    /** Sign in with email + password.  Returns an error string on failure. */
    signIn: (
        email: string,
        password: string,
        rememberMe?: boolean,
    ) => Promise<string | null>;

    /** Create a new account.  Returns an error string on failure,
     *  or a special "verify" string when email verification is required. */
    signUp: (opts: {
        email: string;
        password: string;
        fullName: string;
        shopName?: string;
        rememberMe?: boolean;
    }) => Promise<string | null>;

    /** Redirect to Google OAuth flow. */
    signInWithGoogle: () => Promise<string | null>;

    /** Sign out and clear local session data. */
    signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider component ─────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
    // ─── Synchronous Initial State (CTO TASK FORCE: ZERO FLASH) ──────────────
    // We parse the Supabase session from localStorage BEFORE the first render.
    // This prevents the "AuthGuard -> Login -> Dashboard" redirect loop.
    const initialAuth = (() => {
        if (typeof window === "undefined") return { user: null, session: null, loading: true };
        
        // Find Supabase token key dynamically
        const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.includes('-auth-token'));
        if (sbKey) {
            try {
                const raw = localStorage.getItem(sbKey);
                if (raw) {
                    const data = JSON.parse(raw);
                    if (data?.user) {
                        console.log("⚡ [AuthProvider] Synchronous session detected for user:", data.user.id);
                        return { user: data.user, session: data, loading: false };
                    }
                }
            } catch (e) {
                console.error("⚠️ [AuthProvider] Failed to parse initial session:", e);
            }
            // If key exists but parse failed, stay in loading state until getSession() confirms
            return { user: null, session: null, loading: true };
        }
        
        // No token found — definitely logged out
        return { user: null, session: null, loading: false };
    })();

    const [user, setUser] = useState<User | null>(initialAuth.user);
    const [session, setSession] = useState<Session | null>(initialAuth.session);
    const [loading, setLoading] = useState(initialAuth.loading);

    // Bootstrap — check for existing session on mount
    useEffect(() => {
        const init = async () => {
            try {
                const { data } = await supabase.auth.getSession();
                setSession(data.session);
                setUser(data.session?.user ?? null);
            } catch {
                // Supabase unreachable — remain unauthenticated
            } finally {
                setLoading(false);
            }
        };

        init();

        // Subscribe to future auth state changes (login, logout, token refresh)
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            console.log(`🔐 [AuthContext] Event: ${event}`);
            
            setSession(newSession);
            setUser(newSession?.user ?? null);
            setLoading(false);

            if (event === "SIGNED_IN" && newSession?.user) {
                // INSTANT LOAD: If we have a cached shop ID, broadcast it immediately
                // before wait for the network sync.
                const cachedShopId = localStorage.getItem("currentShopId");
                if (cachedShopId) {
                    console.log("⚡ [AuthContext] Using cached Shop ID for instant load:", cachedShopId);
                    window.dispatchEvent(new CustomEvent("medix_shop_sync", { detail: { shopId: cachedShopId } }));
                }
                
                // Background sync (don't block the UI rendering)
                syncUserShop(newSession.user.id).catch(err => {
                    console.error("❌ [AuthContext] Background shop sync failed:", err);
                });
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // ─── Email / Password sign-in ───────────────────────────────────────────
    const signIn = useCallback(
        async (
            email: string,
            password: string,
            rememberMe = false,
        ): Promise<string | null> => {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (error) return getAuthErrorMessage(error);

            // "Remember me" logic — mark session as temporary so DashboardLayout
            // can wipe localStorage on browser close for shared-computer safety.
            if (!rememberMe) {
                sessionStorage.setItem("temporary_session", "true");
            } else {
                sessionStorage.removeItem("temporary_session");
            }

            // OPTIMIZED: We no longer await shop sync here to provide "instant" dashboard access.
            // The sync will happen in the background or via the useUserShops hook.
            if (data?.user) {
                syncUserShop(data.user.id).catch(err => {
                    console.error("❌ [AuthProvider] Background shop sync failed:", err);
                });
            }

            return null; // success
        },
        [],
    );

    // ─── Email / Password sign-up ───────────────────────────────────────────
    const signUp = useCallback(
        async ({
            email,
            password,
            fullName,
            shopName,
            rememberMe = false,
        }: {
            email: string;
            password: string;
            fullName: string;
            shopName?: string;
            rememberMe?: boolean;
        }): Promise<string | null> => {
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    // Point to root so App.tsx token interceptor can forward tokens
                    emailRedirectTo: `${window.location.origin}/`,
                    data: {
                        full_name: fullName,
                        shop_name: shopName || "My Medical Shop",
                    },
                },
            });

            if (error) return getAuthErrorMessage(error);

            // Supabase returns empty identities when email is already taken
            if (data?.user?.identities?.length === 0) {
                return "An account with this email already exists. Please sign in.";
            }

            // Email verification required (no session returned)
            if (data?.user && !data.session) {
                return "verify"; // caller should show a "check your inbox" message
            }

            // OPTIMIZED: Background sync
            if (data?.user?.id) {
                syncUserShop(data.user.id).catch(console.error);
            }

            // Instant sign-up (verification disabled or auto-confirmed)
            if (!rememberMe) sessionStorage.setItem("temporary_session", "true");
            return null;
        },
        [],
    );

    // ─── Google OAuth ───────────────────────────────────────────────────────
    const signInWithGoogle = useCallback(async (): Promise<string | null> => {
        const isNative = Capacitor.isNativePlatform();
        const callbackUrl = isNative
            ? "com.pharmaassist.app://callback" // Native Deep Link
            : `${window.location.origin}/`; // Web/PWA Root (Always include trailing slash)

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                // Supabase strips hash fragments from redirectTo.
                // Point to appropriate callback so App.tsx global interceptor
                // or Native App Plugin can parse the tokens.
                redirectTo: callbackUrl,
            },
        });

        if (error) return getAuthErrorMessage(error);
        return null; // browser navigates to Google — no further action needed
    }, []);

    // ─── Sign out ───────────────────────────────────────────────────────────
    const signOut = useCallback(async () => {
        console.log("🚪 [AuthProvider] Optimistic SignOut initiated...");
        
        // 1. Clear local application state immediately
        localStorage.removeItem("currentShopId");
        localStorage.removeItem("medix_cached_shops");
        localStorage.removeItem("medix_device_id");
        sessionStorage.removeItem("temporary_session");
        
        // 2. Clear context state to trigger re-renders
        setUser(null);
        setSession(null);

        // 3. Inform Supabase (with timeout guard)
        // We don't want a slow connection to hang the logout spinner forever.
        try {
            await Promise.race([
                supabase.auth.signOut(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("SignOut Timeout")), 3000))
            ]);
            console.log("✅ [AuthProvider] Supabase session revoked.");
        } catch (e) {
            console.warn("⚠️ [AuthProvider] SignOut server call failed or timed out. Local session cleared anyway.");
        }
    }, []);

    return (
        <AuthContext.Provider
            value={{ user, session, loading, signIn, signUp, signInWithGoogle, signOut }}
        >
            {children}
        </AuthContext.Provider>
    );
}
