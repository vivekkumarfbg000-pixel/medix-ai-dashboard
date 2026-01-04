const https = require('https');

const data = JSON.stringify({
    action: 'ping',
    userId: 'test-user',
    shopId: 'test-shop'
});

const options = {
    hostname: 'vivek2073.app.n8n.cloud',
    port: 443,
    path: '/webhook/operations',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('Sending request to https://vivek2073.app.n8n.cloud/webhook/operations...');

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
