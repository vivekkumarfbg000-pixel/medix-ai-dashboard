
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, CheckCircle2, AlertOctagon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const SystemHealthWidget = () => {
    const [errorCount, setErrorCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const checkHealth = async () => {
        setLoading(true);
        const { count, error } = await supabase
            .from('retry_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (!error && count !== null) {
            setErrorCount(count);
        }
        setLoading(false);
    };

    useEffect(() => {
        checkHealth();
        const channel = supabase
            .channel('health-check')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'retry_queue' }, checkHealth)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const isHealthy = errorCount === 0;

    return (
        <Card className={`h-full border-l-4 transition-colors ${isHealthy ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Activity className={`w-5 h-5 ${isHealthy ? 'text-green-500' : 'text-red-500'}`} />
                        System Pulse
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={checkHealth} className="h-6 w-6">
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                <CardDescription className="text-xs">Workflow & Auto-Pilot Status</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-6 space-y-3">
                {isHealthy ? (
                    <>
                        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-pulse">
                            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-green-700 dark:text-green-400">All Systems Normal</h3>
                            <p className="text-xs text-muted-foreground">Agents A, B, & C active</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center animate-bounce">
                            <AlertOctagon className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-red-700 dark:text-red-400">{errorCount} Failures Detected</h3>
                            <p className="text-xs text-muted-foreground">Check Retry Queue immediately</p>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};
