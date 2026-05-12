import { supabase } from "@/integrations/supabase/client";

/**
 * LOCAL SUPABASE TOOLS (Client-Side Fallback)
 * These tools allow the AI to interact with the database directly when N8N is offline.
 */

export const tool_checkInventory = async (shopId: string, query: string) => {
    const { data } = await supabase
        .from('inventory')
        .select('medicine_name, quantity, batch_number, expiry_date')
        .eq('shop_id', shopId)
        .ilike('medicine_name', `%${query}%`)
        .limit(5);

    if (!data || data.length === 0) return `No stock found for '${query}'.`;
    return data.map(i => `${i.medicine_name}: ${i.quantity} units (Batch: ${i.batch_number || 'N/A'}, Expiry: ${i.expiry_date || 'N/A'})`).join('\n');
};

export const tool_checkExpiry = async (shopId: string) => {
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { data } = await supabase
        .from('inventory')
        .select('medicine_name, quantity, batch_number, expiry_date')
        .eq('shop_id', shopId)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', thirtyDaysLater.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true })
        .limit(10);

    if (!data || data.length === 0) return '✅ No medicines expiring in the next 30 days.';

    return '⚠️ Medicines expiring soon:\n' + data.map(i => {
        const daysLeft = Math.floor((new Date(i.expiry_date!).getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        return `${i.medicine_name} (${i.quantity} units): Expires in ${daysLeft} days (${i.expiry_date})`;
    }).join('\n');
};

export const tool_checkReorderLevel = async (shopId: string) => {
    const { data } = await supabase
        .from('inventory')
        .select('medicine_name, quantity, reorder_level')
        .eq('shop_id', shopId)
        .not('reorder_level', 'is', null)
        .limit(100);

    if (!data) return 'Unable to check reorder levels.';

    const needsReorder = data.filter(i => i.quantity <= (i.reorder_level || 0));

    if (needsReorder.length === 0) return '✅ All items are above reorder level.';

    return '⚠️ Items needing reorder:\n' + needsReorder.map(i =>
        `${i.medicine_name}: ${i.quantity} units (Reorder at: ${i.reorder_level})`
    ).join('\n');
};

export const tool_getLowStock = async (shopId: string, threshold: number = 10) => {
    const { data } = await supabase
        .from('inventory')
        .select('medicine_name, quantity')
        .eq('shop_id', shopId)
        .lte('quantity', threshold)
        .order('quantity', { ascending: true })
        .limit(15);

    if (!data || data.length === 0) return `✅ No items with quantity below ${threshold}.`;

    return `⚠️ Low stock items (below ${threshold}): \n` + data.map(i =>
        `${i.medicine_name}: ${i.quantity} units`
    ).join('\n');
};

export const tool_getSalesReport = async (shopId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('shop_id', shopId)
        .gte('created_at', today);

    const total = data?.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) || 0;
    const count = data?.length || 0;
    return `Today's Sales: ₹${total} (${count} orders)`;
};

export const tool_addInventory = async (shopId: string, name: string, qty: number) => {
    const { error } = await supabase.from('inventory_staging' as any).insert({
        shop_id: shopId,
        medicine_name: name,
        quantity_added: qty,
        status: 'pending',
        source: 'chatbot_fallback'
    });
    if (error) return "Failed to add inventory.";
    return `Added ${qty} units of ${name} to Drafts (Pending Review).`;
};

export const tool_addToShortbook = async (shopId: string, name: string) => {
    const { error } = await supabase.from('shortbook' as any).insert({
        shop_id: shopId,
        product_name: name,
        added_by: 'ai_assistant',
        status: 'pending'
    });
    if (error) return `Failed to add ${name} to Shortbook.`;
    return `Added ${name} to Shortbook (Purchase List).`;
};

export const tool_getPrescriptions = async (shopId: string, patientName?: string) => {
    let query = supabase
        .from('prescriptions')
        .select('customer_name, doctor_name, medicines, created_at')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(5);

    if (patientName) {
        query = query.ilike('customer_name', `%${patientName}%`);
    }

    const { data } = await query;
    if (!data || data.length === 0) return patientName ? `No prescriptions found for '${patientName}'.` : 'No recent prescriptions found.';

    return data.map(p => {
        const meds = safeJSONParse(p.medicines, []);
        const medNames = Array.isArray(meds) ? meds.map((m: any) => m.name || m.medicine_name).join(', ') : 'N/A';
        return `${p.customer_name} (Dr. ${p.doctor_name || 'Unknown'}): ${medNames} [${new Date(p.created_at || '').toLocaleDateString()}]`;
    }).join('\n\n');
};

export const tool_getSalesAnalytics = async (shopId: string, period: string = 'today') => {
    try {
        let startDate: Date;
        const now = new Date();

        switch (period.toLowerCase()) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.setHours(0, 0, 0, 0));
        }

        const { data, error } = await supabase
            .from('orders')
            .select('total_amount, order_items')
            .eq('shop_id', shopId)
            .gte('created_at', startDate.toISOString());

        if (error || !data || data.length === 0) return `No sales data for ${period}.`;

        const totalRevenue = data.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
        const orderCount = data.length;

        return `📈 Sales Analytics (${period}):\n` +
            `Total Revenue: ₹${totalRevenue.toFixed(2)}\n` +
            `Orders: ${orderCount}\n` +
            `Average Order Value: ₹${(totalRevenue / orderCount).toFixed(2)}`;
    } catch (e) {
        return 'Unable to fetch sales analytics.';
    }
};

