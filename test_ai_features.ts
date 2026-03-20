import 'dotenv/config';

// Mock Browser Environment required by aiService
global.window = {
  location: { hostname: 'localhost' }
} as any;
global.localStorage = {
  getItem: () => "test_shop_123",
  setItem: () => {}
} as any;

Object.defineProperty(global, 'navigator', {
  value: { onLine: true },
  writable: true,
  configurable: true
});

async function runTests() {
  console.log("=========================================");
  console.log("🧪 BHARAT MEDIX - AI FEATURE DIAGNOSTICS");
  console.log("=========================================\n");

  try {
    console.log("Loading AI Service module...");
    const { aiService } = await import('./src/services/aiService.ts');
    const { callGeminiVision } = await import('./src/services/ai/core.ts');
    console.log("✅ Modules loaded correctly.\n");

    // TEST 1: Chatbot (Groq via router)
    console.log("📋 TEST 1: AI Chatbot (Groq Router)");
    console.log("Sending query: 'Do you have Dolo 650?'");
    const chatStart = Date.now();
    const chatRes = await aiService.chatWithAgent("Do you have Dolo 650?");
    console.log(`✅ Success in ${Date.now() - chatStart}ms`);
    console.log(`Response: ${chatRes.reply.substring(0, 100)}...\n`);

    // TEST 2: Voice Order Parsing (Groq JSON mode)
    console.log("📋 TEST 2: Voice Order Text Parsing (JSON Mode)");
    console.log("Sending transcribed text: 'Bhaiya ek dolo dena aur azithral ka price kya hai'");
    const textStart = Date.now();
    const orderRes = await aiService.parseOrderFromText("Bhaiya ek dolo dena aur azithral ka price kya hai");
    console.log(`✅ Success in ${Date.now() - textStart}ms`);
    console.log(`Extracted Items:`, JSON.stringify(orderRes.items, null, 2), "\n");

    // TEST 3: Lab Report (Gemini Vision)
    console.log("📋 TEST 3: Lab Report Parsing (Gemini Vision w/ Base64 payload)");
    const dummyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    console.log("Testing with dynamic PNG mime_type...");
    const visionStart = Date.now();
    
    const visionRes = await callGeminiVision(
        "Return ONLY JSON: { 'status': 'success' }. Do nothing else.",
        dummyPngBase64,
        "image/png"
    );
    console.log(`✅ Success in ${Date.now() - visionStart}ms`);
    console.log(`Gemini Vision Response:`, visionRes);
    console.log("\n✅ ALL TESTS PASSED!");
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    process.exit(1);
  }
}

runTests();
