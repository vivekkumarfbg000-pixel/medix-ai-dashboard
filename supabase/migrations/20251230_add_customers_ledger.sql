-- Create customers table with Credit Balance
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    credit_balance DECIMAL(10,2) DEFAULT 0, -- Positive means they owe money
    credit_limit DECIMAL(10,2) DEFAULT 5000, -- Max Udhaar allowed
    total_visits INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(shop_id, phone)
);

-- Create ledger for detailed history
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL, -- Positive = User took debt, Negative = User paid
    transaction_type TEXT NOT NULL, -- 'purchase', 'payment', 'adjustment'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their shop customers" ON public.customers
  FOR SELECT USING (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can manage their shop customers" ON public.customers
  FOR ALL USING (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can view their shop ledger" ON public.ledger_entries
  FOR SELECT USING (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can manage their shop ledger" ON public.ledger_entries
  FOR ALL USING (shop_id = public.get_user_shop_id());

-- Helper Function to update customer balance automatically
CREATE OR REPLACE FUNCTION public.update_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.customers
    SET credit_balance = credit_balance + NEW.amount,
        updated_at = now()
    WHERE id = NEW.customer_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_ledger_entry
    AFTER INSERT ON public.ledger_entries
    FOR EACH ROW EXECUTE FUNCTION public.update_credit_balance();
