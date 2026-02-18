import {
  Package,
  FileText,
  MessageSquare,
  Brain,
  TrendingUp,
  Bell,
  Settings,
  LogOut,
  Pill,
  LayoutDashboard,
  Activity,
  ShieldAlert,
  Store,
  Users,
  History,
  Truck,
  NotebookPen,
  BookOpen
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Inventory", url: "/dashboard/inventory", icon: Package },
  { title: "Diary Scan", url: "/dashboard/diary-scan", icon: FileText },
  { title: "Lab Reports", url: "/dashboard/lab-analyzer", icon: Activity },
  { title: "Compliance", url: "/dashboard/compliance", icon: ShieldAlert },
  { title: "Marketplace", url: "/dashboard/marketplace", icon: Store },
  { title: "Orders", url: "/dashboard/orders", icon: MessageSquare },
  { title: "Smart Khata", url: "/dashboard/customers", icon: Users },
  { title: "Digital Parchas", url: "/dashboard/prescriptions", icon: FileText },
  { title: "Financial Reports", url: "/dashboard/reports", icon: TrendingUp },
];

const aiNavItems = [
  { title: "AI Insights", url: "/dashboard/ai-insights", icon: Brain },
  { title: "Forecasting", url: "/dashboard/forecasting", icon: TrendingUp },
  { title: "Alerts", url: "/dashboard/alerts", icon: Bell },

];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

  const handleMobileClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/auth");
    }
  };

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border h-full max-h-screen flex flex-col">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <NavLink to="/dashboard" className="flex items-center gap-2">
            {!collapsed ? (
              <img
                src="/medix-logo.jpg?v=6"
                alt="Medix AI"
                className="h-[50px] w-auto object-contain"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <Pill className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
          </NavLink>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4 flex-1 overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {!collapsed && "Main"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      onClick={handleMobileClick}
                      className={cn(
                        "sidebar-link",
                        isActive(item.url) && "sidebar-link-active"
                      )}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {!collapsed && "AI Features"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {aiNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      onClick={handleMobileClick}
                      className={cn(
                        "sidebar-link",
                        isActive(item.url) && "sidebar-link-active"
                      )}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border pb-[calc(0.5rem+var(--safe-area-bottom))]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <NavLink to="/dashboard/settings" onClick={handleMobileClick} className="sidebar-link">
                <Settings className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Sign Out"
              className="sidebar-link text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
