-- Fix: Ensure shop_id exists on customers table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'shop_id') THEN
        ALTER TABLE public.customers ADD COLUMN shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
        -- Attempt to backfill if possible, or leave null to be fixed manually
        -- For now, allow null temporarily if needed, but schema says NOT NULL usually.
        -- ALTER TABLE public.customers ALTER COLUMN shop_id SET NOT NULL; 
    END IF;
END $$;

-- Also ensure RLS policies exist
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'Users can view their shop customers') THEN
        CREATE POLICY "Users can view their shop customers" ON public.customers FOR SELECT USING (shop_id = public.get_user_shop_id());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'Users can manage their shop customers') THEN
        CREATE POLICY "Users can manage their shop customers" ON public.customers FOR ALL USING (shop_id = public.get_user_shop_id());
    END IF;
END $$;
