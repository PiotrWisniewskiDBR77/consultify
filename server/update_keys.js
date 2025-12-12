const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const KEYS = {
    'openai': process.env.OPENAI_API_KEY || '',
    'z_ai': process.env.ZAI_API_KEY || '',
    'qwen': process.env.QWEN_API_KEY || '',
    'google': process.env.GOOGLE_API_KEY || '',
    'deepseek': process.env.DEEPSEEK_API_KEY || '',
    'nvidia': process.env.NVIDIA_API_KEY || '',
    'cohere': process.env.COHERE_API_KEY || ''
};

// Providers that need specific full-path endpoint updates
const ENDPOINT_UPDATES = {
    'openai': 'https://api.openai.com/v1/chat/completions',
    'anthropic': 'https://api.anthropic.com/v1/messages',
    'z_ai': 'https://api.z.ai/api/paas/v4/chat/completions', // NEW CORRECT ENDPOINT
    'qwen': 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', // Validated Intl Endpoint
    'deepseek': 'https://api.deepseek.com/chat/completions',
    'nvidia': 'https://integrate.api.nvidia.com/v1/chat/completions',
    'cohere': 'https://api.cohere.ai/v1/chat'
};

// Map provider keys to model IDs/configs if not already present
const NEW_PROVIDERS = [
    {
        name: 'Zhipu AI (GLM-4.6)',
        provider: 'z_ai',
        model_id: 'glm-4.6',
        endpoint: 'https://api.z.ai/api/paas/v4/chat/completions',
        cost: 0.01
    },
    {
        name: 'Alibaba Qwen Max',
        provider: 'qwen',
        model_id: 'qwen-max',
        endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
        cost: 0.005
    },
    {
        name: 'Google Gemini 2.0 Flash',
        provider: 'google',
        model_id: 'gemini-2.0-flash',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        cost: 0.005
    },
    {
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        model_id: 'deepseek-chat',
        endpoint: 'https://api.deepseek.com/chat/completions',
        cost: 0.002
    },
    {
        name: 'NVIDIA Llama 3',
        provider: 'nvidia',
        model_id: 'meta/llama3-8b-instruct', // Trying smaller model or different ID
        endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
        cost: 0.005
    },
    {
        name: 'Cohere Command R',
        provider: 'cohere',
        model_id: 'command-r',
        endpoint: 'https://api.cohere.ai/v1/chat', // Reverting to .ai just in case, matching default
        cost: 0.003
    }
];

console.log("Updating API Keys...");

db.serialize(() => {
    // 1. Update Existing Providers (OpenAI, Gemini are likely already seeded)
    const updateStmt = db.prepare("UPDATE llm_providers SET api_key = ?, is_active = 1 WHERE provider = ?");

    Object.entries(KEYS).forEach(([provider, key]) => {
        const trimmedKey = key.trim();
        updateStmt.run(trimmedKey, provider, function (err) {
            if (err) console.error(`Error updating ${provider}:`, err);
            else if (this.changes > 0) console.log(`✅ Updated existing provider: ${provider}`);
        });
    });
    updateStmt.finalize();

    // 1b. Update Endpoints for ALL providers (fix base URL issues)
    const updateEndpointStmt = db.prepare("UPDATE llm_providers SET endpoint = ? WHERE provider = ?");
    Object.entries(ENDPOINT_UPDATES).forEach(([provider, endpoint]) => {
        updateEndpointStmt.run(endpoint, provider, function (err) {
            if (!err && this.changes > 0) console.log(`✅ Updated endpoint for ${provider}`);
        });
    });
    updateEndpointStmt.finalize();


    // 2. Insert New Providers if they don't exist
    // simpler approach: UPDATE endpoint first, then INSERT IGNORE
    const insertStmt = db.prepare(`
        INSERT INTO llm_providers (
            id, name, provider, api_key, endpoint, model_id, 
            cost_per_1k, is_active, visibility, is_default
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'public', 0)
    `);

    NEW_PROVIDERS.forEach(p => {
        if (KEYS[p.provider]) {
            // Check if exists
            db.get("SELECT id FROM llm_providers WHERE provider = ?", [p.provider], (err, row) => {
                if (!row) {
                    const trimmedKey = KEYS[p.provider].trim();
                    insertStmt.run(
                        uuidv4(), p.name, p.provider, trimmedKey, p.endpoint, p.model_id, p.cost,
                        (err) => {
                            if (!err) console.log(`✅ Inserted ${p.name}`);
                            else console.error(`Error inserting ${p.name}`, err);
                        }
                    );
                } else {
                    // Update existing model ID if it's new (optional, but good for cohere/nvidia fix)
                    db.run("UPDATE llm_providers SET model_id = ? WHERE provider = ?", [p.model_id, p.provider], (err) => {
                        if (!err) console.log(`✅ Refreshed model ID for ${p.name}`);
                    });
                }
            });
        }
    });
    // insertStmt.finalize(); // Can't finalize immediately inside callback loop logic, let it close with db
});

setTimeout(() => {
    db.close();
    console.log("Done updating keys.");
}, 2000);

