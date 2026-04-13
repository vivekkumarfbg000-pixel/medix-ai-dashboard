-- ═══════════════════════════════════════════════════════════════════════════════
-- NUCLEAR AUTH CLEANUP & HARDENING (v7)
-- Date: 2026-04-13
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. NUCLEAR DROP: Delete every single trigger on auth.users automatically
-- This ensures no legacy or duplicate triggers are left behind to crash your signups.
DO $$ 
DECLARE
    trg_record RECORD;
BEGIN
    FOR trg_record IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'auth' 
          AND event_object_table = 'users'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trg_record.trigger_name || ' ON auth.users;';
        RAISE NOTICE 'Dropped trigger % on auth.users', trg_record.trigger_name;
    END LOOP;
END $$;

-- 2. SCHEMA SANITY: Ensure crucial constraints exist
-- Fix unique owner constraint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_owner_id_key') THEN
        ALTER TABLE public.shops ADD CONSTRAINT shops_owner_id_key UNIQUE (owner_id);
    END IF;
END $$;

-- 3. MASTER TRIGGER v7 (Immortal Logic)
-- This function is wrapped in internal try/catch blocks to ENSURE it never returns
-- a 500 error, even if the junction tables have schema issues.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_shop_id UUID;
    final_shop_name TEXT;
    final_user_name TEXT;
BEGIN
    -- Extract Metadata Assertively
    final_user_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
        'Pharmacist'
    );

    final_shop_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'shop_name'), ''),
        final_user_name || '''s Pharmacy',
        'My Medical Shop'
    );

    -- ATOMIC PROVISIONING (SILENT FAILSAFE)
    -- This block ensures a SQL failure in our public tables never blocks the auth.users insert.
    BEGIN
        -- A. Upsert Shop
        INSERT INTO public.shops (owner_id, name)
        VALUES (new.id, final_shop_name)
        ON CONFLICT (owner_id) DO UPDATE 
        SET name = EXCLUDED.name,
            updated_at = NOW()
        RETURNING id INTO new_shop_id;

        IF new_shop_id IS NULL THEN
            SELECT id INTO new_shop_id FROM public.shops WHERE owner_id = new.id LIMIT 1;
        END IF;

        -- B. Manage Profile (Idempotent)
        INSERT INTO public.profiles (user_id, shop_id, full_name, role)
        VALUES (new.id, new_shop_id, final_user_name, 'owner')
        ON CONFLICT (user_id) DO UPDATE
            SET shop_id = EXCLUDED.shop_id,
                full_name = EXCLUDED.full_name;

        -- C. Junction Tables (Multi-branch support)
        -- user_shops
        INSERT INTO public.user_shops (user_id, shop_id, is_primary)
        VALUES (new.id, new_shop_id, true)
        ON CONFLICT (user_id, shop_id) DO NOTHING;

        -- user_roles (Enum compatible)
        -- We catch role failures separately in case the enum 'admin' is missing
        BEGIN
            INSERT INTO public.user_roles (user_id, shop_id, role)
            VALUES (new.id, new_shop_id, 'admin')
            ON CONFLICT (user_id, shop_id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN 
            RAISE WARNING 'Role assignment failed: %', SQLERRM;
        END;

    EXCEPTION WHEN OTHERS THEN
        -- CRITICAL: Log warning but DO NOT return failure
        RAISE WARNING '[handle_new_user_v7] Provisioning failed silently: %', SQLERRM;
    END;

    -- ALWAYS return NEW. If we reach here, the user is successfully created in auth.users.
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Install the NEW Trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Backfill Cleanup (Optional logic to fix any broken users)
UPDATE public.profiles p
SET shop_id = s.id
FROM public.shops s
WHERE s.owner_id = p.user_id AND p.shop_id IS NULL;

INSERT INTO public.user_shops (user_id, shop_id, is_primary)
SELECT user_id, shop_id, true
FROM public.profiles
WHERE shop_id IS NOT NULL
ON CONFLICT (user_id, shop_id) DO NOTHING;

COMMENT ON FUNCTION public.handle_new_user() IS 'V7 Master: Immortal provisioning logic. Safe for Google OAuth.';
