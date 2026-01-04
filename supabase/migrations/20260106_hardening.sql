-- 1. Fix RLS on b2b_orders to enforce Multi-Tenancy
DROP POLICY IF EXISTS "Enable all access" ON public.b2b_orders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.b2b_orders;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.b2b_orders;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.b2b_orders;

CREATE POLICY "Users can view their shop orders"
ON public.b2b_orders FOR SELECT
TO authenticated
USING (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can create orders for their shop"
ON public.b2b_orders FOR INSERT
TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can update their shop orders"
ON public.b2b_orders FOR UPDATE
TO authenticated
USING (shop_id = public.get_user_shop_id());

-- 2. Add License Fields to Shops
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS license_number TEXT,
ADD COLUMN IF NOT EXISTS license_expiry DATE DEFAULT (CURRENT_DATE + INTERVAL '1 year');

-- 3. Safety: Add trigger to auto-create profile for new auth users (if missing) - Optional robustness
-- (Skipping to keep scope focused on criticals)
