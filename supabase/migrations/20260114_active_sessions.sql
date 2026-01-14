-- Create a table to track active sessions for single-device login enforcement
CREATE TABLE IF NOT EXISTS public.active_sessions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    last_seen TIMESTAMPTZ DEFAULT now(),
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own active session"
    ON public.active_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update their own active session"
    ON public.active_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own active session"
    ON public.active_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to update session on login (can be called from client or trigger)
CREATE OR REPLACE FUNCTION public.register_session(p_session_id TEXT, p_device_info TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.active_sessions (user_id, session_id, last_seen, device_info)
    VALUES (auth.uid(), p_session_id, now(), p_device_info)
    ON CONFLICT (user_id)
    DO UPDATE SET 
        session_id = EXCLUDED.session_id,
        last_seen = now(),
        device_info = EXCLUDED.device_info;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
