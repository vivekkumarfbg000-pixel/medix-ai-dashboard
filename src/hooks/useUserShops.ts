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
  const [loading, setLoading] = useState(true); // Always start with loading true if user but no shops
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // STALE CACHE PROTECTION: If the user changed, clear the cache state immediately
  const lastUserId = useRef<string | undefined>(user?.id);
  useEffect(() => {
    if (user?.id !== lastUserId.current) {
      console.log("👤 [useUserShops] User changed, clearing stale cache.");
      setShops([]);
      setCurrentShopId(null);
      setLoading(true);
      lastUserId.current = user?.id;
    }
  }, [user?.id]);

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
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`🏪 [useUserShops] fetchShops attempt ${attempt}/${maxAttempts} for user: ${user!.id}`);
          
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            setLoading(false);
            return;
          }

          // PHASE A: Fetch Junction IDs (Simple query)
          const { data: userShops, error: linkError } = await supabase
            .from("user_shops")
            .select("shop_id, is_primary")
            .eq("user_id", session.user.id);

          if (linkError) throw linkError;

          let mappedShops: Shop[] = [];
          if (userShops && userShops.length > 0) {
            // PHASE B: Fetch Detail Metadata (Simple query, no joins)
            const { data: shopsData, error: shopsError } = await supabase
              .from("shops")
              .select("id, name, address, phone, gst_no, dl_number")
              .in("id", userShops.map(us => us.shop_id));

            if (shopsError) {
                console.warn("⚠️ [useUserShops] Detail fetch failed (likely RLS), using fallbacks.");
                mappedShops = userShops.map(us => ({
                    id: us.shop_id,
                    name: "Assigned Pharmacy",
                    address: null,
                    phone: null,
                    gst_no: null,
                    dl_number: null,
                    is_primary: us.is_primary,
                }));
            } else {
                mappedShops = userShops.map(us => {
                    const s = shopsData?.find(fs => fs.id === us.shop_id);
                    return {
                        id: us.shop_id,
                        name: s?.name || "Assigned Pharmacy",
                        address: s?.address || null,
                        phone: s?.phone || null,
                        gst_no: s?.gst_no || null,
                        dl_number: s?.dl_number || null,
                        is_primary: us.is_primary,
                    };
                });
            }
          }

          if (mappedShops.length > 0) {
            setShops(mappedShops);
            localStorage.setItem("medix_cached_shops", JSON.stringify(mappedShops));
            
            const savedShopId = localStorage.getItem("currentShopId");
            const isValidSaved = savedShopId && mappedShops.some(s => s.id === savedShopId);

            if (!isValidSaved) {
              const defaultShopId = mappedShops.find(s => s.is_primary)?.id || mappedShops[0]?.id;
              if (defaultShopId) {
                localStorage.setItem("currentShopId", defaultShopId);
                setCurrentShopId(defaultShopId);
              }
            } else if (savedShopId !== currentShopIdRef.current) {
              setCurrentShopId(savedShopId);
            }
          }
          
          console.log(`✅ [useUserShops] Loaded ${mappedShops.length} shop(s). Sync complete.`);
          setLoading(false);
          return; // SUCCESS - Exit loop

        } catch (err: any) {
          // If we have cached data, don't show a full-page loading/error state
          if (shops.length > 0) setLoading(false);
          
          console.error(`❌ [useUserShops] Shop load failed (attempt ${attempt}):`, err);
          
          if (attempt < maxAttempts) {
            const delay = attempt * 1500;
            console.warn(`⏳ [useUserShops] Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
          } else {
            // ALL RETRIES FAILED
            if (!localStorage.getItem("medix_cached_shops")) {
              const errMsg = err?.message || err?.details || String(err);
              toast.error(`Connection Error: ${errMsg}`, { 
                duration: 15000,
                action: {
                    label: "Retry",
                    onClick: () => setRefetchTrigger(prev => prev + 1)
                }
              });
            }
            setLoading(false);
          }
        }
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
