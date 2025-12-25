import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import Inventory from "./pages/dashboard/Inventory";
import DiaryScan from "./pages/dashboard/DiaryScan";
import LabAnalyzer from "./pages/dashboard/LabAnalyzer";
import Orders from "./pages/dashboard/Orders";
import AIInsights from "./pages/dashboard/AIInsights";
import Forecasting from "./pages/dashboard/Forecasting";
import Alerts from "./pages/dashboard/Alerts";
import Settings from "./pages/dashboard/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="diary-scan" element={<DiaryScan />} />
            <Route path="lab-analyzer" element={<LabAnalyzer />} />
            <Route path="orders" element={<Orders />} />
            <Route path="ai-insights" element={<AIInsights />} />
            <Route path="forecasting" element={<Forecasting />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
