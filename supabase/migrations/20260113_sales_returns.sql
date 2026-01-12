-- Create sales_returns table
CREATE TABLE IF NOT EXISTS public.sales_returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    return_date TIMESTAMPTZ DEFAULT NOW(),
    total_refund_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sales_return_items table
CREATE TABLE IF NOT EXISTS public.sales_return_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    return_id UUID REFERENCES public.sales_returns(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    medicine_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    refund_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for own shop returns" ON public.sales_returns
    FOR SELECT USING (auth.uid() IN (
        SELECT user_id FROM user_roles WHERE shop_id = sales_returns.shop_id
    ));

CREATE POLICY "Enable insert access for own shop returns" ON public.sales_returns
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT user_id FROM user_roles WHERE shop_id = sales_returns.shop_id
    ));

CREATE POLICY "Enable read access for return items" ON public.sales_return_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sales_returns sr
            WHERE sr.id = sales_return_items.return_id
            AND auth.uid() IN (
                SELECT user_id FROM user_roles WHERE shop_id = sr.shop_id
            )
        )
    );

CREATE POLICY "Enable insert access for return items" ON public.sales_return_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sales_returns sr
            WHERE sr.id = sales_return_items.return_id
            AND auth.uid() IN (
                SELECT user_id FROM user_roles WHERE shop_id = sr.shop_id
            )
        )
    );

-- Indexing
CREATE INDEX idx_sales_returns_shop_id ON public.sales_returns(shop_id);
CREATE INDEX idx_sales_returns_sale_id ON public.sales_returns(sale_id);
CREATE INDEX idx_return_items_return_id ON public.sales_return_items(return_id);
