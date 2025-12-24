-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'pharmacist', 'staff');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, shop_id)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _shop_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND shop_id = _shop_id
      AND role = _role
  )
$$;

-- Function to get user's role for current shop
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID, _shop_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id AND shop_id = _shop_id
  LIMIT 1
$$;

-- Function to check if user is admin or pharmacist (can modify)
CREATE OR REPLACE FUNCTION public.can_modify(_user_id UUID, _shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND shop_id = _shop_id
      AND role IN ('admin', 'pharmacist')
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Admins can manage roles for their shop"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), shop_id, 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Create audit_logs table for compliance
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (public.has_role(auth.uid(), shop_id, 'admin'));

-- System can insert audit logs (via trigger)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shop_id UUID;
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  
  IF TG_OP = 'DELETE' THEN
    _shop_id := OLD.shop_id;
    INSERT INTO public.audit_logs (shop_id, user_id, table_name, record_id, action, old_value)
    VALUES (_shop_id, _user_id, TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    _shop_id := NEW.shop_id;
    INSERT INTO public.audit_logs (shop_id, user_id, table_name, record_id, action, old_value, new_value)
    VALUES (_shop_id, _user_id, TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    _shop_id := NEW.shop_id;
    INSERT INTO public.audit_logs (shop_id, user_id, table_name, record_id, action, new_value)
    VALUES (_shop_id, _user_id, TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Add audit triggers to important tables
CREATE TRIGGER audit_inventory
AFTER INSERT OR UPDATE OR DELETE ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_sales
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_orders
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Update inventory policies to be role-based
DROP POLICY IF EXISTS "Users can delete their shop inventory" ON public.inventory;
CREATE POLICY "Admins and Pharmacists can delete inventory"
ON public.inventory
FOR DELETE
USING (
  shop_id = get_user_shop_id() 
  AND public.can_modify(auth.uid(), shop_id)
);

-- Staff cannot export/delete - handled by role checks in app

-- Create user_shops junction for multi-branch access
CREATE TABLE public.user_shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, shop_id)
);

ALTER TABLE public.user_shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their shop associations"
ON public.user_shops
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage shop associations"
ON public.user_shops
FOR ALL
USING (public.has_role(auth.uid(), shop_id, 'admin'));

-- Update handle_new_user to also create admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_shop_id UUID;
BEGIN
  -- Create a new shop for the user
  INSERT INTO public.shops (owner_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'shop_name', 'My Medical Shop'))
  RETURNING id INTO new_shop_id;
  
  -- Create profile linked to the shop
  INSERT INTO public.profiles (user_id, shop_id, full_name)
  VALUES (NEW.id, new_shop_id, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Assign admin role to shop owner
  INSERT INTO public.user_roles (user_id, shop_id, role)
  VALUES (NEW.id, new_shop_id, 'admin');
  
  -- Add to user_shops junction
  INSERT INTO public.user_shops (user_id, shop_id, is_primary)
  VALUES (NEW.id, new_shop_id, true);
  
  RETURN NEW;
END;
$$;

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;