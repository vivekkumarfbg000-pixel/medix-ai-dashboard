import { Suspense, lazy, useEffect } from "react";
import { useMobileBackHandler } from "./hooks/use-mobile-back-handler";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { Activity } from "lucide-react";


// Initial Load
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy Load Dashboard Pages for Performance
const Overview = lazy(() => import("./pages/dashboard/Overview"));
const Inventory = lazy(() => import("./pages/dashboard/Inventory"));
const DiaryScan = lazy(() => import("./pages/dashboard/DiaryScan"));
const LabAnalyzer = lazy(() => import("./pages/dashboard/LabAnalyzer"));
const Orders = lazy(() => import("./pages/dashboard/Orders"));
const Compliance = lazy(() => import("./pages/dashboard/Compliance"));
const AIInsights = lazy(() => import("./pages/dashboard/AIInsights"));
const Forecasting = lazy(() => import("./pages/dashboard/Forecasting"));
const Alerts = lazy(() => import("./pages/dashboard/Alerts"));
const Settings = lazy(() => import("./pages/dashboard/Settings"));
const LitePOS = lazy(() => import("./pages/dashboard/LitePOS"));
const Marketplace = lazy(() => import("./pages/dashboard/Marketplace"));
const Prescriptions = lazy(() => import("./pages/dashboard/Prescriptions"));
const Analytics = lazy(() => import("./pages/dashboard/Analytics"));
const AuditLogs = lazy(() => import("./pages/dashboard/AuditLogs"));
const Customers = lazy(() => import("./pages/dashboard/Customers"));

const queryClient = new QueryClient();

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Activity className="w-12 h-12 text-primary animate-pulse" />
        <div className="absolute inset-0 animate-ping border-2 border-primary rounded-full opacity-20"></div>
      </div>
      <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading MediFlow OS...</p>
    </div>
  </div>
);

import { syncService } from "./services/syncService";

const MobileNavHandler = () => {
  useMobileBackHandler();
  return null;
};

const App = () => {
  useEffect(() => {
    try {
      syncService.startSync();
    } catch (e) {
      console.error("Failed to start sync service:", e);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <MobileNavHandler />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/lite-pos" element={<LitePOS />} />
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<Overview />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="diary-scan" element={<DiaryScan />} />
                <Route path="lab-analyzer" element={<LabAnalyzer />} />
                <Route path="compliance" element={<Compliance />} />
                <Route path="orders" element={<Orders />} />
                <Route path="ai-insights" element={<AIInsights />} />
                <Route path="forecasting" element={<Forecasting />} />
                <Route path="alerts" element={<Alerts />} />
                <Route path="marketplace" element={<Marketplace />} />
                <Route path="prescriptions" element={<Prescriptions />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="customers" element={<Customers />} />
                <Route path="audit-logs" element={<AuditLogs />} />
                <Route path="settings" element={<Settings />} />
              </Route >
              <Route path="*" element={<NotFound />} />
            </Routes >
          </Suspense >
        </BrowserRouter >
      </TooltipProvider >
    </QueryClientProvider >
  );
};

export default App;
