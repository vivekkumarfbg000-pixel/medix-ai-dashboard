-- =============================================================================
-- AUTH JUNCTION AUTHORIZATION — v1 (2026-04-12)
-- =============================================================================
-- Purpose:
--   Allow the frontend to successfully link users to shops via 'user_shops'
--   and 'user_roles' table when the database trigger fails or for manual
--   administrative actions.
-- =============================================================================

-- 1. Helper function for Admin verification
CREATE OR REPLACE FUNCTION public.is_shop_admin(p_shop_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND shop_id = p_shop_id
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Authorize 'user_shops' junction
DO $$ BEGIN
    -- Ensure RLS is on
    ALTER TABLE public.user_shops ENABLE ROW LEVEL SECURITY;

    -- Drop legacy SELECT-only policy
    DROP POLICY IF EXISTS "Users can see their own shop mappings" ON public.user_shops;
    DROP POLICY IF EXISTS "Unified membership access user_shops" ON public.user_shops;

    -- CREATE: Users can link themselves to a shop (for fallback flow)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_shops' AND policyname = 'Users can manage their own mappings') THEN
        CREATE POLICY "Users can manage their own mappings" ON public.user_shops
        FOR ALL TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    END IF;

    -- CREATE: Admins can manage mappings for their shop
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_shops' AND policyname = 'Admins can manage mappings for their shop') THEN
        CREATE POLICY "Admins can manage mappings for their shop" ON public.user_shops
        FOR ALL TO authenticated
        USING (public.is_shop_admin(shop_id))
        WITH CHECK (public.is_shop_admin(shop_id));
    END IF;
END $$;

-- 3. Authorize 'user_roles' junction
DO $$ BEGIN
    -- Ensure RLS is on
    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

    -- Drop legacy policies
    DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Unified membership access user_roles" ON public.user_roles;

    -- CREATE: Users can view their own roles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Users can view their own roles') THEN
        CREATE POLICY "Users can view their own roles" ON public.user_roles
        FOR SELECT TO authenticated
        USING (user_id = auth.uid());
    END IF;

    -- CREATE: Users can assign their initial role if none exists (for fallback flow)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Users can assign their own initial roles') THEN
        CREATE POLICY "Users can assign their own initial roles" ON public.user_roles
        FOR INSERT TO authenticated
        WITH CHECK (user_id = auth.uid());
    END IF;

    -- CREATE: Admins can manage roles for their shop
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Admins can manage roles for their shop') THEN
        CREATE POLICY "Admins can manage roles for their shop" ON public.user_roles
        FOR ALL TO authenticated
        USING (public.is_shop_admin(shop_id))
        WITH CHECK (public.is_shop_admin(shop_id));
    END IF;
END $$;
