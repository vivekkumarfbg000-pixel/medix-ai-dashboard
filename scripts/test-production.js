
const BASE_URL = "https://n8n.medixai.shop/webhook";
const ENDPOINTS = {
    chat: `${BASE_URL}/medix-chat-v2`,
    compliance: `${BASE_URL}/medix-compliance-v5`,
    market: `${BASE_URL}/medix-market-v5`,
    interactions: `${BASE_URL}/medix-interactions-v5`
};

async function testEndpoint(name, url, payload) {
    console.log(`\n--- Testing ${name} ---`);
    console.log(`URL: ${url}`);
    try {
        const start = Date.now();
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const duration = Date.now() - start;

        console.log(`Status: ${response.status} (${duration}ms)`);

        if (response.ok) {
            const text = await response.text();
            try {
                const json = JSON.parse(text);
                console.log("Response:", JSON.stringify(json, null, 2).substring(0, 200) + "...");
                console.log("✅ PASS");
            } catch (e) {
                console.log("Response (Text):", text.substring(0, 200));
                console.log("⚠️ PASS (Non-JSON response)");
            }
        } else {
            console.error("❌ FAIL:", response.statusText);
            console.log(await response.text());
        }
    } catch (error) {
        console.error("❌ ERROR:", error.message);
    }
}

async function runTests() {
    console.log("🚀 Starting Production AI Tests for medixai.shop");

    // 1. Chat
    await testEndpoint("Chat Agent", ENDPOINTS.chat, {
        query: "Hello, are you online?",
        userId: "test-user",
        shopId: "test-shop"
    });

    // 2. Compliance
    await testEndpoint("Compliance Check", ENDPOINTS.compliance, {
        drugName: "Dolo 650",
        userId: "test-user"
    });

    // 3. Market Data
    await testEndpoint("Market Intelligence", ENDPOINTS.market, {
        drugName: "Paracetamol",
        userId: "test-user"
    });

    // 4. Interactions
    await testEndpoint("Interaction Checker", ENDPOINTS.interactions, {
        drugs: ["Aspirin", "Warfarin"],
        userId: "test-user"
    });

    // 5a. Prescription Scan (New Name)
    await testEndpoint("Prescription Scan (analyze-prescription)", `${BASE_URL}/analyze-prescription`, {
        action: "analyze-prescription",
        image_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        userId: "test-user"
    });

    // 5b. Prescription Scan (Old Name - Fallback)
    await testEndpoint("Prescription Scan (scan-parcha)", `${BASE_URL}/analyze-prescription`, {
        action: "scan-parcha",
        image_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        userId: "test-user"
    });

    // 6. Voice Bill (Added Action)
    await testEndpoint("Voice Bill", `${BASE_URL}/voice-bill`, {
        action: "voice-bill", // REQUIRED for N8N Router
        data: "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
        userId: "test-user"
    });
}

runTests();
