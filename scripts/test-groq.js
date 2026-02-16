
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.error("❌ VITE_GROQ_API_KEY is missing in .env");
    process.exit(1);
}

const models = [
    "llama-3.3-70b-versatile",
    "llama-3.2-90b-vision-preview"
];

async function testGroq() {
    console.log("🚀 Testing Groq API...");
    console.log("API Key found: " + (GROQ_API_KEY.length > 5 ? "Yes" : "No"));

    for (const model of models) {
        console.log(`\nTesting model: ${model}...`);
        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    messages: [{ role: "user", content: "Hello, are you working?" }],
                    model: model,
                    max_tokens: 10
                })
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`❌ Failed: ${response.status} - ${text}`);
            } else {
                const data = await response.json();
                console.log(`✅ Success! Response: ${data.choices[0]?.message?.content}`);
            }
        } catch (e) {
            console.error(`❌ Exception:`, e);
        }
    }
}

testGroq();
