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

async function testCohere() {
    console.log("Starting Cohere Connection Test...");

    const providerId = 'cohere-uuid-1234';
    const userId = 'user-uuid-1234';
    const prompt = 'Hello, answer with "I am Cohere".';

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
            console.log("Attempting DIRECT fetch to Cohere...");
            const fetch = (await import('node-fetch')).default || global.fetch;
            try {
                const res = await fetch('https://api.cohere.ai/v1/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: "command-r-plus-08-2024",
                        message: "test",
                        preamble: "You are a helpful assistant."
                    })
                });

                console.log(`Direct Fetch Status: ${res.status} ${res.statusText}`);
                const data = await res.json();
                if (!res.ok) {
                    console.log("Direct Fetch Error Body:", JSON.stringify(data, null, 2));
                } else {
                    console.log("Direct Fetch Success Content:", data.text);
                }
            } catch (e) {
                console.error("Direct Fetch Exception:", e);
            }
        }

        console.log(`Sending prompt to provider ${providerId}...`);

        // Use the service
        const response = await AiService.callLLM(prompt, "You are a helpful assistant.", [], providerId, userId);

        console.log("\n--- RESPONSE FROM COHERE ---");
        console.log(response);
        console.log("----------------------------\n");

        if (response && response.length > 0) {
            console.log("SUCCESS: Cohere API responded correctly.");
        } else {
            console.error("FAILURE: Empty response from Cohere.");
        }

    } catch (error) {
        console.error("ERROR during Cohere test:", error);
    }
}

// Allow time for DB connection
setTimeout(testCohere, 1000);
