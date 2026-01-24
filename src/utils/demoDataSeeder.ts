import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, subDays, format } from "date-fns";

const FAKE_CUSTOMERS = [
    { name: "Rahul Sharma", phone: "9876543210", email: "rahul@example.com" },
    { name: "Priya Patel", phone: "9123456789", email: "priya@example.com" },
    { name: "Amit Singh", phone: "9988776655", email: "amit@example.com" },
    { name: "Sneha Gupta", phone: "9812345678", email: "sneha@example.com" },
    { name: "Vikram Malhotra", phone: "9898989898", email: "vikram@example.com" },
    { name: "Anjali Verma", phone: "9765432109", email: "anjali@example.com" },
    { name: "Rohan Das", phone: "9554433221", email: "rohan@example.com" },
    { name: "Kavita Reddy", phone: "9443322110", email: "kavita@example.com" },
    { name: "Suresh Iyer", phone: "9332211009", email: "suresh@example.com" },
    { name: "Neha Joshi", phone: "9221100998", email: "neha@example.com" }
];

export const seedDemoData = async (shopId: string) => {
    if (!shopId) return;
    const toastId = toast.loading("🌱 Seeding Demo Data...");

    try {
        // 1. Fetch Inventory for realistic orders
        const { data: inventory } = await supabase
            .from('inventory')
            .select('id, medicine_name, unit_price, purchase_price')
            .eq('shop_id', shopId)
            .limit(50);

        if (!inventory || inventory.length === 0) {
            toast.error("Please add some inventory first!", { id: toastId });
            return;
        }

        // 2. Insert Customers
        const customerIds: string[] = [];
        for (const fake of FAKE_CUSTOMERS) {
            const { data, error } = await supabase
                .from('customers')
                .insert({
                    shop_id: shopId,
                    name: fake.name,
                    phone: fake.phone,
                    email: fake.email,
                    credit_balance: Math.random() > 0.7 ? Math.floor(Math.random() * 2000) : 0, // 30% have debt
                    total_spent: Math.floor(Math.random() * 10000)
                })
                .select()
                .single();

            if (data) customerIds.push(data.id);
        }
        console.log(`Seeded ${customerIds.length} customers`);

        // 3. Generate Sales History (Last 30 Days)
        const orders = [];
        const orderItemsBatch = [];

        for (let i = 0; i < 50; i++) {
            const date = subDays(new Date(), Math.floor(Math.random() * 30));
            const customerIndex = Math.floor(Math.random() * customerIds.length);
            const customerId = customerIds[customerIndex];
            const customer = FAKE_CUSTOMERS[customerIndex]; // Simplified lookup

            // Pick 1-4 random items
            const numItems = Math.floor(Math.random() * 4) + 1;
            const selectedItems = [];
            let total = 0;

            for (let j = 0; j < numItems; j++) {
                const item = inventory[Math.floor(Math.random() * inventory.length)];
                const qty = Math.floor(Math.random() * 3) + 1;
                selectedItems.push({ ...item, qty });
                total += (item.unit_price * qty);
            }

            // Create Order Payload
            // Note: Using 'source' to tag as demo
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    shop_id: shopId,
                    customer_name: customer.name,
                    customer_phone: customer.phone,
                    total_amount: total,
                    status: 'approved',
                    payment_mode: Math.random() > 0.5 ? 'cash' : 'online',
                    created_at: date.toISOString(),
                    source: 'demo_seeder'
                })
                .select()
                .single();

            if (orderData) {
                // Prepare Items
                selectedItems.forEach(item => {
                    orderItemsBatch.push({
                        order_id: orderData.id,
                        inventory_id: item.id,
                        name: item.medicine_name, // Schema might use 'medicine_name' or 'name' depending on fixes, sticking to standard
                        qty: item.qty,
                        price: item.unit_price,
                        cost_price: item.purchase_price
                    });
                });
            }
        }

        // Bulk Insert Items
        if (orderItemsBatch.length > 0) {
            const { error } = await supabase.from('order_items').insert(orderItemsBatch);
            if (error) console.error("Item Seed Error", error);
        }

        toast.success("Done! Dashboard is now rich with data. 🚀", { id: toastId });
        // Reload page to show changes
        setTimeout(() => window.location.reload(), 1500);

    } catch (err: any) {
        console.error(err);
        toast.error("Seeding Failed: " + err.message, { id: toastId });
    }
};
