-- Fix RLS Policies for Customers to support multi-shop and avoid function dependency issues
-- Previous policies relied on get_user_shop_id() which might be missing or return only primary shop.

-- 1. Drop old policies
DROP POLICY IF EXISTS "Users can view their shop customers" ON public.customers;
DROP POLICY IF EXISTS "Users can create customers for their shop" ON public.customers;
DROP POLICY IF EXISTS "Users can update their shop customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;

-- 2. Create robust policies checking user_shops table directly
CREATE POLICY "Users can view their shop customers" ON public.customers 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_shops 
        WHERE user_shops.user_id = auth.uid() 
        AND user_shops.shop_id = customers.shop_id
    )
);

CREATE POLICY "Users can create customers for their shop" ON public.customers 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_shops 
        WHERE user_shops.user_id = auth.uid() 
        AND user_shops.shop_id = customers.shop_id
    )
);

CREATE POLICY "Users can update their shop customers" ON public.customers 
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.user_shops 
        WHERE user_shops.user_id = auth.uid() 
        AND user_shops.shop_id = customers.shop_id
    )
);

CREATE POLICY "Users can delete their shop customers" ON public.customers 
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.user_shops 
        WHERE user_shops.user_id = auth.uid() 
        AND user_shops.shop_id = customers.shop_id
    )
);

-- OPTIONAL: Fix Prescriptions as well to prevent future issues
DROP POLICY IF EXISTS "Users can view their shop prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Users can create prescriptions for their shop" ON public.prescriptions;
DROP POLICY IF EXISTS "Users can update their shop prescriptions" ON public.prescriptions;

CREATE POLICY "Users can view their shop prescriptions" ON public.prescriptions 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_shops 
        WHERE user_shops.user_id = auth.uid() 
        AND user_shops.shop_id = prescriptions.shop_id
    )
);

CREATE POLICY "Users can create prescriptions for their shop" ON public.prescriptions 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_shops 
        WHERE user_shops.user_id = auth.uid() 
        AND user_shops.shop_id = prescriptions.shop_id
    )
);

CREATE POLICY "Users can update their shop prescriptions" ON public.prescriptions 
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.user_shops 
        WHERE user_shops.user_id = auth.uid() 
        AND user_shops.shop_id = prescriptions.shop_id
    )
);
