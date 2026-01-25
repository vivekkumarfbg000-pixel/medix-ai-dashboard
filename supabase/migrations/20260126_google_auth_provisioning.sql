-- ENHANCED AUTO-PROVISIONING SYSTEM (Google Auth Support)
-- Rationale: Ensures users signing up via Google get a Shop assigned automatically.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_shop_id UUID;
    final_shop_name TEXT;
    final_user_name TEXT;
BEGIN
    -- 1. Extract Details with Fallbacks for Google Auth
    final_shop_name := COALESCE(
        new.raw_user_meta_data->>'shop_name', 
        'My Medical Shop'
    );
    
    final_user_name := COALESCE(
        new.raw_user_meta_data->>'full_name', 
        new.raw_user_meta_data->>'name', 
        new.raw_user_meta_data->>'user_name',
        'Pharmacist'
    );

    -- 2. Create Shop
    INSERT INTO public.shops (name, address, phone, owner_id)
    VALUES (final_shop_name, 'Update Address', 'Update Phone', new.id)
    RETURNING id INTO new_shop_id;

    -- 3. Create Profile (Safe Insert)
    INSERT INTO public.profiles (user_id, shop_id, full_name, role)
    VALUES (new.id, new_shop_id, final_user_name, 'owner')
    ON CONFLICT (user_id) DO UPDATE 
    SET shop_id = EXCLUDED.shop_id, full_name = EXCLUDED.full_name;

    -- 4. Create User-Shop Link
    INSERT INTO public.user_shops (user_id, shop_id, role)
    VALUES (new.id, new_shop_id, 'owner')
    ON CONFLICT DO NOTHING;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure Trigger is Active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
