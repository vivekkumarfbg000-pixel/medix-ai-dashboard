CREATE OR REPLACE FUNCTION get_sales_report(
  start_date text,
  end_date text,
  query_shop_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_sales numeric := 0;
  total_profit numeric := 0;
  daily_stats json;
BEGIN
  -- 1. Calculate Aggregates
  -- We now use the 'purchase_price' embedded in the JSONB order_items for accurate historical profit
  SELECT 
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(
      (
        SELECT SUM(
          (COALESCE((item->>'price')::numeric, 0) - COALESCE((item->>'purchase_price')::numeric, 0)) * COALESCE((item->>'qty')::numeric, 1)
        )
        FROM jsonb_array_elements(order_items) AS item
      )
    ), 0)
  INTO total_sales, total_profit
  FROM orders
  WHERE shop_id = query_shop_id
    AND created_at >= start_date::timestamp
    AND created_at <= end_date::timestamp
    AND status = 'approved'; -- Only count approved sales

  -- 2. Daily Breakdown
  SELECT json_agg(day_data)
  INTO daily_stats
  FROM (
    SELECT 
      date_trunc('day', created_at) as date,
      COUNT(*) as order_count,
      COALESCE(SUM(total_amount), 0) as sales,
      COALESCE(SUM(
        (
          SELECT SUM(
            (COALESCE((item->>'price')::numeric, 0) - COALESCE((item->>'purchase_price')::numeric, 0)) * COALESCE((item->>'qty')::numeric, 1)
          )
          FROM jsonb_array_elements(order_items) AS item
        )
      ), 0) as profit
    FROM orders
    WHERE shop_id = query_shop_id
      AND created_at >= start_date::timestamp
      AND created_at <= end_date::timestamp
      AND status = 'approved'
    GROUP BY 1
    ORDER BY 1
  ) day_data;

  RETURN json_build_object(
    'total_sales', total_sales,
    'total_profit', total_profit,
    'sales_by_date', COALESCE(daily_stats, '[]'::json)
  );
END;
$$;
