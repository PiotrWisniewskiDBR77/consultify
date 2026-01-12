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

async function testGemini() {
    console.log("Starting Gemini Connection Test...");

    // We need to find the ID of the google provider. 
    // Usually it might be dynamic, but based on previous output it was '75a5bbf9-86ed-4409-8f96-7a151c0d7deb'
    // or we can query by provider='google'

    let providerId = '';

    const provider = await new Promise((resolve) => {
        db.get("SELECT * FROM llm_providers WHERE provider = 'google'", [], (err, row) => resolve(row));
    });

    if (!provider) {
        console.error("No Gemini/Google provider found in DB.");
        return;
    }

    providerId = provider.id;
    const userId = 'user-uuid-1234';
    const prompt = 'Hello, answer with "I am Gemini".';

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

        console.log(`Found provider: ${provider.name} (${provider.id})`);
        console.log(`Key start: ${provider.api_key.substring(0, 5)}...`);
        console.log(`Model: ${provider.model_id}`);

        console.log(`Sending prompt to provider ${providerId}...`);

        // Use the service
        const response = await AiService.callLLM(prompt, "You are a helpful assistant.", [], providerId, userId);

        console.log("\n--- RESPONSE FROM GEMINI ---");
        console.log(response);
        console.log("----------------------------\n");

        if (response && response.length > 0) {
            console.log("SUCCESS: Gemini API responded correctly.");
        } else {
            console.error("FAILURE: Empty response from Gemini.");
        }

    } catch (error) {
        console.error("ERROR during Gemini test:", error);
    }
}

// Allow time for DB connection
setTimeout(testGemini, 1000);
