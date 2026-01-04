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

async function testNvidia() {
    console.log("Starting NVIDIA NIM Connection Test...");

    const providerId = 'nvidia-uuid-1234';
    const userId = 'user-uuid-1234';
    const prompt = 'Hello, answer with "I am Meta Llama 3".';

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
            console.log(`Key start: ${key.substring(0, 5)}...`);

            // Try Direct Fetch
            console.log("Attempting DIRECT fetch to NVIDIA...");
            const fetch = (await import('node-fetch')).default || global.fetch;
            try {
                const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: "meta/llama-3.1-70b-instruct",
                        messages: [
                            { role: "user", content: "test" }
                        ],
                        stream: false,
                        max_tokens: 10
                    })
                });

                console.log(`Direct Fetch Status: ${res.status} ${res.statusText}`);
                const data = await res.json();
                if (!res.ok) {
                    console.log("Direct Fetch Error Body:", JSON.stringify(data, null, 2));
                } else {
                    console.log("Direct Fetch Success Content:", data.choices[0].message.content);
                }
            } catch (e) {
                console.error("Direct Fetch Exception:", e);
            }
        }

        console.log(`Sending prompt to provider ${providerId}...`);

        // Use the service
        const response = await AiService.callLLM(prompt, "You are a helpful assistant.", [], providerId, userId);

        console.log("\n--- RESPONSE FROM NVIDIA ---");
        console.log(response);
        console.log("----------------------------\n");

        if (response && response.length > 0) {
            console.log("SUCCESS: NVIDIA API responded correctly.");
        } else {
            console.error("FAILURE: Empty response from NVIDIA.");
        }

    } catch (error) {
        console.error("ERROR during NVIDIA test:", error);
    }
}

// Allow time for DB connection
setTimeout(testNvidia, 1000);
