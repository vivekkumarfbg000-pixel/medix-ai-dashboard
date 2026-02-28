/**
 * LogoutHandler — Logout route component.
 *
 * Route: /logout
 * Calls signOut(), shows a toast, and redirects to /login.
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export default function LogoutHandler() {
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const didLogout = useRef(false);

    useEffect(() => {
        if (didLogout.current) return;
        didLogout.current = true;

        const doLogout = async () => {
            await signOut();
            toast.success("You have been logged out.");
            navigate("/login", { replace: true });
        };

        doLogout();
    }, [signOut, navigate]);

    // Show a brief spinner while the logout completes
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
    );
}
