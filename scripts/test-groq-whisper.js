
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
// Node 18+ has native fetch and FormData
// No need to import them from node-fetch
// import fetch from 'node-fetch'; 

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const API_KEY = process.env.VITE_GROQ_API_KEY;

if (!API_KEY) {
    console.error("❌ VITE_GROQ_API_KEY is missing in .env");
    process.exit(1);
}


// 1. Create 1 second of silence (WAV)
const sampleRate = 44100;
const numChannels = 1;
const bitsPerSample = 16;
const durationSeconds = 1;
const dataSize = sampleRate * numChannels * (bitsPerSample / 8) * durationSeconds;
const fileSize = 36 + dataSize;

const wavHeader = Buffer.alloc(44);
wavHeader.write("RIFF", 0);
wavHeader.writeUInt32LE(fileSize, 4);
wavHeader.write("WAVE", 8);
wavHeader.write("fmt ", 12);
wavHeader.writeUInt32LE(16, 16); // PCM chunk size
wavHeader.writeUInt16LE(1, 20); // Audio format 1=PCM
wavHeader.writeUInt16LE(numChannels, 22);
wavHeader.writeUInt32LE(sampleRate, 24);
wavHeader.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // Byte rate
wavHeader.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // Block align
wavHeader.writeUInt16LE(bitsPerSample, 34);
wavHeader.write("data", 36);
wavHeader.writeUInt32LE(dataSize, 40);

const data = Buffer.alloc(dataSize); // silence
const finalBuffer = Buffer.concat([wavHeader, data]);


// Write temp file
const tempFilePath = path.resolve(process.cwd(), 'temp_silence.wav');
fs.writeFileSync(tempFilePath, finalBuffer);

async function testWhisper() {
    console.log("🚀 Testing Groq Whisper API...");
    console.log(`Endpoint: https://api.groq.com/openai/v1/audio/transcriptions`);
    console.log(`Model: whisper-large-v3`);

    try {
        const formData = new FormData();
        // Native FormData requires Blob in Node environment for files
        const blob = new Blob([fs.readFileSync(tempFilePath)], { type: 'audio/wav' });
        formData.append('file', blob, 'test_silence.wav'); // Filename is crucial
        formData.append('model', 'whisper-large-v3');
        formData.append('response_format', 'json');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                // Do NOT set Content-Type manually, let fetch set it with boundary
            },
            body: formData
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`❌ API Failed: ${response.status} - ${text}`);
            return;
        }

        const data = await response.json();
        console.log("✅ Success!");
        console.log("Response:", JSON.stringify(data, null, 2));

        // It might be empty text for silence, which is fine, as long as it's 200 OK.
        if (data.text !== undefined) {
            console.log("Transcription Text:", data.text);
        }

    } catch (error) {
        console.error("❌ Exception:", error);
    } finally {
        // Cleanup
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
}

testWhisper();
