-- Add doctor_name to orders table (H1 Requirement)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS doctor_name TEXT;

-- Index it for faster lookup if reporting needs it
CREATE INDEX IF NOT EXISTS idx_orders_doctor_name ON public.orders(doctor_name);
