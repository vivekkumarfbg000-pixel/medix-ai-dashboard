-- Create B2B Orders table for Shortbook conversion
CREATE TABLE IF NOT EXISTS public.b2b_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) NOT NULL,
    distributor_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, sent, received
    items JSONB, -- Array of {name, qty, priority}
    ordered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    received_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.b2b_orders ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own b2b orders" 
ON public.b2b_orders FOR SELECT 
USING (auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = b2b_orders.shop_id));

CREATE POLICY "Users can insert their own b2b orders" 
ON public.b2b_orders FOR INSERT 
WITH CHECK (auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = b2b_orders.shop_id));

CREATE POLICY "Users can update their own b2b orders" 
ON public.b2b_orders FOR UPDATE 
USING (auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = b2b_orders.shop_id));
