-- Add Payment Columns to Sales Table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'upi', 'card', 'credit')),
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'partial', 'cancelled'));

-- Add Index for Reporting Performance
CREATE INDEX IF NOT EXISTS idx_sales_payment_mode ON public.sales(payment_mode);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON public.sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);
