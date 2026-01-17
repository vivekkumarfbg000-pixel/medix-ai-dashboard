-- AI Cross-Selling Engine: Get Frequently Bought Together Items
-- Returns top 5 items often purchased with the scanned medicine
-- Analyzes JSONB order_items history

CREATE OR REPLACE FUNCTION get_frequently_bought_together(
    scan_medicine_name TEXT, 
    query_shop_id UUID
)
RETURNS TABLE (
    medicine_name TEXT,
    frequency BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH matching_orders AS (
        -- Find all orders that contain the scanned medicine
        -- We use a text search on the JSONB representation for speed, 
        -- assuming 'name' field exists in the objects.
        SELECT order_items
        FROM orders
        WHERE shop_id = query_shop_id
          AND order_items::text ILIKE '%' || scan_medicine_name || '%'
    ),
    all_items AS (
        -- Unnest the JSONB array to get individual items from these orders
        SELECT jsonb_array_elements(order_items) ->> 'name' as item_name
        FROM matching_orders
    )
    SELECT 
        item_name as medicine_name,
        count(*) as frequency
    FROM all_items
    WHERE 
        -- Filter out the item itself (case insensitive check)
        NOT (item_name ILIKE scan_medicine_name)
        AND item_name IS NOT NULL
    GROUP BY item_name
    ORDER BY frequency DESC
    LIMIT 5;
END;
$$;
