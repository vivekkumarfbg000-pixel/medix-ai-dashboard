import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Shop {
  id: string;
  name: string;
  address: string | null;
  is_primary: boolean;
}

interface UserShopsState {
  shops: Shop[];
  currentShop: Shop | null;
  loading: boolean;
  switchShop: (shopId: string) => void;
}

export function useUserShops(): UserShopsState {
  const [shops, setShops] = useState<Shop[]>([]);
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchShops() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: userShops, error } = await supabase
          .from("user_shops")
          .select(`
            shop_id,
            is_primary,
            shops (
              id,
              name,
              address
            )
          `)
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching shops:", error);
        }

        let mappedShops: Shop[] = [];

        if (userShops && userShops.length > 0) {
          // SAFE GUARD: Filter out any null 'shops' entries (RLS hidden or orphaned)
          const validShops = userShops.filter((us: any) => us && us.shops);

          mappedShops = validShops.map((us: any) => ({
            id: us.shops?.id,
            name: us.shops?.name || "Unknown Shop",
            address: us.shops?.address,
            is_primary: us.is_primary,
          })).filter(shop => shop.id); // Double check id exists
        } else {
          // FALLBACK: Check profile if no user_shops mapping exists (Migration safety)
          console.warn("No user_shops found, checking profile fallback...");
          const { data: profile } = await supabase
            .from("profiles")
            .select("shop_id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profile?.shop_id) {
            const { data: shop } = await supabase
              .from("shops")
              .select("id, name, address")
              .eq("id", profile.shop_id)
              .single();

            if (shop) {
              mappedShops = [{
                id: shop.id,
                name: shop.name || "My Shop",
                address: shop.address,
                is_primary: true
              }];
            }
          }
        }

        if (mappedShops.length > 0) {
          setShops(mappedShops);

          // Set current shop to primary or first available
          const primary = mappedShops.find((s: Shop) => s.is_primary);
          const savedShopId = localStorage.getItem("currentShopId");
          const savedShop = savedShopId ? mappedShops.find((s: Shop) => s.id === savedShopId) : null;

          const defaultShopId = savedShop?.id || primary?.id || mappedShops[0]?.id || null;
          setCurrentShopId(defaultShopId);
          if (defaultShopId) {
            localStorage.setItem("currentShopId", defaultShopId);
          }
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchShops();
  }, []);

  const switchShop = (shopId: string) => {
    setCurrentShopId(shopId);
    localStorage.setItem("currentShopId", shopId);
  };

  const currentShop = shops.find((s) => s.id === currentShopId) || null;

  return {
    shops,
    currentShop,
    loading,
    switchShop,
  };
}
