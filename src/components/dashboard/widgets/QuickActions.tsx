import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, ScanBarcode, ArrowRight, Stethoscope, Sparkles, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { useEffect, useState } from "react";

export const QuickActions = () => {
    const navigate = useNavigate();
    const { currentShop } = useUserShops();
    const [stats, setStats] = useState({ drafts: 0 });

    useEffect(() => {
        if (!currentShop?.id) return;

        const fetchStats = async () => {
            // 1. Fetch Drafts Cache
            const { count: draftCount } = await supabase
                .from('inventory_staging' as any)
                .select('*', { count: 'exact', head: true })
                .eq('shop_id', currentShop.id)
                .eq('status', 'pending');

            setStats(prev => ({ ...prev, drafts: draftCount || 0 }));
        };

        fetchStats();
    }, [currentShop]);

    return (
        <Card className="h-full border-none shadow-none bg-transparent">
            <CardHeader className="pb-4 px-0">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground/90">
                    <span className="bg-primary/10 p-1.5 rounded-lg text-primary"><Sparkles className="w-4 h-4" /></span>
                    Smart Actions
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-0">
                {/* Daily Tools Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <Button
                        className="h-28 flex flex-col items-start justify-between p-4 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white border-0 shadow-lg shadow-blue-900/20 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
                        onClick={() => navigate("/dashboard/orders")}
                    >
                        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Mic className="w-16 h-16" />
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <Mic className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <span className="text-lg font-bold block">New Sale</span>
                            <span className="text-[10px] opacity-80 font-normal">Voice or Manual</span>
                        </div>
                    </Button>

                    <Button
                        className="h-28 flex flex-col items-start justify-between p-4 bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white border border-slate-700/50 shadow-lg rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
                        onClick={() => navigate("/dashboard/inventory")}
                    >
                        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <ScanBarcode className="w-16 h-16" />
                        </div>
                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center backdrop-blur-sm">
                            <ScanBarcode className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <span className="text-lg font-bold block">Add Stock</span>
                            <span className="text-[10px] text-slate-300 font-normal">Scan & Upload</span>
                        </div>
                    </Button>

                    <Button
                        className="h-28 flex flex-col items-start justify-between p-4 bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border-0 shadow-lg shadow-emerald-900/20 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
                        onClick={() => navigate("/dashboard/diary-scan")}
                    >
                        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <FileText className="w-16 h-16" />
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <span className="text-lg font-bold block">Diary Scan</span>
                            <span className="text-[10px] opacity-80 font-normal">Digitize Handwritten</span>
                        </div>
                    </Button>

                    <Button
                        className="h-28 flex flex-col items-start justify-between p-4 bg-gradient-to-br from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white border-0 shadow-lg shadow-indigo-900/20 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
                        onClick={() => navigate("/dashboard/lab-analyzer")}
                    >
                        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Stethoscope className="w-16 h-16" />
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <Stethoscope className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <span className="text-lg font-bold block">Lab Report</span>
                            <span className="text-[10px] opacity-80 font-normal">Analyze Results</span>
                        </div>
                    </Button>
                </div>

                {/* AI & Clinical Tools */}
                <div className="space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                        Clinical Support
                    </div>

                    {/* Clinical Pharmacist Bot Button - Premium Look */}
                    <div
                        onClick={() => navigate("/dashboard/ai-insights")}
                        className="relative group cursor-pointer"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-40 transition-opacity duration-300" />
                        <div className="relative bg-gradient-to-r from-purple-900/90 to-indigo-900/90 hover:from-purple-800/90 hover:to-indigo-800/90 border border-purple-500/30 p-4 rounded-xl flex items-center justify-between transition-all duration-300 hover:border-purple-400/50 shadow-inner">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg text-white">
                                    <Stethoscope className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-base">Clinical Pharmacist</h4>
                                    <p className="text-xs text-purple-200/80">AI Interaction & Dosage Check</p>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                <ArrowRight className="w-4 h-4 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Expiry Warning Widget */}
                    <div
                        onClick={() => navigate("/dashboard/inventory?filter=expiring")}
                        className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-colors group"
                    >
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform animate-pulse">
                            <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-red-600 dark:text-red-400 text-sm">Expiry Alert</div>
                            <div className="text-xs text-muted-foreground">Review expiring stock</div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-red-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Pending Drafts Action */}
                    {stats.drafts > 0 && (
                        <div
                            onClick={() => navigate("/dashboard/inventory")}
                            className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-colors group"
                        >
                            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                                <FileText className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <div className="font-semibold text-amber-600 dark:text-amber-400 text-sm">Resume Invoice Drafts</div>
                                <div className="text-xs text-muted-foreground">{stats.drafts} items pending review</div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-amber-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
