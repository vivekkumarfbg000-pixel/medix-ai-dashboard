-- Create retry_queue table for ensuring System Health
CREATE TABLE IF NOT EXISTS public.retry_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id TEXT, -- ID of the workflow that failed (e.g. 'n8n-A')
    payload JSONB, -- The data that failed to process
    error_message TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'retrying', 'failed', 'resolved'
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.retry_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to insert failures and read them
CREATE POLICY "Users can insert failures" ON public.retry_queue
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view failure queue" ON public.retry_queue
  FOR SELECT USING (auth.role() = 'authenticated');

-- Notify
NOTIFY pgrst, 'reload config';
