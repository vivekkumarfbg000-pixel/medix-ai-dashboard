import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceUser {
  id: string;
  email: string;
  online_at: string;
  editing?: string; // What they're currently editing
}

interface PresenceState {
  activeUsers: PresenceUser[];
  trackPresence: (editing?: string) => void;
}

export function usePresence(roomId: string): PresenceState {
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    async function setupPresence() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const presenceChannel = supabase.channel(`presence:${roomId}`);

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          const state = presenceChannel.presenceState();
          const users: PresenceUser[] = [];
          
          Object.values(state).forEach((presences: any) => {
            presences.forEach((presence: any) => {
              if (presence.id !== user.id) {
                users.push(presence);
              }
            });
          });
          
          setActiveUsers(users);
        })
        .on("presence", { event: "join" }, ({ newPresences }) => {
          console.log("User joined:", newPresences);
        })
        .on("presence", { event: "leave" }, ({ leftPresences }) => {
          console.log("User left:", leftPresences);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presenceChannel.track({
              id: user.id,
              email: user.email,
              online_at: new Date().toISOString(),
            });
          }
        });

      setChannel(presenceChannel);

      return () => {
        supabase.removeChannel(presenceChannel);
      };
    }

    setupPresence();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [roomId]);

  const trackPresence = async (editing?: string) => {
    if (!channel) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await channel.track({
      id: user.id,
      email: user.email,
      online_at: new Date().toISOString(),
      editing,
    });
  };

  return {
    activeUsers,
    trackPresence,
  };
}
