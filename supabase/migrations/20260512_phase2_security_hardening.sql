-- =============================================================================
-- PHASE 2: DATABASE SECURITY HARDENING & PERFORMANCE OPTIMIZATION
-- MedixAI — Production Readiness Audit (v2.1 - RESILIENT)
-- =============================================================================
-- Fixes: RLS, Missing Indexes, Table Mismatches (shortbook, distributors)
-- =============================================================================

-- ── SECTION 0: SCHEMA STABILIZATION ──────────────────────────────────────────
-- Ensures tables exist with correct columns before applying security.

-- [S1] Ensure distributors has shop_id (Handles legacy 20260106 shadow)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'distributors' AND column_name = 'shop_id') THEN
        ALTER TABLE public.distributors ADD COLUMN shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added shop_id to distributors';
    END IF;
END $$;

-- [S2] Ensure shortbook table exists (Handles mismatch with shortbook_items)
CREATE TABLE IF NOT EXISTS public.shortbook (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    distributor_id BIGINT REFERENCES public.distributors(id) ON DELETE SET NULL,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    added_from TEXT DEFAULT 'manual',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ── SECTION 1: PREREQUISITES ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── SECTION 2: FIX BROKEN RLS POLICIES ──────────────────────────────────────

-- [F1.1] Fix notifications — use membership check
DROP POLICY IF EXISTS "Users can view their shop notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service Role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their shop notifications" ON public.notifications;

CREATE POLICY "notifications_select_shop_members" ON public.notifications
FOR SELECT TO authenticated USING (public.is_shop_member(shop_id));

CREATE POLICY "notifications_insert_shop_members" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (public.is_shop_member(shop_id));

CREATE POLICY "notifications_update_shop_members" ON public.notifications
FOR UPDATE TO authenticated USING (public.is_shop_member(shop_id));


-- [F1.2a] Fix distributors — broken public.users reference
DROP POLICY IF EXISTS "Users can manage their distributors" ON public.distributors;
DROP POLICY IF EXISTS "Public read access" ON public.distributors;

CREATE POLICY "distributors_shop_members_all" ON public.distributors
FOR ALL TO authenticated
USING (public.is_shop_member(shop_id))
WITH CHECK (public.is_shop_member(shop_id));


-- [F1.2b] Fix shortbook — ensure it works for current app structure
DROP POLICY IF EXISTS "Users can manage their shortbook" ON public.shortbook;

CREATE POLICY "shortbook_shop_members_all" ON public.shortbook
FOR ALL TO authenticated
USING (public.is_shop_member(shop_id))
WITH CHECK (public.is_shop_member(shop_id));


-- [F1.3] Fix purchase_returns — use unified membership
DROP POLICY IF EXISTS "Users can view purchase returns from their shop" ON public.purchase_returns;
DROP POLICY IF EXISTS "Users can insert purchase returns for their shop" ON public.purchase_returns;

CREATE POLICY "purchase_returns_shop_members_all" ON public.purchase_returns
FOR ALL TO authenticated USING (public.is_shop_member(shop_id));


-- [F1.8] Fix global_catalogs — Role qualifier
DROP POLICY IF EXISTS "authenticated_view_global" ON public.global_catalogs;
CREATE POLICY "global_catalogs_authenticated_read" ON public.global_catalogs FOR SELECT TO authenticated USING (true);


-- ── SECTION 3: SECURE CRITICAL RPC FUNCTIONS ─────────────────────────────────

-- [F1.5] Fix get_sales_report
DROP FUNCTION IF EXISTS public.get_sales_report(TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.get_sales_report(start_date TEXT, end_date TEXT, query_shop_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    total_sales NUMERIC := 0;
    total_profit NUMERIC := 0;
    daily_stats JSON;
BEGIN
    IF NOT public.is_shop_member(query_shop_id) THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(SUM(total_amount), 0),
           COALESCE(SUM((SELECT SUM((COALESCE((item->>'price')::NUMERIC, 0) - COALESCE((item->>'purchase_price')::NUMERIC, 0)) * COALESCE((item->>'qty')::NUMERIC, 0))
                         FROM jsonb_array_elements(order_items) AS item)), 0)
    INTO total_sales, total_profit
    FROM public.orders WHERE shop_id = query_shop_id AND status IN ('approved', 'completed', 'paid')
    AND created_at >= start_date::TIMESTAMPTZ AND created_at <= end_date::TIMESTAMPTZ;

    SELECT json_agg(t) INTO daily_stats FROM (
        SELECT date_trunc('day', created_at)::TEXT AS date, COUNT(*) AS order_count, SUM(total_amount) AS sales,
               SUM((SELECT SUM((COALESCE((item->>'price')::NUMERIC, 0) - COALESCE((item->>'purchase_price')::NUMERIC, 0)) * COALESCE((item->>'qty')::NUMERIC, 0))
                    FROM jsonb_array_elements(order_items) AS item)) AS profit
        FROM public.orders WHERE shop_id = query_shop_id AND status IN ('approved', 'completed', 'paid')
        AND created_at >= start_date::TIMESTAMPTZ AND created_at <= end_date::TIMESTAMPTZ
        GROUP BY 1 ORDER BY 1
    ) t;

    RETURN json_build_object('total_sales', total_sales, 'total_profit', total_profit, 'sales_by_date', COALESCE(daily_stats, '[]'::JSON));
END; $$;

REVOKE ALL ON FUNCTION public.get_sales_report(TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sales_report(TEXT, TEXT, UUID) TO authenticated;


-- ── SECTION 4: PERFORMANCE INDEXES ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_shops_user_shop ON public.user_shops(user_id, shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_created_at ON public.orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_medicine_name_trgm ON public.inventory USING gin(medicine_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_shop_medicine ON public.inventory(shop_id, medicine_name);
CREATE INDEX IF NOT EXISTS idx_global_catalogs_composition_fts ON public.global_catalogs USING gin(to_tsvector('english', COALESCE(composition, '')));
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- Fixed table name: customer_ledger (instead of ledger_entries)
CREATE INDEX IF NOT EXISTS idx_customer_ledger_shop_customer ON public.customer_ledger(shop_id, customer_id);


-- ── SECTION 5: DATA CONSISTENCY FIXES ────────────────────────────────────────

-- Ensure shortbook.shop_id is NOT NULL
DO $$ BEGIN
    DELETE FROM public.shortbook WHERE shop_id IS NULL;
    ALTER TABLE public.shortbook ALTER COLUMN shop_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Add updated_at trigger to purchase_returns
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE TRIGGER update_purchase_returns_updated_at BEFORE UPDATE ON public.purchase_returns
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- [F6] Improved medicine search
DROP FUNCTION IF EXISTS public.search_global_medicines(TEXT);
CREATE OR REPLACE FUNCTION public.search_global_medicines(search_term TEXT)
RETURNS TABLE (id UUID, medicine_name TEXT, generic_name TEXT, manufacturer TEXT, composition TEXT, category TEXT, mrp DECIMAL, similarity_score REAL)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF search_term IS NULL OR LENGTH(TRIM(search_term)) < 2 THEN RETURN; END IF;
    RETURN QUERY SELECT gc.id, gc.medicine_name, gc.generic_name, gc.manufacturer, gc.composition, gc.category, gc.mrp,
        GREATEST(similarity(gc.medicine_name, search_term), similarity(COALESCE(gc.generic_name, ''), search_term) * 0.9, similarity(COALESCE(gc.composition, ''), search_term) * 0.7)::REAL AS similarity_score
    FROM public.global_catalogs gc
    WHERE gc.medicine_name ILIKE '%' || search_term || '%' OR gc.generic_name ILIKE '%' || search_term || '%' OR gc.composition ILIKE '%' || search_term || '%' OR similarity(gc.medicine_name, search_term) > 0.2
    ORDER BY similarity_score DESC, gc.medicine_name ASC LIMIT 30;
END; $$;

GRANT EXECUTE ON FUNCTION public.search_global_medicines(TEXT) TO authenticated;


-- [F7] Inventory alternative search
DROP FUNCTION IF EXISTS public.find_medicine_alternatives(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.find_medicine_alternatives(p_shop_id UUID, p_medicine_name TEXT, p_generic_name TEXT DEFAULT NULL)
RETURNS TABLE (id UUID, medicine_name TEXT, generic_name TEXT, quantity INTEGER, unit_price NUMERIC, manufacturer TEXT, batch_number TEXT, expiry_date DATE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_shop_member(p_shop_id) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    RETURN QUERY SELECT i.id, i.medicine_name, i.generic_name, i.quantity, i.unit_price, i.manufacturer, i.batch_number, i.expiry_date
    FROM public.inventory i WHERE i.shop_id = p_shop_id AND i.quantity > 0 AND i.medicine_name <> p_medicine_name
    AND ((p_generic_name IS NOT NULL AND (similarity(COALESCE(i.generic_name, ''), p_generic_name) > 0.3 OR i.generic_name ILIKE '%' || p_generic_name || '%')) OR similarity(i.medicine_name, p_medicine_name) > 0.4)
    ORDER BY (CASE WHEN p_generic_name IS NOT NULL AND i.generic_name ILIKE '%' || p_generic_name || '%' THEN 0 ELSE 1 END), similarity(i.medicine_name, p_medicine_name) DESC, i.quantity DESC LIMIT 10;
END; $$;

GRANT EXECUTE ON FUNCTION public.find_medicine_alternatives(UUID, TEXT, TEXT) TO authenticated;

-- ── SECTION 8: CLEANUP ────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
ANALYZE public.orders; ANALYZE public.inventory; ANALYZE public.user_shops; ANALYZE public.customer_ledger; ANALYZE public.shortbook;
