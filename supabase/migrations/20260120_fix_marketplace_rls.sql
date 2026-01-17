-- FIX: RLS Policies for Marketplace (Distributors & Shortbook)
-- Previous migration referenced non-existent 'public.users' table
-- Switching to robust 'user_shops' junction table

-- 1. Fix Distributors RLS
DROP POLICY IF EXISTS "Users can manage their distributors" ON public.distributors;

CREATE POLICY "Users can manage their distributors" ON public.distributors
FOR ALL USING (
    shop_id IN (
        SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.shops WHERE owner_id = auth.uid()
    )
);

-- 2. Fix Shortbook RLS
DROP POLICY IF EXISTS "Users can manage their shortbook" ON public.shortbook;

CREATE POLICY "Users can manage their shortbook" ON public.shortbook
FOR ALL USING (
    shop_id IN (
        SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.shops WHERE owner_id = auth.uid()
    )
);

-- 3. Ensure get_user_shop_id function exists (for other dependent queries)
CREATE OR REPLACE FUNCTION public.get_user_shop_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shop_id UUID;
BEGIN
    SELECT shop_id INTO v_shop_id
    FROM public.user_shops
    WHERE user_id = auth.uid()
    LIMIT 1;
    
    IF v_shop_id IS NULL THEN
        SELECT id INTO v_shop_id
        FROM public.shops
        WHERE owner_id = auth.uid()
        LIMIT 1;
    END IF;

    RETURN v_shop_id;
END;
$$;
