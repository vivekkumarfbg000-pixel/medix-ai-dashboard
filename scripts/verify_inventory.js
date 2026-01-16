
import { createClient } from '@supabase/supabase-js';

// Hardcode from .env for the script execution context
const SUPABASE_URL = "https://ykrqpxbbyfipjqhpaszf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcnFweGJieWZpcGpxaHBhc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTEwNjEsImV4cCI6MjA4MjA4NzA2MX0.rWuk98xZ1wpJwK9agtZCeie3C9xQDb43UZK8FutCGss";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyInventory() {
    console.log("1. Starting Inventory Verification...");

    // Test 1: Check Connection & Read Access (Public usually blocked, but let's see)
    // We expect this might return [] or error 401 if RLS is strict
    const { data: readData, error: readError } = await supabase
        .from('inventory')
        .select('*')
        .limit(1);

    if (readError) {
        console.log("Read Check result:", readError.code, readError.message);
    } else {
        console.log("Read Check result: Success (Found " + readData.length + " items)");
    }

    // Test 2: Attempt Insert (without Auth - expecting 401, but checking if SCHEMA validation happens first)
    // Sometimes schema validation (missing column) happens before RLS
    console.log("\n2. Attempting Insert (Trace Payload)...");

    // Mimic the exact payload from the frontend
    const payload = {
        // shop_id: "some-uuid", // We don't have a valid shop ID without login, so this will fail RLS for sure
        medicine_name: "Test_Drug_" + Date.now(),
        quantity: 10,
        source: "script_verify" // Checking if this column triggers error
    };

    const { data: insertData, error: insertError } = await supabase
        .from('inventory')
        .insert(payload)
        .select();

    if (insertError) {
        console.log("Insert Check result:");
        console.log("   Code:", insertError.code);
        console.log("   Message:", insertError.message);
        console.log("   Details:", insertError.details);
        console.log("   Hint:", insertError.hint);

        if (insertError.code === '42703') {
            console.error("\nCRITICAL FAILURE: Column 'source' does not exist in the database!");
        } else if (insertError.code === '42501') {
            console.log("\nResult: RLS Permission Denied (Expected for unauthenticated script).");
            console.log("This confirms the Table Exists and is reachable.");
        }
    } else {
        console.log("Insert Check result: Success!? (Unexpected without auth)");
    }
}

verifyInventory();
