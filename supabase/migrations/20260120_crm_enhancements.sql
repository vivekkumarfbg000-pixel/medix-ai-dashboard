-- Add CRM fields to Customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Enable search on tags (optional but good practice)
CREATE INDEX IF NOT EXISTS idx_customers_tags ON public.customers USING GIN(tags);
