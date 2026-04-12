import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export function AuthGuard() {
    const { user, loading } = useAuth();
    const location = useLocation();

    // FIX BUG-3: If we are inside the auth callback flow, never redirect to /login.
    // GoogleCallback needs time to exchange the PKCE code and establish the session.
    // AuthProvider's getSession() returning null right now is expected — session isn't set yet.
    const isOAuthCallback = location.pathname === "/auth/google";

    // Still resolving session — show a branded loading spinner
    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-medical-canvas space-y-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-primary">M</span>
                    </div>
                </div>
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-foreground">
                        Loading MedixAI.Shop...
                    </h2>
                    <p className="text-sm text-muted-foreground animate-pulse">
                        Initializing Secure Dashboard
                    </p>
                </div>
            </div>
        );
    }

    // Not authenticated — but don't redirect if we're handling an OAuth callback
    if (!user && !isOAuthCallback) {
        return <Navigate to="/login" replace />;
    }

    // Authenticated (or mid-oauth-callback) — render nested routes
    return <Outlet />;
}
