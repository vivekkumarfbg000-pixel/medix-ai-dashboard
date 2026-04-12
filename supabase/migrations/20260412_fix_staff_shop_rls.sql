-- FIX: Allow Staff/Team members to view the shop details for shops they are assigned to.
-- Current policy 'Users can view their own shop' only checks owner_id, which blocks staff.

-- Ensure helper function exists (self-contained fix)
CREATE OR REPLACE FUNCTION public.is_shop_member(p_shop_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_shops 
        WHERE user_id = auth.uid() 
        AND shop_id = p_shop_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ 
BEGIN
    -- 1. Drop the restrictive owner-only policy
    DROP POLICY IF EXISTS "Users can view their own shop" ON public.shops;
    DROP POLICY IF EXISTS "Users can view their shops" ON public.shops;

    -- 2. Create the unified membership-aware policy
    -- We use the helper function created in 20260315_unified_access_control.sql
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shops' AND policyname = 'Unified membership access shops') THEN
        CREATE POLICY "Unified membership access shops" ON public.shops
        FOR SELECT TO authenticated
        USING (
            owner_id = auth.uid() 
            OR 
            public.is_shop_member(id)
        );
    END IF;

    -- Update/Delete should still typically be owner/admin only, which is handled elsewhere or by owner_id check.
    -- But for clarity, we ensure staff can at least SELECT the shop name for the UI.
END $$;
