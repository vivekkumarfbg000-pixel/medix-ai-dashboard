-- Fix schema mismatch for Customers Feature
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0;

-- Ensure RLS policies cover updates to these new columns (existing policies might cover ALL, but good to be safe)
-- (Existing policies were "FOR ALL" so we are good)
