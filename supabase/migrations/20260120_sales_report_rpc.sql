-- Financial Analytics: Sales & Profit Report
-- Returns aggregated sales, profit, and daily breakdown for a given date range.

create or replace function get_sales_report(
  start_date text,
  end_date text,
  query_shop_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  total_sales numeric := 0;
  total_profit numeric := 0;
  daily_stats json;
begin
  -- 1. Calculate Total Sales & Profit
  -- We sum up the total_amount for sales
  -- For profit, we iterate through order_items jsonb
  
  -- Note: Profit calculation relies on 'purchase_price' finding its way into order_items.
  -- For old orders without 'purchase_price', profit will be 0 (fallback).

  select 
    coalesce(sum(total_amount), 0),
    coalesce(sum(
      (
        select sum(
          (coalesce((item->>'price')::numeric, 0) - coalesce((item->>'purchase_price')::numeric, 0)) * 
          coalesce((item->>'qty')::numeric, 0)
        )
        from jsonb_array_elements(order_items) as item
      )
    ), 0)
  into total_sales, total_profit
  from orders
  where shop_id = query_shop_id
    and status = 'approved'
    and created_at >= start_date::timestamp
    and created_at <= end_date::timestamp;

  -- 2. Daily Breakdown
  select json_agg(t) into daily_stats
  from (
    select
      date_trunc('day', created_at)::text as date,
      count(*) as order_count,
      sum(total_amount) as sales,
      sum(
        (
          select sum(
            (coalesce((item->>'price')::numeric, 0) - coalesce((item->>'purchase_price')::numeric, 0)) * 
            coalesce((item->>'qty')::numeric, 0)
          )
          from jsonb_array_elements(order_items) as item
        )
      ) as profit
    from orders
    where shop_id = query_shop_id
      and status = 'approved'
      and created_at >= start_date::timestamp
      and created_at <= end_date::timestamp
    group by date_trunc('day', created_at)
    order by date_trunc('day', created_at)
  ) t;

  return json_build_object(
    'total_sales', total_sales,
    'total_profit', total_profit,
    'sales_by_date', coalesce(daily_stats, '[]'::json)
  );
end;
$$;
