const SUPABASE_URL = 'https://ykrqpxbbyfipjqhpaszf.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcnFweGJieWZpcGpxaHBhc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTEwNjEsImV4cCI6MjA4MjA4NzA2MX0.rWuk98xZ1wpJwK9agtZCeie3C9xQDb43UZK8FutCGss';

async function testSignup() {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: 'test' + Date.now() + '@example.com',
            password: 'password123',
            data: { full_name: 'Test Agent' }
        })
    });
    console.log('Status:', res.status);
    console.log('Response:', await res.text());
}
testSignup().catch(console.error);
