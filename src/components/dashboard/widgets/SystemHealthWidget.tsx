
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, CheckCircle2, AlertOctagon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const SystemHealthWidget = () => {
    const [errorCount, setErrorCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const checkHealth = async () => {
        setLoading(true);
        // @ts-ignore - Table exists in database
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

    const [isdetailsOpen, setIsDetailsOpen] = useState(false);
    const [failedJobs, setFailedJobs] = useState<any[]>([]);

    const fetchDetails = async () => {
        const { data } = await supabase
            .from('retry_queue')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (data) setFailedJobs(data);
    };

    const handleDismiss = async (id: string) => {
        await supabase.from('retry_queue').update({ status: 'dismissed' }).eq('id', id);
        toast.success("Job dismissed");
        fetchDetails();
        checkHealth();
    };

    const handleRetry = async (job: any) => {
        toast.info("Retrying job...");
        try {
            // Simple logic to route retry based on payload content
            let url = "";
            if (job.payload?.drugs) url = "https://vivek2073.app.n8n.cloud/webhook/interactions";
            else if (job.payload?.drugName) url = "https://vivek2073.app.n8n.cloud/webhook/compliance-check";
            else if (job.payload?.salesHistory) url = "https://vivek2073.app.n8n.cloud/webhook/forecast";

            if (url) {
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(job.payload)
                });
                await supabase.from('retry_queue').update({ status: 'retried' }).eq('id', job.id);
                toast.success("Job resubmitted successfully");
                fetchDetails();
                checkHealth();
            } else {
                toast.error("Could not determine retry endpoint for this job");
            }
        } catch (e) {
            toast.error("Retry failed");
        }
    };

    return (
        <>
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
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => { setIsDetailsOpen(true); fetchDetails(); }}
                                >
                                    View & Fix
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isdetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>System Health Issues</DialogTitle>
                        <DialogDescription>Review and retry failed background jobs.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {failedJobs.map(job => (
                            <div key={job.id} className="p-4 border rounded-lg bg-red-50/50 flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs font-mono">{job.workflow_name || 'System'}</Badge>
                                        <span className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleString()}</span>
                                    </div>
                                    <p className="font-medium text-red-800 text-sm">{job.error_message || "Unknown Error"}</p>
                                    <pre className="text-[10px] bg-white p-2 rounded border overflow-x-auto max-w-[400px]">
                                        {JSON.stringify(job.payload, null, 2)}
                                    </pre>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Button size="sm" onClick={() => handleRetry(job)}>Retry</Button>
                                    <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => handleDismiss(job.id)}>Dismiss</Button>
                                </div>
                            </div>
                        ))}
                        {failedJobs.length === 0 && <p className="text-center text-muted-foreground py-8">No active issues found.</p>}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
