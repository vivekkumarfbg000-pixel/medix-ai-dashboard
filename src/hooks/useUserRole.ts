import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "admin" | "pharmacist" | "staff";

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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoading(false);
          return;
        }

        // FIX BUG-5: Roles are stored in `user_roles` table, NOT in `user_shops`.
        // user_shops has: user_id, shop_id, is_primary — NO role column.
        // user_roles has: user_id, shop_id, role — the correct source of truth.
        const { data: mapping, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("shop_id", shopId)
          .maybeSingle();

        if (error) throw error;

        // Use any-casting because Supabase types might be out of sync with migrations
        const mappedRole = mapping ? (mapping as any).role : null;
        
        if (mappedRole) {
          setRole(mappedRole as AppRole);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error("Error fetching role from user_roles:", err);
        setRole(null);
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
