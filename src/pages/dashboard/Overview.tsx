
import { useEffect, useState } from "react";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { VoiceCommandBar, ParsedItem } from "@/components/dashboard/VoiceCommandBar";
import { toast } from "sonner";

// Widgets
import { QuickActions } from "@/components/dashboard/widgets/QuickActions";
import { PulseWidget } from "@/components/dashboard/widgets/PulseWidget";
import { SafetyWidget } from "@/components/dashboard/widgets/SafetyWidget";
import { RefillAlertsWidget } from "@/components/dashboard/widgets/RefillAlertsWidget";
import { BusinessReportWidget } from "@/components/dashboard/widgets/BusinessReportWidget";
import { SystemHealthWidget } from "@/components/dashboard/widgets/SystemHealthWidget";

const Overview = () => {
  const [loading, setLoading] = useState(true);

  // Voice command handler
  const handleVoiceCommand = (transcription: string, items: ParsedItem[]) => {
    toast.success("Voice command received!", {
      description: `Captured: ${transcription}. Items will be added to quick order.`
    });
    // In a full implementation, this would add items to a quick order or cart
    console.log("Voice items:", items);
  };

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
            Good Morning, Vivek. Your pharmacy is <span className="text-green-600 font-bold">98% Efficient</span> today.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Voice Billing Bar */}
          <VoiceCommandBar
            onTranscriptionComplete={handleVoiceCommand}
            compact={false}
          />
          <Button className="w-fit shadow-glow bg-primary hover:bg-primary/90 text-white rounded-full px-6">
            <Pill className="w-4 h-4 mr-2" />
            Add Manual Entry
          </Button>
        </div>
      </div>

      {/* ROW 1: CORE OPS (3-COLUMN LAYOUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        {/* LEFT COLUMN: QUICK ACTIONS (25%) */}
        <div className="lg:col-span-1 h-full min-h-[400px]">
          <QuickActions />
        </div>

        {/* MIDDLE COLUMN: PULSE (50%) */}
        <div className="lg:col-span-2 h-full min-h-[400px]">
          <PulseWidget />
        </div>

        {/* RIGHT COLUMN: SAFETY (25%) */}
        <div className="lg:col-span-1 h-full min-h-[400px]">
          <SafetyWidget />
        </div>
      </div>

      {/* ROW 2: INTELLIGENCE LAYER (Phase 15 - Unified Front) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[300px]">
        {/* REFILL ALERTS */}
        <div className="h-full">
          <RefillAlertsWidget />
        </div>

        {/* BUSINESS REPORT (AI) */}
        <div className="h-full">
          <BusinessReportWidget />
        </div>

        {/* SYSTEM HEALTH */}
        <div className="h-full">
          <SystemHealthWidget />
        </div>
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
