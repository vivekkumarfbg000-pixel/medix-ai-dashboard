-- Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    old_value JSONB,
    new_value JSONB,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View Audit Logs" ON public.audit_logs;

CREATE POLICY "View Audit Logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (true); -- Shop owners can view logs

-- Trigger Function
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    user_id UUID;
BEGIN
    -- Try to get User ID (might be null for system/n8n actions)
    user_id := auth.uid();
    
    IF (TG_OP = 'DELETE') THEN
        old_data = to_jsonb(OLD);
        INSERT INTO public.audit_logs (table_name, record_id, action, old_value, user_id)
        VALUES (TG_TABLE_NAME, OLD.id::text, 'DELETE', old_data, user_id);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        old_data = to_jsonb(OLD);
        new_data = to_jsonb(NEW);
        INSERT INTO public.audit_logs (table_name, record_id, action, old_value, new_value, user_id)
        VALUES (TG_TABLE_NAME, NEW.id::text, 'UPDATE', old_data, new_data, user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        new_data = to_jsonb(NEW);
        INSERT INTO public.audit_logs (table_name, record_id, action, new_value, user_id)
        VALUES (TG_TABLE_NAME, NEW.id::text, 'INSERT', new_data, user_id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach Triggers to Key Tables

-- 1. Orders
DROP TRIGGER IF EXISTS audit_orders_trigger ON public.orders;
CREATE TRIGGER audit_orders_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 2. Inventory
DROP TRIGGER IF EXISTS audit_inventory_trigger ON public.inventory;
CREATE TRIGGER audit_inventory_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.inventory
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 3. Customers
DROP TRIGGER IF EXISTS audit_customers_trigger ON public.customers;
CREATE TRIGGER audit_customers_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 4. Shops (Settings changes)
DROP TRIGGER IF EXISTS audit_shops_trigger ON public.shops;
CREATE TRIGGER audit_shops_trigger
AFTER UPDATE ON public.shops
FOR EACH ROW EXECUTE FUNCTION log_audit_event();
