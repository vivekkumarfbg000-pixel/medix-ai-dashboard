-- Create Purchase Returns Table (Debit Notes)
CREATE TABLE IF NOT EXISTS public.purchase_returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    return_date DATE DEFAULT CURRENT_DATE,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    reason TEXT,
    status TEXT DEFAULT 'completed', -- completed, draft
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Purchase Return Items Table
CREATE TABLE IF NOT EXISTS public.purchase_return_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    return_id UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    medicine_name TEXT NOT NULL,
    batch_number TEXT,
    expiry_date DATE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    refund_price NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Price per unit being refunded
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchase returns from their shop" 
ON public.purchase_returns FOR SELECT 
USING (shop_id IN (
    SELECT shop_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can insert purchase returns for their shop" 
ON public.purchase_returns FOR INSERT 
WITH CHECK (shop_id IN (
    SELECT shop_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can view purchase return items from their shop" 
ON public.purchase_return_items FOR SELECT 
USING (
    return_id IN (
        SELECT id FROM public.purchase_returns WHERE shop_id IN (
            SELECT shop_id FROM public.profiles WHERE id = auth.uid()
        )
    )
);

CREATE POLICY "Users can insert purchase return items for their shop" 
ON public.purchase_return_items FOR INSERT 
WITH CHECK (
    return_id IN (
        SELECT id FROM public.purchase_returns WHERE shop_id IN (
            SELECT shop_id FROM public.profiles WHERE id = auth.uid()
        )
    )
);

-- Indexes
CREATE INDEX idx_purchase_returns_shop_id ON public.purchase_returns(shop_id);
CREATE INDEX idx_purchase_returns_supplier_id ON public.purchase_returns(supplier_id);
CREATE INDEX idx_purchase_return_items_return_id ON public.purchase_return_items(return_id);

-- RPC to Process Purchase Return (Atomic)
CREATE OR REPLACE FUNCTION public.process_purchase_return(
  p_return_data JSONB,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_return_id UUID;
  v_item JSONB;
  v_shop_id UUID;
BEGIN
  -- Extract shop_id from the first item or pass it in? 
  -- Better to extract from p_return_data
  v_shop_id := (p_return_data->>'shop_id')::UUID;
  
  -- Security Check
  IF v_shop_id IS DISTINCT FROM public.get_user_shop_id() THEN
     RETURN jsonb_build_object('success', false, 'error', 'Unauthorized shop access');
  END IF;

  -- 1. Create Return Record
  INSERT INTO public.purchase_returns (
    shop_id,
    supplier_id,
    total_amount,
    reason,
    return_date,
    status
  ) VALUES (
    v_shop_id,
    (p_return_data->>'supplier_id')::UUID,
    (p_return_data->>'total_amount')::NUMERIC,
    p_return_data->>'reason',
    (p_return_data->>'return_date')::DATE,
    'completed'
  ) RETURNING id INTO v_return_id;

  -- 2. Process Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
      -- Insert Item
      INSERT INTO public.purchase_return_items (
        return_id,
        inventory_id,
        medicine_name,
        batch_number,
        quantity,
        refund_price
      ) VALUES (
        v_return_id,
        (v_item->>'inventory_id')::UUID,
        v_item->>'medicine_name',
        v_item->>'batch_number',
        (v_item->>'quantity')::INTEGER,
        (v_item->>'refund_price')::NUMERIC
      );

      -- Deduct Stock (CALL adjust_inventory_stock)
      -- This is a 'Return Out', so we DEDUCT stock.
      PERFORM public.adjust_inventory_stock(
        (v_item->>'inventory_id')::UUID,
        -(v_item->>'quantity')::INTEGER, -- Negative for deduction
        'OUT',
        'Purchase Return / Debit Note',
        v_item->>'batch_number'
      );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'return_id', v_return_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
