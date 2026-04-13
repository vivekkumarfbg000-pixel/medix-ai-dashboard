-- =============================================================================
-- HARDENED SIGNUP TRIGGER — v5 (2026-04-13)
-- =============================================================================
-- Purpose:
--   1. Fixes the "Critical Error (500)" during signup by making the trigger
--      idempotent and resilient to existing database records.
--   2. Handles "unique_owner_shop_idx" (owner_id) conflicts gracefully.
--   3. Ensures all provisioning steps (profile, user_shops, user_roles)
--      are idempotent using ON CONFLICT logic.
-- =============================================================================

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

    -- Wrap ALL provisioning in an exception-safe block
    BEGIN
        -- A. Create/Resolve Shop (Handle unique owner_id constraint)
        -- We use ON CONFLICT (owner_id) because a user can only own one shop in this schema.
        INSERT INTO public.shops (name, address, phone, owner_id)
        VALUES (final_shop_name, 'Update Address', 'Update Phone', new.id)
        ON CONFLICT (owner_id) DO UPDATE 
        SET name = EXCLUDED.name,
            updated_at = NOW()
        RETURNING id INTO new_shop_id;

        -- Fallback in case RETURNING failed
        IF new_shop_id IS NULL THEN
            SELECT id INTO new_shop_id FROM public.shops WHERE owner_id = new.id LIMIT 1;
        END IF;

        -- B. Upsert profile (safe against duplicate user_id)
        INSERT INTO public.profiles (user_id, shop_id, full_name, role)
        VALUES (new.id, new_shop_id, final_user_name, 'owner')
        ON CONFLICT (user_id) DO UPDATE
            SET shop_id   = EXCLUDED.shop_id,
                full_name = EXCLUDED.full_name,
                updated_at = NOW();

        -- C. Create the user ↔ shop link (Idempotent)
        INSERT INTO public.user_shops (user_id, shop_id, is_primary)
        VALUES (new.id, new_shop_id, true)
        ON CONFLICT (user_id, shop_id) DO UPDATE
            SET is_primary = true;

        -- D. Assign admin role to the shop owner
        INSERT INTO public.user_roles (user_id, shop_id, role)
        VALUES (new.id, new_shop_id, 'admin'::public.app_role)
        ON CONFLICT (user_id, shop_id) DO NOTHING;

    EXCEPTION WHEN OTHERS THEN
        -- Log the error to Postgres logs but NEVER block the user's ability to Sign In!
        RAISE WARNING '[handle_new_user] Auto-provisioning failed for user %: %', new.id, SQLERRM;
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-wire the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- FINAL CHECK: Ensure any users currently stuck without a user_shops link are fixed
INSERT INTO public.user_shops (user_id, shop_id, is_primary)
SELECT p.user_id, p.shop_id, true
FROM public.profiles p
WHERE p.shop_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_shops us WHERE us.user_id = p.user_id)
ON CONFLICT (user_id, shop_id) DO NOTHING;
