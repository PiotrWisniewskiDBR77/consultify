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

async function testAlibaba() {
    console.log("Starting Alibaba Qwen Connection Test...");

    const providerId = 'alibaba-uuid-1234';
    const userId = 'user-uuid-1234';
    const prompt = 'Hello, who are you?';

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

        // Debug: Fetch key
        const provider = await new Promise((resolve) => {
            db.get("SELECT * FROM llm_providers WHERE id = ?", [providerId], (err, row) => resolve(row));
        });

        if (provider) {
            const key = provider.api_key;
            console.log(`Key length: ${key.length}`);
            console.log(`Key start: ${key.substring(0, 5)}...`);

            // Try Direct Fetch (China Endpoint)
            console.log("Attempting DIRECT fetch to Alibaba (China Endpoint)...");
            let fetch = (await import('node-fetch')).default || global.fetch;
            let success = false;

            try {
                let res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: "qwen-max",
                        messages: [{ role: "user", content: "test" }]
                    })
                });

                console.log(`China Endpoint Status: ${res.status} ${res.statusText}`);
                if (res.ok) {
                    const data = await res.json();
                    console.log("Success on China Endpoint:", data.choices[0].message.content);
                    success = true;
                } else {
                    const err = await res.json();
                    console.log("Error on China Endpoint:", JSON.stringify(err));
                }
            } catch (e) {
                console.error("China Endpoint Exception:", e);
            }

            if (!success) {
                console.log("\nAttempting DIRECT fetch to Alibaba (Intl Endpoint)...");
                try {
                    let res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${key}`
                        },
                        body: JSON.stringify({
                            model: "qwen-max",
                            messages: [{ role: "user", content: "test" }]
                        })
                    });

                    console.log(`Intl Endpoint Status: ${res.status} ${res.statusText}`);
                    if (res.ok) {
                        const data = await res.json();
                        console.log("Success on Intl Endpoint:", data.choices[0].message.content);
                    } else {
                        const err = await res.json();
                        console.log("Error on Intl Endpoint:", JSON.stringify(err));
                    }
                } catch (e) {
                    console.error("Intl Endpoint Exception:", e);
                }
            }
        }

        console.log(`Sending prompt to provider ${providerId}...`);

        // Use the service
        const response = await AiService.callLLM(prompt, "You are a helpful assistant.", [], providerId, userId);

        console.log("\n--- RESPONSE FROM ALIBABA ---");
        console.log(response);
        console.log("-----------------------------\n");

        if (response && response.length > 0) {
            console.log("SUCCESS: Alibaba API responded correctly.");
        } else {
            console.error("FAILURE: Empty response from Alibaba.");
        }

    } catch (error) {
        console.error("ERROR during Alibaba test:", error);
    }
}

// Allow time for DB connection
setTimeout(testAlibaba, 1000);
