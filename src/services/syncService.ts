import { supabase } from "@/integrations/supabase/client";
import { db, OfflineInventory } from "@/db/db";
import { toast } from "sonner";

export const syncService = {
    // 1. Pull latest inventory from Supabase -> Dexie
    async syncInventoryDown() {
        try {
            const { data, error } = await supabase.from('inventory').select('*');
            if (error) throw error;

            const offlineData: OfflineInventory[] = data.map((item: any) => ({
                id: item.id,
                medicine_name: item.medicine_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                batch_number: item.batch_number,
                expiry_date: item.expiry_date,
                is_synced: 1
            }));

            await db.inventory.bulkPut(offlineData);
            console.log("Offline DB Synced: ", offlineData.length, " items");
        } catch (e) {
            console.error("Sync Down Failed:", e);
        }
    },

    // 2. Initial Seed (Run on App Mount)
    async seedDatabase() {
        // Only fetch if empty or user requests
        const count = await db.inventory.count();
        if (count === 0 && navigator.onLine) {
            console.log("Seeding Local DB...");
            await this.syncInventoryDown();
        }
    },

    // 3. Start Background Sync (Push Orders Up)
    startSync() {
        // Run immediately
        this.seedDatabase();

        // Listen to Online/Offline Events
        window.addEventListener('online', () => {
            toast.info("Back Online! Syncing...");
            this.syncInventoryDown();
        });
    }
};

// Export standalone alias for App.tsx compatibility
export const seedDatabase = () => syncService.seedDatabase();
