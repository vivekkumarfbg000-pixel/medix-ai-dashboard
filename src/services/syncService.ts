import { supabase } from "@/integrations/supabase/client";
import { db, OfflineOrder } from "@/db/db";
import { toast } from "sonner";
import { logger } from "@/utils/logger";

class SyncService {
    private isSyncing = false;

    constructor() {
        // Listen for online status
        window.addEventListener('online', this.handleOnline);

        // Initial check - DEFERRED to prevent startup blocking
        if (navigator.onLine) {
            setTimeout(() => {
                this.syncOrders();
            }, 2000);
        }
    }

    private handleOnline = () => {
        toast.info("Back Online", { description: "Syncing offline data..." });
        this.syncOrders();
    };

    public async syncOrders() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            // 1. Get Pending Orders
            const pendingOrders = await db.orders.where('is_synced').equals(0).toArray();

            if (pendingOrders.length === 0) {
                this.isSyncing = false;
                return;
            }

            logger.log(`Syncing ${pendingOrders.length} offline orders...`);
            let syncedCount = 0;

            for (const order of pendingOrders) {
                try {
                    // Remove local ID and sync flag before push
                    const { id, is_synced, items, ...rest } = order;

                    // Map to Supabase Order Insert
                    const orderPayload = {
                        ...rest,
                        order_items: items, // 'items' in local DB maps to 'order_items' in Supabase
                        status: 'approved'
                    };

                    // Push to Supabase
                    const { error } = await supabase.from('orders').insert(orderPayload as any);

                    if (error) {
                        console.error("Sync Failed for Order", id, error);
                        // If persistent error (e.g. schema violation), maybe mark as error-ed locally?
                        // For now we just skip and retry later.
                    } else {
                        // Mark as Synced (or delete if you want to keep DB clean)
                        // We'll update is_synced to 1 to keep history
                        if (id) {
                            await db.orders.update(id, { is_synced: 1 });
                            syncedCount++;
                        }
                    }
                } catch (e) {
                    console.error("Sync Exception", e);
                }
            }

            if (syncedCount > 0) {
                toast.success(`Synced ${syncedCount} offline orders!`);
            }

        } catch (e) {
            console.error("SyncService Error", e);
        } finally {
            this.isSyncing = false;
        }
    }
}

export const syncService = new SyncService();
