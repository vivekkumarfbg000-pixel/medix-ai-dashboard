-- ═══════════════════════════════════════════════════════════════════════════════
-- DUAL LOGIN SUPPORT (PC + Mobile)
-- Version: 1.0 | Date: 2026-04-13
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Modify active_sessions to allow multiple sessions per user
-- We drop the existing Primary Key (which was just user_id)
ALTER TABLE public.active_sessions DROP CONSTRAINT IF EXISTS active_sessions_pkey;

-- 2. Add composite primary key (user_id, session_id)
-- This allows two different devices to occupy two rows for the same user.
ALTER TABLE public.active_sessions ADD PRIMARY KEY (user_id, session_id);

-- 3. Update register_session RPC to be composite-aware
CREATE OR REPLACE FUNCTION public.register_session(p_session_id TEXT, p_device_info TEXT)
RETURNS VOID AS $$
BEGIN
    -- Upsert based on the specific session_id
    INSERT INTO public.active_sessions (user_id, session_id, last_seen, device_info)
    VALUES (auth.uid(), p_session_id, now(), p_device_info)
    ON CONFLICT (user_id, session_id)
    DO UPDATE SET 
        last_seen = now(),
        device_info = EXCLUDED.device_info;

    -- OPTIONAL: Cleanup very old sessions for this user to prevent row bloat
    -- (Keep last 3 active sessions for safety)
    DELETE FROM public.active_sessions
    WHERE user_id = auth.uid()
      AND session_id NOT IN (
          SELECT session_id 
          FROM public.active_sessions 
          WHERE user_id = auth.uid() 
          ORDER BY last_seen DESC 
          LIMIT 3
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Notify about session revocation (Manual Logout from other device)
-- This allows us to trigger a specific event if a session is deleted.
CREATE OR REPLACE FUNCTION public.notify_session_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- We can add logic here if we want to broadcast a 'forced_logout' event via realtime
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_session_deleted ON public.active_sessions;
CREATE TRIGGER on_session_deleted
    BEFORE DELETE ON public.active_sessions
    FOR EACH ROW EXECUTE FUNCTION public.notify_session_deletion();

COMMENT ON TABLE public.active_sessions IS 'Tracks multiple active sessions (PC, Mobile, Tablet) per user to support Dual Login.';
