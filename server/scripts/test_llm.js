require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { LLMConfigService } = require('../services/ai/llmConfigService');
const db = require('../database');

async function testConnection() {
    console.log('--- LLM CONNECTION TEST ---');

    // Mock DB for the service if needed, or just let it use the real one
    // The service requires the DB to be initialized.

    // Use the service directly
    const configService = new LLMConfigService();
    await configService.initialize();

    const providers = await configService.getAllProviders();
    console.log(`Found ${providers.length} active providers.`);

    providers.forEach(p => {
        console.log(`[${p.provider}] Status: ${p.healthStatus}, Configured: ${p.isConfigured}, Tier: ${p.tier}`);
        if (p.isConfigured) {
            console.log(`   -> Active URL: ${p.endpoint}`);
        }
    });

    // We won't actually make an HTTP request to OpenAI/Google here to avoid cost/complexity in this simple script,
    // but verifying the SERVICE returns them as active is the key step 1.
}

testConnection().catch(console.error);
