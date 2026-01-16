import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, TrendingUp } from "lucide-react";
import { OfflineInventory, db } from "@/db/db";

interface UpsellWidgetProps {
    cartItems: { item: OfflineInventory; qty: number }[];
    onAddItem: (item: OfflineInventory) => void;
}

// Simple rule-based engine (Fast & Offline)
const RULE_ENGINE: Record<string, string[]> = {
    'antibiotic': ['Probiotic', 'Vitamin B Complex', 'Pantoprazole'],
    'pain killer': ['Antacid', 'Spray'],
    'diabetic': ['Needles', 'Alcohol Swabs', 'Stevia'],
    'syrup': ['Spoon', 'Tissue'],
    'baby': ['Diapers', 'Wipes', 'Baby Oil'],
};

export function UpsellWidget({ cartItems, onAddItem }: UpsellWidgetProps) {
    const [recommendations, setRecommendations] = useState<OfflineInventory[]>([]);

    useEffect(() => {
        if (cartItems.length === 0) {
            setRecommendations([]);
            return;
        }

        const runRecommendations = async () => {
            const lastItem = cartItems[cartItems.length - 1].item;
            const keywords = lastItem.medicine_name.toLowerCase().split(' ');

            let potentialMatches: string[] = [];

            // 1. Check Rules
            // very basic keyword matching against our rule engine
            for (const [key, suggestions] of Object.entries(RULE_ENGINE)) {
                if (lastItem.medicine_name.toLowerCase().includes(key) ||
                    (lastItem.composition || "").toLowerCase().includes(key)) {
                    potentialMatches = [...potentialMatches, ...suggestions];
                }
            }

            // 2. If no rules, try 'Frequently Bought Together' simulation
            // In a real app, this queries the 'orders' table for correlation. 
            // Here we just find items with similar tags or random high-margin items for demo
            if (potentialMatches.length === 0) {
                // Fallback: Suggest popular categories
                potentialMatches = ['Vitamin', 'Mask', 'Sanitizer'];
            }

            // 3. Resolve names to Inventory Items
            const verifiedRecs: OfflineInventory[] = [];
            for (const term of potentialMatches) {
                // Find ANY item that matches this term and has stock
                const match = await db.inventory
                    .filter(i =>
                        i.medicine_name.toLowerCase().includes(term.toLowerCase()) &&
                        i.quantity > 0 &&
                        !cartItems.find(c => c.item.id === i.id) // Don't suggest if already in cart
                    )
                    .first();

                if (match) verifiedRecs.push(match);
            }

            setRecommendations(verifiedRecs.slice(0, 3)); // Limit to 3
        };

        runRecommendations();
    }, [cartItems]);

    if (recommendations.length === 0) return null;

    return (
        <div className="mt-3 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                    <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        Smart Suggestions
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
