-- SURGICAL FIX: Resolve get_sales_report ambiguity
-- Drops the old TIMESTAMP version that causes RPC collisions

DROP FUNCTION IF EXISTS public.get_sales_report(timestamp without time zone, timestamp without time zone, uuid);

-- Re-verify and ensure the TEXT version is correctly permissioned
GRANT EXECUTE ON FUNCTION public.get_sales_report(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_report(text, text, uuid) TO service_role;
