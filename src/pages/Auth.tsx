import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Pill, ShieldCheck, TrendingUp, Users } from "lucide-react";

const getAuthErrorMessage = (error: any) => {
  const msg = error?.message?.toLowerCase() || "";
  if (msg.includes('unexpected token') || msg.includes('is not valid json')) return "Server Configuration Error: Reach out to support. The Supabase proxy is misconfigured causing HTML to be returned instead of JSON.";
  if (msg.includes('invalid login credentials')) return "Incorrect email or password.";
  if (msg.includes('email not confirmed')) return "Please verify your email before signing in. Check your inbox.";
  if (msg.includes('rate limit')) return "Too many attempts. Please wait a few minutes and try again.";
  if (msg.includes('already registered')) return "An account with this email already exists. Please sign in.";
  return error?.message || "An unexpected error occurred. Please try again.";
};

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // ─── Helper: Extract OAuth/email-verification tokens from URL ───────────────
  // With HashRouter the full URL after a callback looks like:
  //   https://medixai.shop/#/auth#access_token=xxx&refresh_token=yyy&...
  // window.location.hash gives us:  #/auth#access_token=xxx&...
  // We need the part AFTER the second '#'.
  const extractTokensFromHash = (): URLSearchParams | null => {
    const fullHash = window.location.hash; // e.g. "#/auth#access_token=..."
    if (!fullHash) return null;

    // Find the second '#' (the one Supabase appended)
    const secondHash = fullHash.indexOf('#', 1);
    if (secondHash === -1) return null;

    const tokenString = fullHash.substring(secondHash + 1); // "access_token=xxx&..."
    if (!tokenString) return null;

    return new URLSearchParams(tokenString);
  };

  useEffect(() => {
    const checkExistingSession = async () => {
      console.log('[Auth] checkExistingSession starting... hash:', window.location.hash);
      try {
        // [CRITICAL FIX]: detectSessionInUrl is disabled in client.ts to prevent
        // race conditions. We manually parse tokens from the URL hash here.
        const params = extractTokensFromHash();
        console.log('[Auth] Extracted tokens from hash:', params ? 'found' : 'none');

        if (params) {
          // Handle error responses from Supabase (e.g. expired verification link)
          if (params.has('error')) {
            toast.error(params.get('error_description')?.replace(/\+/g, ' ') || 'Verification failed');
            // Clean the URL — keep only the HashRouter route part
            window.history.replaceState(null, '', window.location.pathname + '#/auth');
            return;
          }

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            setIsLoading(true);
            toast.info("Verifying login...");

            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!sessionError) {
              // Clean the URL hash — remove tokens, keep HashRouter route
              window.history.replaceState(null, '', window.location.pathname + '#/auth');
              toast.success("Login verified successfully!");

              if (!rememberMe) sessionStorage.setItem('temporary_session', 'true');

              navigate("/dashboard");
              return;
            } else {
              toast.error(getAuthErrorMessage(sessionError));
              // Clean URL even on error
              window.history.replaceState(null, '', window.location.pathname + '#/auth');
            }
          }
        }

        // No tokens in URL — check for existing session (with timeout for blocked ISP)
        console.log('[Auth] Checking existing session...');
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
        const sessionCheck = supabase.auth.getSession().then(({ data }) => data.session);
        const session = await Promise.race([sessionCheck, timeout]);
        console.log('[Auth] Session check result:', session ? 'has session' : 'no session');
        if (session?.user) {
          console.log('[Auth] Existing session found, navigating to /dashboard');
          navigate("/dashboard");
        }
      } catch {
        // Supabase unreachable — stay on login page
      } finally {
        setIsLoading(false);
      }
    };
    checkExistingSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Auth] onAuthStateChange:', _event, session ? 'has session' : 'no session');
      if (session?.user) {
        console.log('[Auth] Auth state changed to signed in, navigating to /dashboard');
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // ─── Google OAuth Handler (async with full error handling) ──────────────────
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // CRITICAL: Supabase strips hash fragments from redirectTo.
          // Point to root, and let App.tsx's global interceptor catch the tokens and forward to /auth
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(getAuthErrorMessage(error));
        setIsLoading(false);
      }
      // If successful, browser navigates away to Google — no need to reset isLoading
    } catch (err: any) {
      toast.error(err.message || "Google login failed. Please check your connection.");
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Auth] handleLogin called for:', email.trim());
    if (!email.trim() || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    setIsLoading(true);

    try {
      console.log('[Auth] Calling signInWithPassword...');
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      console.log('[Auth] signInWithPassword result:', error ? `error: ${error.message}` : 'success');

      if (error) {
        toast.error(getAuthErrorMessage(error));
      } else {
        toast.success("Welcome back!");
        if (!rememberMe) {
          sessionStorage.setItem('temporary_session', 'true');
        } else {
          sessionStorage.removeItem('temporary_session');
        }
        // onAuthStateChange handles navigation
      }
    } catch (err: any) {
      toast.error(err.message || "Login failed. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // CRITICAL: Point to root, let App.tsx interceptor forward to /auth
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            shop_name: shopName || "My Medical Shop",
          },
        },
      });

      if (error) {
        toast.error(getAuthErrorMessage(error));
      } else if (data?.user?.identities?.length === 0) {
        toast.error("An account with this email already exists. Please sign in.");
      } else if (data?.user && !data.session) {
        toast.success("Account created! Check your email to verify before signing in.", {
          duration: 8000,
        });
      } else if (data?.session) {
        toast.success("Account created successfully!");
        if (!rememberMe) sessionStorage.setItem('temporary_session', 'true');
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Sign up failed. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Pill, title: "Smart Inventory", desc: "AI-powered stock management" },
    { icon: ShieldCheck, title: "Drug Safety", desc: "Automatic interaction alerts" },
    { icon: TrendingUp, title: "Analytics", desc: "Sales forecasting & insights" },
    { icon: Users, title: "Patient Care", desc: "Automated refill reminders" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-16 h-16 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 shadow-xl overflow-hidden">
              <img src="/medix-logo.jpg?v=6" alt="MedixAI Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold text-primary-foreground tracking-tight">MedixAI</h1>
          </div>
          <p className="text-primary-foreground/80 text-sm">Medical Shop Management System</p>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-primary-foreground leading-tight">
            Transform Your<br />Pharmacy Operations
          </h2>
          <p className="text-primary-foreground/80 text-lg">
            AI-powered dashboard for modern medical shops. Manage inventory, track sales, and ensure patient safety.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-4 border border-primary-foreground/20"
              >
                <feature.icon className="w-6 h-6 text-primary-foreground mb-2" />
                <h3 className="font-semibold text-primary-foreground text-sm">{feature.title}</h3>
                <p className="text-primary-foreground/70 text-xs">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-primary-foreground/60 text-sm">
          © 2024 MedixAI. Secure & HIPAA Compliant.
        </p>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center gap-4 mb-8 justify-center">
            <div className="w-16 h-16 rounded-xl bg-primary/5 flex items-center justify-center overflow-hidden border border-primary/10 shadow-lg">
              <img src="/medix-logo.jpg?v=6" alt="MedixAI Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">MedixAI</h1>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold">Welcome</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <div className="space-y-4">
                    <Button
                      variant="outline"
                      className="w-full h-11 font-medium border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                    >
                      <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                        <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                      </svg>
                      Sign in with Google
                    </Button>

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
                        <Checkbox id="remember-me" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} />
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
                        disabled={isLoading}
                      >
                        {isLoading ? "Signing in..." : "Sign In"}
                      </Button>
                    </form>
                  </div>
                </TabsContent>

                <TabsContent value="signup">
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
                      <Checkbox id="remember-me-signup" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} />
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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
