-- COMPREHENSIVE FIX: Run this entire script to fix all table issues.

-- 1. Create lab_reports table if it doesn't exist (using gen_random_uuid() for reliability)
CREATE TABLE IF NOT EXISTS public.lab_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id),
    patient_name TEXT,
    patient_phone TEXT,
    report_date DATE DEFAULT CURRENT_DATE,
    summary TEXT,
    disease_possibility TEXT[],
    diet_recommendations TEXT[],
    next_steps TEXT[],
    raw_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Add missing columns to lab_reports (in case it existed but was old)
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.lab_reports ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Enable RLS for lab_reports if not already on
ALTER TABLE public.lab_reports ENABLE ROW LEVEL SECURITY;

-- 4. Fix 'Record Parcha' (Prescriptions)
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 5. Fix 'Record Voice Order' (Orders)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'voice';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS raw_transcript TEXT;

-- 6. Add Policies for lab_reports (Safe policy creation)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lab_reports' AND policyname = 'Users can view their shop''s reports') THEN
        CREATE POLICY "Users can view their shop's reports" ON public.lab_reports FOR SELECT USING (auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = lab_reports.shop_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lab_reports' AND policyname = 'Users can insert reports for their shop') THEN
        CREATE POLICY "Users can insert reports for their shop" ON public.lab_reports FOR INSERT WITH CHECK (auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = lab_reports.shop_id));
    END IF;
END $$;
