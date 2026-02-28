/**
 * SignupPage — Account registration form.
 *
 * Route: /signup
 * Collects full name, shop name, email, and password.
 * Uses the same split-layout branding as LoginPage.
 */

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "./useAuth";
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
import { Pill, ShieldCheck, TrendingUp, Users } from "lucide-react";

const features = [
    { icon: Pill, title: "Smart Inventory", desc: "AI-powered stock management" },
    { icon: ShieldCheck, title: "Drug Safety", desc: "Automatic interaction alerts" },
    { icon: TrendingUp, title: "Analytics", desc: "Sales forecasting & insights" },
    { icon: Users, title: "Patient Care", desc: "Automated refill reminders" },
];

export default function SignupPage() {
    const navigate = useNavigate();
    const { signUp, user } = useAuth();

    const [fullName, setFullName] = useState("");
    const [shopName, setShopName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Already logged in → go to dashboard
    if (user) {
        navigate("/dashboard", { replace: true });
        return null;
    }

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            toast.error("Password must be at least 6 characters.");
            return;
        }

        setIsLoading(true);
        try {
            const result = await signUp({
                email,
                password,
                fullName,
                shopName,
                rememberMe,
            });

            if (result === "verify") {
                toast.success(
                    "Account created! Check your email to verify before signing in.",
                    { duration: 8000 },
                );
            } else if (result) {
                // Error string
                toast.error(result);
            } else {
                // Immediate sign-in (no verification required)
                toast.success("Account created successfully!");
                navigate("/dashboard");
            }
        } catch (ex: unknown) {
            toast.error(
                (ex as Error).message || "Sign up failed. Please check your connection.",
            );
        } finally {
            setIsLoading(false);
        }
    };

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

            {/* ── Right Panel — Signup Form ───────────────────────────────────── */}
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

                    <Card className="border-0 shadow-lg">
                        <CardHeader className="space-y-1 pb-4">
                            <CardTitle className="text-2xl font-bold">
                                Create Account
                            </CardTitle>
                            <CardDescription>
                                Get started with your pharmacy dashboard
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSignup} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="full-name">Full Name</Label>
                                    <Input
                                        id="full-name"
                                        type="text"
                                        placeholder="Dr. John Smith"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        required
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="shop-name">Shop Name</Label>
                                    <Input
                                        id="shop-name"
                                        type="text"
                                        placeholder="City Medical Store"
                                        value={shopName}
                                        onChange={(e) => setShopName(e.target.value)}
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="signup-email">Email</Label>
                                    <Input
                                        id="signup-email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="signup-password">Password</Label>
                                    <Input
                                        id="signup-password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="h-11"
                                    />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="remember-me-signup"
                                        checked={rememberMe}
                                        onCheckedChange={(checked) =>
                                            setRememberMe(checked === true)
                                        }
                                    />
                                    <label
                                        htmlFor="remember-me-signup"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
                                    >
                                        Remember me on this device
                                    </label>
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full h-11 font-medium"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Creating account..." : "Create Account"}
                                </Button>
                            </form>

                            {/* Link back to Login */}
                            <p className="text-center text-sm text-muted-foreground mt-4">
                                Already have an account?{" "}
                                <Link
                                    to="/login"
                                    className="text-primary font-medium hover:underline"
                                >
                                    Sign in
                                </Link>
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
