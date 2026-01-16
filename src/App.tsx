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
const Shortbook = lazy(() => import("./pages/dashboard/Shortbook"));
const Distributors = lazy(() => import("./pages/dashboard/Distributors"));
const Reports = lazy(() => import("./pages/dashboard/Reports"));

// ...

                  <Route path="customers" element={<ErrorBoundary><Customers /></ErrorBoundary>} />
                  <Route path="shortbook" element={<ErrorBoundary><Shortbook /></ErrorBoundary>} />
                  <Route path="distributors" element={<ErrorBoundary><Distributors /></ErrorBoundary>} />
                  <Route path="reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
                  <Route path="reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
                  <Route path="suppliers" element={<ErrorBoundary><Suppliers /></ErrorBoundary>} />
                  <Route path="purchases" element={<ErrorBoundary><Purchases /></ErrorBoundary>} />
                  <Route path="audit-logs" element={<ErrorBoundary><AuditLogs /></ErrorBoundary>} />
                  <Route path="schedule-h1" element={<ErrorBoundary><ScheduleH1 /></ErrorBoundary>} />
                  <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
                  <Route path="env-debug" element={<ErrorBoundary><EnvDebug /></ErrorBoundary>} />
                  <Route path="ai-debug" element={<ErrorBoundary><AiDebug /></ErrorBoundary>} />
                </Route >
  <Route path="*" element={<NotFound />} />
              </Routes >
            </Suspense >
          </BrowserRouter >
        </TooltipProvider >
      </QueryClientProvider >
    </ErrorBoundary >
  );
};

export default App;
