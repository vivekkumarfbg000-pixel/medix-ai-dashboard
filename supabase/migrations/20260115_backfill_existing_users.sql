-- BACKFILL: Auto-Provision Shops for Existing "Orphan" Users (v3)
-- Rationale: Fixes "column email does not exist" error.
-- Schema: Profiles table does NOT store email (it lives in auth.users).

DO $$
DECLARE
    r RECORD;
    new_shop_id UUID;
    user_shop_name TEXT;
    user_full_name TEXT;
BEGIN
    -- Loop through all users in auth.users who do NOT have a mapping in user_shops
    FOR r IN 
        SELECT u.id, u.email, u.raw_user_meta_data 
        FROM auth.users u
        WHERE NOT EXISTS (
            SELECT 1 FROM public.user_shops us WHERE us.user_id = u.id
        )
    LOOP
        -- 1. Determine safe defaults
        user_shop_name := COALESCE(r.raw_user_meta_data->>'shop_name', 'My Pharmacy');
        user_full_name := COALESCE(r.raw_user_meta_data->>'full_name', 'Pharmacist');

        -- 2. Create a new Shop for this user (including owner_id)
        INSERT INTO public.shops (name, address, phone, owner_id)
        VALUES (user_shop_name, 'Address Pending', 'Phone Pending', r.id)
        RETURNING id INTO new_shop_id;

        -- 3. Ensure Profile exists (Upsert) - REMOVED 'email' COLUMN
        INSERT INTO public.profiles (user_id, shop_id, full_name, role)
        VALUES (r.id, new_shop_id, user_full_name, 'owner')
        ON CONFLICT (user_id) 
        DO UPDATE SET shop_id = EXCLUDED.shop_id, role = 'owner';

        -- 4. Create User-Shop Mapping
        INSERT INTO public.user_shops (user_id, shop_id, role)
        VALUES (r.id, new_shop_id, 'owner')
        ON CONFLICT (user_id, shop_id) DO NOTHING;

        RAISE NOTICE 'Provisioned Shop % for User % (%)', new_shop_id, r.id, r.email;
        
    END LOOP;
END $$;
