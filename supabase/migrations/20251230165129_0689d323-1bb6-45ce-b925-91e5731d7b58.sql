-- Create customers table for Smart Khata feature
CREATE TABLE public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    credit_balance NUMERIC DEFAULT 0,
    total_spent NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create prescriptions table for Digital Parchas
CREATE TABLE public.prescriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_name TEXT,
    doctor_name TEXT,
    visit_date DATE,
    medicines JSONB DEFAULT '[]'::jsonb,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create restock_predictions table for AI forecasting
CREATE TABLE public.restock_predictions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    current_stock INTEGER DEFAULT 0,
    avg_daily_sales NUMERIC DEFAULT 0,
    predicted_quantity INTEGER NOT NULL,
    confidence_score NUMERIC DEFAULT 0.8,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory_staging table for AI-scanned items
CREATE TABLE public.inventory_staging (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    batch_number TEXT,
    expiry_date TEXT,
    quantity INTEGER DEFAULT 0,
    unit_price NUMERIC DEFAULT 0,
    source TEXT DEFAULT 'ai_scan',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ledger_entries table for customer credit tracking (Udhaar)
CREATE TABLE public.ledger_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    transaction_type TEXT NOT NULL, -- 'purchase', 'payment', 'adjustment'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create retry_queue table for system health monitoring
CREATE TABLE public.retry_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    payload JSONB,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retry_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Users can view their shop customers" ON public.customers FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Users can create customers for their shop" ON public.customers FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Users can update their shop customers" ON public.customers FOR UPDATE USING (shop_id = get_user_shop_id());
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE USING (shop_id = get_user_shop_id() AND can_modify(auth.uid(), shop_id));

-- RLS Policies for prescriptions
CREATE POLICY "Users can view their shop prescriptions" ON public.prescriptions FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Users can create prescriptions for their shop" ON public.prescriptions FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
CREATE POLICY "Users can update their shop prescriptions" ON public.prescriptions FOR UPDATE USING (shop_id = get_user_shop_id());

-- RLS Policies for restock_predictions
CREATE POLICY "Users can view their shop predictions" ON public.restock_predictions FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Users can manage their shop predictions" ON public.restock_predictions FOR ALL USING (shop_id = get_user_shop_id());

-- RLS Policies for inventory_staging
CREATE POLICY "Users can view their shop staging items" ON public.inventory_staging FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Users can manage their shop staging items" ON public.inventory_staging FOR ALL USING (shop_id = get_user_shop_id());

-- RLS Policies for ledger_entries
CREATE POLICY "Users can view their shop ledger" ON public.ledger_entries FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Users can create ledger entries" ON public.ledger_entries FOR INSERT WITH CHECK (shop_id = get_user_shop_id());

-- RLS Policies for retry_queue
CREATE POLICY "Users can view their shop retry queue" ON public.retry_queue FOR SELECT USING (shop_id = get_user_shop_id());
CREATE POLICY "Users can manage their shop retry queue" ON public.retry_queue FOR ALL USING (shop_id = get_user_shop_id());

-- Add missing columns to orders table for GST compliance
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_total NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Create indexes for performance
CREATE INDEX idx_customers_shop_id ON public.customers(shop_id);
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_prescriptions_shop_id ON public.prescriptions(shop_id);
CREATE INDEX idx_restock_predictions_shop_id ON public.restock_predictions(shop_id);
CREATE INDEX idx_inventory_staging_shop_id ON public.inventory_staging(shop_id);
CREATE INDEX idx_inventory_staging_status ON public.inventory_staging(status);
CREATE INDEX idx_ledger_entries_customer_id ON public.ledger_entries(customer_id);
CREATE INDEX idx_retry_queue_status ON public.retry_queue(status);