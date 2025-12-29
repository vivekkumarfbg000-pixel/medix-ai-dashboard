-- Add Refill Columns to Orders Table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS refill_due_date DATE,
ADD COLUMN IF NOT EXISTS days_supply INTEGER,
ADD COLUMN IF NOT EXISTS last_refill_reminder TIMESTAMP WITH TIME ZONE;

-- Create Index for fast daily query
CREATE INDEX IF NOT EXISTS idx_orders_refill_due ON public.orders(refill_due_date);

-- Create Retry Queue Table for Error Handling
CREATE TABLE IF NOT EXISTS public.retry_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    workflow_name TEXT,
    node_name TEXT,
    error_message TEXT,
    payload JSONB,
    retry_count INTEGER DEFAULT 0,
    next_retry_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending', -- pending, retried, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.retry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their retry queue" ON public.retry_queue
  FOR ALL USING (shop_id = public.get_user_shop_id());
