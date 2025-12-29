-- Create restock_predictions table for AI Forecasting
CREATE TABLE IF NOT EXISTS public.restock_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    current_stock INTEGER,
    Avg_daily_sales DECIMAL(10,2),
    predicted_quantity INTEGER,
    confidence_score DECIMAL(3,2),
    reason TEXT, -- e.g. "Seasonal Spike (Flu)", "Consistent Demand"
    prediction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.restock_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their predictions" ON public.restock_predictions
  FOR ALL USING (shop_id = public.get_user_shop_id());
