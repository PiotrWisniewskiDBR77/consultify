
async function testChat() {
    const fetch = (await import('node-fetch')).default;
    console.log("Testing Chat Endpoint...");
    try {
        const response = await fetch('http://localhost:3005/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "Hello, are you working?",
                history: [],
                userId: "user-dbr77-user-1765481480345"
            })
        });

        console.log("Status:", response.status);
        const data = await response.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Request Failed:", error);
    }
}

testChat();
