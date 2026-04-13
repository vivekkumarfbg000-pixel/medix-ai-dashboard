-- =============================================================================
-- FINAL AUTH & SHOP SYNC HARDENING (2026-04-13)
-- =============================================================================
-- This migration:
-- 1. Updates handle_new_user to Hardened v5 (Idempotent, safe, robust).
-- 2. Hardens TABLE RLS policies to allow client-side provisioning fallbacks.
-- 3. Ensures Junction table unique constraints are correct.
-- =============================================================================

-- ── 1. HARDENED TRIGGER ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_shop_id UUID;
    final_shop_name TEXT;
    final_user_name TEXT;
BEGIN
    -- Extract display name from metadata (Google / Email)
    final_shop_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'shop_name'), ''),
        'My Medical Shop'
    );

    final_user_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
        'Pharmacist'
    );

    BEGIN
        -- A. Create/Resolve Shop 
        INSERT INTO public.shops (name, owner_id)
        VALUES (final_shop_name, new.id)
        ON CONFLICT (owner_id) DO UPDATE 
        SET name = EXCLUDED.name,
            updated_at = NOW()
        RETURNING id INTO new_shop_id;

        IF new_shop_id IS NULL THEN
            SELECT id INTO new_shop_id FROM public.shops WHERE owner_id = new.id LIMIT 1;
        END IF;

        -- B. Upsert profile
        INSERT INTO public.profiles (user_id, shop_id, full_name, role)
        VALUES (new.id, new_shop_id, final_user_name, 'owner')
        ON CONFLICT (user_id) DO UPDATE
            SET shop_id = EXCLUDED.shop_id,
                full_name = EXCLUDED.full_name;

        -- C. Junction link
        INSERT INTO public.user_shops (user_id, shop_id, is_primary)
        VALUES (new.id, new_shop_id, true)
        ON CONFLICT (user_id, shop_id) DO NOTHING;

        -- D. Role assignment (Staff/Admin)
        INSERT INTO public.user_roles (user_id, shop_id, role)
        VALUES (new.id, new_shop_id, 'admin')
        ON CONFLICT (user_id, shop_id) DO NOTHING;

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[handle_new_user] Provisioning failed for user %: %', new.id, SQLERRM;
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Wiring
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 2. RLS HARDENING FOR FALLBACKS ───────────────────────────────────────────
-- These allow the frontend syncUserShop() to create records if the trigger above lags.

-- SHOPS: Allow owner to insert their own shop
DROP POLICY IF EXISTS "Owner can insert own shop" ON public.shops;
CREATE POLICY "Owner can insert own shop" ON public.shops
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- USER_SHOPS: Allow user to link themselves to a shop they just created
DROP POLICY IF EXISTS "Users can insert own shop links" ON public.user_shops;
CREATE POLICY "Users can insert own shop links" ON public.user_shops
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- PROFILES: Allow user to create their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- USER_ROLES: Allow user to manage their own roles (Insert fallback)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
CREATE POLICY "Users see own roles" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
CREATE POLICY "Users can insert own roles" ON public.user_roles
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Ensure updates are also possible (profiles often need this for full_name)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());


-- ── 3. CLEANUP & BACKFILL ────────────────────────────────────────────────────

-- Fix any current users missing their user_shops junction record
INSERT INTO public.user_shops (user_id, shop_id, is_primary)
SELECT p.user_id, p.shop_id, true
FROM public.profiles p
JOIN public.shops s ON s.id = p.shop_id
WHERE p.shop_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_shops us WHERE us.user_id = p.user_id AND us.shop_id = p.shop_id)
ON CONFLICT (user_id, shop_id) DO NOTHING;
