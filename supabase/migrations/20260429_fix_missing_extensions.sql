-- Enable pg_trgm extension for text similarity search (Required for search_global_medicines RPC)
-- This fix addresses the "function similarity(text, text) does not exist" error.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Re-verify or Re-create the search function to ensure it uses the extension correctly
-- (This is just a safety re-run of the relevant part of the catalog migration)
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
