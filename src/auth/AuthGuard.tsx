/**
 * AuthGuard — Route protection wrapper.
 *
 * Checks authentication state from AuthProvider:
 *   - loading  → show spinner
 *   - no user  → redirect to /login
 *   - has user → render children (Outlet)
 */

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";

export function AuthGuard() {
    const { user, loading } = useAuth();

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

    // Not authenticated — redirect to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Authenticated — render nested routes
    return <Outlet />;
}
