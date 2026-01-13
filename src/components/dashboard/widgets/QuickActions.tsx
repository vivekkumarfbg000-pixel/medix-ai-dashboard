import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, ScanBarcode, MessageCircle, ArrowRight, User, Stethoscope, Sparkles, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

export const QuickActions = () => {
    const navigate = useNavigate();
    const { currentShop } = useUserShops();
    const [stats, setStats] = useState({ drafts: 0, lowStock: 0 });

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
            <CardHeader className="pb-2 px-0">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                    ⚡ Quick Actions
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-0">
                {/* Daily Tools */}
                <div className="grid grid-cols-2 gap-4 relative z-50">
                    <Button
                        className="h-24 flex flex-col gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white border-none shadow-lg hover:shadow-xl transition-all rounded-xl active:scale-95 cursor-pointer"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate("/dashboard/orders");
                        }}
                    >
                        <Mic className="w-8 h-8" />
                        <span className="text-sm font-bold">New Sale</span>
                    </Button>
                    <Button
                        className="h-24 flex flex-col gap-2 bg-[#0f172a] hover:bg-[#1e293b] text-white border border-slate-700 shadow-lg hover:shadow-xl transition-all rounded-xl active:scale-95 cursor-pointer"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate("/dashboard/inventory");
                        }}
                    >
                        <ScanBarcode className="w-8 h-8 text-[#0ea5e9]" />
                        <span className="text-sm font-bold">Add Stock</span>
                    </Button>
                </div>

                {/* AI Assistant & Smart Actions */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-white/90 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400" /> AI Assistant
                        </span>
                    </div>

                    {/* Clinical Pharmacist Bot Button */}
                    <div
                        onClick={() => navigate("/dashboard/ai-insights")}
                        className="bg-gradient-to-r from-purple-900/80 to-indigo-900/80 p-3 rounded-xl border border-purple-500/30 flex items-center justify-between group hover:border-purple-400 transition-all cursor-pointer shadow-sm relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300">
                                <Stethoscope className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-sm text-white">Clinical Pharmacist</div>
                                <div className="text-xs text-purple-200 opacity-90">
                                    Ask about conflict & dosage
                                </div>
                            </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:text-purple-300 hover:bg-transparent relative z-10">
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Pending Actions (Drafts) */}
                    {stats.drafts > 0 && (
                        <div
                            onClick={() => navigate("/dashboard/inventory")}
                            className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex items-center justify-between group hover:border-slate-600 transition-all cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div className="text-sm font-medium text-white">
                                    {stats.drafts} AI Drafts Pending
                                </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
