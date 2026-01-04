const key = "AIzaSyDI4TPL2r8IShASlqSNATT3exBsyz9yEmo";

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
