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
    customer_name: string;
    customer_phone?: string;
    total_amount: number;
    items: any[];
    created_at: string;
    is_synced: number; // 0 = Pending Upload
}

class MedixDatabase extends Dexie {
    inventory!: Table<OfflineInventory>;
    orders!: Table<OfflineOrder>;

    constructor() {
        super('MedixLiteDB');
        this.version(1).stores({
            inventory: 'id, medicine_name, batch_number, is_synced', // Primary key and indexes
            orders: '++id, created_at, is_synced'      // Auto-increment ID for offline orders
        });
        this.version(2).stores({
            inventory: 'id, medicine_name, batch_number, rack_number, is_synced', // Added rack_number index
            orders: '++id, created_at, is_synced'
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
    is_synced: number; // 1 = Synced, 0 = Pending Upload
}

export const db = new MedixDatabase();
