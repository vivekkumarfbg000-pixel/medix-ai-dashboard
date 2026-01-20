-- Create inventory_staging table for AI Drafts
CREATE TABLE IF NOT EXISTS public.inventory_staging (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    batch_number TEXT,
    expiry_date DATE,
    quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(10,2) DEFAULT 0,
    source TEXT DEFAULT 'scan', -- 'scan', 'manual', 'csv'
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.inventory_staging ENABLE ROW LEVEL SECURITY;

-- Policies (Drop first to avoid "policy already exists" error)
DROP POLICY IF EXISTS "Users can view drafts for their shops" ON public.inventory_staging;
CREATE POLICY "Users can view drafts for their shops" ON public.inventory_staging
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_shops
            WHERE user_shops.shop_id = inventory_staging.shop_id
            AND user_shops.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.shops
            WHERE shops.id = inventory_staging.shop_id
            AND shops.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert drafts for their shops" ON public.inventory_staging;
CREATE POLICY "Users can insert drafts for their shops" ON public.inventory_staging
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_shops
            WHERE user_shops.shop_id = inventory_staging.shop_id
            AND user_shops.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.shops
            WHERE shops.id = inventory_staging.shop_id
            AND shops.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update drafts for their shops" ON public.inventory_staging;
CREATE POLICY "Users can update drafts for their shops" ON public.inventory_staging
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_shops
            WHERE user_shops.shop_id = inventory_staging.shop_id
            AND user_shops.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.shops
            WHERE shops.id = inventory_staging.shop_id
            AND shops.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete drafts for their shops" ON public.inventory_staging;
CREATE POLICY "Users can delete drafts for their shops" ON public.inventory_staging
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_shops
            WHERE user_shops.shop_id = inventory_staging.shop_id
            AND user_shops.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.shops
            WHERE shops.id = inventory_staging.shop_id
            AND shops.owner_id = auth.uid()
        )
    );
