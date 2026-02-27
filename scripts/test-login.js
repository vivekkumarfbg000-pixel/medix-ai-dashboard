import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ykrqpxbbyfipjqhpaszf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcnFweGJieWZpcGpxaHBhc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTEwNjEsImV4cCI6MjA4MjA4NzA2MX0.rWuk98xZ1wpJwK9agtZCeie3C9xQDb43UZK8FutCGss";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testLogin() {
  console.log("Testing login API...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password123'
  });
  
  if (error) {
    console.log("LOGIN ERROR:", error.message);
  } else {
    console.log("LOGIN SUCCESS:", data.user?.id);
  }
}

testLogin();
