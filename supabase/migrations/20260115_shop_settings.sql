-- PHASE 3: Shop Settings for Invoice Customization
-- Extends the shops functionality to store invoice preferences

CREATE TABLE IF NOT EXISTS public.shop_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    gstin TEXT,
    dl_number TEXT, -- Drug License Number
    invoice_footer_text TEXT,
    logo_url TEXT,
    terms_and_conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(shop_id) -- One settings record per shop
);

-- Enable RLS
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Shop members can view/edit their settings
CREATE POLICY "Users can manage their shop settings" ON public.shop_settings
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
);

-- Insert default settings for existing shops (Migrate existing data if any, or just init)
INSERT INTO public.shop_settings (shop_id, created_at, updated_at)
SELECT id, now(), now()
FROM public.shops
ON CONFLICT (shop_id) DO NOTHING;
