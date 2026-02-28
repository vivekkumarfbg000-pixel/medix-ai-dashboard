import { useEffect, useState, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ShopSwitcher } from "./ShopSwitcher";
import { ActiveUsers } from "./ActiveUsers";
import { CommandPalette } from "./CommandPalette";
import { VoiceCommandBar, type ParsedItem } from "./VoiceCommandBar";
import { ReviewInvoiceModal } from "./ReviewInvoiceModal";
import { toast } from "sonner";
import { Bell, Search, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserShops } from "@/hooks/useUserShops";
import { useUserRole } from "@/hooks/useUserRole";
import { useSessionEnforcement } from "@/hooks/useSessionEnforcement";
import { useAuth } from "@/auth/useAuth";
import { ThemeToggle } from "../common/ThemeToggle";
import { SyncStatus } from "../common/SyncStatus";
import { AIChatbotWidget } from "./AIChatbotWidget";

// Inner component that has access to SidebarContext
function DashboardContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [commandOpen, setCommandOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const { currentShop } = useUserShops();
  const { role } = useUserRole(currentShop?.id);
  const { state, openMobile } = useSidebar();
  const lastBackPressRef = useRef(0);

  // Handle Back Navigation Logic
  useEffect(() => {
    const handlePopState = () => {
      const now = Date.now();

      // Condition 1: If Sidebar is currently open (mobile sheet)
      if (openMobile) {
        navigate("/dashboard");
        toast.info("Welcome to Command Center 🏠");
        return;
      }

      // Condition 2: Double Tap Logic
      if (now - lastBackPressRef.current < 2000) {
        navigate("/dashboard");
        toast.info("Welcome to Command Center 🏠");
      }
      lastBackPressRef.current = now;
    };

    window.addEventListener('popstate', handlePopState);

    // Privacy protection for shared medical shop computers
    const handleUnload = () => {
      if (sessionStorage.getItem('temporary_session') === 'true') {
        // Sync localStorage wipe for maximum safety on unload
        localStorage.removeItem('sb-ykrqpxbbyfipjqhpaszf-auth-token');
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [navigate, openMobile]);

  const handleTranscriptionComplete = (text: string, items: ParsedItem[]) => {
    navigate("/dashboard/sales/pos", {
      state: {
        voiceTranscription: text,
        voiceItems: items
      }
    });
    toast.success("Redirecting to Billing Hub...");
  };

  // AuthGuard guarantees user is non-null at this point
  if (!user) return null;

  return (
    <>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <ReviewInvoiceModal
        open={invoiceModalOpen}
        onOpenChange={setInvoiceModalOpen}
        transcription={transcription}
        parsedItems={parsedItems}
        shopId={currentShop?.id}
      />
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">

          {/* Header */}
          <header
            className="border-b border-border/50 glass-card flex items-center justify-between px-4 lg:px-6 sticky top-0 z-50 gap-4 transition-all duration-200"
            style={{
              paddingTop: 'max(1rem, var(--safe-area-top))',
              height: 'calc(4rem + var(--safe-area-top))'
            }}
          >
            <div className="flex items-center gap-4">
              <SidebarTrigger className="lg:hidden" />
              <ShopSwitcher />
              <Button variant="outline" size="sm" className="hidden md:flex gap-2 text-muted-foreground glass-card" onClick={() => setCommandOpen(true)}>
                <Search className="w-4 h-4" /><span>Search...</span>
                <kbd className="inline-flex h-5 items-center gap-1 rounded border bg-muted/50 px-1.5 font-mono text-[10px]"><Command className="w-3 h-3" />K</kbd>
              </Button>
            </div>

            {/* Center: Search/Voice (Desktop) */}
            <div className="flex-1 flex justify-center max-w-2xl px-4 hidden md:flex">
              <VoiceCommandBar onTranscriptionComplete={handleTranscriptionComplete} compact />
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Mobile Voice Trigger (Visible only on mobile) */}
              <div className="md:hidden">
                <VoiceCommandBar onTranscriptionComplete={handleTranscriptionComplete} compact />
              </div>

              <ThemeToggle />
              {/* <SyncStatus /> */}
              <ActiveUsers roomId={currentShop?.id || "default"} />
              <Button variant="ghost" size="icon" className="relative" onClick={() => navigate("/dashboard/alerts")}>
                <Bell className="w-5 h-5" />
                <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-destructive">3</Badge>
              </Button>
              <div className="h-8 w-px bg-border/50 hidden sm:block" />
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-glow">
                  <span className="text-sm font-medium text-primary-foreground">{user.email?.charAt(0).toUpperCase()}</span>
                </div>
                <div className="hidden lg:flex flex-col">
                  <span className="text-sm font-medium">{user.email?.split("@")[0]}</span>
                  {role && <Badge variant="secondary" className="text-xs w-fit capitalize glass-card">{role}</Badge>}
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6 overflow-auto"><Outlet /></main>
        </div>
      </div>
      <AIChatbotWidget />
    </>
  );
}

export function DashboardLayout() {
  useSessionEnforcement(); // Enforce single device login
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Pre-fetch shop ID for immediate availability to all children
  useEffect(() => {
    const prefetchShop = async () => {
      try {
        if (!localStorage.getItem('currentShopId')) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data } = await supabase
              .from('user_shops')
              .select('shop_id')
              .eq('user_id', session.user.id)
              .limit(1)
              .single();

            if (data?.shop_id) {
              localStorage.setItem('currentShopId', data.shop_id);
            }
          }
        }
      } catch (e) {
        console.error("Failed to pre-fetch initial shop", e);
      } finally {
        setLoading(false);
      }
    };

    prefetchShop();
  }, [navigate]);

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
          <h2 className="text-lg font-semibold text-foreground">Loading MedixAI.Shop...</h2>
          <p className="text-sm text-muted-foreground animate-pulse">Initializing Secure Dashboard</p>
          <button
            onClick={() => setLoading(false)}
            className="mt-4 text-xs text-blue-500 hover:underline"
          >
            taking too long? click here
          </button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <DashboardContent />
    </SidebarProvider>
  );
}