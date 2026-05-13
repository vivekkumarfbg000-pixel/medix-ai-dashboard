-- Hardening Sales Report RPC: Resilience & Multi-Key Support
-- Rationale: Prevent RPC crashes on empty strings, handle key variations, and ensure stable cross-browser date formatting.

CREATE OR REPLACE FUNCTION public.get_sales_report(start_date TEXT, end_date TEXT, query_shop_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
    total_sales NUMERIC;
    total_profit NUMERIC;
    daily_stats JSON;
BEGIN
    -- 1. Security check (is_shop_member is defined in public)
    IF NOT public.is_shop_member(query_shop_id) THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    -- 2. Calculate Aggregates
    SELECT 
        COALESCE(SUM(total_amount), 0),
        COALESCE(SUM(
            (SELECT SUM(
                (
                    COALESCE(NULLIF(item->>'price', '')::NUMERIC, 0) - 
                    COALESCE(NULLIF(COALESCE(item->>'purchase_price', item->>'cost_price'), ''), '0')::NUMERIC
                ) * 
                COALESCE(NULLIF(item->>'qty', '')::NUMERIC, 1)
            )
            FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(order_items) = 'array' THEN order_items ELSE '[]'::jsonb END
            ) AS item)
        ), 0)
    INTO total_sales, total_profit
    FROM public.orders 
    WHERE shop_id = query_shop_id 
      AND status IN ('approved', 'completed', 'paid')
      AND created_at >= start_date::TIMESTAMPTZ 
      AND created_at <= end_date::TIMESTAMPTZ;

    -- 3. Daily Breakdown (standardized DATE output)
    SELECT json_agg(t) INTO daily_stats FROM (
        SELECT 
            date_trunc('day', created_at)::DATE::TEXT AS date, 
            COUNT(*) AS order_count, 
            SUM(total_amount) AS sales,
            SUM(
                (SELECT SUM(
                    (
                        COALESCE(NULLIF(item->>'price', '')::NUMERIC, 0) - 
                        COALESCE(NULLIF(COALESCE(item->>'purchase_price', item->>'cost_price'), ''), '0')::NUMERIC
                    ) * 
                    COALESCE(NULLIF(item->>'qty', '')::NUMERIC, 1)
                )
                FROM jsonb_array_elements(
                    CASE WHEN jsonb_typeof(order_items) = 'array' THEN order_items ELSE '[]'::jsonb END
                ) AS item)
            ) AS profit
        FROM public.orders 
        WHERE shop_id = query_shop_id 
          AND status IN ('approved', 'completed', 'paid')
          AND created_at >= start_date::TIMESTAMPTZ 
          AND created_at <= end_date::TIMESTAMPTZ
        GROUP BY 1 
        ORDER BY 1
    ) t;

    RETURN json_build_object(
        'total_sales', total_sales,
        'total_profit', total_profit,
        'sales_by_date', COALESCE(daily_stats, '[]'::JSON)
    );
END;
$$;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_sales_report(TEXT, TEXT, UUID) TO authenticated;
