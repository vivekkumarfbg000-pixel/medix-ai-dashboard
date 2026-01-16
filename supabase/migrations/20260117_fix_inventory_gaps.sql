-- 1. Add 'source' column to inventory to track where items came from (CSV, Manual, AI, Migrated)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- 2. Ensure inventory_staging exists (Fixing potential missing link for AI Drafts)
CREATE TABLE IF NOT EXISTS public.inventory_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    batch_number TEXT,
    expiry_date DATE,
    quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(10,2) DEFAULT 0,
    source TEXT DEFAULT 'scan',
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Enable RLS for staging
ALTER TABLE public.inventory_staging ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Staging (Crucial for it to work)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_staging' AND policyname = 'Users can manage their shop staging') THEN
        CREATE POLICY "Users can manage their shop staging" ON public.inventory_staging
            FOR ALL USING (shop_id = public.get_user_shop_id());
    END IF;
END $$;
