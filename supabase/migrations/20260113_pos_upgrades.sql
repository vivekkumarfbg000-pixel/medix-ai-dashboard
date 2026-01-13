-- 1. Sales Returns Table
CREATE TABLE IF NOT EXISTS public.sales_returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    original_order_id UUID REFERENCES public.orders(id),
    customer_id UUID REFERENCES public.customers(id),
    return_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    total_refund_amount NUMERIC DEFAULT 0,
    reason TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Return Items (Linked to Inventory for Stock Re-entry)
CREATE TABLE IF NOT EXISTS public.sales_return_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES public.inventory(id),
    medicine_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    refund_price NUMERIC DEFAULT 0, -- Unit price at time of return
    restock BOOLEAN DEFAULT TRUE,   -- Should this item go back to shelf? (False if damaged)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Customer Ledger (For Credit Sales / Udhaar)
CREATE TABLE IF NOT EXISTS public.customer_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    transaction_type TEXT CHECK (transaction_type IN ('DEBIT', 'CREDIT')), -- DEBIT = Udhaar (Owe more), CREDIT = Payment (Owe less)
    amount NUMERIC NOT NULL,
    reference_id UUID, -- Order ID or Payment ID
    description TEXT,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view returns for their shop" ON public.sales_returns
    FOR SELECT USING (shop_id IN (SELECT shop_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert returns for their shop" ON public.sales_returns
    FOR INSERT WITH CHECK (shop_id IN (SELECT shop_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view ledger for their shop" ON public.customer_ledger
    FOR SELECT USING (shop_id IN (SELECT shop_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert ledger for their shop" ON public.customer_ledger
    FOR INSERT WITH CHECK (shop_id IN (SELECT shop_id FROM public.profiles WHERE id = auth.uid()));

-- 5. Helper RPC to Process Return (Stock Adjustment + Refund)
CREATE OR REPLACE FUNCTION process_sales_return(
    p_shop_id UUID,
    p_order_id UUID,
    p_items JSONB, -- Array of {inventory_id, quantity, price, restock}
    p_total_refund NUMERIC
) RETURNS UUID AS $$
DECLARE
    v_return_id UUID;
    v_item JSONB;
BEGIN
    -- Create Return Record
    INSERT INTO public.sales_returns (shop_id, original_order_id, total_refund_amount, status)
    VALUES (p_shop_id, p_order_id, p_total_refund, 'completed')
    RETURNING id INTO v_return_id;

    -- Process Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Insert Return Item
        INSERT INTO public.sales_return_items (return_id, inventory_id, medicine_name, quantity, refund_price, restock)
        VALUES (
            v_return_id, 
            (v_item->>'inventory_id')::UUID, 
            v_item->>'medicine_name', 
            (v_item->>'quantity')::INT, 
            (v_item->>'price')::NUMERIC, 
            (v_item->>'restock')::BOOLEAN
        );

        -- Restock Inventory if needed
        IF (v_item->>'restock')::BOOLEAN AND (v_item->>'inventory_id') IS NOT NULL THEN
            UPDATE public.inventory
            SET quantity = quantity + (v_item->>'quantity')::INT
            WHERE id = (v_item->>'inventory_id')::UUID;
        END IF;
    END LOOP;

    RETURN v_return_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
