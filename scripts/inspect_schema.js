
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ykrqpxbbyfipjqhpaszf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcnFweGJieWZpcGpxaHBhc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTEwNjEsImV4cCI6MjA4MjA4NzA2MX0.rWuk98xZ1wpJwK9agtZCeie3C9xQDb43UZK8FutCGss";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchema() {
    console.log("Inspecting 'inventory' table columns...");

    // We can't query information_schema easily with supabase-js clientside/anon usually,
    // BUT we can try to RPC if enabled, or just try to select the specific column and see if it errors.

    const { data, error } = await supabase
        .from('inventory')
        .select('source') // SELECT SPECIFIC COLUMN
        .limit(1);

    if (error) {
        if (error.code === '42703') {
            console.log("RESULT: FAIL - Column 'source' DOES NOT EXIST.");
        } else {
            console.log("RESULT: UNKNOWN ERROR - " + error.message + " (" + error.code + ")");
        }
    } else {
        console.log("RESULT: SUCCESS - Column 'source' exists!");
    }
}

inspectSchema();
