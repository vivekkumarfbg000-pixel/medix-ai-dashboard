import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY is missing in .env file!");
    process.exit(1);
}

async function checkInteractions(drugs) {
    console.log(`\n🔍 Checking interactions for: ${drugs.join(', ')}...`);

    const prompt = `
    Act as a Clinical Pharmacist. Check interactions for: ${drugs.join(', ')}.
    Return JSON only.
    Structure: {
        "interactions": [
            { "drug1": "A", "drug2": "B", "severity": "Major"|"Moderate", "description": "Reason in Hinglish" }
        ]
    }
    If no interactions, return { "interactions": [] }.
    
    CRITICAL: You MUST return a JSON object. Do not return anything else.
    `;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: "You are a clinical interaction checker. Output valid JSON only." },
                    { role: "user", content: prompt }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.1,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API Failed: ${response.status} - ${err}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content || "{}";

        console.log("\n📄 Raw AI Response:");
        console.log(content);

        const parsed = JSON.parse(content);

        if (parsed.interactions && parsed.interactions.length > 0) {
            console.log("\n✅ Interactions Detected:");
            parsed.interactions.forEach(i => {
                console.log(`- [${i.severity}] ${i.drug1} + ${i.drug2}: ${i.description}`);
            });
        } else {
            console.log("\n✅ No interactions found (as expected or issue?).");
        }

    } catch (e) {
        console.error("\n❌ Error:", e.message);
    }
}

// Test Case: High Alert Interaction
checkInteractions(["Aspirin", "Warfarin"]);
