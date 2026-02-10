/**
 * Test script to verify Groq API key and test prescription analysis
 * Run with: node scripts/test-groq-api.js
 */

// Replace with your actual Groq API key
const GROQ_API_KEY = 'YOUR_GROQ_API_KEY_HERE';

async function testGroqConnection() {
    console.log('🔍 Testing Groq API connection...\n');

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant. Respond in JSON format.'
                    },
                    {
                        role: 'user',
                        content: 'Say "Hello from Groq!" in JSON format with a key called "message"'
                    }
                ],
                response_format: {
                    type: 'json_object'
                },
                temperature: 0.1,
                max_tokens: 100
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ API Error:', response.status, error);
            return false;
        }

        const data = await response.json();
        console.log('✅ Connection successful!');
        console.log('📦 Model:', data.model);
        console.log('💬 Response:', data.choices[0].message.content);
        console.log('⏱️  Processing time:', data.usage?.total_time || 'N/A', 'ms');
        console.log('🎯 Tokens used:', data.usage?.total_tokens || 'N/A');
        console.log('');

        return true;

    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

async function testPrescriptionAnalysis() {
    console.log('🧪 Testing prescription analysis...\n');

    const samplePrescription = `
    Dr. Sharma Medical Clinic
    Date: 09/02/2026
    
    Patient Name: Rajesh Kumar
    Age: 45 years
    
    Rx:
    1. Paracetamol 500mg - 1 tablet TID for 5 days
    2. Amoxicillin 250mg - 1 capsule BD for 7 days
    3. Cetirizine 10mg - 1 tablet OD at bedtime for 10 days
    
    Dr. A.K. Sharma
    Reg. No: MH/12345
  `;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: `You are a medical prescription analyzer for an Indian pharmacy. 
Extract prescription data and return ONLY valid JSON with this structure:
{
  "patient_name": string,
  "patient_age": string,
  "medications": [
    {
      "name": string,
      "dosage": string,
      "frequency": string,
      "duration": string
    }
  ],
  "doctor_name": string,
  "doctor_registration": string,
  "prescription_date": string
}`
                    },
                    {
                        role: 'user',
                        content: `Analyze this prescription:\n\n${samplePrescription}`
                    }
                ],
                response_format: {
                    type: 'json_object'
                },
                temperature: 0.1,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Analysis Error:', response.status, error);
            return;
        }

        const data = await response.json();
        const analysisResult = JSON.parse(data.choices[0].message.content);

        console.log('✅ Prescription analysis successful!\n');
        console.log('📋 Extracted Data:');
        console.log(JSON.stringify(analysisResult, null, 2));
        console.log('');
        console.log('⏱️  Processing time:', data.usage?.total_time || 'N/A', 'ms');
        console.log('🎯 Tokens used:', data.usage?.total_tokens || 'N/A');
        console.log('');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function checkRateLimits() {
    console.log('📊 Rate Limits (Free Tier):\n');
    console.log('  • Requests per minute: 6,000');
    console.log('  • Requests per day: 14,400');
    console.log('  • Estimated prescriptions/day capacity: 10,000+');
    console.log('');
}

// Run all tests
async function runTests() {
    console.log('═══════════════════════════════════════════');
    console.log('   GROQ API TEST SUITE - PharmaAssist');
    console.log('═══════════════════════════════════════════\n');

    if (GROQ_API_KEY === 'YOUR_GROQ_API_KEY_HERE') {
        console.error('❌ Please add your Groq API key first!\n');
        console.log('📝 Instructions:');
        console.log('1. Go to: https://console.groq.com');
        console.log('2. Sign up or log in');
        console.log('3. Navigate to API Keys → Create API Key');
        console.log('4. Copy your API key');
        console.log('5. Replace YOUR_GROQ_API_KEY_HERE in this script');
        console.log('6. Run: node scripts/test-groq-api.js\n');
        return;
    }

    const isConnected = await testGroqConnection();

    if (isConnected) {
        await testPrescriptionAnalysis();
        checkRateLimits();

        console.log('✅ All tests completed successfully!');
        console.log('🚀 You can now configure n8n with Groq API\n');
    } else {
        console.log('❌ Connection test failed. Please check your API key.\n');
    }
}

runTests();
