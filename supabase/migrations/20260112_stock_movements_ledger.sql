-- Create enum for movement types
CREATE TYPE public.stock_movement_type AS ENUM ('IN', 'OUT', 'SALE', 'RETURN', 'ADJUSTMENT', 'EXPIRED', 'DAMAGE');

-- Create stock_movements table
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL, -- Storing signed values (+ for IN, - for OUT) recommended for easy summation
  movement_type public.stock_movement_type NOT NULL,
  reason TEXT,
  batch_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- Enable RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their shop stock movements" ON public.stock_movements
  FOR SELECT USING (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can create stock movements for their shop" ON public.stock_movements
  FOR INSERT WITH CHECK (shop_id = public.get_user_shop_id());

-- Indexes for performance
CREATE INDEX idx_stock_movements_shop_id ON public.stock_movements(shop_id);
CREATE INDEX idx_stock_movements_inventory_id ON public.stock_movements(inventory_id);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at);
