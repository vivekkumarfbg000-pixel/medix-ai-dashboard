/**
 * useUserShops — Resolves the current user's shops and active shop ID.
 *
 * FIX LOG (2026-04-12):
 *  - Bug B: Removed duplicate syncUserShop call pattern (now only in AuthProvider onAuthStateChange)
 *  - Bug C: Fixed stale closure in medix_shop_sync event listener by using useRef
 *  - Bug D: Removed `currentShopId` from fetchShops dependency array — it only re-fetches on user change
 *  - Bug F: Replaced window.location.reload() in switchShop with event dispatch
 */

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/useAuth";
import { toast } from "sonner";

interface Shop {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  gst_no: string | null;
  dl_number: string | null;
  is_primary: boolean;
}

interface UserShopsState {
  shops: Shop[];
  currentShop: Shop | null;
  currentShopId: string | null;
  loading: boolean;
  switchShop: (shopId: string) => void;
}

export function useUserShops(): UserShopsState {
  const { user } = useAuth();
  const [shops, setShops] = useState<Shop[]>(() => {
    const cached = localStorage.getItem("medix_cached_shops");
    try {
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [currentShopId, setCurrentShopId] = useState<string | null>(() => {
    return localStorage.getItem("currentShopId");
  });
  const [loading, setLoading] = useState(() => {
    // If we have cached shops AND a current shop ID, we can start with loading=false
    const cached = localStorage.getItem("medix_cached_shops");
    const currentId = localStorage.getItem("currentShopId");
    return !(cached && currentId);
  });
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // FIX C: Use a ref to hold the latest currentShopId so event listeners
  // never capture a stale closure value. The listener effect runs ONCE (empty deps).
  const currentShopIdRef = useRef<string | null>(currentShopId);
  useEffect(() => {
    currentShopIdRef.current = currentShopId;
  }, [currentShopId]);

    // FIX C: Register event listeners ONCE with empty dependency array.
    // Use ref for current value comparison to avoid stale closures.
    useEffect(() => {
        // Cross-tab sync via storage event
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "currentShopId" && e.newValue !== currentShopIdRef.current) {
                console.log("🏪 [useUserShops] Storage sync received:", e.newValue);
                setCurrentShopId(e.newValue);
            }
        };

        // Same-window sync via custom event (dispatched by syncUserShop in authHelpers)
        const handleCustomSync = (e: Event) => {
            const detail = (e as CustomEvent<{ shopId: string }>).detail;
            if (detail?.shopId && detail.shopId !== currentShopIdRef.current) {
                console.log("🏪 [useUserShops] Custom sync event received:", detail.shopId);
                setCurrentShopId(detail.shopId);
                // We MUST force a re-fetch of the shops array, because if this event fired,
                // it means a new shop was just created in the DB by the auth trigger!
                // We emit another custom event to trigger the other useEffect to run.
                window.dispatchEvent(new CustomEvent("medix_shop_refetch"));
            }
        };

        const handleRefetch = () => setRefetchTrigger(prev => prev + 1);

        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("medix_shop_sync", handleCustomSync);
        window.addEventListener("medix_shop_refetch", handleRefetch);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("medix_shop_sync", handleCustomSync);
            window.removeEventListener("medix_shop_refetch", handleRefetch);
        };
    }, []); // ✅ FIX C: Empty deps — listener registered once, ref handles current value

  // FIX D: fetchShops ONLY re-runs when the user identity changes (login/logout).
  // It does NOT depend on currentShopId, preventing the race condition loop.
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    async function fetchShops() {
      console.log("🏪 [useUserShops] fetchShops triggered for user:", user!.id);
      try {
        // OPTIMIZATION: getSession is cached locally, avoids a network call
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoading(false);
          return;
        }

        // Single efficient query through the junction table
        const { data: userShops, error } = await supabase
          .from("user_shops")
          .select(`
            shop_id,
            is_primary,
            shops (
              id,
              name,
              address,
              phone,
              gst_no,
              dl_number
            )
          `)
          .eq("user_id", session.user.id);

        if (error) {
          console.error("❌ [useUserShops] Error fetching shops:", error);
          throw error;
        }

        let mappedShops: Shop[] = [];

        if (userShops && userShops.length > 0) {
          // FIX BUG-6: If RLS blocks reading the 'shops' table (e.g. for Staff users),
          // us.shops will be null. DO NOT filter out the mapping, use us.shop_id instead!
          mappedShops = userShops.map((us: any) => ({
            id: us.shops?.id || us.shop_id,
            name: us.shops?.name || "Assigned Pharmacy",
            address: us.shops?.address,
            phone: us.shops?.phone || null,
            gst_no: us.shops?.gst_no || null,
            dl_number: us.shops?.dl_number || null,
            is_primary: us.is_primary,
          })).filter((shop: Shop) => shop.id);
        }

        if (mappedShops.length > 0) {
          setShops(mappedShops);
          // PERSIST CACHE for offline-first load next time
          localStorage.setItem("medix_cached_shops", JSON.stringify(mappedShops));
          
          const savedShopId = localStorage.getItem("currentShopId");
          const isValidSaved = savedShopId && mappedShops.some(s => s.id === savedShopId);

          if (!isValidSaved) {
            const defaultShopId =
              mappedShops.find(s => s.is_primary)?.id || mappedShops[0]?.id;
            if (defaultShopId) {
              console.log("🏪 [useUserShops] Setting default shop:", defaultShopId);
              localStorage.setItem("currentShopId", defaultShopId);
              setCurrentShopId(defaultShopId);
            }
          } else if (savedShopId !== currentShopIdRef.current) {
            setCurrentShopId(savedShopId);
          }
          console.log(`✅ [useUserShops] Loaded ${mappedShops.length} shop(s)`);
        } else {
            console.warn("⚠️ [useUserShops] No shops found on server.");
            // If the server explicitly returns empty, we should probably clear the cache
            // But only if we are SURE it's not a temporary error. 
            // For now, we keep the cache to be safe.
        }
      } catch (err: any) {
        console.error("❌ [useUserShops] Shop Load Error (Background):", err);
        // If we don't have a cache, and the network timed out, let the user know.
        if (!localStorage.getItem("medix_cached_shops")) {
            toast.error("Network timeout. Your connection or proxy is unstable. Please refresh or use Bypass Proxy.", { duration: 10000 });
        }
      } finally {
        setLoading(false);
      }
    }

    fetchShops();
  }, [user?.id, refetchTrigger]); // ✅ FIX D: Re-run on user change or explicit refetch trigger

  // FIX F: No more window.location.reload(). Use reactive state + event dispatch.
  const switchShop = (shopId: string) => {
    console.log("🔄 [useUserShops] Switching shop to:", shopId);
    localStorage.setItem("currentShopId", shopId);
    setCurrentShopId(shopId);
    // Notify all other components using useUserShops in the same window
    window.dispatchEvent(
      new CustomEvent("medix_shop_sync", { detail: { shopId } })
    );
  };

  const currentShop = shops.find((s) => s.id === currentShopId) || (currentShopId ? {
    id: currentShopId,
    name: "My Pharmacy (Offline/Syncing)",
    address: null,
    phone: null,
    gst_no: null,
    dl_number: null,
    is_primary: true
  } : null);

  return {
    shops,
    currentShop,
    currentShopId,
    loading,
    switchShop,
  };
}
