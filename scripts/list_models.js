
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY;

async function listModels() {
    console.log("Fetching Groq models...");
    try {
        const response = await fetch("https://api.groq.com/openai/v1/models", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} - ${await response.text()}`);
            return;
        }

        const data = await response.json();
        console.log("Available Models:");
        data.data.forEach(model => console.log(`- ${model.id}`));
    } catch (e) {
        console.error("Failed to fetch models", e);
    }
}

listModels();
