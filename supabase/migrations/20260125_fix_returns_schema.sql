-- Fix Purchase Returns Schema to support Manual Returns
-- Ensures compatibility between 'basic' and 'expiry' migration versions

DO $$ 
BEGIN 
    -- 1. Ensure 'supplier_name' exists (for ad-hoc returns without ID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_returns' AND column_name = 'supplier_name') THEN 
        ALTER TABLE public.purchase_returns ADD COLUMN supplier_name TEXT; 
    END IF;

    -- 2. Ensure 'total_estimated_value' exists (frontend uses this)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_returns' AND column_name = 'total_estimated_value') THEN 
        ALTER TABLE public.purchase_returns ADD COLUMN total_estimated_value NUMERIC(10, 2) DEFAULT 0; 
    END IF;

    -- 3. Ensure 'status' defaults to 'draft' if not set
    ALTER TABLE public.purchase_returns ALTER COLUMN status SET DEFAULT 'draft';

END $$;
