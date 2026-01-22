-- ============================================================================
-- FIX: Link 'orders' -> 'sales' for Real-Time Analytics
-- Problem: Web POS writes to 'orders', but Analytics reads 'sales'.
-- Solution: Trigger to auto-insert into 'sales' when order is approved.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_order_to_sales()
RETURNS TRIGGER AS $$
DECLARE
  order_item jsonb;
  inv_id UUID;
  qty INT;
  unit_price NUMERIC;
BEGIN
  -- Only process if status is 'approved' (ignore pending/cancelled)
  IF NEW.status = 'approved' THEN
    
    -- Iterate through each item in the order to record granular sales
    FOR order_item IN SELECT * FROM jsonb_array_elements(NEW.order_items)
    LOOP
      inv_id := (order_item->>'inventory_id')::UUID;
      qty := (order_item->>'qty')::INT;
      unit_price := (order_item->>'price')::NUMERIC;

      -- Insert into sales table
      INSERT INTO public.sales (
        shop_id,
        inventory_id,
        quantity_sold,
        total_amount,
        sale_date,
        customer_name,
        payment_mode,
        payment_status
      ) VALUES (
        NEW.shop_id,
        inv_id,
        qty,
        (qty * unit_price), -- Calulate line item total
        NEW.created_at,
        NEW.customer_name,
        NEW.payment_mode, -- From recent migration
        NEW.payment_status -- From recent migration
      );
    END LOOP;

  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger to ensure it's fresh
DROP TRIGGER IF EXISTS on_order_approved_sync_sales ON public.orders;

CREATE TRIGGER on_order_approved_sync_sales
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_to_sales();
