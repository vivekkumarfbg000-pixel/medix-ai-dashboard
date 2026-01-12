-- Create shortbook_items table
CREATE TABLE IF NOT EXISTS public.shortbook_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    quantity_needed TEXT, -- Allows "5 boxes", "10 strips"
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
    is_ordered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.shortbook_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for own shop shortbook" ON public.shortbook_items
    FOR SELECT USING (auth.uid() IN (
        SELECT user_id FROM user_roles WHERE shop_id = shortbook_items.shop_id
    ));

CREATE POLICY "Enable insert access for own shop shortbook" ON public.shortbook_items
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT user_id FROM user_roles WHERE shop_id = shortbook_items.shop_id
    ));

CREATE POLICY "Enable update access for own shop shortbook" ON public.shortbook_items
    FOR UPDATE USING (auth.uid() IN (
        SELECT user_id FROM user_roles WHERE shop_id = shortbook_items.shop_id
    ));

CREATE POLICY "Enable delete access for own shop shortbook" ON public.shortbook_items
    FOR DELETE USING (auth.uid() IN (
        SELECT user_id FROM user_roles WHERE shop_id = shortbook_items.shop_id
    ));


-- Indexing
CREATE INDEX idx_shortbook_shop_id ON public.shortbook_items(shop_id);
