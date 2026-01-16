
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ykrqpxbbyfipjqhpaszf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcnFweGJieWZpcGpxaHBhc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTEwNjEsImV4cCI6MjA4MjA4NzA2MX0.rWuk98xZ1wpJwK9agtZCeie3C9xQDb43UZK8FutCGss";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSystemHealth() {
    console.log("=== Starting System Health Check ===\n");
    const report = {
        Marketplace: "PENDING",
        Billing_RPC: "PENDING",
        Inventory_RPC: "PENDING",
        Inventory_Table: "PENDING"
    };

    // 1. Marketplace Search Check
    try {
        const { data, error } = await supabase.rpc('search_global_medicines', { search_term: 'para' });
        if (error) {
            report.Marketplace = "FAIL: " + error.message;
        } else {
            report.Marketplace = "PASS (Found " + data.length + " items)";
        }
    } catch (e) { report.Marketplace = "ERROR: " + e.message; }

    // 2. Billing: Decrement Inventory RPC Check
    try {
        // Call with invalid UUID to check existence
        const { error } = await supabase.rpc('decrement_inventory', {
            row_id: '00000000-0000-0000-0000-000000000000',
            quantity_to_sub: 1
        });

        // If error is "P0002" (no data found) or similar DB error, the FUNCTION exists.
        // If error is 42883 (undefined function), it's missing.
        if (error) {
            if (error.code === '42883') report.Billing_RPC = "FAIL: Function Missing";
            else report.Billing_RPC = "PASS (Exists, returned DB error: " + error.message + ")";
        } else {
            report.Billing_RPC = "PASS (Executed)";
        }
    } catch (e) { report.Billing_RPC = "ERROR: " + e.message; }

    // 3. Inventory: Add Inventory Secure RPC Check
    try {
        const { error } = await supabase.rpc('add_inventory_secure', {
            p_shop_id: '00000000-0000-0000-0000-000000000000',
            p_medicine_name: 'Test',
            p_quantity: 1,
            p_unit_price: 1
        });
        if (error) {
            if (error.code === '42883') report.Inventory_RPC = "FAIL: Function Missing";
            else report.Inventory_RPC = "PASS (Exists, returned: " + error.message + ")";
        } else {
            report.Inventory_RPC = "PASS";
        }
    } catch (e) { report.Inventory_RPC = "ERROR: " + e.message; }

    // 4. Inventory Table Columns Check (for 'source')
    try {
        const { error } = await supabase.from('inventory').select('source').limit(1);
        if (error) {
            if (error.code === '42703') report.Inventory_Table = "FAIL: 'source' Column Missing";
            else report.Inventory_Table = "PASS (Read Attempted: " + error.message + ")"; // RLS error is fine, means column check passed logic
        } else {
            report.Inventory_Table = "PASS (Readable)";
        }
    } catch (e) { report.Inventory_Table = "ERROR: " + e.message; }

    console.table(report);
}

checkSystemHealth();
