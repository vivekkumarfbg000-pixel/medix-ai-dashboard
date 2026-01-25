-- Create Lab Reports Table for AI Lab Intelligence
CREATE TABLE IF NOT EXISTS public.lab_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    patient_name TEXT,
    summary_json JSONB,
    biomarkers_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.lab_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lab reports from their shop" 
ON public.lab_reports FOR SELECT 
USING (shop_id IN (
    SELECT shop_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can insert lab reports for their shop" 
ON public.lab_reports FOR INSERT 
WITH CHECK (shop_id IN (
    SELECT shop_id FROM public.profiles WHERE id = auth.uid()
));
