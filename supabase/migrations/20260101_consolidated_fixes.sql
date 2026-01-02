-- Consolidated schema fix for all N8N nodes
-- Run this entire script in Supabase SQL Editor

-- 1. Fix 'Record Parcha' (Prescriptions)
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 2. Fix 'Record Voice Order' (Orders)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'voice';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS raw_transcript TEXT;

-- 3. Fix 'Save Lab Report' (Lab Reports)
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Verify RLS (ensure new columns are accessible)
-- (Existing policies typically cover whole rows, so no action needed usually, but good to be safe)
