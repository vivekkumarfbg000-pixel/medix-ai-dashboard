-- Create inventory_drafts table for storing unstructured AI extractions
CREATE TABLE IF NOT EXISTS public.inventory_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    brand_name TEXT NOT NULL,
    salt TEXT,
    quantity NUMERIC DEFAULT 10,
    mrp NUMERIC,
    expiry TEXT, -- Keeping as text since AI might return "March 27"
    uom TEXT,
    confidence_score NUMERIC,
    status TEXT DEFAULT 'Pending_Verification',
    reorder_threshold NUMERIC,
    source TEXT DEFAULT 'ai_unstructured',
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.inventory_drafts ENABLE ROW LEVEL SECURITY;

-- Add Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_drafts' AND policyname = 'Users can view their shop''s drafts') THEN
        CREATE POLICY "Users can view their shop's drafts" ON public.inventory_drafts FOR SELECT USING (auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = inventory_drafts.shop_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_drafts' AND policyname = 'Users can insert drafts for their shop') THEN
        CREATE POLICY "Users can insert drafts for their shop" ON public.inventory_drafts FOR INSERT WITH CHECK (auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = inventory_drafts.shop_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_drafts' AND policyname = 'Users can update their shop''s drafts') THEN
        CREATE POLICY "Users can update their shop's drafts" ON public.inventory_drafts FOR UPDATE USING (auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = inventory_drafts.shop_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_drafts' AND policyname = 'Users can delete their shop''s drafts') THEN
        CREATE POLICY "Users can delete their shop's drafts" ON public.inventory_drafts FOR DELETE USING (auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = inventory_drafts.shop_id));
    END IF;
END $$;
