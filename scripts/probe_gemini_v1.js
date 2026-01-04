const models = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-001'
];
const versions = ['v1', 'v1beta'];

async function testModel(version, model) {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=dummy_key_for_resource_check`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello" }] }]
            })
        });

        console.log(`URL: ${url}`);
        console.log(`Status: ${response.status} ${response.statusText}`);
        // Only print body if it's NOT 400 (interesting cases) or if it IS 400 (to confirm valid)
        // Actually print body always but short
        const text = await response.text();
        console.log(`Body: ${text.substring(0, 100)}...`);
        console.log('-----------------------------------');
    } catch (error) {
        console.error(`Error testing ${version} ${model}:`, error.message);
    }
}

async function run() {
    for (const v of versions) {
        for (const m of models) {
            await testModel(v, m);
        }
    }
}

run();
