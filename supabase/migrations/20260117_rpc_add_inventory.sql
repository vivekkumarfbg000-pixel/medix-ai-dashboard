-- Secure RPC to add inventory (Bypassing complex RLS policies for reliability)
CREATE OR REPLACE FUNCTION public.add_inventory_secure(
    p_shop_id UUID,
    p_medicine_name TEXT,
    p_quantity INTEGER,
    p_unit_price DECIMAL,
    p_batch_number TEXT DEFAULT NULL,
    p_expiry_date DATE DEFAULT NULL,
    p_manufacturer TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_generic_name TEXT DEFAULT NULL,
    p_rack_number TEXT DEFAULT NULL,
    p_shelf_number TEXT DEFAULT NULL,
    p_gst_rate DECIMAL DEFAULT 0,
    p_hsn_code TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated permissions (Bypasses RLS)
AS $$
DECLARE
    v_inventory_id UUID;
    v_is_shop_owner_or_member BOOLEAN;
BEGIN
    -- 1. Verify Permission (Manual Check instead of RLS)
    -- Allow if user is adding to a shop they are linked to via user_shops OR if they are the owner
    SELECT EXISTS (
        SELECT 1 FROM public.user_shops WHERE user_id = auth.uid() AND shop_id = p_shop_id
        UNION
        SELECT 1 FROM public.shops WHERE id = p_shop_id AND owner_id = auth.uid()
    ) INTO v_is_shop_owner_or_member;

    IF NOT v_is_shop_owner_or_member THEN
        RAISE EXCEPTION 'Access Denied: You do not have permission to add inventory to this shop.';
    END IF;

    -- 2. Validate Shop Exists
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
        RAISE EXCEPTION 'Invalid Shop ID';
    END IF;

    -- 3. Insert Verified Data
    INSERT INTO public.inventory (
        shop_id,
        medicine_name,
        quantity,
        unit_price,
        batch_number,
        expiry_date,
        manufacturer,
        category,
        generic_name,
        rack_number,
        shelf_number,
        gst_rate,
        hsn_code,
        source
    ) VALUES (
        p_shop_id,
        p_medicine_name,
        p_quantity,
        p_unit_price,
        p_batch_number,
        p_expiry_date,
        p_manufacturer,
        p_category,
        p_generic_name,
        p_rack_number,
        p_shelf_number,
        p_gst_rate,
        p_hsn_code,
        p_source
    ) RETURNING id INTO v_inventory_id;

    RETURN jsonb_build_object('success', true, 'id', v_inventory_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
