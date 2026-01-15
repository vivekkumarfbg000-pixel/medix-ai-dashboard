-- INVENTORY RLS FALLBACK (Defense in Depth)
-- Rationale: User reports "inventory not loading". 
-- Even if user_shops backfill failed, we should allow access via profiles.shop_id as a fallback.
-- This aligns with the "Emergency Access Fix" applied to the `shops` table.

-- 1. Inventory Table
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Enable access for shop members" ON public.inventory;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Enable access for shop members" ON public.inventory
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
    OR
    shop_id IN (SELECT shop_id FROM public.profiles WHERE user_id = auth.uid()) -- Fallback
);

-- 2. Inventory Staging
ALTER TABLE public.inventory_staging ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Enable access for shop members" ON public.inventory_staging;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Enable access for shop members" ON public.inventory_staging
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
    OR
    shop_id IN (SELECT shop_id FROM public.profiles WHERE user_id = auth.uid()) -- Fallback
);
