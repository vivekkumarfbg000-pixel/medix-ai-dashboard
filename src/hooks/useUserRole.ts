import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "pharmacist" | "staff";

interface UserRoleState {
  role: AppRole | null;
  loading: boolean;
  canModify: boolean;
  isAdmin: boolean;
}

export function useUserRole(shopId?: string | null): UserRoleState {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!shopId) {
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("shop_id", shopId)
          .maybeSingle();

        if (error) {
          console.error("Error fetching role:", error);
        } else if (data) {
          setRole(data.role as AppRole);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [shopId]);

  return {
    role,
    loading,
    canModify: role === "admin" || role === "pharmacist",
    isAdmin: role === "admin",
  };
}
