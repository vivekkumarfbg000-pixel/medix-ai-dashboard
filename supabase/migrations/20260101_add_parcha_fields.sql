-- Add missing columns to prescriptions table for N8N 'Record Parcha' node compatibility
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Update RLS policies (optional, but good practice if new columns need specific protection, though existing table policies usually cover rows)
-- No changes needed for row-level permissions if the existing policies cover the table generally.
