/**
 * useAuth — Consumer hook for the AuthProvider context.
 *
 * Usage:
 *   const { user, signIn, signOut } = useAuth();
 *
 * Throws if called outside of <AuthProvider>.
 */

import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./AuthProvider";

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an <AuthProvider>.");
    }
    return ctx;
}
