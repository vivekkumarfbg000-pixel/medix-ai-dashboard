import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Plus, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ActivityLog {
    id: string;
    action_type: "CREATE" | "UPDATE" | "DELETE";
    entity_type: "INVENTORY" | "ORDER";
    description: string;
    created_at: string;
    user_email?: string;
}

export function ActivityFeed() {
    const [activities, setActivities] = useState<ActivityLog[]>([]);

    useEffect(() => {
        // In a real implementation we would fetch from a dedicated 'activity_logs' table.
        // For this demo, we can simulate or listen to inventory changes.
        // Assuming a 'activity_logs' table exists as per requirements.

        // Fallback Mock Data if table doesn't exist yet
        const mockActivities: ActivityLog[] = [
            {
                id: "1",
                action_type: "CREATE",
                entity_type: "INVENTORY",
                description: "Added Paracetamol 500mg (500 units)",
                created_at: new Date().toISOString(),
                user_email: "pharmacy@admin.com"
            }
        ];
        setActivities(mockActivities);

        // TODO: Connect to real Supabase table if available
        /*
        const fetchLogs = async () => {
          const { data } = await supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
          if (data) setActivities(data);
        };
        fetchLogs();
        */

    }, []);

    const getIcon = (type: string) => {
        switch (type) {
            case "CREATE": return <Plus className="w-4 h-4 text-success" />;
            case "DELETE": return <Trash2 className="w-4 h-4 text-destructive" />;
            default: return <Edit className="w-4 h-4 text-primary" />;
        }
    };

    return (
        <Card className="glass-card h-full">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="w-5 h-5 text-primary" />
                    Recent Activity
                </CardTitle>
                <CardDescription>Latest actions performed by staff</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[300px] w-full pr-4">
                    <div className="space-y-4">
                        {activities.map((log) => (
                            <div key={log.id} className="flex gap-3 items-start pb-3 border-b border-border/50 last:border-0">
                                <div className="mt-1 w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                    {getIcon(log.action_type)}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-foreground leading-none">{log.description}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>{log.user_email?.split('@')[0]}</span>
                                        <span>•</span>
                                        <span>{format(new Date(log.created_at), "MMM dd, HH:mm")}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {activities.length === 0 && (
                            <p className="text-center text-muted-foreground text-sm py-4">No recent activity</p>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
