/**
 * Auth Module — Barrel export.
 *
 * All auth-related components and hooks are exported from here.
 * Usage:  import { AuthProvider, useAuth, AuthGuard } from "@/auth";
 */

export { AuthProvider } from "./AuthProvider";
export { useAuth } from "./useAuth";
export { AuthGuard } from "./AuthGuard";
export { getAuthErrorMessage, extractTokensFromHash } from "./authHelpers";

// Pages (lazy-loaded by App.tsx, but exported here for completeness)
export { default as LoginPage } from "./LoginPage";
export { default as SignupPage } from "./SignupPage";
export { default as LogoutHandler } from "./LogoutHandler";
export { default as GoogleCallback } from "./GoogleCallback";
