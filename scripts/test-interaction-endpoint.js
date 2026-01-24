
const url = 'https://n8n.medixai.shop/webhook/medix-interactions-v5';
const data = {
    drugs: ["Aspirin", "Warfarin"]
};

console.log(`Testing: ${url}`);

try {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    console.log(`Status Code: ${response.status}`);
    const text = await response.text();
    console.log('Response Body:', text);
} catch (error) {
    console.error('Error:', error);
}
