import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ykrqpxbbyfipjqhpaszf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcnFweGJieWZpcGpxaHBhc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTEwNjEsImV4cCI6MjA4MjA4NzA2MX0.rWuk98xZ1wpJwK9agtZCeie3C9xQDb43UZK8FutCGss";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyPaymentMode() {
    console.log("Checking if 'sales' table has 'payment_mode'...");
    const { data, error } = await supabase
        .from('sales')
        .select('payment_mode')
        .limit(1);

    if (error) {
        console.log("Error code:", error.code);
        console.log("Error message:", error.message);
    } else {
        console.log("SUCCESS! payment_mode exists in sales table.");
    }
}

verifyPaymentMode();
