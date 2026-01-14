
-- 1. Add Location & Tax Info to Inventory
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS rack_number TEXT,
ADD COLUMN IF NOT EXISTS shelf_number TEXT,
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 12.00, -- 0, 5, 12, 18
ADD COLUMN IF NOT EXISTS hsn_code TEXT;

-- 2. Parked Bills (Hold Bill)
CREATE TABLE IF NOT EXISTS public.hold_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_name TEXT,
    items JSONB, -- Store the cart array
    total_amount NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for Hold Bills
ALTER TABLE public.hold_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their shop hold bills" ON public.hold_bills
  FOR ALL USING (shop_id = public.get_user_shop_id());
