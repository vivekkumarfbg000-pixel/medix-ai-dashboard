import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ShopSwitcher } from "./ShopSwitcher";
import { ActiveUsers } from "./ActiveUsers";
import { CommandPalette } from "./CommandPalette";
import { User } from "@supabase/supabase-js";
import { Bell, Search, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserShops } from "@/hooks/useUserShops";
import { useUserRole } from "@/hooks/useUserRole";

export function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const { currentShop } = useUserShops();
  const { role } = useUserRole(currentShop?.id);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="lg:hidden" />
              <ShopSwitcher />
              <Button variant="outline" size="sm" className="hidden md:flex gap-2 text-muted-foreground" onClick={() => setCommandOpen(true)}>
                <Search className="w-4 h-4" /><span>Search...</span>
                <kbd className="inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px]"><Command className="w-3 h-3" />K</kbd>
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <ActiveUsers roomId={currentShop?.id || "default"} />
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-destructive">3</Badge>
              </Button>
              <div className="h-8 w-px bg-border hidden sm:block" />
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-foreground">{user.email?.charAt(0).toUpperCase()}</span>
                </div>
                <div className="hidden lg:flex flex-col">
                  <span className="text-sm font-medium">{user.email?.split("@")[0]}</span>
                  {role && <Badge variant="secondary" className="text-xs w-fit capitalize">{role}</Badge>}
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6 overflow-auto"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}