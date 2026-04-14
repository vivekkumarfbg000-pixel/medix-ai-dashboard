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
            <div className="flex-1 flex items-center justify-center p-8 bg-background relative overflow-hidden">
                {/* Background decorative glows */}
                <div className="absolute -top-[10%] -right-[10%] w-1/2 h-1/2 bg-primary/5 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute -bottom-[10%] -left-[10%] w-1/2 h-1/2 bg-primary/5 rounded-full blur-[120px] animate-pulse delay-1000" />
                
                <div className="w-full max-w-md relative z-10">
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

                    {/* Subtle Connectivity Indicator (Silent by default) */}
                    {!isCheckingConnection && isOffline && (
                        <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
                             <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl flex items-start gap-4 backdrop-blur-md">
                                <WifiOff className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold">Connection Issue</p>
                                    <p className="text-xs opacity-90 leading-relaxed">It seems we can't reach the server. Please check your internet or try again in a moment.</p>
                                    <button 
                                        onClick={retryConnection}
                                        className="mt-2 text-xs font-bold underline hover:opacity-80 flex items-center gap-1"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${isCheckingConnection ? 'animate-spin' : ''}`} />
                                        Try again
                                    </button>
                                </div>
                             </div>
                        </div>
                    )}

                    {/* Advanced: Proxy Toggle (Discreetly at the bottom or hidden) */}
                    {isOffline && (
                        <div className="mb-4 flex justify-end text-muted-foreground/40 italic">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] hover:text-foreground p-0 px-2"
                                onClick={isProxyBypassed ? handleRestoreProxy : handleBypassProxy}
                            >
                                {isProxyBypassed ? "Using Direct Connection" : "Attempt Direct Connection"}
                            </Button>
                        </div>
                    )}

                    <Card className="card-glass shadow-2xl animate-in zoom-in-95 duration-700">
                        <CardHeader className="space-y-1 pb-4 text-center">
                            <CardTitle className="text-3xl font-bold tracking-tight">Welcome Back</CardTitle>
                            <CardDescription className="text-sm">
                                Access your medical dashboard
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                {/* Google sign-in button */}
                                <Button
                                    variant="outline"
                                    className="w-full h-12 font-medium border-border/50 bg-background/50 hover:bg-accent transition-all duration-300 gap-3 group relative overflow-hidden"
                                    onClick={handleGoogleLogin}
                                    disabled={isLoading}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <svg
                                        className="h-5 w-5"
                                        aria-hidden="true"
                                        focusable="false"
                                        viewBox="0 0 488 512"
                                    >
                                        <path
                                            fill="currentColor"
                                            d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                                        />
                                    </svg>
                                    Continue with Google
                                </Button>
                                
                                {/* Divider */}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-border/50" />
                                    </div>
                                    <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
                                        <span className="bg-background/80 backdrop-blur-sm px-4">
                                            Or Secure Email
                                        </span>
                                    </div>
                                </div>

                                {/* Email / Password form */}
                                <form onSubmit={handleLogin} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="login-email" className="text-xs font-semibold ml-1">Email</Label>
                                        <Input
                                            id="login-email"
                                            type="email"
                                            placeholder="doctor@medixai.shop"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="h-11 bg-background/50 border-border/50 focus:bg-background transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="login-password" title="Password" className="text-xs font-semibold ml-1">Password</Label>
                                        <Input
                                            id="login-password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="h-11 bg-background/50 border-border/50 focus:bg-background transition-all"
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2 pb-2">
                                        <Checkbox
                                            id="remember-me"
                                            checked={rememberMe}
                                            onCheckedChange={(checked) =>
                                                setRememberMe(checked === true)
                                            }
                                            className="border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        />
                                        <label
                                            htmlFor="remember-me"
                                            className="text-[12px] font-medium leading-none text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                                        >
                                            Remember this device for 30 days
                                        </label>
                                    </div>
                                    <Button
                                        type="submit"
                                        className="w-full h-12 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-500 active:scale-[0.98]"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : "Sign In to MedixAI"}
                                    </Button>
                                </form>

                                {/* Link to Sign Up */}
                                <div className="pt-2 text-center text-sm">
                                    <span className="text-muted-foreground">New to MedixAI? </span>
                                    <Link
                                        to="/signup"
                                        className="text-primary font-bold hover:underline underline-offset-4 decoration-2"
                                    >
                                        Create your shop
                                    </Link>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
