-- PRODUCTION HARDENING MIGRATION
-- Fixes: Missing shop_settings, RLS Ghost Writes, Performance

-- 1. Create shop_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.shop_settings (
    shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
    gstin TEXT,
    dl_number TEXT,
    invoice_footer_text TEXT,
    terms_and_conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Enable RLS on shop_settings
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

-- 3. Policy for shop_settings (Upsert needs INSERT + UPDATE permissions)
DROP POLICY IF EXISTS "Shop members can manage settings" ON public.shop_settings;

CREATE POLICY "Shop members can manage settings" ON public.shop_settings
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
    OR
    shop_id IN (SELECT shop_id FROM public.profiles WHERE user_id = auth.uid())
);

-- 4. Re-Apply Inventory RLS (Force correct permissions for INSERT/UPDATE)
-- Sometimes policies get stale or conflicting. We refresh them here.
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable access for shop members" ON public.inventory;

CREATE POLICY "Enable access for shop members" ON public.inventory
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
    OR
    shop_id IN (SELECT shop_id FROM public.profiles WHERE user_id = auth.uid())
);

-- 5. Re-Apply Inventory Staging RLS
ALTER TABLE public.inventory_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable access for shop members" ON public.inventory_staging;

CREATE POLICY "Enable access for shop members" ON public.inventory_staging
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
    OR
    shop_id IN (SELECT shop_id FROM public.profiles WHERE user_id = auth.uid())
);

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_shop_id ON public.inventory(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_staging_shop_id ON public.inventory_staging(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON public.customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders(shop_id);

-- 7. Grant permissions to authenticated users (often missed)
GRANT ALL ON public.shop_settings TO authenticated;
GRANT ALL ON public.inventory TO authenticated;
GRANT ALL ON public.inventory_staging TO authenticated;
