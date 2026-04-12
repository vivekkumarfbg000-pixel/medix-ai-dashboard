-- =============================================================================
-- SHOP ID SYNC FIX — v4 (2026-04-12)
-- =============================================================================
-- Purpose:
--   1. Replaces all previous versions of handle_new_user() with a hardened,
--      exception-safe version that correctly populates user_shops on new signups.
--   2. Backfills existing users in profiles who are MISSING a user_shops row.
--   3. Ensures the trigger is active and wired to auth.users.
-- =============================================================================

-- STEP 1: Replace the provisioning function with the latest hardened version
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_shop_id UUID;
    final_shop_name TEXT;
    final_user_name TEXT;
BEGIN
    -- Extract display name with fallbacks for Google / Email / Anonymous Auth
    final_shop_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'shop_name'), ''),
        'My Medical Shop'
    );

    final_user_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
        NULLIF(TRIM(new.raw_user_meta_data->>'user_name'), ''),
        'Pharmacist'
    );

    -- Wrap ALL provisioning in an exception-safe block so a failure here
    -- never blocks the Supabase Auth user creation from succeeding.
    BEGIN
        -- A. Create the shop record
        INSERT INTO public.shops (name, address, phone, owner_id)
        VALUES (final_shop_name, 'Update Address', 'Update Phone', new.id)
        RETURNING id INTO new_shop_id;

        -- B. Upsert profile (safe against duplicate user_id)
        INSERT INTO public.profiles (user_id, shop_id, full_name, role)
        VALUES (new.id, new_shop_id, final_user_name, 'owner')
        ON CONFLICT (user_id) DO UPDATE
            SET shop_id   = EXCLUDED.shop_id,
                full_name = EXCLUDED.full_name;

        -- C. Create the user ↔ shop link (THE CRITICAL ROW for frontend sync)
        INSERT INTO public.user_shops (user_id, shop_id, is_primary)
        VALUES (new.id, new_shop_id, true)
        ON CONFLICT (user_id, shop_id) DO NOTHING;

        -- D. Assign admin role to the shop owner
        INSERT INTO public.user_roles (user_id, shop_id, role)
        VALUES (new.id, new_shop_id, 'admin'::public.app_role)
        ON CONFLICT (user_id, shop_id) DO NOTHING;

    EXCEPTION WHEN OTHERS THEN
        -- Log the error but never block auth user creation
        RAISE WARNING '[handle_new_user] Auto-provisioning failed for user %: %', new.id, SQLERRM;
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- STEP 2: Re-wire the trigger (drop + create is idempotent)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STEP 3: Backfill — create user_shops rows for existing users who are missing one
-- ---------------------------------------------------------------------------
-- This fixes any user whose account was created before the trigger was stable,
-- or whose provisioning silently failed.
INSERT INTO public.user_shops (user_id, shop_id, is_primary)
SELECT
    p.user_id,
    p.shop_id,
    true
FROM public.profiles p
WHERE
    p.shop_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM public.user_shops us
        WHERE us.user_id = p.user_id
    )
ON CONFLICT (user_id, shop_id) DO NOTHING;

-- STEP 4: Verification query — run this to confirm YOUR account has a shop row
-- ---------------------------------------------------------------------------
-- SELECT us.user_id, us.shop_id, us.is_primary, s.name
-- FROM user_shops us
-- JOIN shops s ON s.id = us.shop_id
-- WHERE us.user_id = auth.uid();
