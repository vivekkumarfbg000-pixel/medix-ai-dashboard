-- Add Patient Management fields to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS medical_history JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS last_consultation TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS allergies TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Format for medical_history JSONB:
-- [
--   { "date": "2024-01-01", "note": "Reported fever", "medicines": ["Dolo"], "doctor": "Dr. AI" }
-- ]
