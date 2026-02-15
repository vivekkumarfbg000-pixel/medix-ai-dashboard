import { Suspense, lazy } from "react";
import { useMobileBackHandler } from "./hooks/use-mobile-back-handler";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner, toast } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { Activity } from "lucide-react";

// Services
import "@/services/syncService"; // Initialize Sync Service
// Note: importing solely for side-effects (constructor listener)
import { ErrorBoundary } from "./components/ErrorBoundary";

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
const Shortbook = lazy(() => import("./pages/dashboard/Shortbook"));
const Distributors = lazy(() => import("./pages/dashboard/Distributors"));
const Reports = lazy(() => import("./pages/dashboard/Reports"));
const Suppliers = lazy(() => import("./pages/dashboard/Suppliers"));
const Purchases = lazy(() => import("./pages/dashboard/Purchases"));
const ScheduleH1 = lazy(() => import("./pages/dashboard/ScheduleH1"));
const EnvDebug = lazy(() => import("./pages/EnvDebug"));
const AiDebug = lazy(() => import("./pages/AiDebug"));
const TestAIFallback = lazy(() => import("./pages/TestAIFallback"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    }
  },
  queryCache: new QueryCache({
    onError: (error) => {
      console.error("Global Query Error:", error);
      // Only show toast for 5xx errors or network issues, avoid spamming for 404/400 handled locally
      if (error instanceof Error && (error.message.includes('Network') || error.message.includes('500'))) {
        toast.error(`Connnection Issue: ${error.message}`);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      console.error("Global Mutation Error:", error);
      // Mutations usually require user feedback on failure
      toast.error(`Action Failed: ${error.message}`);
    },
  }),
});

const AppRoutes = () => {
  useMobileBackHandler();

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Activity className="h-8 w-8 animate-spin text-primary" /></div>}>
      <Routes>
        <Route path="/auth" element={<Auth />} />

        {/* Redirect root to /dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard Layout wraps all authenticated features */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Overview />} />
          <Route path="inventory" element={<ErrorBoundary><Inventory /></ErrorBoundary>} />
          <Route path="diary-scan" element={<ErrorBoundary><DiaryScan /></ErrorBoundary>} />
          <Route path="lab-analyzer" element={<ErrorBoundary><LabAnalyzer /></ErrorBoundary>} />
          <Route path="orders" element={<ErrorBoundary><Orders /></ErrorBoundary>} />
          <Route path="compliance" element={<ErrorBoundary><Compliance /></ErrorBoundary>} />
          <Route path="ai-insights" element={<ErrorBoundary><AIInsights /></ErrorBoundary>} />
          <Route path="forecasting" element={<ErrorBoundary><Forecasting /></ErrorBoundary>} />
          <Route path="alerts" element={<ErrorBoundary><Alerts /></ErrorBoundary>} />
          <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          <Route path="sales/pos" element={<ErrorBoundary><LitePOS /></ErrorBoundary>} />
          <Route path="marketplace" element={<ErrorBoundary><Marketplace /></ErrorBoundary>} />
          <Route path="prescriptions" element={<ErrorBoundary><Prescriptions /></ErrorBoundary>} />
          <Route path="analytics" element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
          <Route path="audit-logs" element={<ErrorBoundary><AuditLogs /></ErrorBoundary>} />
          <Route path="customers" element={<ErrorBoundary><Customers /></ErrorBoundary>} />
          <Route path="shortbook" element={<ErrorBoundary><Shortbook /></ErrorBoundary>} />
          <Route path="distributors" element={<ErrorBoundary><Distributors /></ErrorBoundary>} />
          <Route path="reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
          <Route path="suppliers" element={<ErrorBoundary><Suppliers /></ErrorBoundary>} />
          <Route path="purchases" element={<ErrorBoundary><Purchases /></ErrorBoundary>} />
          <Route path="schedule-h1" element={<ErrorBoundary><ScheduleH1 /></ErrorBoundary>} />
          <Route path="env-debug" element={<ErrorBoundary><EnvDebug /></ErrorBoundary>} />
          <Route path="ai-debug" element={<ErrorBoundary><AiDebug /></ErrorBoundary>} />
        </Route>

        <Route path="/test-ai-fallback" element={<TestAIFallback />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => {
  console.log("🚀 App Component Rendering...");
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
