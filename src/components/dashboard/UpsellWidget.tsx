import { useEffect, useState } from "react";
import { Sparkles, Plus } from "lucide-react";
import { OfflineInventory, db } from "@/db/db";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";

interface UpsellWidgetProps {
    cartItems: { item: OfflineInventory; qty: number }[];
    onAddItem: (item: OfflineInventory) => void;
}

export function UpsellWidget({ cartItems, onAddItem }: UpsellWidgetProps) {
    const [recommendations, setRecommendations] = useState<OfflineInventory[]>([]);
    const { currentShop } = useUserShops();

    useEffect(() => {
        if (cartItems.length === 0 || !currentShop?.id) {
            setRecommendations([]);
            return;
        }

        const runRealAI = async () => {
            const lastItem = cartItems[cartItems.length - 1].item;

            // 1. Query Real Sales Correlation (RPC)
            // @ts-ignore
            const { data } = await supabase.rpc('get_frequently_bought_together', {
                scan_medicine_name: lastItem.medicine_name,
                query_shop_id: currentShop?.id
            });

            const aiSuggestions = (data || []) as any[];

            let potentialNames: string[] = [];

            if (aiSuggestions && aiSuggestions.length > 0) {
                potentialNames = aiSuggestions.map((s: any) => s.medicine_name);
            } else {
                // 2. Fallback: Category-based or High Margin items if no history
                // Find items with same category but not the same item
                const fallback = ['Vitamin', 'Mask', 'Sanitizer', 'Balm'];
                potentialNames = fallback;
            }

            // 3. Resolve to In-Stock Local Inventory
            const verifiedRecs: OfflineInventory[] = [];

            for (const name of potentialNames) {
                // Fuzzy search in local DB
                const match = await db.inventory
                    .filter(i =>
                        i.medicine_name.toLowerCase().includes(name.toLowerCase()) &&
                        i.quantity > 0 &&
                        !cartItems.find(c => c.item.id === i.id)
                    )
                    .first();

                if (match) verifiedRecs.push(match);
            }

            setRecommendations(verifiedRecs.slice(0, 3));
        };

        const timer = setTimeout(runRealAI, 500); // Debounce
        return () => clearTimeout(timer);

    }, [cartItems, currentShop?.id]);

    if (recommendations.length === 0) return null;

    return (
        <div className="mt-3 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                    <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        People also buy
                    </h4>
                </div>
                <div className="flex flex-wrap gap-2">
                    {recommendations.map(rec => (
                        <div
                            key={rec.id}
                            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-full px-3 py-1 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                            onClick={() => onAddItem(rec)}
                        >
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 group-hover:text-purple-600 transition-colors">
                                {rec.medicine_name.split(' ')[0]} {/* Show short name */}
                            </span>
                            <div className="bg-purple-100 dark:bg-purple-900/50 rounded-full p-0.5">
                                <Plus className="w-3 h-3 text-purple-600" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
