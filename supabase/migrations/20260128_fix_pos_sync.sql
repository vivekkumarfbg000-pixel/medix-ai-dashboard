-- RPC to safely decrement stock during POS checkout
CREATE OR REPLACE FUNCTION public.decrement_stock(row_id UUID, amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.inventory
  SET quantity = quantity - amount,
      is_synced = 0
  WHERE id = row_id;
END;
$$;
