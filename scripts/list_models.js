const key = process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE";

async function listModels() {
    console.log("--- LISTING MODELS ---");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("✅ Models Available (Flash only):");
            const flashModels = data.models.filter(m => m.name.toLowerCase().includes('flash'));
            flashModels.forEach(m => console.log(` - ${m.name}`));
        } else {
            console.log("❌ No models found or error occurred:");
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.log(`❌ Network Error: ${e.message}`);
    }
}

listModels();
