const models = [
    'gemini-2.5-flash',
    'gemini-flash-latest'
];

const key = process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE"; // User provided key

async function run() {
    console.log("--- AUTO DIAGNOSTICS ---");
    for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
            });
            console.log(`[${model}] Status: ${response.status}`);
            if (response.status !== 200) {
                const text = await response.text();
                console.log(`   Error: ${text.substring(0, 200)}`);
            }
        } catch (e) {
            console.log(`[${model}] Network Error: ${e.message}`);
        }
    }
}

run();
