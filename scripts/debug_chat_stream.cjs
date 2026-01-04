const http = require('http');

// Adjust port if needed
const PORT = process.env.PORT || 3001;

function testChatStream() {
    console.log(`Testing Chat Stream on http://localhost:${PORT}/api...`);

    // Mock Payload with Nested Context (The Fix)
    const context = {
        screenContext: { _meta: { title: 'Test Screen' }, data: [] },
        pmo: { projectId: 'test-project-id' },
        global: { user: 'test-user' }
    };

    const payload = JSON.stringify({
        message: "Test message",
        history: [],
        context: context, // Simulating the fix
        language: 'en'
    });

    const options = {
        hostname: 'localhost',
        port: PORT,
        path: '/api/ai/chat/stream',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'Authorization': 'Bearer mock-token'
        }
    };

    const req = http.request(options, (res) => {
        console.log(`Response Status: ${res.statusCode} ${res.statusMessage}`);

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            console.log('Chunk received:', chunk);
        });

        res.on('end', () => {
            console.log('Stream ended.');
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    // Write data to request body
    req.write(payload);
    req.end();
}

testChatStream();
