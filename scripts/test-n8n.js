
// Native Fetch (Node 18+)
const ENDPOINT = "https://vivek2073.app.n8n.cloud/webhook/chat";
const PAYLOAD = {
    query: "Hello Agent, this is a test.",
    userId: "test-user-id",
    shopId: "test-shop-id"
};

console.log("Testing N8N Endpoint:", ENDPOINT);
console.log("Payload:", PAYLOAD);

async function testConnection() {
    try {
        const response = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(PAYLOAD),
        });

        console.log("Status:", response.status);
        if (!response.ok) {
            console.error("Error Text:", await response.text());
            return;
        }

        const data = await response.json();
        console.log("Success! Response JSON:", JSON.stringify(data, null, 2));

        if (data.reply) {
            console.log("Verified: 'reply' field exists. Frontend should work.");
        } else {
            console.warn("Warning: 'reply' field missing. Frontend might show empty bubble.");
        }

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testConnection();
