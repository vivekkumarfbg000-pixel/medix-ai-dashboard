-- ============================================================================
-- Supabase Row Level Security (RLS) Policies Migration
-- ============================================================================
-- This script configures multi-tenant security policies to ensure that users 
-- can only access data belonging to shops they are linked to.
-- ============================================================================

-- Enable RLS on all critical tables
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_drafts ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────────
-- Helper Functions
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_shops()
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY
  SELECT shop_id 
  FROM public.user_shops 
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Shops Table Policies
-- ────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can view shops they belong to"
ON public.shops
FOR SELECT
USING (
  id IN (SELECT public.get_user_shops())
);

CREATE POLICY "Owners can update their shops"
ON public.shops
FOR UPDATE
USING (
  id IN (
    SELECT shop_id 
    FROM public.user_shops 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Inventory Table Policies
-- ────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can select inventory of their linked shops"
ON public.inventory
FOR SELECT
USING (
  shop_id IN (SELECT public.get_user_shops())
);

CREATE POLICY "Staff can insert/update inventory of their linked shops"
ON public.inventory
FOR ALL
USING (
  shop_id IN (SELECT public.get_user_shops())
)
WITH CHECK (
  shop_id IN (SELECT public.get_user_shops())
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Orders Table Policies
-- ────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can select orders of their linked shops"
ON public.orders
FOR SELECT
USING (
  shop_id IN (SELECT public.get_user_shops())
);

CREATE POLICY "Staff can create/update orders of their linked shops"
ON public.orders
FOR ALL
USING (
  shop_id IN (SELECT public.get_user_shops())
)
WITH CHECK (
  shop_id IN (SELECT public.get_user_shops())
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. User Shops Table Policies
-- ────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can view members of their shops"
ON public.user_shops
FOR SELECT
USING (
  shop_id IN (SELECT public.get_user_shops())
);

CREATE POLICY "Only owners/admins can modify shop membership"
ON public.user_shops
FOR ALL
USING (
  shop_id IN (
    SELECT shop_id 
    FROM public.user_shops 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);
