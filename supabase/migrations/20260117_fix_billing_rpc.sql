-- Function to decrement inventory quantity securely
-- Called by LitePOS.tsx during checkout

CREATE OR REPLACE FUNCTION public.decrement_inventory(row_id UUID, quantity_to_sub INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.inventory
  SET quantity = quantity - quantity_to_sub,
      updated_at = now()
  WHERE id = row_id;
END;
$$;
