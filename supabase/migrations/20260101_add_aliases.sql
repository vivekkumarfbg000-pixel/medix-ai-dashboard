-- Fix for "prescription date and item still missing"
-- This aligns the database tables with the N8N node configurations

-- 1. Add 'prescription_date' and 'items' to Prescriptions table
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS prescription_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 2. Add 'items' to Orders table (Voice Orders might be looking for 'items' instead of 'order_items')
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 3. Ensure 'medicines' is also present in case of mixed usage
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS medicines JSONB DEFAULT '[]'::jsonb;
