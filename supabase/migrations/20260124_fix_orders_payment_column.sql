-- Fix missing columns in orders table for LitePOS
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid';

-- Add safe check constraints (optional but good for data integrity)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_mode_check') THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_payment_mode_check 
        CHECK (payment_mode IN ('cash', 'online', 'credit', 'upi', 'card'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check') THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
        CHECK (payment_status IN ('paid', 'pending', 'partial', 'cancelled'));
    END IF;
END $$;