export const tool_savePatientNote = async (shopId: string, name: string, note: string, phone?: string) => {
    let customerId = null;
    let { data: existing } = await supabase.from('customers').select('id, medical_history').eq('shop_id', shopId).ilike('name', name).limit(1).single() as any;

    if (!existing) {
        const { data: newCust, error } = await supabase.from('customers').insert({
            shop_id: shopId, name: name, phone: phone || null
        }).select().single();
        if (error || !newCust) return "Could not create patient profile.";
        customerId = newCust.id;
        existing = { id: customerId, medical_history: [] };
    } else {
        customerId = existing.id;
    }

    const history = Array.isArray(existing.medical_history) ? existing.medical_history : [];
    const newEntry = { date: new Date().toISOString().split('T')[0], note: note, doctor: 'AI Assistant' };

    const { error: updateErr } = await supabase
        .from('customers')
        .update({
            medical_history: [...history, newEntry],
            last_consultation: new Date().toISOString()
        } as any)
        .eq('id', customerId);

    if (updateErr) return "Failed to save note.";
    return `Saved to ${name}'s Medical History: "${note}"`;
};

export const tool_getInventoryValue = async (shopId: string) => {
    const { data } = await supabase
        .from('inventory')
        .select('quantity, unit_price, cost_price')
        .eq('shop_id', shopId);

    if (!data || data.length === 0) return "Zero inventory found.";

    const totalValue = data.reduce((sum, item: any) => sum + (Number(item.quantity || 0) * Number(item.unit_price || item.cost_price || 0)), 0);
    const itemCount = data.length;

    return `Total Inventory Value: ₹${totalValue.toLocaleString()}\nTotal Unique Items: ${itemCount}`;
};

export const tool_getMarketplaceBrief = async (shopId: string) => {
    // Assuming a table or just summary logic for marketplace
    const { data } = await supabase
        .from('inventory')
        .select('medicine_name, quantity')
        .eq('shop_id', shopId)
        .lt('quantity', 10)
        .limit(10);

    if (!data || data.length === 0) return "Marketplace is quiet. Your stock looks healthy.";

    return `Marketplace Recommendations:\n` + data.map(i => `• ${i.medicine_name} is running low (${i.quantity} left). Order from marketplace?`).join('\n');
};
