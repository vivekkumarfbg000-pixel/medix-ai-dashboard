/**
 * AuthProvider — Global authentication context.
 *
 * Wraps the application to provide auth state (user, session, loading)
 * and actions (signIn, signUp, signInWithGoogle, signOut) to all children.
 *
 * Supabase handles bcrypt password hashing and JWT token management
 * server-side. This provider simply surfaces that state to React.
 */

import {
    createContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "./authHelpers";
import type { User, Session } from "@supabase/supabase-js";

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
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

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
        } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
            setUser(newSession?.user ?? null);
            setLoading(false);
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
            const { error } = await supabase.auth.signInWithPassword({
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

            // Instant sign-up (verification disabled or auto-confirmed)
            if (!rememberMe) sessionStorage.setItem("temporary_session", "true");
            return null;
        },
        [],
    );

    // ─── Google OAuth ───────────────────────────────────────────────────────
    const signInWithGoogle = useCallback(async (): Promise<string | null> => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                // Supabase strips hash fragments from redirectTo.
                // Point to root — App.tsx global interceptor rewrites the hash
                // into /#/auth/google#access_token=... so GoogleCallback can parse it.
                redirectTo: `${window.location.origin}/`,
            },
        });

        if (error) return getAuthErrorMessage(error);
        return null; // browser navigates to Google — no further action needed
    }, []);

    // ─── Sign out ───────────────────────────────────────────────────────────
    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        localStorage.removeItem("currentShopId");
        localStorage.removeItem("medix_device_id");
        sessionStorage.removeItem("temporary_session");
    }, []);

    return (
        <AuthContext.Provider
            value={{ user, session, loading, signIn, signUp, signInWithGoogle, signOut }}
        >
            {children}
        </AuthContext.Provider>
    );
}
