
import { LLMService } from './services/ai/llmService.js';
import { LLMConfigService } from './services/ai/llmConfigService.js';
import db from './database.js';

// Mock Logger to look like real output
const logger = {
    info: (ctx, msg) => console.log(`[INFO] [${ctx}] ${msg}`),
    warn: (ctx, msg) => console.log(`[WARN] [${ctx}] ${msg}`),
    error: (ctx, msg) => console.error(`[ERROR] [${ctx}] ${msg}`)
};

// Try to inject logger if the module allows or just rely on console
try {
    const loggerModule = require('./services/ai/logger');
    loggerModule.aiLogger = logger;
} catch (e) {
    console.log('Could not mock logger, continuing...');
}

async function runVerification() {
    console.log('--- Starting Tier Routing Verification ---');

    const configService = new LLMConfigService();
    // Assuming database.js exports the db instance or a connection function
    // Looking at other files, db might need initialization or is a singleton
    // check_dbr77_data.js uses: const db = require('./database'); await db.get(...)
    // So db is likely the instance.
    configService.db = db;

    await configService.initialize();

    const tiers = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'];

    let success = true;

    for (const tier of tiers) {
        process.stdout.write(`Testing ${tier}... `);
        try {
            const provider = await configService.getNextFallback([], tier);
            if (provider) {
                console.log(`✅ Resolved to: ${provider.provider} (${provider.model_id})`);
            } else {
                console.log(`⚠️ No active provider found (Expected if no API keys set)`);
            }
        } catch (e) {
            console.log(`❌ Error: ${e.message}`);
            success = false;
        }
    }

    console.log('\n--- Verification Complete ---');
    process.exit(success ? 0 : 1);
}

runVerification().catch(err => {
    console.error(err);
    process.exit(1);
});
