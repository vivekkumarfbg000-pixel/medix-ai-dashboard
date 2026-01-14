-- PHASE 3: Global Activity Logs
-- Tracks "Who did what" across the entire system

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- e.g., 'LOGIN', 'SALE', 'RESTOCK', 'SETTINGS_UPDATE', 'EXPORT'
    entity_type TEXT NOT NULL, -- e.g., 'INVENTORY', 'ORDER', 'USER', 'SETTINGS'
    entity_id TEXT, -- ID of the affected item (optional)
    details JSONB DEFAULT '{}'::jsonb, -- Snapshot of changes or metadata
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Shop owners/staff can view logs for their own shop
CREATE POLICY "Users can view logs for their shop" ON public.activity_logs
FOR ALL USING (
    shop_id IN (SELECT shop_id FROM public.user_shops WHERE user_id = auth.uid())
);

-- Index for fast filtering
CREATE INDEX idx_activity_logs_shop_created ON public.activity_logs(shop_id, created_at DESC);
