-- Create Suppliers Table
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Purchases Table (Inward Invoice)
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    invoice_number TEXT,
    invoice_date DATE DEFAULT CURRENT_DATE,
    total_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Purchase Items Table
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    medicine_name TEXT NOT NULL, -- Snapshot incase inventory item is deleted
    batch_number TEXT,
    expiry_date DATE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    purchase_price NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies

-- Suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view suppliers from their shop" 
ON public.suppliers FOR SELECT 
USING (shop_id IN (
    SELECT shop_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can insert suppliers for their shop" 
ON public.suppliers FOR INSERT 
WITH CHECK (shop_id IN (
    SELECT shop_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can update suppliers from their shop" 
ON public.suppliers FOR UPDATE 
USING (shop_id IN (
    SELECT shop_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can delete suppliers from their shop" 
ON public.suppliers FOR DELETE 
USING (shop_id IN (
    SELECT shop_id FROM public.profiles WHERE id = auth.uid()
));

-- Purchases
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchases from their shop" 
ON public.purchases FOR SELECT 
USING (shop_id IN (
    SELECT shop_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can insert purchases for their shop" 
ON public.purchases FOR INSERT 
WITH CHECK (shop_id IN (
    SELECT shop_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can update purchases from their shop" 
ON public.purchases FOR UPDATE 
USING (shop_id IN (
    SELECT shop_id FROM public.profiles WHERE id = auth.uid()
));

-- Purchase Items
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchase items from their shop" 
ON public.purchase_items FOR SELECT 
USING (
    purchase_id IN (
        SELECT id FROM public.purchases WHERE shop_id IN (
            SELECT shop_id FROM public.profiles WHERE id = auth.uid()
        )
    )
);

CREATE POLICY "Users can insert purchase items for their shop" 
ON public.purchase_items FOR INSERT 
WITH CHECK (
    purchase_id IN (
        SELECT id FROM public.purchases WHERE shop_id IN (
            SELECT shop_id FROM public.profiles WHERE id = auth.uid()
        )
    )
);

-- Indexes for performance
CREATE INDEX idx_suppliers_shop_id ON public.suppliers(shop_id);
CREATE INDEX idx_purchases_shop_id ON public.purchases(shop_id);
CREATE INDEX idx_purchases_supplier_id ON public.purchases(supplier_id);
CREATE INDEX idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);
