-- Create shop_id type and shops table for multi-tenancy
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'owner',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory table
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL,
  generic_name TEXT,
  batch_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(10,2),
  expiry_date DATE,
  manufacturer TEXT,
  category TEXT,
  reorder_level INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales table for tracking
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES public.inventory(id),
  quantity_sold INTEGER NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  sale_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  customer_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table for WhatsApp orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  order_items JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10,2),
  source TEXT DEFAULT 'whatsapp',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create diary_scans table for OCR uploads
CREATE TABLE public.diary_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  image_url TEXT,
  extracted_text TEXT,
  status TEXT DEFAULT 'pending',
  confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patient_reminders table
CREATE TABLE public.patient_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_phone TEXT,
  medicine_name TEXT NOT NULL,
  reminder_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_reminders ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get user's shop_id
CREATE OR REPLACE FUNCTION public.get_user_shop_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- RLS Policies for shops
CREATE POLICY "Users can view their own shop" ON public.shops
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can create their own shop" ON public.shops
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own shop" ON public.shops
  FOR UPDATE USING (owner_id = auth.uid());

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for inventory (using shop_id)
CREATE POLICY "Users can view their shop inventory" ON public.inventory
  FOR SELECT USING (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can create inventory for their shop" ON public.inventory
  FOR INSERT WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can update their shop inventory" ON public.inventory
  FOR UPDATE USING (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can delete their shop inventory" ON public.inventory
  FOR DELETE USING (shop_id = public.get_user_shop_id());

-- RLS Policies for sales
CREATE POLICY "Users can view their shop sales" ON public.sales
  FOR SELECT USING (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can create sales for their shop" ON public.sales
  FOR INSERT WITH CHECK (shop_id = public.get_user_shop_id());

-- RLS Policies for orders
CREATE POLICY "Users can view their shop orders" ON public.orders
  FOR SELECT USING (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can create orders for their shop" ON public.orders
  FOR INSERT WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can update their shop orders" ON public.orders
  FOR UPDATE USING (shop_id = public.get_user_shop_id());

-- RLS Policies for diary_scans
CREATE POLICY "Users can view their shop scans" ON public.diary_scans
  FOR SELECT USING (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can create scans for their shop" ON public.diary_scans
  FOR INSERT WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can update their shop scans" ON public.diary_scans
  FOR UPDATE USING (shop_id = public.get_user_shop_id());

-- RLS Policies for patient_reminders
CREATE POLICY "Users can view their shop reminders" ON public.patient_reminders
  FOR SELECT USING (shop_id = public.get_user_shop_id());

CREATE POLICY "Users can manage their shop reminders" ON public.patient_reminders
  FOR ALL USING (shop_id = public.get_user_shop_id());

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();