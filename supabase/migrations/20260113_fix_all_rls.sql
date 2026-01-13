-- FIXED SCRIPT (Run this to fix "profiles relation does not exist" error)
-- We are using 'user_shops' table for permissions, not 'profiles'

-- 1. Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    address TEXT,
    credit_period_days INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Purchases
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    invoice_number TEXT,
    invoice_date DATE DEFAULT CURRENT_DATE,
    total_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Purchase Items
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    medicine_name TEXT NOT NULL,
    batch_number TEXT,
    expiry_date DATE,
    quantity INTEGER NOT NULL,
    purchase_price NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Sales Returns
CREATE TABLE IF NOT EXISTS public.sales_returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    original_order_id UUID REFERENCES public.orders(id),
    customer_id UUID REFERENCES public.customers(id),
    return_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    total_refund_amount NUMERIC DEFAULT 0,
    reason TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Sales Return Items
CREATE TABLE IF NOT EXISTS public.sales_return_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES public.inventory(id),
    medicine_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    refund_price NUMERIC DEFAULT 0,
    restock BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Customer Ledger
CREATE TABLE IF NOT EXISTS public.customer_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    transaction_type TEXT CHECK (transaction_type IN ('DEBIT', 'CREDIT')),
    amount NUMERIC NOT NULL,
    description TEXT,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- === FIX RLS POLICIES ===
-- Drop old incorrect policies if they exist
DROP POLICY IF EXISTS "Users can view suppliers from their shop" ON public.suppliers;
DROP POLICY IF EXISTS "Users can insert suppliers for their shop" ON public.suppliers;
-- (Add drops for others if needed, or just standard DROP IF EXISTS is safe)

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;

-- Correct Policy Logic: Check 'user_shops'
-- Policy for Suppliers
CREATE POLICY "Enable access for shop members" ON public.suppliers
    FOR ALL USING (
        shop_id IN (
            SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
        )
    );

-- Policy for Purchases
CREATE POLICY "Enable access for shop members" ON public.purchases
    FOR ALL USING (
        shop_id IN (
            SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
        )
    );

-- Policy for Purchase Items
CREATE POLICY "Enable access for shop members" ON public.purchase_items
    FOR ALL USING (
        purchase_id IN (
            SELECT id FROM public.purchases WHERE shop_id IN (
                SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
            )
        )
    );

-- Policy for Sales Returns
CREATE POLICY "Enable access for shop members" ON public.sales_returns
    FOR ALL USING (
        shop_id IN (
            SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
        )
    );

-- Policy for Sales Return Items
CREATE POLICY "Enable access for shop members" ON public.sales_return_items
    FOR ALL USING (
        return_id IN (
            SELECT id FROM public.sales_returns WHERE shop_id IN (
                SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
            )
        )
    );

-- Policy for Customer Ledger
CREATE POLICY "Enable access for shop members" ON public.customer_ledger
    FOR ALL USING (
        shop_id IN (
            SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid()
        )
    );

-- RPC for Returns
CREATE OR REPLACE FUNCTION process_sales_return(
    p_shop_id UUID,
    p_order_id UUID,
    p_items JSONB, 
    p_total_refund NUMERIC
) RETURNS UUID AS $$
DECLARE
    v_return_id UUID;
    v_item JSONB;
BEGIN
    INSERT INTO public.sales_returns (shop_id, original_order_id, total_refund_amount, status)
    VALUES (p_shop_id, p_order_id, p_total_refund, 'completed')
    RETURNING id INTO v_return_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.sales_return_items (return_id, inventory_id, medicine_name, quantity, refund_price, restock)
        VALUES (
            v_return_id, 
            (v_item->>'inventory_id')::UUID, 
            v_item->>'medicine_name', 
            (v_item->>'quantity')::INT, 
            (v_item->>'price')::NUMERIC, 
            (v_item->>'restock')::BOOLEAN
        );

        IF (v_item->>'restock')::BOOLEAN AND (v_item->>'inventory_id') IS NOT NULL THEN
            UPDATE public.inventory
            SET quantity = quantity + (v_item->>'quantity')::INT
            WHERE id = (v_item->>'inventory_id')::UUID;
        END IF;
    END LOOP;

    RETURN v_return_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
