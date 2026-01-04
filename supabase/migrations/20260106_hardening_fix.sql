-- CONSOLIDATED HARDENING FIX (Run this to fix errors)

-- 1. Cleaning up old/conflicting policies on b2b_orders
DROP POLICY IF EXISTS "Enable all access" ON public.b2b_orders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.b2b_orders;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.b2b_orders;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.b2b_orders;
DROP POLICY IF EXISTS "Users can view their shop orders" ON public.b2b_orders;
DROP POLICY IF EXISTS "Users can create orders for their shop" ON public.b2b_orders;
DROP POLICY IF EXISTS "Users can update their shop orders" ON public.b2b_orders;

-- 2. Ensure Table Exists (Idempotent)
CREATE TABLE IF NOT EXISTS public.b2b_orders (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references public.shops(id) on delete cascade not null,
    distributor_name text,
    total_amount numeric not null default 0,
    status text not null default 'pending',
    items jsonb not null default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.b2b_orders ENABLE ROW LEVEL SECURITY;

-- 3. Re-Create Secure Policies
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

-- 4. Add License Fields to Shops (Safe if already exists)
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS license_number TEXT;

ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS license_expiry DATE DEFAULT (CURRENT_DATE + INTERVAL '1 year');
