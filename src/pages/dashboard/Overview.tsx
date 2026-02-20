
import { useEffect, useState } from "react";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";

import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";

// Widgets
import { QuickActions } from "@/components/dashboard/widgets/QuickActions";
import { SafetyWidget } from "@/components/dashboard/widgets/SafetyWidget";
import { AICommandCentre } from "@/components/dashboard/widgets/AICommandCentre"; // NEW
import { DayEndTally } from "@/components/dashboard/widgets/DayEndTally";
import { AddMedicineDialog } from "@/components/dashboard/inventory/AddMedicineDialog";

import { SystemHealthCheck } from "@/components/debug/SystemHealthCheck";

const Overview = () => {
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    // Simulate initial data load or real fetch
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-12 w-48 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[400px]">
          <div className="bg-gradient-to-r from-muted via-muted-foreground/10 to-muted rounded-xl animate-pulse" />
          <div className="lg:col-span-2 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted rounded-xl animate-pulse" />
          <div className="bg-gradient-to-r from-muted via-muted-foreground/10 to-muted rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* System Health Check (Only shows if critical errors found) */}
      <SystemHealthCheck />

      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Command Center</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {(() => {
              const hour = new Date().getHours();
              const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
              return `${greeting}! Here's your pharmacy at a glance.`;
            })()}
          </p>
        </div>
        <Button
          className="w-fit shadow-glow bg-primary hover:bg-primary/90 text-white rounded-full px-6"
          onClick={() => setIsAddOpen(true)}
        >
          <Pill className="w-4 h-4 mr-2" />
          Add Manual Entry
        </Button>
        <AddMedicineDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
      </div>

      {/* ROW 1: CORE OPS (2-COLUMN LAYOUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* LEFT COLUMN: QUICK ACTIONS */}
        <div className="h-full min-h-[300px]">
          <WidgetErrorBoundary title="Quick Actions">
            <QuickActions />
          </WidgetErrorBoundary>
        </div>

        {/* RIGHT COLUMN: SAFETY */}
        <div className="h-full min-h-[300px]">
          <WidgetErrorBoundary title="Safety Monitor">
            <SafetyWidget />
          </WidgetErrorBoundary>
        </div>
      </div>

      {/* ROW 2: INTELLIGENCE LAYER */}
      <div className="grid grid-cols-1 gap-6">
        {/* AI COMMAND CENTRE (Full Width) */}
        <div className="h-full">
          <WidgetErrorBoundary title="AI Command Centre">
            <AICommandCentre />
          </WidgetErrorBoundary>
        </div>
      </div>

      {/* ROW 3: METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WidgetErrorBoundary title="Day Tally">
          <DayEndTally />
        </WidgetErrorBoundary>
        {/* System Pulse Removed */}
      </div>

      {/* Activity Feed & Detailed Metrics */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4 text-foreground/80">Recent Activity</h2>
        <WidgetErrorBoundary title="Activity Feed">
          <ActivityFeed />
        </WidgetErrorBoundary>
      </div>
    </div>
  );
};

export default Overview;
