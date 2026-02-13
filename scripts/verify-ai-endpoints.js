
// Output nothing - skipped update

// Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.warn("⚠️  GROQ_API_KEY is missing. Please set it via environment variables.");
}
const MODEL = "llama-3.3-70b-versatile";

// --- Helper for Direct Groq Calls (Simulating the Service Fallback) ---
async function callGroqDirect(messages, jsonMode = true) {
    try {
        const body = {
            messages: messages,
            model: MODEL,
            temperature: 0.7
        };
        if (jsonMode) body.response_format = { type: "json_object" };

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            console.error("Groq API Error:", await response.text());
            return null;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content;
    } catch (e) {
        console.error("Groq Call Error:", e.message);
        return null;
    }
}

// --- Test 1: Chat (Hinglish) ---
async function testGroqChat() {
    console.log("\n--- 1. Testing Hinglish Chat Fallback ---");
    const SYSTEM_PROMPT = "You are MedixAI, an expert clinical pharmacist in India. Answer queries in Hinglish (Hindi + English mix). Be professional, helpful, and concise.";

    // Disable JSON mode for chat
    const content = await callGroqDirect([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Mujhe sardi khasi hai, kya lu?" }
    ], false);

    console.log("Chat Response:", content);
    if (content && (content.toLowerCase().includes("karein") || content.toLowerCase().includes("hai") || content.toLowerCase().includes("tablet") || content.toLowerCase().includes("sakte"))) {
        console.log("✅ SUCCESS: Hinglish response detected.");
    } else {
        console.log("⚠️ CHECK: Response might be empty or not Hinglish.");
    }
}

// --- Test 2: Interactions (Hinglish Warnings) ---
async function testGroqInteractions() {
    console.log("\n--- 2. Testing Hinglish Interaction Warnings ---");
    const prompt = `
    Act as a Clinical Pharmacist in India. Check for interactions between these drugs: Aspirin, Warfarin.
    Return a valid JSON array of strings ONLY. 
    Each string should be a warning starting with "⚠️ Major" or "⚠️ Moderate".
    The warning message MUST be in HINGLISH (Hindi + English mix).
    `;

    const content = await callGroqDirect([
        { role: "system", content: "You are a clinical interaction checker. Output valid JSON only." },
        { role: "user", content: prompt }
    ], true);

    console.log("Interaction Response:", content);
    try {
        const parsed = JSON.parse(content);
        // Handle flexible response formats from LLM (Array, or Object with keys)
        const warnings = Array.isArray(parsed) ? parsed : (parsed.warnings || parsed.interactions || []);

        console.log("Parsed Warnings:", warnings);
        if (warnings.length > 0) {
            console.log("✅ SUCCESS: Found Interaction Warnings.");
        } else {
            console.log("⚠️ CHECK: No warnings found or format mismatch.");
        }
    } catch (e) { console.error("JSON Parse Fail:", e.message); }
}

// --- Test 3: Compliance (Banned Status) ---
async function testGroqCompliance() {
    console.log("\n--- 3. Testing Compliance Fallback ---");
    const prompt = `
    Check strictly for Indian CDSCO/FDA regulations for the drug: "Corex Codeine".
    1. Is it a BANNED drug in India? (is_banned)
    2. Is it a Schedule H/H1 drug requiring prescription? (is_h1)
    3. Provide a short reason in HINGLISH.
    Return JSON only: { "is_banned": boolean, "is_h1": boolean, "reason": "Reason in Hinglish" }
    `;

    const content = await callGroqDirect([
        { role: "system", content: "You are a Regulatory Affairs Specialist. Output valid JSON only." },
        { role: "user", content: prompt }
    ], true);

    console.log("Compliance Response:", content);
    try {
        const parsed = JSON.parse(content);
        if (parsed.is_banned !== undefined) console.log("✅ SUCCESS: Valid Compliance JSON.");
    } catch (e) { console.error("JSON Parse Fail"); }
}

// --- Test 4: Inventory Forecast ---
async function testGroqForecast() {
    console.log("\n--- 4. Testing Inventory Forecast Fallback ---");
    // Updated sales data format to match what aiService expects
    const salesData = [{ d: "2024-01-01", i: "Dolo 650 x 100" }, { d: "2024-01-02", i: "Dolo 650 x 50" }];
    const prompt = `
    Analyze these recent pharmacy sales.
    Predict next week's restocking needs for top 3 selling items.
    Return JSON only:
    {
        "forecast": [
            { "product": "Drug Name", "suggested_restock": 10, "confidence": 0.85, "reason": "Reason in Hinglish" }
        ]
    }
    Data: ${JSON.stringify(salesData)}
    `;

    const content = await callGroqDirect([
        { role: "system", content: "You are an Inventory Analyst. Output valid JSON only." },
        { role: "user", content: prompt }
    ], true);

    console.log("Forecast Response:", content);
    try {
        const parsed = JSON.parse(content);
        if (parsed.forecast) console.log("✅ SUCCESS: Valid Forecast JSON.");
    } catch (e) { console.error("JSON Parse Fail"); }
}

async function run() {
    await testGroqChat();
    await testGroqInteractions();
    await testGroqCompliance();
    await testGroqForecast();
}

run();
