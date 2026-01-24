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

        // OPTIMIZATION: Single efficient query for shop details through the junction table
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
          throw error;
        }

        let mappedShops: Shop[] = [];

        if (userShops && userShops.length > 0) {
          const validShops = userShops.filter((us: any) => us && us.shops);
          mappedShops = validShops.map((us: any) => ({
            id: us.shops?.id,
            name: us.shops?.name || "Unknown Shop",
            address: us.shops?.address,
            is_primary: us.is_primary,
          })).filter(shop => shop.id);
        }

        // REMOVED REDUNDANT FALLBACK: The user_shops table is the source of truth. 
        // If it's empty, the user has no shops. Profile fallback is legacy and slow.

        if (mappedShops.length > 0) {
          setShops(mappedShops);

          // Smart Selection: LocalStorage -> Primary -> First
          const savedShopId = localStorage.getItem("currentShopId");
          const savedShop = savedShopId ? mappedShops.find((s: Shop) => s.id === savedShopId) : null;

          const defaultShopId = savedShop?.id || mappedShops.find(s => s.is_primary)?.id || mappedShops[0]?.id;

          if (defaultShopId) {
            setCurrentShopId(defaultShopId);
            localStorage.setItem("currentShopId", defaultShopId);
          }
        }
      } catch (err) {
        console.error("Shop Load Error:", err);
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
