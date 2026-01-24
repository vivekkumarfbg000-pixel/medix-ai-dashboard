-- Fix for "Could not find table public.order_items in schema cache" logic
-- This usually means RLS is enabled but no policy allows access

-- 1. Ensure Table Exists (Safety)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES public.inventory(id),
    name TEXT NOT NULL,
    qty INTEGER NOT NULL,
    price NUMERIC NOT NULL,
    cost_price NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 3. Drop old policies to prevent conflicts
DROP POLICY IF EXISTS "Enable access for shop members" ON public.order_items;
DROP POLICY IF EXISTS "Users can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert order items" ON public.order_items;

-- 4. Create Policies

-- SELECT: Allow if user has access to the parent order
CREATE POLICY "Users can view order items" ON public.order_items
FOR SELECT USING (
    order_id IN (
        SELECT id FROM public.orders 
        WHERE shop_id IN (
            SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
        )
    )
);

-- INSERT: Allow if user has access to the parent order
-- Note: This subquery check works because the order is usually inserted first in the transaction
CREATE POLICY "Users can insert order items" ON public.order_items
FOR INSERT WITH CHECK (
    order_id IN (
        SELECT id FROM public.orders 
        WHERE shop_id IN (
            SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
        )
    )
);

-- UPDATE/DELETE: Same as SELECT
CREATE POLICY "Users can modify order items" ON public.order_items
FOR UPDATE USING (
    order_id IN (
        SELECT id FROM public.orders 
        WHERE shop_id IN (
            SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can delete order items" ON public.order_items
FOR DELETE USING (
    order_id IN (
        SELECT id FROM public.orders 
        WHERE shop_id IN (
            SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
        )
    )
);

-- 5. Notify PostgREST to reload schema cache (just in case)
NOTIFY pgrst, 'reload schema';
