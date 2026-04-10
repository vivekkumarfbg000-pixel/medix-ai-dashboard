-- EXCEPTION-SAFE AUTO-PROVISIONING SYSTEM
-- Rationale: Ensures users signing up via Google or Email NEVER get blocked by Database Errors.
-- If any provisioning step fails (e.g. constraints), it catches the exception and logs a warning
-- while safely allowing the auth.user row to be created successfully.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_shop_id UUID;
    final_shop_name TEXT;
    final_user_name TEXT;
BEGIN
    -- 1. Extract Details with Fallbacks for Google/Email Auth
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

    -- 2. SAFE PROVISIONING BLOCK
    BEGIN
        -- A. Create Shop
        INSERT INTO public.shops (name, address, phone, owner_id)
        VALUES (final_shop_name, 'Update Address', 'Update Phone', new.id)
        RETURNING id INTO new_shop_id;

        -- B. Create Profile (Safe Insert)
        INSERT INTO public.profiles (user_id, shop_id, full_name, role)
        VALUES (new.id, new_shop_id, final_user_name, 'owner')
        ON CONFLICT (user_id) DO UPDATE 
        SET shop_id = EXCLUDED.shop_id, full_name = EXCLUDED.full_name;

        -- C. Create User-Shop Link
        INSERT INTO public.user_shops (user_id, shop_id, is_primary)
        VALUES (new.id, new_shop_id, true)
        ON CONFLICT (user_id, shop_id) DO NOTHING;

        -- D. Assign admin role to shop owner using explicit type cast
        INSERT INTO public.user_roles (user_id, shop_id, role)
        VALUES (new.id, new_shop_id, 'admin'::public.app_role)
        ON CONFLICT (user_id, shop_id) DO NOTHING;

    EXCEPTION WHEN OTHERS THEN
        -- Safely trap ANY error in the provisioning block!
        -- The user is still returning to Auth gracefully.
        RAISE WARNING 'Auto-provisioning failed for user %: %', new.id, SQLERRM;
    END;

    -- Return new ID so Supabase Auth completes successfully
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure Trigger is Active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
