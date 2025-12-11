const AiService = require('./services/aiService');
const db = require('./database');

async function testAllProviders() {
    console.log("Starting Comprehensive AI Provider Test...");

    // Give DB a moment to connect
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get all active providers
    const providers = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM llm_providers WHERE is_active = 1", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    console.log(`Found ${providers.length} active providers.`);

    for (const provider of providers) {
        console.log(`\n--- Testing Provider: ${provider.name} (${provider.provider}) ---`);
        console.log(`Model: ${provider.model_id}`);
        console.log(`Endpoint: ${provider.endpoint || 'Default'}`);

        try {
            // We need to force callLLM to use this specific provider.
            // valid way is passing providerId as 4th argument
            const response = await AiService.callLLM(
                "Hello! Reply with 'OK'.",
                "You are a test bot.",
                [],
                provider.id // providerId
            );
            console.log(`✅ SUCCESS: ${provider.name} responded: "${response.slice(0, 50)}..."`);
        } catch (error) {
            console.error(`❌ FAILED: ${provider.name}`);
            console.error(`Error Message: ${error.message}`);
        }
    }
}

testAllProviders();
