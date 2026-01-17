import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const useSessionEnforcement = () => {
    const navigate = useNavigate();
    const sessionCheckedRef = useRef(false);

    useEffect(() => {
        const enforceSession = async () => {
            // 1. Get current user
            try {
                const { data, error } = await supabase.auth.getUser();
                if (error || !data?.user) return;
                const user = data.user;

                // 2. Get or create local Device ID
                let deviceId = localStorage.getItem('medix_device_id');
                if (!deviceId) {
                    deviceId = crypto.randomUUID();
                    localStorage.setItem('medix_device_id', deviceId);
                }

                // 3. Register/Update session in DB
                const { error: rpcError } = await supabase.rpc('register_session', {
                    p_session_id: deviceId,
                    p_device_info: navigator.userAgent
                });

                if (rpcError) {
                    console.warn("Session Registration Warning:", rpcError.message);
                }

                // 4. Subscribe to changes on active_sessions for this user
                const channel = supabase
                    .channel(`session_guard_${user.id}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'active_sessions',
                            filter: `user_id=eq.${user.id}`
                        },
                        (payload) => {
                            const remoteSessionId = payload.new.session_id;
                            if (remoteSessionId && remoteSessionId !== deviceId) {
                                // Another device took over
                                handleLogout();
                            }
                        }
                    )
                    .subscribe();

                return () => {
                    supabase.removeChannel(channel);
                };

            } catch (err) {
                console.error("Session Check Error:", err);
            }
        };

        const handleLogout = async () => {
            await supabase.auth.signOut();
            localStorage.removeItem('medix_device_id'); // Optional: clear device ID
            navigate('/auth');
            toast.error("You have been logged out.", {
                description: "New login detected on another device." // "Single Device Login Enforced"
            });
        };

        if (!sessionCheckedRef.current) {
            enforceSession();
            sessionCheckedRef.current = true;
        }

    }, [navigate]);
};
