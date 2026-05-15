import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, RefreshCw, Archive, Sparkles, ArrowRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { useUserShops } from "@/hooks/useUserShops";
import { aiService } from "@/services/aiService";

export const BusinessReportWidget = () => {
    const { currentShop } = useUserShops();
    const [predictions, setPredictions] = useState<any[]>([]);
    const [pulse, setPulse] = useState<{ insight: string; action: string } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = useCallback(async () => {
        if (!currentShop?.id || !aiService) return;
        setLoading(true);
        
        try {
            // 1. Fetch saved predictions
            const { data: predData } = await supabase
                .from('restock_predictions' as any)
                .select('*')
                .eq('shop_id', currentShop?.id)
                .order('confidence_score', { ascending: false })
                .limit(2);

            if (predData) setPredictions(predData);

            // 2. Run real-time pulse if we have enough sales
            const { data: sales } = await supabase
                .from('orders')
                .select('order_items, created_at')
                .eq('shop_id', currentShop.id)
                .limit(20);

            if (sales && sales.length > 5 && aiService?.analyzeSalesPulse) {
                const pulseResult = await aiService.analyzeSalesPulse(sales);
                setPulse(pulseResult);
            }
        } catch (e) {
            console.error("Pulse Fetch Failed", e);
        } finally {
            setLoading(false);
        }
    }, [currentShop?.id]);

    useEffect(() => {
        if (currentShop?.id) fetchAnalytics();
    }, [currentShop?.id, fetchAnalytics]);

    return (
        <Card className="h-full border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-900/10">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-500" /> Pulse Growth Engine
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={fetchAnalytics} className="h-6 w-6">
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {pulse ? (
                    <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30">
                        <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">AI Insight</div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight mb-2">{pulse.insight}</p>
                        <div className="flex items-center gap-2 text-[10px] text-indigo-700 dark:text-indigo-300 bg-white dark:bg-indigo-900/50 w-fit px-2 py-1 rounded">
                            <Zap className="w-3 h-3" /> {pulse.action}
                        </div>
                    </div>
                ) : (
                    <div className="text-[10px] text-slate-500 italic px-2">Gathering sales data for real-time pulse...</div>
                )}

                <div className="space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Restock Alerts</div>
                    {predictions.length === 0 ? (
                        <div className="text-[10px] text-slate-400 pl-1">No alerts. Shop is healthy.</div>
                    ) : (
                        predictions.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2 bg-white dark:bg-card rounded border border-slate-100 dark:border-slate-800 shadow-sm">
                                <span className="text-xs font-medium">{item.medicine_name}</span>
                                <Badge variant="outline" className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-100">+{item.predicted_quantity}</Badge>
                            </div>
                        ))
                    )}
                </div>

                <Button variant="outline" size="sm" className="w-full text-[10px] h-7 gap-2 border-indigo-200 text-indigo-700 dark:text-indigo-300">
                    Full Growth Report <ArrowRight className="w-3 h-3" />
                </Button>
            </CardContent>
        </Card>
    );
};
