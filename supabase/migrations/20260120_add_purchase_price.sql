-- Financial Analytics: Add purchase_price column and update RPCs

-- 1. Add column if it makes sense (using safe alter)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'purchase_price') THEN
        ALTER TABLE inventory ADD COLUMN purchase_price numeric DEFAULT 0;
    END IF;
END $$;

-- 2. Update the Secure Add RPC to accept purchase_price
CREATE OR REPLACE FUNCTION add_inventory_secure(
    p_shop_id uuid,
    p_medicine_name text,
    p_quantity integer,
    p_unit_price numeric,
    p_batch_number text default null,
    p_expiry_date date default null,
    p_manufacturer text default null,
    p_category text default null,
    p_generic_name text default null,
    p_rack_number text default null,
    p_shelf_number text default null,
    p_gst_rate numeric default 0,
    p_hsn_code text default null,
    p_source text default 'manual',
    p_purchase_price numeric default 0 -- NEW PARAMETER
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id uuid;
BEGIN
    -- Basic validation
    IF p_quantity < 0 THEN
        RETURN json_build_object('success', false, 'error', 'Quantity cannot be negative');
    END IF;

    INSERT INTO inventory (
        shop_id, medicine_name, quantity, unit_price, batch_number, 
        expiry_date, manufacturer, category, generic_name, 
        rack_number, shelf_number, gst_rate, hsn_code, source, purchase_price
    ) VALUES (
        p_shop_id, p_medicine_name, p_quantity, p_unit_price, p_batch_number, 
        p_expiry_date, p_manufacturer, p_category, p_generic_name, 
        p_rack_number, p_shelf_number, p_gst_rate, p_hsn_code, p_source, p_purchase_price
    ) RETURNING id INTO new_id;

    RETURN json_build_object('success', true, 'id', new_id);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
