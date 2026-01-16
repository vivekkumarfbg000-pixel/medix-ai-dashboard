
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ykrqpxbbyfipjqhpaszf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcnFweGJieWZpcGpxaHBhc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTEwNjEsImV4cCI6MjA4MjA4NzA2MX0.rWuk98xZ1wpJwK9agtZCeie3C9xQDb43UZK8FutCGss";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyRPC() {
    console.log("Verifying 'add_inventory_secure' RPC...");

    // We try to call it with invalid data just to see if it EXISTS (404/400 vs 500)
    // If it exists, it might return "Access Denied" or "Invalid Shop", but not "function not found"

    const { data, error } = await supabase.rpc('add_inventory_secure', {
        p_shop_id: '00000000-0000-0000-0000-000000000000', // Invalid UUID
        p_medicine_name: 'RPC Probe',
        p_quantity: 1,
        p_unit_price: 10
    });

    if (error) {
        if (error.code === '42883') { // undefined_function
            console.log("RESULT: FAIL - RPC Function Missing. Migration NOT run.");
        } else {
            console.log("RESULT: SUCCESS (Exists) - Error captured: " + error.message + " (" + error.code + ")");
            console.log("This means the function exists but rejected our probe (which is good/expected).");
        }
    } else {
        console.log("RESULT: SUCCESS - Function executed.");
    }
}

verifyRPC();
