
// Test All AI Endpoints (Native Fetch)
// Run with: node scripts/test-all-endpoints.js

const N8N_BASE = "https://vivek2073.app.n8n.cloud/webhook";
const ENDPOINTS = {
    CHAT: `${N8N_BASE}/medix-chat-v5`, // Assuming chat was intended for v5 or skipped
    INTERACTIONS: `${N8N_BASE}/medix-interactions-v5`,
    MARKET: `${N8N_BASE}/medix-market-v5`,
    COMPLIANCE: `${N8N_BASE}/medix-compliance-v5`,
    OPS: `${N8N_BASE}/operations`,
    FORECAST: `${N8N_BASE}/medix-forecast-v5`
};

const MOCK_USER = { userId: "test-user-id", shopId: "test-shop-id" };

async function testEndpoint(name, url, payload, validator) {
    console.log(`\n--- Testing ${name} ---`);
    console.log("URL:", url);
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, ...MOCK_USER }),
        });

        if (!response.ok) {
            console.error(`FAILED ${name}: HTTP ${response.status}`);
            console.error(await response.text());
            return;
        }

        const data = await response.json();
        console.log(`Response [${name}]:`, JSON.stringify(data, null, 2));

        if (validator) {
            const validationError = validator(data);
            if (validationError) {
                console.error(`SCHEMA MISMATCH [${name}]:`, validationError);
            } else {
                console.log(`PASSED [${name}]`);
            }
        }
    } catch (error) {
        console.error(`ERROR [${name}]:`, error.message);
    }
}

async function runTests() {
    // 1. CHAT
    await testEndpoint("Chat", ENDPOINTS.CHAT, { query: "Hello" }, (data) => {
        // Updated expectation: 'output' or 'reply'
        if (!data.output && !data.reply) return "Missing 'output' or 'reply' field";
        return null;
    });
    await new Promise(r => setTimeout(r, 5000)); // Delay to avoid 429 Rate Limits

    // 2. INTERACTIONS
    await testEndpoint("Interactions", ENDPOINTS.INTERACTIONS, { drugs: ["Aspirin", "Warfarin"] }, (data) => {
        if (!data.interactions || !Array.isArray(data.interactions)) return "Missing 'interactions' array";
        return null;
    });
    await new Promise(r => setTimeout(r, 5000));

    // 3. COMPLIANCE
    await testEndpoint("Compliance", ENDPOINTS.COMPLIANCE, { drugName: "Corex" }, (data) => {
        if (typeof data.is_banned === 'undefined') return "Missing 'is_banned' field";
        return null;
    });
    await new Promise(r => setTimeout(r, 5000));

    // 4. MARKET
    await testEndpoint("Market", ENDPOINTS.MARKET, { drugName: "Dolo 650" }, (data) => {
        // Market logic in background workflow is complex, it queries DB. 
        // If DB is empty, it might return empty array.
        // Simulator returns array of opportunities.
        if (!Array.isArray(data)) return "Expected Array of opportunities";
        return null;
    });
    await new Promise(r => setTimeout(r, 5000));

    // 5. FORECAST
    await testEndpoint("Forecast", ENDPOINTS.FORECAST, {
        salesHistory: [{ medicine_name: "Dolo", last_month_sales: 100 }] // Mock history
    }, (data) => {
        // Forecast returns saved row or gemini result?
        // Workflow: Parse Gemini Forecast -> Save Predictions -> Respond
        // The workflow saves to DB, then returns $json.
        // It likely returns the inserted row.
        if (!data) return "No data returned";
        return null;
    });
    await new Promise(r => setTimeout(r, 5000));

    // 6. OPERATIONS (Scan Report - Critical Path)
    await testEndpoint("Operations (Scan Report)", ENDPOINTS.OPS, {
        action: "scan-report",
        image_base64: "base64_placeholder_string_for_testing" // Gemini might error on invalid base64 but should not 404
    }, (data) => {
        if (data.error) return "Returned error: " + JSON.stringify(data.error);
        return null;
    });
}

runTests();
