-- Create prescriptions table for Digital Parcha
CREATE TABLE IF NOT EXISTS public.prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_phone TEXT, -- To link to the "Digital Parcha" lookup
    customer_name TEXT,
    doctor_name TEXT,
    visit_date DATE DEFAULT CURRENT_DATE,
    medicines JSONB, -- Array of extracted medicines [{name, dose, frequency}]
    raw_text TEXT, -- Full OCR text for search
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their prescriptions" ON public.prescriptions
  FOR ALL USING (shop_id = public.get_user_shop_id());
