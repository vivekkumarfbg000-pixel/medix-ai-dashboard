-- Create Distributors Table
CREATE TABLE IF NOT EXISTS public.distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for Distributors
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their distributors" ON public.distributors
    FOR ALL USING (shop_id = (select shop_id from public.users where id = auth.uid()));

-- Create Shortbook Table
CREATE TABLE IF NOT EXISTS public.shortbook (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    distributor_id UUID REFERENCES public.distributors(id) ON DELETE SET NULL,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    added_from TEXT DEFAULT 'manual', -- manual, pos, inventory
    status TEXT DEFAULT 'pending', -- pending, ordered
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for Shortbook
ALTER TABLE public.shortbook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their shortbook" ON public.shortbook
    FOR ALL USING (shop_id = (select shop_id from public.users where id = auth.uid()));

-- Add Indexes
CREATE INDEX IF NOT EXISTS idx_shortbook_shop ON public.shortbook(shop_id);
CREATE INDEX IF NOT EXISTS idx_shortbook_status ON public.shortbook(status);
