-- Create global_catalogs table for the Master Medicine Database
CREATE TABLE IF NOT EXISTS public.global_catalogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_name TEXT NOT NULL,
    generic_name TEXT,
    manufacturer TEXT,
    composition TEXT, -- Salt composition
    category TEXT,
    mrp DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast text search
CREATE INDEX IF NOT EXISTS idx_global_catalogs_name ON public.global_catalogs USING gin(to_tsvector('english', medicine_name));
CREATE INDEX IF NOT EXISTS idx_global_catalogs_generic ON public.global_catalogs USING gin(to_tsvector('english', generic_name));

-- Enable RLS
ALTER TABLE public.global_catalogs ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone (authenticated) can view
CREATE POLICY "authenticated_view_global" ON public.global_catalogs
FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Only admins/service_role can insert (Prevent user pollution)
-- (Users can't insert by default unless we add a policy, so this is safe)


-- RPC Function for Search (to be used by Marketplace.tsx)
CREATE OR REPLACE FUNCTION public.search_global_medicines(search_term TEXT)
RETURNS TABLE (
    id UUID,
    medicine_name TEXT,
    generic_name TEXT,
    manufacturer TEXT,
    mrp DECIMAL,
    similarity_score REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gc.id,
        gc.medicine_name,
        gc.generic_name,
        gc.manufacturer,
        gc.mrp,
        similarity(gc.medicine_name, search_term)::REAL as similarity_score
    FROM public.global_catalogs gc
    WHERE 
        gc.medicine_name ILIKE '%' || search_term || '%'
        OR gc.generic_name ILIKE '%' || search_term || '%'
    ORDER BY similarity_score DESC
    LIMIT 50;
END;
$$;

-- Seed some initial data (Real Examples)
INSERT INTO public.global_catalogs (medicine_name, generic_name, manufacturer, composition, mrp, category)
VALUES
('Dolo 650', 'Paracetamol', 'Micro Labs', 'Paracetamol (650mg)', 30.00, 'Analgesic'),
('Crocin 500', 'Paracetamol', 'GSK', 'Paracetamol (500mg)', 20.00, 'Analgesic'),
('Azithral 500', 'Azithromycin', 'Alembic', 'Azithromycin (500mg)', 120.00, 'Antibiotic'),
('Pantocid 40', 'Pantoprazole', 'Sun Pharma', 'Pantoprazole (40mg)', 100.00, 'Antacid'),
('Montair LC', 'Montelukast + Levocetirizine', 'Cipla', 'Montelukast (10mg) + Levocetirizine (5mg)', 180.00, 'Antiallergic'),
('Telma 40', 'Telmisartan', 'Glenmark', 'Telmisartan (40mg)', 90.00, 'Cardiology'),
('Metolar XR 25', 'Metoprolol', 'Cipla', 'Metoprolol Succinate (25mg)', 60.00, 'Cardiology'),
('Glycomet 500', 'Metformin', 'USV', 'Metformin (500mg)', 45.00, 'Diabetic'),
('Shelcal 500', 'Calcium + Vit D3', 'Torrent', 'Calcium (500mg) + Vitamin D3', 85.00, 'Supplements'),
('Becosules', 'Multivitamins', 'Pfizer', 'Vitamin B Complex + C', 45.00, 'Supplements');
