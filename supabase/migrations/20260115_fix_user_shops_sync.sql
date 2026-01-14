-- FIX: Sync Profiles to User Shops (v2 - Robust)
-- Rationale: Strict RLS relies on 'user_shops' table.
-- Fixes error: column "role" does not exist.

-- 1. Ensure user_shops exists
CREATE TABLE IF NOT EXISTS public.user_shops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, shop_id)
);

-- 2. Add 'role' column if it doesn't exist (Safe Alter)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_shops' AND column_name = 'role') THEN
        ALTER TABLE public.user_shops ADD COLUMN role TEXT DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff', 'viewer'));
    END IF;
END $$;

-- 3. Enable RLS on user_shops itself (CRITICAL)
ALTER TABLE public.user_shops ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can see their own shop mappings" ON public.user_shops;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Users can see their own shop mappings" ON public.user_shops
FOR SELECT USING (
    user_id = auth.uid()
);

-- 4. Backfill: Insert users from 'profiles' into 'user_shops' if missing
INSERT INTO public.user_shops (user_id, shop_id, role)
SELECT 
    p.user_id, 
    p.shop_id, 
    'owner' -- Default to owner for existing profile-linked users
FROM public.profiles p
WHERE 
    p.shop_id IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM public.user_shops us 
        WHERE us.user_id = p.user_id AND us.shop_id = p.shop_id
    );

-- 5. Fix SHOPS table RLS (Ensure owners can read their shop details)
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their shops" ON public.shops;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Users can view their shops" ON public.shops
FOR ALL USING (
    id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
);
