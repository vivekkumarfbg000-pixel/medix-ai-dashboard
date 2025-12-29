
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, RefreshCw, Archive, Sparkles } from "lucide-react";

export const BusinessReportWidget = () => {
    const [predictions, setPredictions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPredictions = async () => {
        setLoading(true);
        // Fetch AI predictions
        const { data, error } = await supabase
            .from('restock_predictions')
            .select('*')
            .order('confidence_score', { ascending: false })
            .limit(4);

        if (!error && data) {
            setPredictions(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPredictions();
    }, []);

    return (
        <Card className="h-full border-l-4 border-l-purple-400 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-900/10">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" /> AI Growth Engine
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={fetchPredictions} className="h-6 w-6">
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                <CardDescription className="text-xs">Smart Restock & Demand Forecast</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {predictions.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-xs">
                        No AI predictions yet. Run Workflow C.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {predictions.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2 bg-white dark:bg-card rounded shadow-sm border border-purple-100 dark:border-purple-900/50">
                                <div className="flex flex-col">
                                    <span className="font-semibold text-sm">{item.medicine_name}</span>
                                    <span className="text-[10px] text-muted-foreground line-clamp-1">{item.reason || 'High Demand'}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{item.predicted_quantity}</div>
                                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Units</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="pt-2">
                    <Button variant="outline" size="sm" className="w-full text-xs h-7 border-purple-200 hover:bg-purple-50 text-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/30">
                        View Full Report
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
