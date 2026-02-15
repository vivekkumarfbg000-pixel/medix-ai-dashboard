import 'dotenv/config';

// Mock Browser globals for aiService if needed, or just extract the logic
const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.error("❌ VITE_GROQ_API_KEY is missing in .env");
    process.exit(1);
}

console.log(`✅ Found API Key: ${GROQ_API_KEY.substring(0, 5)}...`);

async function callGroqAI(messages) {
    console.log("Attempting to call Groq...");
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: messages,
                model: "llama-3.3-70b-versatile",
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API Failed: ${response.status} - ${err}`);
        }

        const data = await response.json();
        console.log("✅ Groq Success:", data.choices[0]?.message?.content?.substring(0, 50) + "...");
        return data.choices[0]?.message?.content;
    } catch (e) {
        console.error("❌ Groq Call Failed:", e.message);
        throw e;
    }
}

async function testFallback() {
    console.log("--- Testing Groq Fallback Logic ---");
    try {
        await callGroqAI([{ role: "user", content: "Hello, this is a connectivity test." }]);
    } catch (e) {
        console.error("Test Failed.");
    }
}

testFallback();
