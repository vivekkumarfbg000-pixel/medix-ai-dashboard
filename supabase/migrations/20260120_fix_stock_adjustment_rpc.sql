-- FIX: Stock Adjustment RPC Multi-Shop Bug
-- Previous version relied on `get_user_shop_id()` which only returns the FIRST shop.
-- This version checks if the user has access to the SPECFIC shop owning the item.

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
  p_inventory_id UUID,
  p_quantity_change INTEGER,
  p_movement_type public.stock_movement_type,
  p_reason TEXT DEFAULT NULL,
  p_batch_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shop_id UUID;
  v_current_qty INTEGER;
  v_new_qty INTEGER;
  v_has_access BOOLEAN;
BEGIN
  -- 1. Get current item and lock row
  SELECT shop_id, quantity INTO v_shop_id, v_current_qty
  FROM public.inventory
  WHERE id = p_inventory_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found');
  END IF;

  -- 2. Verify Shop Access (Robust Multi-Shop Check)
  SELECT EXISTS (
    SELECT 1 FROM public.user_shops 
    WHERE user_id = auth.uid() AND shop_id = v_shop_id
    UNION
    SELECT 1 FROM public.shops 
    WHERE id = v_shop_id AND owner_id = auth.uid()
  ) INTO v_has_access;

  IF NOT v_has_access THEN
     RETURN jsonb_build_object('success', false, 'error', 'Unauthorized access to shop inventory');
  END IF;

  -- 3. Calculate new quantity
  v_new_qty := v_current_qty + p_quantity_change;

  IF v_new_qty < 0 THEN
     RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock');
  END IF;

  -- 4. Update Inventory
  UPDATE public.inventory
  SET quantity = v_new_qty,
      updated_at = now()
  WHERE id = p_inventory_id;

  -- 5. Log Movement
  INSERT INTO public.stock_movements (
    shop_id,
    inventory_id,
    quantity,
    movement_type,
    reason,
    batch_number
  ) VALUES (
    v_shop_id,
    p_inventory_id,
    p_quantity_change,
    p_movement_type,
    p_reason,
    p_batch_number
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_quantity', v_new_qty
  );
END;
$$;
