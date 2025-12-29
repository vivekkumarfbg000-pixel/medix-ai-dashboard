-- Update audit_logs RLS policy to allow users to view audit logs for their shop
-- First drop the restrictive admin-only SELECT policy
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- Create a new policy that allows all shop users to view audit logs for their shop
CREATE POLICY "Users can view their shop audit logs"
ON public.audit_logs
FOR SELECT
USING (shop_id = get_user_shop_id());

-- Also add the triggers for audit logging if they don't exist
DO $$
BEGIN
  -- Inventory table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_inventory_trigger') THEN
    CREATE TRIGGER audit_inventory_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.inventory
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
  END IF;
  
  -- Orders table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_orders_trigger') THEN
    CREATE TRIGGER audit_orders_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
  END IF;
  
  -- Sales table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_sales_trigger') THEN
    CREATE TRIGGER audit_sales_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
  END IF;
  
  -- Patient reminders trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_patient_reminders_trigger') THEN
    CREATE TRIGGER audit_patient_reminders_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.patient_reminders
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
  END IF;
  
  -- Diary scans trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_diary_scans_trigger') THEN
    CREATE TRIGGER audit_diary_scans_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.diary_scans
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
  END IF;
END $$;