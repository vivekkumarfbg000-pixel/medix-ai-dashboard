/**
 * LoginPage — Email/password + Google OAuth sign-in form.
 *
 * Route: /login
 * Preserves the existing split-layout design (branding panel + form).
 * Includes a connectivity check that warns users when the auth server
 * is unreachable (e.g. ISP blocking Supabase).
 */

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "./useAuth";
import { checkSupabaseConnectivity, type ConnectivityResult } from "./authHelpers";
import { getSupabaseBaseUrl, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Pill, ShieldCheck, TrendingUp, Users, WifiOff, RefreshCw, Wifi } from "lucide-react";

// Feature bullets for the branding panel
const features = [
    { icon: Pill, title: "Smart Inventory", desc: "AI-powered stock management" },
    { icon: ShieldCheck, title: "Drug Safety", desc: "Automatic interaction alerts" },
    { icon: TrendingUp, title: "Analytics", desc: "Sales forecasting & insights" },
    { icon: Users, title: "Patient Care", desc: "Automated refill reminders" },
];

export default function LoginPage() {
    const navigate = useNavigate();
    const { signIn, signInWithGoogle, user } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // ─── Connectivity state ─────────────────────────────────────────────
    const [connectivity, setConnectivity] = useState<ConnectivityResult | null>(null);
    const [isCheckingConnection, setIsCheckingConnection] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const check = async () => {
            setIsCheckingConnection(true);
            const result = await checkSupabaseConnectivity(getSupabaseBaseUrl(), SUPABASE_ANON_KEY);
            if (!cancelled) {
                setConnectivity(result);
                setIsCheckingConnection(false);
            }
        };
        check();
        return () => { cancelled = true; };
    }, []);

    const retryConnection = async () => {
        setIsCheckingConnection(true);
        const result = await checkSupabaseConnectivity(getSupabaseBaseUrl(), SUPABASE_ANON_KEY);
        setConnectivity(result);
        setIsCheckingConnection(false);
        if (result.reachable) {
            toast.success("Connected to authentication server!");
        } else {
            toast.error("Still unable to connect. Try using a VPN or the Bypass below.");
        }
    };

    const handleBypassProxy = () => {
        console.warn("⚡ [Login] User requested proxy bypass.");
        localStorage.setItem("medix_force_no_proxy", "true");
        toast.info("Switched to Direct Connection. Reloading...", { icon: <Wifi /> });
        setTimeout(() => window.location.reload(), 1000);
    };

    const handleRestoreProxy = () => {
        console.warn("⚡ [Login] User restored proxy.");
        localStorage.removeItem("medix_force_no_proxy");
        toast.info("Restored Proxy Connection. Reloading...");
        setTimeout(() => window.location.reload(), 1000);
    };

    const isProxyBypassed = localStorage.getItem("medix_force_no_proxy") === "true";

    // If already authenticated, redirect to dashboard
    if (user) {
        navigate("/dashboard", { replace: true });
        return null;
    }

    // ─── Email/Password Login ───────────────────────────────────────────────
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password) {
            toast.error("Please enter your email and password.");
            return;
        }
        if (connectivity && !connectivity.reachable) {
            toast.error("Cannot sign in — authentication server is unreachable. Try a VPN or different network.");
            return;
        }
        setIsLoading(true);
        try {
            const err = await signIn(email, password, rememberMe);
            if (err) {
                toast.error(err);
            } else {
                toast.success("Welcome back!");
                navigate("/dashboard");
            }
        } catch (ex: unknown) {
            toast.error(
                (ex as Error).message || "Login failed. Please check your connection.",
            );
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Google OAuth ───────────────────────────────────────────────────────
    const handleGoogleLogin = async () => {
        if (connectivity && !connectivity.reachable) {
            toast.error("Cannot sign in — authentication server is unreachable. Try a VPN or different network.");
            return;
        }
        setIsLoading(true);
        try {
            const err = await signInWithGoogle();
            if (err) {
                toast.error(err);
                setIsLoading(false);
            }
            // On success the browser navigates to Google — no reset needed
        } catch (ex: unknown) {
            toast.error(
                (ex as Error).message || "Google login failed. Please check your connection.",
            );
            setIsLoading(false);
        }
    };

    const isOffline = connectivity !== null && !connectivity.reachable;

    return (
        <div className="min-h-screen flex">
            {/* ── Left Panel — Branding ────────────────────────────────────────── */}
            <div className="hidden lg:flex lg:w-1/2 gradient-primary p-12 flex-col justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-16 h-16 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 shadow-xl overflow-hidden">
                            <img
                                src="/medix-logo.jpg?v=6"
                                alt="MedixAI Logo"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <h1 className="text-3xl font-bold text-primary-foreground tracking-tight">
                            MedixAI
                        </h1>
                    </div>
                    <p className="text-primary-foreground/80 text-sm">
                        Medical Shop Management System
                    </p>
                </div>

                <div className="space-y-6">
                    <h2 className="text-3xl font-bold text-primary-foreground leading-tight">
                        Transform Your<br />Pharmacy Operations
                    </h2>
                    <p className="text-primary-foreground/80 text-lg">
                        AI-powered dashboard for modern medical shops. Manage inventory, track
                        sales, and ensure patient safety.
                    </p>
                    <div className="grid grid-cols-2 gap-4 pt-6">
                        {features.map((feature, i) => (
                            <div
                                key={i}
                                className="bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-4 border border-primary-foreground/20"
                            >
                                <feature.icon className="w-6 h-6 text-primary-foreground mb-2" />
                                <h3 className="font-semibold text-primary-foreground text-sm">
                                    {feature.title}
                                </h3>
                                <p className="text-primary-foreground/70 text-xs">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-primary-foreground/60 text-sm">
                    © 2024 MedixAI. Secure &amp; HIPAA Compliant.
                </p>
            </div>

            {/* ── Right Panel — Login Form ────────────────────────────────────── */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex flex-col items-center gap-4 mb-8 justify-center">
                        <div className="w-16 h-16 rounded-xl bg-primary/5 flex items-center justify-center overflow-hidden border border-primary/10 shadow-lg">
                            <img
                                src="/medix-logo.jpg?v=6"
                                alt="MedixAI Logo"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <h1 className="text-3xl font-bold text-foreground tracking-tight">
                            MedixAI
                        </h1>
                    </div>

                    {/* ── Connectivity Banner ─────────────────────────────────── */}
                    {isCheckingConnection && (
                        <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
                            <RefreshCw className="h-4 w-4 animate-spin flex-shrink-0" />
                            <span>Checking server connectivity…</span>
                        </div>
                    )}
                    {isOffline && !isCheckingConnection && (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                            <div className="flex items-center gap-2 mb-2">
                                <WifiOff className="h-4 w-4 flex-shrink-0" />
                                <span className="font-semibold">Cannot reach authentication server</span>
                            </div>
                            <p className="mb-2 text-xs leading-relaxed">
                                {connectivity?.error || "The server is unreachable."}{" "}
                                You might be experiencing network restrictions. Try switching to a <strong>mobile hotspot</strong> or check your internet settings.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40"
                                    onClick={retryConnection}
                                    disabled={isCheckingConnection}
                                >
                                    <RefreshCw className={`h-3 w-3 mr-1 ${isCheckingConnection ? 'animate-spin' : ''}`} />
                                    Retry Connection
                                </Button>
                            </div>
                        </div>
                    )}
                    {connectivity?.reachable && !isCheckingConnection && (
                        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40 px-4 py-3 text-sm text-green-700 dark:text-green-300">
                            <div className="flex items-center gap-2">
                                <Wifi className="h-4 w-4 flex-shrink-0" />
                                <span>Connected to server ({connectivity.latencyMs}ms)</span>
                            </div>
                        </div>
                    )}

                    {/* Always show the proxy bypass toggle as an advanced fallback explicitly */}
                    <div className="mb-4 flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-orange-300 bg-orange-50/50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300 hover:bg-orange-100"
                            onClick={isProxyBypassed ? handleRestoreProxy : handleBypassProxy}
                            title={isProxyBypassed ? "Restore to default connectivity settings" : "Try if your ISP is not blocking Supabase but the proxy is slow"}
                        >
                            <Wifi className="h-3 w-3 mr-1" />
                            {isProxyBypassed ? "Restore Proxy" : "Bypass Proxy & Try Direct"}
                        </Button>
                    </div>

                    <Card className="border-0 shadow-lg">
                        <CardHeader className="space-y-1 pb-4">
                            <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
                            <CardDescription>
                                Sign in to your account to continue
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* Google sign-in button */}
                                <Button
                                    variant="outline"
                                    className="w-full h-11 font-medium border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    onClick={handleGoogleLogin}
                                    disabled={isLoading || isOffline}
                                >
                                    <svg
                                        className="mr-2 h-4 w-4"
                                        aria-hidden="true"
                                        focusable="false"
                                        viewBox="0 0 488 512"
                                    >
                                        <path
                                            fill="currentColor"
                                            d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                                        />
                                    </svg>
                                    Sign in with Google
                                </Button>

                                {/* Divider */}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-muted-foreground">
                                            Or continue with email
                                        </span>
                                    </div>
                                </div>

                                {/* Email / Password form */}
                                <form onSubmit={handleLogin} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="login-email">Email</Label>
                                        <Input
                                            id="login-email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="h-11"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="login-password">Password</Label>
                                        <Input
                                            id="login-password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="h-11"
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="remember-me"
                                            checked={rememberMe}
                                            onCheckedChange={(checked) =>
                                                setRememberMe(checked === true)
                                            }
                                        />
                                        <label
                                            htmlFor="remember-me"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
                                        >
                                            Remember me on this device
                                        </label>
                                    </div>
                                    <Button
                                        type="submit"
                                        className="w-full h-11 font-medium"
                                        disabled={isLoading || isOffline}
                                    >
                                        {isLoading ? "Signing in..." : isOffline ? "Server Unreachable" : "Sign In"}
                                    </Button>
                                </form>

                                {/* Link to Sign Up */}
                                <p className="text-center text-sm text-muted-foreground">
                                    Don&apos;t have an account?{" "}
                                    <Link
                                        to="/signup"
                                        className="text-primary font-medium hover:underline"
                                    >
                                        Create one
                                    </Link>
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
