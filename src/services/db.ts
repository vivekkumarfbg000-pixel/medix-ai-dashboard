import Dexie, { Table } from 'dexie';

export interface Medicine {
    id?: number;
    name: string;
    genericName: string;
    batchNumber: string;
    expiryDate: Date;
    quantity: number;
    mrp: number;
    minStockLevel: number;
    isH1?: boolean;
    syncStatus?: 'pending' | 'synced' | 'failed';
    supabaseId?: string;
}

export interface Order {
    id?: number;
    customerName: string;
    doctorName?: string; // Added for H1 Compliance
    mobileNumber?: string;
    items: { medicineId: number; name: string; quantity: number; price: number; isH1?: boolean }[];
    totalAmount: number;
    status: 'pending' | 'completed' | 'cancelled';
    createdAt: Date;
    syncStatus?: 'pending' | 'synced' | 'failed';
    supabaseId?: string;
}

export class PharmaDB extends Dexie {
    medicines!: Table<Medicine>;
    orders!: Table<Order>;

    constructor() {
        super('PharmaAssistDB');
        this.version(3).stores({
            medicines: '++id, name, genericName, expiryDate, quantity, isH1, syncStatus, supabaseId',
            orders: '++id, customerName, doctorName, status, createdAt, syncStatus, supabaseId'
        });
    }
}

export const db = new PharmaDB();

// Mock Data Seeder
export const seedDatabase = async () => {
    const count = await db.medicines.count();
    if (count === 0) {
        await db.medicines.bulkAdd([
            { name: "Dolo 650", genericName: "Paracetamol", batchNumber: "B123", expiryDate: new Date("2025-12-31"), quantity: 100, mrp: 30, minStockLevel: 20 },
            { name: "Augmentin 625", genericName: "Amoxicillin + Clavulanic Acid", batchNumber: "B124", expiryDate: new Date("2024-10-15"), quantity: 50, mrp: 220, minStockLevel: 10 },
            { name: "Pantop 40", genericName: "Pantoprazole", batchNumber: "B125", expiryDate: new Date("2026-05-20"), quantity: 200, mrp: 155, minStockLevel: 30 },
            { name: "Ascoril LS", genericName: "Levosalbutamol", batchNumber: "B126", expiryDate: new Date("2024-03-01"), quantity: 5, mrp: 110, minStockLevel: 10 }, // Expiring soon mockup
            { name: "Azithral 500", genericName: "Azithromycin", batchNumber: "B127", expiryDate: new Date("2025-08-10"), quantity: 8, mrp: 120, minStockLevel: 15 } // Low stock mockup
        ]);
        console.log("Database seeded with initial inventory.");
    }
};
