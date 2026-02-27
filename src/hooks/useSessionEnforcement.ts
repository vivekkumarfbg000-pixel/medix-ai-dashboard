import { useEffect, useRef } from 'react';
import { supabase, connectivityReady } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const useSessionEnforcement = () => {
    const navigate = useNavigate();
    const sessionCheckedRef = useRef(false);

    useEffect(() => {
        let channel: any = null;

        const handleLogout = async () => {
            await supabase.auth.signOut();
            localStorage.removeItem('medix_device_id');
            navigate('/auth');
            toast.error("You have been logged out.", {
                description: "New login detected on another device."
            });
        };

        const enforceSession = async () => {
            try {
                // Await the connectivity check instead of reading a stale sync flag
                const isReachable = await connectivityReady;
                if (!isReachable) {
                    console.warn("Session enforcement skipped — Supabase unreachable");
                    return;
                }

                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) return;
                const user = session.user;

                let deviceId = localStorage.getItem('medix_device_id');
                if (!deviceId) {
                    deviceId = crypto.randomUUID();
                    localStorage.setItem('medix_device_id', deviceId);
                }

                const { error: rpcError } = await supabase.rpc('register_session' as any, {
                    p_session_id: deviceId,
                    p_device_info: navigator.userAgent
                });

                if (rpcError) {
                    console.warn("Session Registration Warning:", rpcError.message);
                }

                channel = supabase
                    .channel(`session_guard_${user.id}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'active_sessions',
                            filter: `user_id=eq.${user.id}`
                        },
                        (payload: any) => {
                            const remoteSessionId = payload.new.session_id;
                            if (remoteSessionId && remoteSessionId !== deviceId) {
                                handleLogout();
                            }
                        }
                    )
                    .subscribe();

            } catch (err) {
                console.error("Session Check Error:", err);
            }
        };

        if (!sessionCheckedRef.current) {
            enforceSession();
            sessionCheckedRef.current = true;
        }

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [navigate]);
};
