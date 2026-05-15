import { OfflineInventory } from "@/db/db";

export interface Customer {
    id: string;
    name: string;
    phone: string;
    credit_balance?: number;
    credit_limit?: number;
}

export interface HeldBill {
    id: string;
    customer_name: string;
    items: { item: OfflineInventory; qty: number }[];
    cart: { item: OfflineInventory; qty: number }[];
    customer: Customer | null;
    timestamp: string;
    note?: string;
}
