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
        } else if (userShops) {
          const mappedShops = userShops.map((us: any) => ({
            id: us.shops.id,
            name: us.shops.name,
            address: us.shops.address,
            is_primary: us.is_primary,
          }));
          setShops(mappedShops);

          // Set current shop to primary or first available
          const primary = mappedShops.find((s: Shop) => s.is_primary);
          const savedShopId = localStorage.getItem("currentShopId");
          const savedShop = savedShopId ? mappedShops.find((s: Shop) => s.id === savedShopId) : null;
          
          setCurrentShopId(savedShop?.id || primary?.id || mappedShops[0]?.id || null);
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
