-- Fix Inventory Schema: Add missing columns causing frontend failures
-- Run this in Supabase SQL Editor

-- 1. Ensure Table Exists
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    batch_number TEXT,
    expiry_date DATE,
    quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Add Missing Columns (Safe 'IF NOT EXISTS')
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS mrp DECIMAL(10,2);
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS generic_name TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS hsn_code TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS schedule_h1 BOOLEAN DEFAULT false;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS salt_composition TEXT;

-- 3. Create Index for Barcode Search (Fast Scanning)
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON public.inventory(barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_shop_barcode ON public.inventory(shop_id, barcode);

-- 4. Enable RLS (Security)
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their shop inventory" ON public.inventory;

CREATE POLICY "Users can manage their shop inventory" ON public.inventory
  FOR ALL USING (shop_id = public.get_user_shop_id());
