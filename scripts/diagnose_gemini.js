const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const models = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-001',
    'gemini-1.5-pro',
    'gemini-pro'
];

console.log("\n--- MEDIX AI: Gemini API Key Diagnostics ---");
console.log("This script helps verify which Google Gemini models are accessible with your API Key.\n");
console.log("Please paste your Google Gemini API Key and press Enter:");

rl.question('> ', async (key) => {
    key = key.trim();
    if (!key) {
        console.error("❌ No key provided! Exiting.");
        process.exit(1);
    }

    console.log(`\nTesting Key: ${key.substring(0, 5)}...**********`);
    console.log("--------------------------------------------------");

    for (const model of models) {
        // Use v1beta as per workflow
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: "Hello, are you operational?"
                        }]
                    }]
                })
            });

            if (response.status === 200) {
                console.log(`✅ [${model}] SUCCESS (200 OK)`);
            } else {
                const text = await response.text();
                let errorMsg = text;
                try {
                    const json = JSON.parse(text);
                    errorMsg = json.error?.message || text;
                } catch (e) { } // Keep raw text if not JSON

                console.log(`❌ [${model}] FAILED (${response.status}): ${errorMsg.substring(0, 150)}...`);
            }
        } catch (error) {
            console.error(`⚠️ [${model}] NETWORK ERROR: ${error.message}`);
        }
    }

    console.log("--------------------------------------------------");
    console.log("Diagnostics Complete.\n");
    console.log("Recommendation:");
    console.log("1. If ALL fail: Your API Key might be invalid or not enabled for Generative Language API.");
    console.log("2. If 'gemini-1.5-flash' succeeds here but fails in N8N: The issue is N8N Cloud connectivity.");
    console.log("3. If only specific models fail: Your project might have quota limits or region blocks.");

    rl.close();
});
