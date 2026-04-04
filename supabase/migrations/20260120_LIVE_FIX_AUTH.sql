-- MedixAI Dashboard: Authentication & Auto-Provisioning Fix
-- 1. Create or Update the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_shop_id UUID;
    shop_name TEXT;
    given_name TEXT;
BEGIN
    -- Extract metadata from the auth.users signup
    shop_name := new.raw_user_meta_data->>'shop_name';
    given_name := new.raw_user_meta_data->>'full_name';

    -- Defaults if metadata is missing
    IF shop_name IS NULL OR shop_name = '' THEN
        shop_name := 'My Pharmacy';
    END IF;

    IF given_name IS NULL THEN
        given_name := 'Pharmacist';
    END IF;

    -- A. Create the initial Shop
    INSERT INTO public.shops (name, address, phone, owner_id)
    VALUES (shop_name, 'Address Pending', 'Phone Pending', new.id)
    RETURNING id INTO new_shop_id;

    -- B. Create the User Profile (email column removed to fix the bug)
    INSERT INTO public.profiles (user_id, shop_id, full_name, role)
    VALUES (new.id, new_shop_id, given_name, 'owner');

    -- C. Create User-Shop Mapping
    INSERT INTO public.user_shops (user_id, shop_id, role)
    VALUES (new.id, new_shop_id, 'owner');

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure the trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
