-- Create lab_reports table for storing AI analysis
CREATE TABLE IF NOT EXISTS public.lab_reports (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    shop_id UUID REFERENCES public.shops(id),
    patient_name TEXT,
    patient_phone TEXT,
    report_date DATE DEFAULT CURRENT_DATE,
    summary TEXT,
    disease_possibility TEXT[], -- Array of strings
    diet_recommendations TEXT[],
    next_steps TEXT[],
    raw_analysis JSONB, -- The full JSON from Gemini
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.lab_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their shop's reports"
ON public.lab_reports FOR SELECT
USING (auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = lab_reports.shop_id));

CREATE POLICY "Users can insert reports for their shop"
ON public.lab_reports FOR INSERT
WITH CHECK (auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = lab_reports.shop_id));
