import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Package,
  FileText,
  MessageSquare,
  Brain,
  TrendingUp,
  Bell,
  Settings,
  Search,
  Plus,
  User,
  FileBarChart,
  Pill,
} from "lucide-react";

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const navigationCommands = [
  { id: "overview", label: "Go to Overview", icon: Package, path: "/dashboard" },
  { id: "inventory", label: "Go to Inventory", icon: Package, path: "/dashboard/inventory" },
  { id: "diary-scan", label: "Go to Diary Scan", icon: FileText, path: "/dashboard/diary-scan" },
  { id: "orders", label: "Go to Orders", icon: MessageSquare, path: "/dashboard/orders" },
  { id: "ai-insights", label: "Go to AI Insights", icon: Brain, path: "/dashboard/ai-insights" },
  { id: "forecasting", label: "Go to Forecasting", icon: TrendingUp, path: "/dashboard/forecasting" },
  { id: "alerts", label: "Go to Alerts", icon: Bell, path: "/dashboard/alerts" },
  { id: "settings", label: "Go to Settings", icon: Settings, path: "/dashboard/settings" },
];

const actionCommands = [
  { id: "add-medicine", label: "Add New Medicine", icon: Plus, path: "/dashboard/inventory", action: "add-medicine" },
  { id: "add-order", label: "Create New Order", icon: Plus, path: "/dashboard/orders", action: "add-order" },
  { id: "scan-diary", label: "Scan Diary Entry", icon: FileText, path: "/dashboard/diary-scan" },
  { id: "check-interactions", label: "Check Drug Interactions", icon: Pill, path: "/dashboard/ai-insights" },
];

const reportCommands = [
  { id: "revenue-report", label: "View Revenue Report", icon: FileBarChart, path: "/dashboard/analytics" },
  { id: "stock-report", label: "View Stock Report", icon: Package, path: "/dashboard/inventory" },
  { id: "audit-logs", label: "View Audit Logs", icon: FileText, path: "/dashboard/audit-logs" },
];

export function CommandPalette({ open: controlledOpen, onOpenChange }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const isOpen = controlledOpen ?? open;
  const handleOpenChange = onOpenChange ?? setOpen;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOpenChange(!isOpen);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, handleOpenChange]);

  const runCommand = useCallback((command: () => void) => {
    handleOpenChange(false);
    command();
  }, [handleOpenChange]);

  return (
    <CommandDialog open={isOpen} onOpenChange={handleOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          {navigationCommands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              onSelect={() => runCommand(() => navigate(cmd.path))}
              className="gap-3"
            >
              <cmd.icon className="w-4 h-4" />
              <span>{cmd.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          {actionCommands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              onSelect={() => runCommand(() => navigate(cmd.path))}
              className="gap-3"
            >
              <cmd.icon className="w-4 h-4" />
              <span>{cmd.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Reports">
          {reportCommands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              onSelect={() => runCommand(() => navigate(cmd.path))}
              className="gap-3"
            >
              <cmd.icon className="w-4 h-4" />
              <span>{cmd.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
