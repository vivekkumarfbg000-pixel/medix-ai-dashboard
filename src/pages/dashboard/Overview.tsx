
import { useEffect, useState } from "react";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";

// Widgets
import { QuickActions } from "@/components/dashboard/widgets/QuickActions";
import { SafetyWidget } from "@/components/dashboard/widgets/SafetyWidget";
import { RefillAlertsWidget } from "@/components/dashboard/ai/RefillAlertsWidget";
import { AICommandCentre } from "@/components/dashboard/widgets/AICommandCentre"; // NEW
import { SystemHealthWidget } from "@/components/dashboard/widgets/SystemHealthWidget";
import { DayEndTally } from "@/components/dashboard/widgets/DayEndTally";

const Overview = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate initial data load or real fetch
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-12 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[400px]">
          <div className="bg-muted rounded-xl animate-pulse" />
          <div className="lg:col-span-2 bg-muted rounded-xl animate-pulse" />
          <div className="bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Command Center</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Good Morning, Vivek. You have <span className="text-indigo-600 font-bold">5 Refills Due</span> today.
          </p>
        </div>
        <Button className="w-fit shadow-glow bg-primary hover:bg-primary/90 text-white rounded-full px-6">
          <Pill className="w-4 h-4 mr-2" />
          Add Manual Entry
        </Button>
      </div>

      {/* ROW 1: CORE OPS (3-COLUMN LAYOUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        {/* LEFT COLUMN: QUICK ACTIONS (25%) */}
        <div className="lg:col-span-1 h-full min-h-[400px]">
          <QuickActions />
        </div>

        {/* MIDDLE COLUMN: SMART REFILL ENGINE (50%) - Replaces Pulse */}
        <div className="lg:col-span-2 h-full min-h-[400px]">
          <RefillAlertsWidget />
        </div>

        {/* RIGHT COLUMN: SAFETY (25%) */}
        <div className="lg:col-span-1 h-full min-h-[400px]">
          <SafetyWidget />
        </div>
      </div>

      {/* ROW 2: INTELLIGENCE LAYER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* AI COMMAND CENTRE (Full Width for Growth) */}
        <div className="h-full md:col-span-3">
          <AICommandCentre />
        </div>
      </div>

      {/* ROW 3: METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DayEndTally />
        <SystemHealthWidget />
      </div>

      {/* Activity Feed & Detailed Metrics */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4 text-foreground/80">Recent Activity</h2>
        <ActivityFeed />
      </div>
    </div>
  );
};

export default Overview;
