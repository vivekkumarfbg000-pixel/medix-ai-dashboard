import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Prediction {
    id: number;
    shop_id: string;
    medicine_name: string;
    current_stock: number;
    avg_daily_sales: number;
    predicted_quantity: number;
    confidence_score: number;
    reason: string;
    created_at: string;
}

export const useDemandForecast = (shopId?: string) => {
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastRun, setLastRun] = useState<Date | null>(null);

    const fetchPredictions = async () => {
        if (!shopId) return;

        const { data, error } = await supabase
            .from('restock_predictions')
            .select('*')
            .eq('shop_id', shopId)
            .order('predicted_quantity', { ascending: false });

        if (error) {
            console.error('Error fetching predictions:', error);
            return;
        }

        // @ts-ignore
        setPredictions(data || []);
        if (data && data.length > 0) {
            setLastRun(new Date(data[0].created_at));
        }
    };

    const runAIAnalysis = async () => {
        if (!shopId) return;
        setLoading(true);
        const toastId = toast.loading("Analyzing Sales Velocity...");

        try {
            // 1. Fetch Sales History (Last 30 Days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: orders, error: orderError } = await supabase
                .from('orders')
                .select('order_items, created_at')
                .eq('shop_id', shopId)
                .gte('created_at', thirtyDaysAgo.toISOString());

            if (orderError) throw orderError;

            // 2. Fetch Current Inventory
            const { data: inventory, error: invError } = await supabase
                .from('inventory')
                .select('id, medicine_name, quantity, unit_price')
                .eq('shop_id', shopId);

            if (invError) throw invError;

            // 3. Aggregate Sales (Map <MedicineName, QtySold>)
            const salesMap = new Map<string, number>();
            orders?.forEach(order => {
                const items = order.order_items as any[];
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        const name = item.name || item.medicine_name;
                        if (name) {
                            const qty = parseInt(item.qty || item.quantity || 0);
                            salesMap.set(name, (salesMap.get(name) || 0) + qty);
                        }
                    });
                }
            });

            // 4. Calculate ROS & Predictions
            const newPredictions = inventory?.map(item => {
                const totalSold = salesMap.get(item.medicine_name) || 0;
                const avgDailySales = totalSold / 30; // Simple Moving Average
                const currentStock = item.quantity;

                // Forecast Logic
                const safetyStockDays = 14; // buffer
                const leadTimeDays = 2; // time to restock

                let predictedRestock = 0;
                let status = "Healthy";
                let confidence = 0.9;

                if (avgDailySales > 0) {
                    const daysCover = currentStock / avgDailySales;
                    const reorderPoint = avgDailySales * (leadTimeDays + safetyStockDays);

                    if (currentStock < reorderPoint) {
                        predictedRestock = Math.ceil(reorderPoint - currentStock);
                        status = "Low Stock";
                    }
                } else {
                    status = "Dead Stock";
                    confidence = 0.5;
                }

                return {
                    shop_id: shopId,
                    medicine_name: item.medicine_name,
                    current_stock: currentStock,
                    avg_daily_sales: parseFloat(avgDailySales.toFixed(2)),
                    predicted_quantity: predictedRestock,
                    confidence_score: confidence,
                    reason: status
                };
            });

            // 5. Save to DB (Clear old first)
            await supabase.from('restock_predictions').delete().eq('shop_id', shopId);

            if (newPredictions && newPredictions.length > 0) {
                const vitalPredictions = newPredictions.filter(p => p.predicted_quantity > 0 || p.avg_daily_sales > 0);
                if (vitalPredictions.length > 0) {
                    const { error: saveError } = await supabase.from('restock_predictions').insert(vitalPredictions);
                    if (saveError) throw saveError;
                }
            }

            toast.success(`Analysis Complete. Processed ${orders?.length} orders.`);
            fetchPredictions();

        } catch (e: any) {
            console.error("Forecasting Error:", e);
            toast.error("Analysis Failed: " + e.message);
        } finally {
            setLoading(false);
            toast.dismiss(toastId);
        }
    };

    useEffect(() => {
        fetchPredictions();
    }, [shopId]);

    return {
        predictions,
        loading,
        runAIAnalysis,
        refreshPredictions: fetchPredictions,
        lastRun
    };
};
