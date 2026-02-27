import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ykrqpxbbyfipjqhpaszf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcnFweGJieWZpcGpxaHBhc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTEwNjEsImV4cCI6MjA4MjA4NzA2MX0.rWuk98xZ1wpJwK9agtZCeie3C9xQDb43UZK8FutCGss';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
    console.log('Testing Supabase Login API...');
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
    });
    
    if (error) {
        console.error('Login Error:', error);
    } else {
        console.log('Login Success! User ID:', data.user.id);
    }
}

testLogin();
