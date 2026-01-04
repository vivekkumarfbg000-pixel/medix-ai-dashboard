const models = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-001',
    'gemini-1.5-pro',
    'gemini-pro'
];

async function testModel(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=dummy_key_for_resource_check`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello" }] }]
            })
        });

        console.log(`Model: ${model}`);
        console.log(`Status: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log(`Body: ${text.substring(0, 200)}`); // Print first 200 chars
        console.log('-----------------------------------');
    } catch (error) {
        console.error(`Error testing ${model}:`, error.message);
    }
}

async function run() {
    for (const model of models) {
        await testModel(model);
    }
}

run();
