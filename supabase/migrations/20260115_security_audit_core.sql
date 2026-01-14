-- PHASE 2 SECURITY AUDIT: Core Tables RLS Fix
-- Replaces weak function-based policies with explicit subquery checks

-- 1. INVENTORY TABLE
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Drop old potentially weak policies safely
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage their shop inventory" ON public.inventory;
    DROP POLICY IF EXISTS "Enable access for shop members" ON public.inventory;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- Create strict policy
CREATE POLICY "Enable access for shop members" ON public.inventory
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
);

-- 2. CUSTOMERS TABLE
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage their shop customers" ON public.customers;
    DROP POLICY IF EXISTS "Enable access for shop members" ON public.customers;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Enable access for shop members" ON public.customers
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
);

-- 3. INVENTORY STAGING (Drafts)
ALTER TABLE public.inventory_staging ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage their shop staging" ON public.inventory_staging;
    DROP POLICY IF EXISTS "Enable access for shop members" ON public.inventory_staging;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Enable access for shop members" ON public.inventory_staging
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
);

-- 4. VERIFY CUSTOMER LEDGER (Critical Financial Data)
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;
-- (Policy likely exists from previous script, but ensuring it matches strict pattern)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Enable access for shop members" ON public.customer_ledger;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Enable access for shop members" ON public.customer_ledger
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
);
