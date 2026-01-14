-- EMERGENCY ACCESS FIX
-- Rationale: User reports "Profile not working". Likely RLS lockout.
-- This script ensures the user can ALWAYS read their own profile and shop.

-- 1. FIX PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING ( user_id = auth.uid() );

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING ( user_id = auth.uid() );

-- 2. ROBUST SHOPS POLICY (Dual Check)
-- Allows access if in user_shops OR if linked in profiles (Fallback)
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their shops" ON public.shops;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Users can view their shops" ON public.shops
FOR ALL USING (
    id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
    OR
    id IN (SELECT shop_id FROM public.profiles WHERE user_id = auth.uid())
);

-- 3. ENSURE USER_SHOPS IS POPULATED (Again, being extra safe)
-- We use ON CONFLICT DO NOTHING to avoid duplicate key errors
INSERT INTO public.user_shops (user_id, shop_id, role)
SELECT 
    p.user_id, 
    p.shop_id, 
    'owner'
FROM public.profiles p
WHERE p.shop_id IS NOT NULL
ON CONFLICT (user_id, shop_id) DO NOTHING;

-- 4. FIX CUSTOMERS RLS (Dual Check)
DROP POLICY IF EXISTS "Enable access for shop members" ON public.customers;

CREATE POLICY "Enable access for shop members" ON public.customers
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
    OR
    shop_id IN (SELECT shop_id FROM public.profiles WHERE user_id = auth.uid()) -- Fallback
);
