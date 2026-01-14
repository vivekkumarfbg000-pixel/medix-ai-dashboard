-- AUTO-PROVISIONING SYSTEM (v3)
-- Rationale: Fixes "column email does not exist" error.

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_shop_id UUID;
    shop_name TEXT;
    given_name TEXT;
BEGIN
    -- Extract metadata
    shop_name := new.raw_user_meta_data->>'shop_name';
    given_name := new.raw_user_meta_data->>'full_name';

    IF shop_name IS NULL OR shop_name = '' THEN
        shop_name := 'My Pharmacy';
    END IF;

    IF given_name IS NULL THEN
        given_name := 'Pharmacist';
    END IF;

    -- 1. Create a new Shop (Including owner_id)
    INSERT INTO public.shops (name, address, phone, owner_id)
    VALUES (shop_name, 'Address Pending', 'Phone Pending', new.id)
    RETURNING id INTO new_shop_id;

    -- 2. Create User Profile - REMOVED 'email' COLUMN
    INSERT INTO public.profiles (user_id, shop_id, full_name, role)
    VALUES (new.id, new_shop_id, given_name, 'owner');

    -- 3. Create User-Shop Mapping
    INSERT INTO public.user_shops (user_id, shop_id, role)
    VALUES (new.id, new_shop_id, 'owner');

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF exists on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
