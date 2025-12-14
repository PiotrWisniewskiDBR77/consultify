const AiService = require('../services/aiService');
const db = require('../database');

// Mock dependencies if needed, but we want to test DB integration mainly.
// aiService requires 'deps' to be set up usually, or we trust it uses require()'d modules.
// Looking at aiService.js, it uses a 'deps' object.
// We might need to mock or ensure DB is ready.

// Wait for DB to be ready (it initiates on require)
setTimeout(async () => {
    try {
        console.log("--- Verifying Global AI Roles ---");

        const roles = ['ANALYST', 'PARTNER', 'GATEKEEPER'];

        for (const role of roles) {
            console.log(`\nTesting Role: ${role}`);
            // We use enhancePrompt to get the full system prompt
            // enhancePrompt(roleKey, contextType, orgId)
            const prompt = await AiService.enhancePrompt(role, 'chat', null);

            console.log(`[PASS] Got prompt for ${role}`);
            console.log(`Snippet: ${prompt.substring(0, 150)}...`);

            if (!prompt.includes(role === 'ANALYST' ? "Expert Digital Analyst" :
                role === 'PARTNER' ? "Strategic Partner" : "Strict Gatekeeper")) {
                console.error(`[FAIL] Prompt does not match expected definition for ${role}`);
            } else {
                console.log(`[OK] Definition matches.`);
            }
        }

    } catch (e) {
        console.error("Test Failed", e);
    } finally {
        // Force exit
        process.exit(0);
    }
}, 1000);
