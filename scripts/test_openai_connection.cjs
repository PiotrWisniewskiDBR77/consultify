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

async function testOpenAI() {
    console.log("Starting OpenAI Connection Test...");

    const providerId = 'openai-uuid-1234'; // ID from database
    const userId = 'user-uuid-1234'; // Mock User ID
    const prompt = 'Hello, are you working? Respond with "Yes, I am OpenAI".';

    try {
        // Mock TokenBillingService to avoid balance checks failure if not set up
        AiService.setDependencies({
            TokenBillingService: {
                hasSufficientBalance: async () => true,
                deductTokens: async () => true
            },
            AnalyticsService: {
                logUsage: async () => console.log("Analytics logged (mock).")
            }
        });

        console.log(`Sending prompt to provider ${providerId}...`);

        // Debug: Fetch key directly to verify
        const provider = await new Promise((resolve) => {
            db.get("SELECT * FROM llm_providers WHERE id = ?", [providerId], (err, row) => resolve(row));
        });

        if (provider) {
            const key = provider.api_key;
            console.log(`Key length: ${key.length}`);
            console.log(`Key start: ${key.substring(0, 10)}...`);
            console.log(`Key end: ...${key.substring(key.length - 10)}`);

            // Try Direct Fetch
            console.log("Attempting DIRECT fetch to OpenAI...");
            try {
                const fetch = (await import('node-fetch')).default || global.fetch; // Use global fetch if available (Node 18+) or dynamic import if needed. Node 18+ has fetch.
                // Assuming Node 18+ for this environment
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o",
                        messages: [{ role: "user", content: "test" }]
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

        const response = await AiService.callLLM(prompt, "You are a helpful assistant.", [], providerId, userId);

        console.log("\n--- RESPONSE FROM OPENAI ---");
        console.log(response);
        console.log("----------------------------\n");

        if (response && response.length > 0) {
            console.log("SUCCESS: OpenAI API responded correctly.");
        } else {
            console.error("FAILURE: Empty response from OpenAI.");
        }

    } catch (error) {
        console.error("ERROR during OpenAI test:", error);
    }
}

// Allow time for DB connection
setTimeout(testOpenAI, 1000);
