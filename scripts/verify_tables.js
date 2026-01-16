
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ykrqpxbbyfipjqhpaszf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcnFweGJieWZpcGpxaHBhc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTEwNjEsImV4cCI6MjA4MjA4NzA2MX0.rWuk98xZ1wpJwK9agtZCeie3C9xQDb43UZK8FutCGss";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyTables() {
    console.log("Verifying Tables...");

    const tables = ['inventory', 'inventory_staging', 'user_shops', 'shops', 'profiles'];
    const results = {};

    for (const table of tables) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (error) {
            if (error.code === '42P01') {
                results[table] = "MISSING (42P01)";
            } else if (error.code === '42501') {
                results[table] = "EXISTS (RLS Protected)";
            } else {
                results[table] = "ERROR: " + error.message;
            }
        } else {
            results[table] = "EXISTS (Publicly Readable)";
        }
    }

    console.table(results);
}

verifyTables();
