import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Calendar, Zap, RefreshCw, ArrowRight, Snowflake, Sun, CloudRain } from "lucide-react";
import { toast } from "sonner";
import { useUserShops } from "@/hooks/useUserShops";
import { aiService } from "@/services/aiService";

interface SeasonalInsight {
    season: string;
    icon: any;
    color: string;
    focus_areas: string[];
    start_date: string;
}

export const AICommandCentre = () => {
    const { currentShop } = useUserShops();
    const [loading, setLoading] = useState(false);
    const [predictions, setPredictions] = useState<any[]>([]);
    const [seasonalData, setSeasonalData] = useState<SeasonalInsight | null>(null);

    // 1. Fetch AI Predictions (Growth Engine)
    const fetchPredictions = async () => {
        if (!currentShop?.id) return;
        const { data, error } = await supabase
            .from('restock_predictions' as any)
            .select('*')
            .order('confidence_score', { ascending: false })
            .limit(3);

        if (!error && data) {
            setPredictions(data);
        }
    };

    // 2. Calculate Seasonal Prep Logic
    const calculateSeason = () => {
        const month = new Date().getMonth(); // 0-11
        let season: SeasonalInsight = {
            season: "General Wellness",
            icon: Sun,
            color: "text-orange-500",
            focus_areas: ["Vitamins", "First Aid"],
            start_date: "Year Round"
        };

        if (month >= 10 || month <= 1) { // Nov, Dec, Jan, Feb
            season = {
                season: "Cold & Flu Season",
                icon: Snowflake,
                color: "text-blue-500",
                focus_areas: ["Cough Syrups", "Antibiotics", "Immunity Boosters", "Vaporizers"],
                start_date: "Active Now"
            };
        } else if (month >= 2 && month <= 5) { // Mar, Apr, May, Jun
            season = {
                season: "Allergy & Heat Season",
                icon: Sun,
                color: "text-amber-500",
                focus_areas: ["Antihistamines", "ORS / Electrolytes", "Sunscreen", "Dermatology"],
                start_date: "Starts March"
            };
        } else if (month >= 6 && month <= 9) { // Jul, Aug, Sep, Oct
            season = {
                season: "Monsoon & Vector Season",
                icon: CloudRain,
                color: "text-cyan-600",
                focus_areas: ["Anti-Milarial", "Repellents", "Antifungals", "Water Purification"],
                start_date: "Active Now"
            };
        }
        setSeasonalData(season);
    };

    useEffect(() => {
        fetchPredictions();
        calculateSeason();
    }, [currentShop]);

    // 3. Trigger N8N Analysis
    const runAIAnalysis = async () => {
        if (!currentShop?.id) return;
        setLoading(true);
        toast.loading("AI Engine: Analyzing Sales Patterns...");

        try {
            // Fetch recent sales for context
            const { data: salesHistory } = await supabase
                .from('orders') // Assuming orders table exists
                .select('*')
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                .eq('shop_id', currentShop?.id)
                .limit(100);

            // Call Service
            // Call Service
            const aiResponse = await aiService.getInventoryForecast(salesHistory || []);

            if (aiResponse && aiResponse.forecast) {
                // Clear old
                await supabase.from('restock_predictions' as any).delete().eq('shop_id', currentShop?.id);

                // Save new
                await supabase.from('restock_predictions' as any).insert(aiResponse.forecast.map((item: any) => ({
                    shop_id: currentShop?.id,
                    medicine_name: item.product,
                    current_stock: item.current_stock || 0,
                    predicted_quantity: item.suggested_restock || 0,
                    confidence_score: item.confidence || 0.85,
                    reason: item.reason || "AI Insight"
                })));

                await fetchPredictions();
                toast.dismiss();
                toast.success("Growth Engine Updated!");
            }
        } catch (e) {
            console.error(e);
            toast.dismiss();
            toast.error("Analysis Failed. Check N8N connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="h-full border-none shadow-md bg-gradient-to-br from-slate-900 to-slate-950 text-white overflow-hidden relative group">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
            <div className="absolute -right-20 -top-20 h-[200px] w-[200px] bg-purple-500/20 blur-[100px] rounded-full group-hover:bg-purple-500/30 transition-all duration-1000" />

            <CardHeader className="pb-4 relative z-10 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" /> AI Command Centre
                    </CardTitle>
                    <CardDescription className="text-slate-400">Growth Engine & Seasonal Prep</CardDescription>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={runAIAnalysis}
                    disabled={loading}
                    className="bg-slate-800/50 border-slate-700 text-purple-300 hover:bg-purple-900/20 hover:text-purple-200"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Analyzing...' : 'Run Analysis'}
                </Button>
            </CardHeader>

            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
                {/* 1. Growth Engine Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-purple-300/80 uppercase tracking-wider">
                        <TrendingUp className="w-4 h-4" /> Growth Opportunities
                    </div>

                    {predictions.length === 0 ? (
                        <div className="p-4 rounded-lg border border-dashed border-slate-700 bg-slate-800/30 text-center text-sm text-slate-400">
                            No active predictions. Run analysis to identify growth items.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {predictions.map((p, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-white">{p.medicine_name}</span>
                                        <span className="text-xs text-slate-400">{p.reason}</span>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">
                                            +{p.predicted_quantity} Units
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Seasonal Prep Section */}
                <div className="space-y-4 border-l border-slate-800 lg:pl-6">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-300/80 uppercase tracking-wider">
                        <Calendar className="w-4 h-4" /> Seasonal Prep
                    </div>

                    {seasonalData && (
                        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900/20 to-cyan-900/10 border border-blue-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <seasonalData.icon className={`w-6 h-6 ${seasonalData.color}`} />
                                    <span className="font-bold text-lg">{seasonalData.season}</span>
                                </div>
                                <Badge className="bg-blue-500/20 text-blue-300 pointer-events-none">
                                    {seasonalData.start_date}
                                </Badge>
                            </div>

                            <p className="text-xs text-slate-400 mb-3">Recommended stock focus for this month:</p>

                            <div className="flex flex-wrap gap-2">
                                {seasonalData.focus_areas.map((area, idx) => (
                                    <Badge key={idx} variant="secondary" className="bg-slate-800 text-slate-300 border-none">
                                        {area}
                                    </Badge>
                                ))}
                            </div>

                            <Button variant="ghost" size="sm" className="w-full mt-4 text-xs text-blue-300 hover:text-blue-200 hover:bg-blue-900/20 group-hover:translate-x-1 transition-transform">
                                View Seasonal Inventory Report <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
