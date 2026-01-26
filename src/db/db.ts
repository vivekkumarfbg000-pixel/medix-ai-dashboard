import Dexie, { Table } from 'dexie';

export interface OfflineInventory {
    id: string; // Supabase UUID
    medicine_name: string;
    quantity: number;
    unit_price: number;
    batch_number?: string;
    expiry_date?: string;
    is_synced: number; // 1 = Synced, 0 = Pending Upload
}

export interface OfflineOrder {
    id?: number; // Auto-increment (Local ID)
    shop_id: string; // Required for sync
    customer_name: string;
    customer_phone?: string;
    total_amount: number;
    items: any[];
    created_at: string;
    source?: string;
    payment_mode?: string;
    payment_status?: string;
    invoice_number?: string;
    is_synced: number; // 0 = Pending Upload
}

class MedixDatabase extends Dexie {
    inventory!: Table<OfflineInventory>;
    orders!: Table<OfflineOrder>;

    constructor() {
        super('MedixLiteDB');
        this.version(1).stores({
            inventory: 'id, medicine_name, batch_number, is_synced',
            orders: '++id, created_at, is_synced'
        });
        this.version(2).stores({
            inventory: 'id, medicine_name, batch_number, rack_number, is_synced',
            orders: '++id, created_at, is_synced'
        });
        // VERSION 3: Multi-Shop Isolation & Security
        this.version(3).stores({
            inventory: 'id, shop_id, [shop_id+medicine_name], batch_number, is_synced',
            orders: '++id, shop_id, created_at, is_synced'
        });
    }
}

export interface OfflineInventory {
    id: string; // Supabase UUID
    medicine_name: string;
    quantity: number;
    unit_price: number;
    batch_number?: string;
    expiry_date?: string;
    rack_number?: string;
    shelf_number?: string;
    gst_rate?: number;
    hsn_code?: string;
    description?: string;
    generic_name?: string; // For smart substitution
    composition?: string; // For accurate matching
    purchase_price?: number; // For margin calculation
    shop_id?: string; // Critical for isolation
    schedule_h1?: boolean;
    manufacturer?: string;
    is_synced: number; // 1 = Synced, 0 = Pending Upload
}

export const db = new MedixDatabase();
