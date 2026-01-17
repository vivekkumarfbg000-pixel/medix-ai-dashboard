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

        // 1. Check direct role assignment
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("shop_id", shopId)
          .maybeSingle();

        if (roleData) {
          setRole(roleData.role as AppRole);
        } else {
          // 2. Fallback: Check if they are the OWNER via Profiles
          const { data: profileData } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", user.id)
            .eq("shop_id", shopId)
            .maybeSingle();

          if (profileData?.role) {
            setRole(profileData.role as AppRole);
          }
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
    canModify: role === "admin" || role === "pharmacist" || role === "owner",
    isAdmin: role === "admin" || role === "owner",
  };
}
