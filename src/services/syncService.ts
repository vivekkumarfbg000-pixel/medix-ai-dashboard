import { db, Medicine, Order } from './db';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

class SyncService {
    private isSyncing = false;
    private syncInterval: NodeJS.Timeout | null = null;

    // Start background sync
    startSync(intervalMs = 30000) {
        if (this.syncInterval) return;
        this.syncInterval = setInterval(() => this.syncAll(), intervalMs);
        console.log("🔄 Sync Service Started");
        this.syncAll(); // Initial sync
    }

    async syncAll() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        try {
            await this.pushMedicines();
            await this.pushOrders();
            // await this.pullMedicines(); // Implementation for future
        } catch (error) {
            console.error("Sync Failed", error);
        } finally {
            this.isSyncing = false;
        }
    }

    // PUSH: Local -> Cloud
    private async pushMedicines() {
        const pending = await db.medicines.where('syncStatus').equals('pending').toArray();
        if (pending.length === 0) return;

        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return; // Not logged in

        for (const med of pending) {
            try {
                // Map to Snake Case for Supabase
                const payload = {
                    name: med.name,
                    generic_name: med.genericName,
                    batch_number: med.batchNumber,
                    expiry_date: med.expiryDate.toISOString(),
                    quantity: med.quantity,
                    mrp: med.mrp,
                    min_stock_level: med.minStockLevel,
                    // shop_id is handled by RLS defaults if set up, or we might need to fetch it.
                    // For now assuming RLS policies handle owner_id via auth.
                };

                const { data, error } = await supabase
                    .from('medicines')
                    .insert(payload)
                    .select()
                    .single();

                if (error) throw error;

                // Update Local
                await db.medicines.update(med.id!, {
                    syncStatus: 'synced',
                    supabaseId: data.id.toString()
                });
            } catch (err) {
                console.error("Failed to sync medicine", med.name, err);
                // Optionally mark as failed
            }
        }
        toast.success(`Synced ${pending.length} medicines to Cloud`);
    }

    private async pushOrders() {
        const pending = await db.orders.where('syncStatus').equals('pending').toArray();
        if (pending.length === 0) return;

        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        for (const order of pending) {
            try {
                const payload = {
                    customer_name: order.customerName,
                    mobile_number: order.mobileNumber,
                    total_amount: order.totalAmount,
                    status: order.status,
                    items: order.items, // JSONB
                    created_at: order.createdAt.toISOString()
                };

                const { data, error } = await supabase
                    .from('orders')
                    .insert(payload)
                    .select()
                    .single();

                if (error) throw error;

                await db.orders.update(order.id!, {
                    syncStatus: 'synced',
                    supabaseId: data.id.toString()
                });
            } catch (err) {
                console.error("Failed to sync order", err);
            }
        }
    }
}

export const syncService = new SyncService();
