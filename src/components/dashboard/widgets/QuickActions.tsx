import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, ScanBarcode, ArrowRight, Stethoscope, Sparkles, FileText, Zap, AlertTriangle, Package, TrendingUp, Clock, X, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ExpiringItem {
    id: string;
    medicine_name: string;
    quantity: number;
    expiry_date: string;
    days_left: number;
}

interface LowStockItem {
    id: string;
    medicine_name: string;
    quantity: number;
    reorder_level: number;
    demand_score: number; // 0-100, based on sales frequency
    demand_label: string; // "Hot", "Moderate", "Slow"
}

export const QuickActions = () => {
    const navigate = useNavigate();
    const { currentShop } = useUserShops();
    const [stats, setStats] = useState({ drafts: 0, expiring: 0, lowStock: 0 });
    const [showExpiry, setShowExpiry] = useState(false);
    const [showLowStock, setShowLowStock] = useState(false);
    const [expiringItems, setExpiringItems] = useState<ExpiringItem[]>([]);
    const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
    const [panelLoading, setPanelLoading] = useState(false);

    useEffect(() => {
        if (!currentShop?.id) return;

        const fetchStats = async () => {
            // 1. Drafts
            const { count: draftCount } = await supabase
                .from('inventory_staging' as any)
                .select('*', { count: 'exact', head: true })
                .eq('shop_id', currentShop?.id)
                .eq('status', 'pending');

            // 2. Expiring items (within 90 days)
            const ninetyDaysLater = new Date();
            ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);
            const { count: expiryCount } = await supabase
                .from('inventory')
                .select('*', { count: 'exact', head: true })
                .eq('shop_id', currentShop?.id)
                .not('expiry_date', 'is', null)
                .lte('expiry_date', ninetyDaysLater.toISOString().split('T')[0])
                .gt('quantity', 0);

            // 3. Low stock items (below reorder level or below 15)
            const { data: inventoryData } = await supabase
                .from('inventory')
                .select('id, medicine_name, quantity, reorder_level')
                .eq('shop_id', currentShop?.id)
                .gt('quantity', 0);

            const lowCount = (inventoryData || []).filter(
                item => item.quantity <= (item.reorder_level || 15)
            ).length;

            setStats({
                drafts: draftCount || 0,
                expiring: expiryCount || 0,
                lowStock: lowCount
            });
        };

        fetchStats();
    }, [currentShop]);

    const fetchExpiringItems = async () => {
        if (!currentShop?.id) return;
        setPanelLoading(true);

        const today = new Date();
        const ninetyDaysLater = new Date();
        ninetyDaysLater.setDate(today.getDate() + 90);

        const { data, error } = await supabase
            .from('inventory')
            .select('id, medicine_name, quantity, expiry_date')
            .eq('shop_id', currentShop?.id)
            .not('expiry_date', 'is', null)
            .lte('expiry_date', ninetyDaysLater.toISOString().split('T')[0])
            .gt('quantity', 0)
            .order('expiry_date', { ascending: true });

        if (data) {
            setExpiringItems(data.map(item => {
                const expiryDate = new Date(item.expiry_date!);
                const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return { ...item, expiry_date: item.expiry_date!, days_left: daysLeft };
            }));
        }
        setPanelLoading(false);
    };

    const fetchLowStockItems = async () => {
        if (!currentShop?.id) return;
        setPanelLoading(true);

        // 1. Fetch low stock inventory
        const { data: inventoryData } = await supabase
            .from('inventory')
            .select('id, medicine_name, quantity, reorder_level')
            .eq('shop_id', currentShop?.id)
            .gt('quantity', 0)
            .order('quantity', { ascending: true });

        const lowItems = (inventoryData || []).filter(
            item => item.quantity <= (item.reorder_level || 15)
        );

        // 2. Fetch sales data for demand scoring (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: orders } = await supabase
            .from('orders')
            .select('order_items')
            .eq('shop_id', currentShop?.id)
            .gte('created_at', thirtyDaysAgo.toISOString());

        // Build sales frequency map
        const salesMap = new Map<string, number>();
        (orders || []).forEach(order => {
            const items = Array.isArray(order.order_items) ? order.order_items : [];
            items.forEach((item: any) => {
                const name = (item.name || '').toLowerCase();
                salesMap.set(name, (salesMap.get(name) || 0) + (item.qty || 1));
            });
        });

        // Find max sales for normalization
        const maxSales = Math.max(...Array.from(salesMap.values()), 1);

        // Calculate demand score for each low stock item
        const enrichedItems: LowStockItem[] = lowItems.map(item => {
            const sold = salesMap.get(item.medicine_name.toLowerCase()) || 0;
            const score = Math.round((sold / maxSales) * 100);
            let label = "Slow";
            if (score >= 60) label = "🔥 Hot";
            else if (score >= 30) label = "Moderate";
            return {
                ...item,
                reorder_level: item.reorder_level || 15,
                demand_score: score,
                demand_label: label
            };
        });

        // Sort by demand score (highest demand first)
        enrichedItems.sort((a, b) => b.demand_score - a.demand_score);
        setLowStockItems(enrichedItems);
        setPanelLoading(false);
    };

    const handleExpiryClick = () => {
        setShowExpiry(true);
        setShowLowStock(false);
        fetchExpiringItems();
    };

    const handleLowStockClick = () => {
        setShowLowStock(true);
        setShowExpiry(false);
        fetchLowStockItems();
    };

    const addToShortbook = async (medicineName: string, qty: number) => {
        if (!currentShop?.id) return;
        const { error } = await supabase.from('shortbook').insert({
            shop_id: currentShop?.id,
            product_name: medicineName,
            quantity: Math.max(qty, 10),
            priority: 'high',
            added_from: 'command_centre'
        });
        if (error) toast.error("Failed to add");
        else toast.success(`${medicineName} added to Shortbook`);
    };

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
                        onClick={() => navigate("/dashboard/sales/pos")}
                    >
                        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Zap className="w-16 h-16" /></div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><Zap className="w-5 h-5" /></div>
                        <div className="text-left">
                            <span className="text-lg font-bold block">Billing Hub</span>
                            <span className="text-[10px] opacity-80 font-normal">Offline POS & Billing</span>
                        </div>
                    </Button>

                    <Button
                        className="h-28 flex flex-col items-start justify-between p-4 bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white border border-slate-700/50 shadow-lg rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
                        onClick={() => navigate("/dashboard/inventory")}
                    >
                        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><ScanBarcode className="w-16 h-16" /></div>
                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center backdrop-blur-sm"><ScanBarcode className="w-5 h-5" /></div>
                        <div className="text-left">
                            <span className="text-lg font-bold block">Add Stock</span>
                            <span className="text-[10px] text-slate-300 font-normal">Scan & Upload</span>
                        </div>
                    </Button>

                    <Button
                        className="h-28 flex flex-col items-start justify-between p-4 bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border-0 shadow-lg shadow-emerald-900/20 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
                        onClick={() => navigate("/dashboard/diary-scan")}
                    >
                        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><FileText className="w-16 h-16" /></div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><FileText className="w-5 h-5" /></div>
                        <div className="text-left">
                            <span className="text-lg font-bold block">Diary Scan</span>
                            <span className="text-[10px] opacity-80 font-normal">Digitize Handwritten</span>
                        </div>
                    </Button>

                    <Button
                        className="h-28 flex flex-col items-start justify-between p-4 bg-gradient-to-br from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white border-0 shadow-lg shadow-indigo-900/20 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
                        onClick={() => navigate("/dashboard/lab-analyzer")}
                    >
                        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Stethoscope className="w-16 h-16" /></div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><Stethoscope className="w-5 h-5" /></div>
                        <div className="text-left">
                            <span className="text-lg font-bold block">Lab Report</span>
                            <span className="text-[10px] opacity-80 font-normal">Analyze Results</span>
                        </div>
                    </Button>
                </div>

                {/* Clinical Support */}
                <div className="space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                        Clinical Support
                    </div>

                    {/* Clinical Pharmacist Bot */}
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

                    {/* Expiry Alert Button */}
                    <div
                        onClick={handleExpiryClick}
                        className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-colors group"
                    >
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform animate-pulse">
                            <Clock className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-red-600 dark:text-red-400 text-sm">Expiry Alert</div>
                            <div className="text-xs text-muted-foreground">
                                {stats.expiring > 0 ? `${stats.expiring} items expiring soon` : 'Check expiring stock'}
                            </div>
                        </div>
                        {stats.expiring > 0 && (
                            <Badge variant="destructive" className="text-[10px] h-5">{stats.expiring}</Badge>
                        )}
                        <ArrowRight className="w-4 h-4 text-red-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Low Stock Button */}
                    <div
                        onClick={handleLowStockClick}
                        className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-colors group"
                    >
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                            <Package className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-amber-600 dark:text-amber-400 text-sm">Low Stock</div>
                            <div className="text-xs text-muted-foreground">
                                {stats.lowStock > 0 ? `${stats.lowStock} items running low` : 'Stock levels healthy'}
                            </div>
                        </div>
                        {stats.lowStock > 0 && (
                            <Badge className="text-[10px] h-5 bg-amber-500 text-white">{stats.lowStock}</Badge>
                        )}
                        <ArrowRight className="w-4 h-4 text-amber-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Pending Drafts */}
                    {stats.drafts > 0 && (
                        <div
                            onClick={() => navigate("/dashboard/inventory")}
                            className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-colors group"
                        >
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                <FileText className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <div className="font-semibold text-blue-600 dark:text-blue-400 text-sm">Resume Invoice Drafts</div>
                                <div className="text-xs text-muted-foreground">{stats.drafts} items pending review</div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-blue-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                </div>

                {/* ===== EXPIRY ALERT PANEL ===== */}
                {showExpiry && (
                    <div className="animate-in slide-in-from-top-2 duration-300 bg-background border border-red-200 dark:border-red-900 rounded-xl shadow-lg overflow-hidden">
                        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-900">
                            <h4 className="font-bold text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Expiring Medicines ({expiringItems.length})
                            </h4>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowExpiry(false)}>
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {panelLoading ? (
                                <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
                            ) : expiringItems.length === 0 ? (
                                <div className="p-6 text-center text-green-600 text-sm font-medium">✅ No medicines expiring within 90 days!</div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {expiringItems.map(item => (
                                        <div key={item.id} className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">{item.medicine_name}</div>
                                                <div className="text-xs text-muted-foreground">Qty: {item.quantity}</div>
                                            </div>
                                            <Badge
                                                variant={item.days_left <= 0 ? "destructive" : item.days_left <= 30 ? "secondary" : "outline"}
                                                className={`text-[10px] ml-2 whitespace-nowrap ${item.days_left <= 0 ? '' : item.days_left <= 30 ? 'bg-amber-100 text-amber-700 border-amber-200' : ''}`}
                                            >
                                                {item.days_left <= 0 ? '⚠️ EXPIRED' : `${item.days_left}d left`}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-2 border-t bg-muted/20">
                            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setShowExpiry(false); navigate("/dashboard/inventory?filter=expiring"); }}>
                                View All in Inventory <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* ===== LOW STOCK PANEL ===== */}
                {showLowStock && (
                    <div className="animate-in slide-in-from-top-2 duration-300 bg-background border border-amber-200 dark:border-amber-900 rounded-xl shadow-lg overflow-hidden">
                        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900">
                            <h4 className="font-bold text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                                <Package className="w-4 h-4" /> Low Stock ({lowStockItems.length})
                            </h4>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowLowStock(false)}>
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                            {panelLoading ? (
                                <div className="p-6 text-center text-muted-foreground text-sm">Analyzing inventory & sales...</div>
                            ) : lowStockItems.length === 0 ? (
                                <div className="p-6 text-center text-green-600 text-sm font-medium">✅ All stock levels healthy!</div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {lowStockItems.map(item => (
                                        <div key={item.id} className="p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate flex items-center gap-1.5">
                                                    {item.medicine_name}
                                                    {item.demand_score >= 60 && (
                                                        <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                                            <TrendingUp className="w-2.5 h-2.5" />{item.demand_label}
                                                        </span>
                                                    )}
                                                    {item.demand_score >= 30 && item.demand_score < 60 && (
                                                        <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                                            {item.demand_label}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-muted-foreground">Stock: <span className={`font-bold ${item.quantity <= 5 ? 'text-red-500' : 'text-amber-600'}`}>{item.quantity}</span></span>
                                                    <span className="text-xs text-muted-foreground">/ Reorder: {item.reorder_level}</span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-[10px] border-purple-300 text-purple-600 hover:bg-purple-50 whitespace-nowrap"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    addToShortbook(item.medicine_name, item.reorder_level - item.quantity);
                                                }}
                                            >
                                                <ShoppingCart className="w-3 h-3 mr-1" /> Reorder
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-2 border-t bg-muted/20">
                            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setShowLowStock(false); navigate("/dashboard/shortbook"); }}>
                                Open Shortbook <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
