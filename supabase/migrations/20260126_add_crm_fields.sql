-- Add CRM fields to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tags TEXT[]; -- Array of strings

-- Index for tags might be useful later
CREATE INDEX IF NOT EXISTS idx_customers_tags ON public.customers USING GIN (tags);
