-- ═══════════════════════════════════════════════════════════════════════════════
-- PharmaAssist.AI (MedixAI) — Production RLS Policies
-- Version: 2.0 | Date: 2026-04-10
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- IMPORTANT: This file is the CANONICAL source for all RLS policies.
-- It aligns with the REAL production DB schema (inventory, user_shops, etc.)
-- Run this in order after creating tables via Supabase migrations.
--
-- PREREQUISITE: All tables must exist before running this.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. ENABLE RLS ON ALL TABLES ──────────────────────────────────────────────

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- ── 2. HELPER FUNCTION: Get user's shop IDs ─────────────────────────────────
-- This is used in all RLS policies to check shop membership via user_shops table.

CREATE OR REPLACE FUNCTION public.get_user_shop_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid();
$$;

-- ── 3. RLS POLICIES ─────────────────────────────────────────────────────────

-- PROFILES: Users can only view/edit their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- USER_SHOPS: Users can only see their own shop memberships
DROP POLICY IF EXISTS "Users see own shop links" ON user_shops;
CREATE POLICY "Users see own shop links" ON user_shops
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- SHOPS: Read access through user_shops membership (NOT profiles.shop_id which is legacy)
DROP POLICY IF EXISTS "Team access shop" ON shops;
CREATE POLICY "Team access shop" ON shops
    FOR SELECT TO authenticated
    USING (id IN (SELECT public.get_user_shop_ids()));

DROP POLICY IF EXISTS "Owner update shop" ON shops;
CREATE POLICY "Owner update shop" ON shops
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid());

-- INVENTORY: Full access for shop team members
DROP POLICY IF EXISTS "Team access inventory" ON inventory;
CREATE POLICY "Team access inventory" ON inventory
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- ORDERS: Full access for shop team members
DROP POLICY IF EXISTS "Team access orders" ON orders;
CREATE POLICY "Team access orders" ON orders
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- ORDER_ITEMS: Access through order's shop ownership
DROP POLICY IF EXISTS "Team access order items" ON order_items;
CREATE POLICY "Team access order items" ON order_items
    FOR ALL TO authenticated
    USING (order_id IN (
        SELECT id FROM orders WHERE shop_id IN (SELECT public.get_user_shop_ids())
    ));

-- CUSTOMERS: Full access for shop team members
DROP POLICY IF EXISTS "Team access customers" ON customers;
CREATE POLICY "Team access customers" ON customers
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- DISTRIBUTORS: Shop-scoped access
DROP POLICY IF EXISTS "Team access distributors" ON distributors;
CREATE POLICY "Team access distributors" ON distributors
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- SUPPLIERS: Shop-scoped access
DROP POLICY IF EXISTS "Team access suppliers" ON suppliers;
CREATE POLICY "Team access suppliers" ON suppliers
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- PURCHASES: Shop-scoped access
DROP POLICY IF EXISTS "Team access purchases" ON purchases;
CREATE POLICY "Team access purchases" ON purchases
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- PURCHASE_RETURNS: Shop-scoped access
DROP POLICY IF EXISTS "Team access purchase returns" ON purchase_returns;
CREATE POLICY "Team access purchase returns" ON purchase_returns
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- PURCHASE_RETURN_ITEMS: Access through parent purchase return
DROP POLICY IF EXISTS "Team access return items" ON purchase_return_items;
CREATE POLICY "Team access return items" ON purchase_return_items
    FOR ALL TO authenticated
    USING (purchase_return_id IN (
        SELECT id FROM purchase_returns WHERE shop_id IN (SELECT public.get_user_shop_ids())
    ));

-- PRESCRIPTIONS: Shop-scoped access
DROP POLICY IF EXISTS "Team access prescriptions" ON prescriptions;
CREATE POLICY "Team access prescriptions" ON prescriptions
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- SHORTBOOK: Shop-scoped access
DROP POLICY IF EXISTS "Team access shortbook" ON shortbook;
CREATE POLICY "Team access shortbook" ON shortbook
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- LAB_REPORTS: Shop-scoped access
DROP POLICY IF EXISTS "Team access lab reports" ON lab_reports;
CREATE POLICY "Team access lab reports" ON lab_reports
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- RESTOCK_PREDICTIONS: Shop-scoped access
DROP POLICY IF EXISTS "Team access predictions" ON restock_predictions;
CREATE POLICY "Team access predictions" ON restock_predictions
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- AUDIT_LOGS: Shop-scoped read-only (insert via trigger or function)
DROP POLICY IF EXISTS "Team view audit logs" ON audit_logs;
CREATE POLICY "Team view audit logs" ON audit_logs
    FOR SELECT TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- ACTIVE_SESSIONS: Users can only access their own session
DROP POLICY IF EXISTS "Users manage own sessions" ON active_sessions;
CREATE POLICY "Users manage own sessions" ON active_sessions
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

-- LEDGER_ENTRIES: Shop-scoped access
DROP POLICY IF EXISTS "Team access ledger" ON ledger_entries;
CREATE POLICY "Team access ledger" ON ledger_entries
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT public.get_user_shop_ids()));

-- ── 4. AUTO-ONBOARDING TRIGGER ──────────────────────────────────────────────
-- Creates shop, profile, AND user_shops entry for new signups.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_shop_id UUID;
BEGIN
    -- 1. Create Default Shop
    INSERT INTO public.shops (name, owner_id)
    VALUES (
        COALESCE(new.raw_user_meta_data->>'shop_name', 'My Medical Shop'),
        new.id
    )
    RETURNING id INTO new_shop_id;

    -- 2. Create Profile
    INSERT INTO public.profiles (user_id, full_name, role, shop_id)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
        'admin',
        new_shop_id
    );

    -- 3. Create user_shops link (CRITICAL — this is what useUserShops reads)
    INSERT INTO public.user_shops (user_id, shop_id, is_primary)
    VALUES (new.id, new_shop_id, TRUE);

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 5. STORAGE POLICIES ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'clinical-uploads' );

DROP POLICY IF EXISTS "Allow users to view own files" ON storage.objects;
CREATE POLICY "Allow users to view own files"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'clinical-uploads' AND auth.uid()::text = (storage.foldername(name))[1] );
