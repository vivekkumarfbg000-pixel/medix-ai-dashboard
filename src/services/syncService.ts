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
            // Defer sync further to allow app to fully hydrate and render critical UI
            setTimeout(() => {
                this.syncOrders();
            }, 5000);
        }
    }

    private handleOnline = () => {
        toast.info("Back Online", { description: "Syncing offline data..." });
        this.syncAll();
    };

    public async syncAll() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        try {
            await this.syncOrders();
            await this.syncInventory();
        } finally {
            this.isSyncing = false;
        }
    }

    public async syncOrders() {
        // ... (existing logic remains similar but we'll wrap it better)
        try {
            const pendingOrders = await db.orders.where('is_synced').equals(0).toArray();
            if (pendingOrders.length === 0) return;

            logger.log(`Syncing ${pendingOrders.length} offline orders...`);
            let syncedCount = 0;

            for (const order of pendingOrders) {
                const { id, is_synced, items, ...rest } = order;
                
                // 1. Insert Order
                const { data: newOrder, error } = await supabase.from('orders').insert({
                    ...rest,
                    order_items: items, // JSONB backup
                    status: 'approved'
                }).select().single();

                if (!error && newOrder) {
                    let itemsSynced = true;
                    // 2. Insert Order Items for Reports/Ledger
                    if (items && items.length > 0) {
                        const orderItemsToInsert = items.map((c: any) => ({
                            order_id: newOrder.id,
                            inventory_id: c.id || c.inventory_id,
                            name: c.name,
                            qty: c.qty,
                            price: c.price,
                            cost_price: c.cost_price || 0
                        }));
                        // @ts-ignore
                        const { error: itemsError } = await supabase.from('order_items').insert(orderItemsToInsert);
                        if (itemsError) {
                            console.error("Order items sync fail", itemsError);
                            itemsSynced = false;
                        }
                    }

                    if (itemsSynced) {
                        // 3. Mark as synced locally
                        await db.orders.update(id, { is_synced: 1 });
                        syncedCount++;
                    }
                }
            }
            if (syncedCount > 0) toast.success(`Synced ${syncedCount} orders!`);
        } catch (e) { console.error("Order sync fail", e); }
    }

    public async syncInventory() {
        try {
            const pendingInv = await db.inventory.where('is_synced').equals(0).toArray();
            if (pendingInv.length === 0) return;

            logger.log(`Syncing ${pendingInv.length} inventory changes...`);
            let syncedCount = 0;

            for (const item of pendingInv) {
                // Use the secure RPC for adding inventory if it's a new item or adjustment
                // Or use standard upsert if the ID exists in Supabase
                const { is_synced, ...payload } = item;
                
                const { error } = await supabase.from('inventory').upsert(payload as any);

                if (!error) {
                    await db.inventory.update(item.id, { is_synced: 1 });
                    syncedCount++;
                }
            }
            if (syncedCount > 0) toast.success(`Synced ${syncedCount} inventory items!`);
        } catch (e) { console.error("Inventory sync fail", e); }
    }
}

export const syncService = new SyncService();
