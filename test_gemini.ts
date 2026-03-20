import 'dotenv/config';

async function testModels() {
    const key = process.env.GEMINI_API_KEY;
    console.log("Key Length:", key?.length);
    const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-exp'];

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-goog-api-key': key
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Respond 'OK' if you hear me." }] }]
                })
            });
            console.log(`[${model}] Status:`, res.status);
            if (!res.ok) {
                console.log(`[${model}] Error:`, await res.text());
            } else {
                const data = await res.json();
                console.log(`[${model}] Success:`, data.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 50));
            }
        } catch (e) {
            console.log(`[${model}] Crash:`, e.message);
        }
    }
}
testModels();
