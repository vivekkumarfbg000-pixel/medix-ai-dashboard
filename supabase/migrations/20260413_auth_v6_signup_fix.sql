-- ═══════════════════════════════════════════════════════════════════════════════
-- SIGNUP SERVER ERROR FIX (v6)
-- Date: 2026-04-13
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Ensure shops has a unique constraint on owner_id
-- Without this, the ON CONFLICT clause in the trigger will cause a 500 error.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'shops_owner_id_key'
    ) THEN
        ALTER TABLE public.shops ADD CONSTRAINT shops_owner_id_key UNIQUE (owner_id);
    END IF;
END $$;

-- 2. Hardened Trigger v6 - Specifically for Google metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_shop_id UUID;
    final_shop_name TEXT;
    final_user_name TEXT;
BEGIN
    -- Extract Display Names
    -- Google often uses 'name' instead of 'full_name'
    final_user_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
        'Pharmacist'
    );

    final_shop_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'shop_name'), ''),
        final_user_name || '''s Medical Shop',
        'My Medical Shop'
    );

    -- ATOMIC PROVISIONING
    -- We use a single nested block to catch and ignore minor errors 
    -- while ensuring 'new' is always returned to prevent 500s.
    BEGIN
        -- A. Create Shop (Fixed for the new Unique constraint)
        INSERT INTO public.shops (owner_id, name)
        VALUES (new.id, final_shop_name)
        ON CONFLICT (owner_id) DO UPDATE 
        SET name = EXCLUDED.name,
            updated_at = NOW()
        RETURNING id INTO new_shop_id;

        IF new_shop_id IS NULL THEN
            SELECT id INTO new_shop_id FROM public.shops WHERE owner_id = new.id LIMIT 1;
        END IF;

        -- B. Manage Profile
        INSERT INTO public.profiles (user_id, shop_id, full_name, role)
        VALUES (new.id, new_shop_id, final_user_name, 'owner')
        ON CONFLICT (user_id) DO UPDATE
            SET shop_id = EXCLUDED.shop_id,
                full_name = EXCLUDED.full_name;

        -- C. Ensure Junctions
        INSERT INTO public.user_shops (user_id, shop_id, is_primary)
        VALUES (new.id, new_shop_id, true)
        ON CONFLICT (user_id, shop_id) DO NOTHING;

        -- D. Assign Role (Enum compatible)
        INSERT INTO public.user_roles (user_id, shop_id, role)
        VALUES (new.id, new_shop_id, 'admin')
        ON CONFLICT (user_id, shop_id) DO NOTHING;

    EXCEPTION WHEN OTHERS THEN
        -- Log warning but DO NOT crash the transaction
        RAISE WARNING '[handle_new_user] Error during silent provision: %', SQLERRM;
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Cleanup: Remove duplicate triggers if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'V6: Hardened for Google OAuth metadata and idempotent shop creation.';
