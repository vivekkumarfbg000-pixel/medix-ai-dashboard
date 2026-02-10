/**
 * Test script to verify Google AI Studio API key and available models
 * Run with: node scripts/test-gemini-api.js
 */

// Replace with your actual API key
const API_KEY = 'YOUR_API_KEY_HERE';

async function listAvailableModels() {
    console.log('🔍 Fetching available Gemini models...\n');

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Error fetching models:', response.status, error);
            return;
        }

        const data = await response.json();

        console.log('✅ Available models:\n');
        data.models.forEach(model => {
            if (model.name.includes('gemini')) {
                console.log(`  📦 ${model.name}`);
                console.log(`     Display Name: ${model.displayName}`);
                console.log(`     Description: ${model.description}`);
                console.log(`     Supported methods: ${model.supportedGenerationMethods?.join(', ')}`);
                console.log('');
            }
        });
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function testGeneration() {
    console.log('\n🧪 Testing text generation...\n');

    // Try the correct model name
    const modelName = 'models/gemini-1.5-flash';

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                {
                                    text: 'Say "Hello, I am working!" in JSON format with a key called "message"'
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: 'application/json'
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Generation Error:', response.status, error);
            return;
        }

        const data = await response.json();
        console.log('✅ Generation successful!');
        console.log('Response:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run both tests
async function runTests() {
    if (API_KEY === 'YOUR_API_KEY_HERE') {
        console.error('❌ Please add your API key to the script first!');
        console.log('\n📝 Instructions:');
        console.log('1. Get your API key from: https://aistudio.google.com/app/apikey');
        console.log('2. Replace YOUR_API_KEY_HERE in this script with your actual key');
        console.log('3. Run: node scripts/test-gemini-api.js');
        return;
    }

    await listAvailableModels();
    await testGeneration();
}

runTests();
