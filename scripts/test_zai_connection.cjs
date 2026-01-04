const path = require('path');

// Mock aiQueue to prevent Redis connection
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
    if (request.includes('queues/aiQueue')) {
        return {
            add: async () => ({ id: 'mock-job-id' }),
            getJob: async () => null
        };
    }
    return originalRequire.apply(this, arguments);
};

const AiService = require('../server/services/aiService');
const db = require('../server/database');

async function testZAI() {
    console.log("Starting Z.ai Connection Test...");

    const providerId = 'zai-uuid-1234';
    const userId = 'user-uuid-1234';
    const prompt = 'Hello, answer with "I am Z.ai".';

    try {
        AiService.setDependencies({
            TokenBillingService: {
                hasSufficientBalance: async () => true,
                deductTokens: async () => true
            },
            AnalyticsService: {
                logUsage: async () => console.log("Analytics logged (mock).")
            }
        });

        const fetch = (await import('node-fetch')).default || global.fetch;
        const jwt = require('jsonwebtoken');

        // Debug: Fetch key
        const provider = await new Promise((resolve) => {
            db.get("SELECT * FROM llm_providers WHERE id = ?", [providerId], (err, row) => resolve(row));
        });

        if (provider) {
            const key = provider.api_key;
            console.log(`Key length: ${key.length}`);

            // Try Direct Fetch with token generation
            console.log("Attempting DIRECT fetch to Z.ai...");

            let token = key;
            if (key.includes('.')) {
                try {
                    const [id, secret] = key.split('.');
                    const now = Date.now();
                    const payload = {
                        api_key: id,
                        exp: now + 3600 * 1000,
                        timestamp: now
                    };
                    token = jwt.sign(payload, secret, {
                        algorithm: 'HS256',
                        header: { alg: 'HS256', sign_type: 'SIGN' }
                    });
                    console.log("Generated JWT Token for direct fetch.");
                } catch (e) {
                    console.error("Error generating token in script:", e);
                }
            }

            try {
                const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        model: "glm-4-plus",
                        messages: [
                            { role: "user", content: "test" }
                        ],
                        stream: false
                    })
                });

                console.log(`Direct Fetch Status: ${res.status} ${res.statusText}`);
                const data = await res.json();
                if (!res.ok) {
                    console.log("Direct Fetch Error Body:", JSON.stringify(data, null, 2));
                } else {
                    console.log("Direct Fetch Success:", data.choices[0].message.content);
                }
            } catch (e) {
                console.error("Direct Fetch Exception:", e);
            }
        }

        console.log(`Sending prompt to provider ${providerId}...`);

        // Use the service
        const response = await AiService.callLLM(prompt, "You are a helpful assistant.", [], providerId, userId);

        console.log("\n--- RESPONSE FROM Z.AI ---");
        console.log(response);
        console.log("--------------------------\n");

        if (response && response.length > 0) {
            console.log("SUCCESS: Z.ai API responded correctly.");
        } else {
            console.error("FAILURE: Empty response from Z.ai.");
        }

    } catch (error) {
        console.error("ERROR during Z.ai test:", error);
    }
}

// Allow time for DB connection
setTimeout(testZAI, 1000);
