-- CRITICAL FIX: Update Inventory RLS for Multi-Shop Support and Source Column
-- Addresses "Permission Denied" and "Missing Column" errors

-- 1. Ensure 'source' column exists (Fixes CSV/Manual Upload)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- 2. Drop Old Single-Shop Policies (Which caused the lockouts)
DROP POLICY IF EXISTS "Users can view their shop inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can create inventory for their shop" ON public.inventory;
DROP POLICY IF EXISTS "Users can update their shop inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can delete their shop inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can manage their shop inventory" ON public.inventory; -- Catch-all

-- 3. Create Robust Multi-Shop Policy
-- Allows access if the user is mapped to the shop in `user_shops` OR is the `owner_id` in `shops`
CREATE POLICY "inventory_access_policy" ON public.inventory
FOR ALL
USING (
    shop_id IN (
        SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.shops WHERE owner_id = auth.uid()
    )
);

-- 4. Enable RLS (Just in case)
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 5. Fix Staging (Drafts) as well
CREATE TABLE IF NOT EXISTS public.inventory_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    batch_number TEXT,
    expiry_date DATE,
    quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(10,2) DEFAULT 0,
    source TEXT DEFAULT 'scan',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.inventory_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staging_access_policy" ON public.inventory_staging;
CREATE POLICY "staging_access_policy" ON public.inventory_staging
FOR ALL
USING (
    shop_id IN (
        SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.shops WHERE owner_id = auth.uid()
    )
);
