import { db, Medicine, Order } from './db';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

class SyncService {
    private isSyncing = false;
    private syncInterval: NodeJS.Timeout | null = null;
    private listeners: ((status: 'idle' | 'syncing' | 'error') => void)[] = [];

    // Subscribe to status changes
    subscribe(listener: (status: 'idle' | 'syncing' | 'error') => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(status: 'idle' | 'syncing' | 'error') {
        this.listeners.forEach(l => l(status));
    }

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
        this.notifyListeners('syncing');
        try {
            await this.pushMedicines();
            await this.pushOrders();
            // await this.pullMedicines(); // Implementation for future
            this.notifyListeners('idle');
        } catch (error) {
            console.error("Sync Failed", error);
            this.notifyListeners('error');
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

        // Fetch shop_id 
        const { data: profile } = await supabase
            .from('profiles')
            .select('shop_id')
            .eq('id', user.user.id)
            .single();

        if (!profile?.shop_id) return;

        for (const med of pending) {
            try {
                // Map to Snake Case for Supabase
                const payload = {
                    shop_id: profile.shop_id,
                    name: med.name,
                    generic_name: med.genericName,
                    batch_number: med.batchNumber,
                    expiry_date: med.expiryDate.toISOString(),
                    quantity: med.quantity,
                    mrp: med.mrp,
                    min_stock_level: med.minStockLevel,
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
            }
        }
        toast.success(`Synced ${pending.length} medicines to Cloud`);
    }

    private async pushOrders() {
        const pending = await db.orders.where('syncStatus').equals('pending').toArray();
        if (pending.length === 0) return;

        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        // Fetch shop_id for the current user
        const { data: profile } = await supabase
            .from('profiles')
            .select('shop_id')
            .eq('id', user.user.id)
            .single();

        if (!profile?.shop_id) {
            console.error("No shop_id found for user, cannot sync orders");
            return;
        }

        for (const order of pending) {
            try {
                const payload = {
                    shop_id: profile.shop_id,
                    customer_name: order.customerName,
                    // Fix: Ensure correct field mapping and prevent duplicates
                    customer_phone: order.mobileNumber,
                    total_amount: order.totalAmount,
                    status: order.status,
                    order_items: order.items,
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
