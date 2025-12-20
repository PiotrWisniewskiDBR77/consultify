
async function testChatWithAuth() {
    const fetch = (await import('node-fetch')).default;
    const baseUrl = 'http://localhost:3005/api';

    // 1. Register a temporary user
    const email = `test.user.${Date.now()}@example.com`;
    const password = 'Password123!';

    console.log(`Registering user: ${email}`);

    try {
        const registerRes = await fetch(`${baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                name: "Test User",
                role: "user",
                organizationName: "Test Org",
                isDemo: true
            })
        });

        const registerData = await registerRes.json();
        console.log("Register Response:", JSON.stringify(registerData, null, 2));

        if (!registerRes.ok) {
            console.error("Registration failed:", registerData);
            return;
        }

        const token = registerData.token;
        const userId = registerData.user.id;
        console.log("Registered. Token obtained.");

        // 2. Chat
        console.log("Sending chat message...");
        const chatRes = await fetch(`${baseUrl}/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                message: "Hello, are you working?",
                history: [],
                userId: userId
            })
        });

        console.log("Chat Status:", chatRes.status);
        const chatData = await chatRes.json();
        console.log("Chat Response:", JSON.stringify(chatData, null, 2));

    } catch (error) {
        console.error("Error:", error);
    }
}

testChatWithAuth();
