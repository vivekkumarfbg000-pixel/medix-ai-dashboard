-- FIXED: Complete Inventory Repair Script
-- Run this in Supabase SQL Editor

-- 1. Create/Fix 'inventory' Table (Main Stock)
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

-- Add all missing columns safely
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS mrp DECIMAL(10,2);
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS generic_name TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS hsn_code TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS schedule_h1 BOOLEAN DEFAULT false;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS salt_composition TEXT;

-- 2. Create 'inventory_staging' Table (AI Drafts)
CREATE TABLE IF NOT EXISTS public.inventory_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    batch_number TEXT,
    expiry_date DATE,
    quantity INTEGER,
    unit_price DECIMAL(10,2),
    source TEXT DEFAULT 'scan',
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Security Policies (RLS)
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_staging ENABLE ROW LEVEL SECURITY;

-- Helper to safely drop policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage their shop inventory" ON public.inventory;
    DROP POLICY IF EXISTS "Users can manage their shop staging" ON public.inventory_staging;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Users can manage their shop inventory" ON public.inventory
  FOR ALL USING (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can manage their shop staging" ON public.inventory_staging
  FOR ALL USING (shop_id = public.get_user_shop_id());
