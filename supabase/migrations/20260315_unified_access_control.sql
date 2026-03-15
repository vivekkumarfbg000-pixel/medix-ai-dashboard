-- ARCHITECTURAL OVERHAUL: Unified Access Control
-- Rationale: Move away from owner-only policies to membership-aware policies using 'user_shops'.

-- 1. Create a Helper Function for Membership Verification
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

-- 2. Update INVENTORY RLS
DROP POLICY IF EXISTS "Team access medicines" ON public.inventory;
DROP POLICY IF EXISTS "Enable access for shop members" ON public.inventory;

CREATE POLICY "Unified membership access inventory" ON public.inventory
FOR ALL TO authenticated
USING (public.is_shop_member(shop_id))
WITH CHECK (public.is_shop_member(shop_id));

-- 3. Update ORDERS RLS
DROP POLICY IF EXISTS "Team access orders" ON public.orders;

CREATE POLICY "Unified membership access orders" ON public.orders
FOR ALL TO authenticated
USING (public.is_shop_member(shop_id))
WITH CHECK (public.is_shop_member(shop_id));

-- 4. Update CUSTOMERS RLS
DROP POLICY IF EXISTS "Team access customers" ON public.customers;

CREATE POLICY "Unified membership access customers" ON public.customers
FOR ALL TO authenticated
USING (public.is_shop_member(shop_id))
WITH CHECK (public.is_shop_member(shop_id));

-- 5. Update INVENTORY_DRAFTS RLS
DROP POLICY IF EXISTS "Users can view their shop's drafts" ON public.inventory_drafts;
DROP POLICY IF EXISTS "Users can insert drafts for their shop" ON public.inventory_drafts;
DROP POLICY IF EXISTS "Users can update their shop's drafts" ON public.inventory_drafts;
DROP POLICY IF EXISTS "Users can delete their shop's drafts" ON public.inventory_drafts;

CREATE POLICY "Unified membership access drafts" ON public.inventory_drafts
FOR ALL TO authenticated
USING (public.is_shop_member(shop_id))
WITH CHECK (public.is_shop_member(shop_id));

-- 6. Update LAB_REPORTS RLS
DROP POLICY IF EXISTS "Users can view their shop's reports" ON public.lab_reports;
DROP POLICY IF EXISTS "Users can insert reports for their shop" ON public.lab_reports;

CREATE POLICY "Unified membership access lab_reports" ON public.lab_reports
FOR ALL TO authenticated
USING (public.is_shop_member(shop_id))
WITH CHECK (public.is_shop_member(shop_id));

-- 7. Fix Profiles Lockout (Ensure users can see their own profile and profiles of team members if needed)
-- NOTE: Profiles are often used for identity. Usually, shops have profiles.
-- We keep profiles simple: access your own, and maybe allow lookups for team members.

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Unified profile access" ON public.profiles
FOR ALL TO authenticated
USING (
    user_id = auth.uid() 
    OR 
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
);
