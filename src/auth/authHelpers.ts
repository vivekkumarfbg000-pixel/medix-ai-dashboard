/**
 * Auth Helpers — Shared utilities for the authentication module.
 *
 * - getAuthErrorMessage: maps Supabase error objects to friendly strings.
 * - extractTokensFromHash: parses OAuth/email-verification tokens from the
 *   URL hash when running under HashRouter.
 */

// ─── User-friendly error messages ───────────────────────────────────────────
export const getAuthErrorMessage = (error: unknown): string => {
    const msg =
        (error as { message?: string })?.message?.toLowerCase() ?? "";

    if (msg.includes("unexpected token") || msg.includes("is not valid json"))
        return "Server Configuration Error: Reach out to support. The Supabase proxy is misconfigured.";
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
