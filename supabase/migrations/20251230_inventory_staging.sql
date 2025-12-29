-- Create inventory_staging table for Draft Mode
CREATE TABLE IF NOT EXISTS public.inventory_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    batch_number TEXT,
    expiry_date DATE,
    quantity INTEGER,
    unit_price DECIMAL(10,2),
    source TEXT DEFAULT 'scan', -- 'scan', 'voice', etc.
    status TEXT DEFAULT 'pending', -- 'pending' (Draft), 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_staging ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their shop staging" ON public.inventory_staging
  FOR ALL USING (shop_id = public.get_user_shop_id());
