
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Load .env manually
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

// Adjusted path: scripts/ is in root, database.sqlite is in server/
const DB_PATH = path.join(__dirname, '../server/database.sqlite');
console.log('Opening database at:', DB_PATH);
const db = new sqlite3.Database(DB_PATH);

const providers = [
    {
        id: 'openai-gpt4o',
        name: 'OpenAI GPT-4o',
        provider: 'openai',
        api_key_env: 'OPENAI_API_KEY',
        endpoint: 'https://api.openai.com/v1',
        model_id: 'gpt-4o',
        cost_per_1k: 0.03
    },
    {
        id: 'gemini-pro',
        name: 'Google Gemini Pro',
        provider: 'google',
        api_key_env: 'GEMINI_API_KEY',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        model_id: 'gemini-1.5-pro-latest',
        cost_per_1k: 0.00
    },
    {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        api_key_env: 'DEEPSEEK_API_KEY',
        endpoint: 'https://api.deepseek.com',
        model_id: 'deepseek-chat',
        cost_per_1k: 0.014
    },
    {
        id: 'qwen-turbo',
        name: 'Alibaba Qwen Turbo',
        provider: 'qwen',
        api_key_env: 'QWEN_API_KEY',
        endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        model_id: 'qwen-turbo',
        cost_per_1k: 0.01
    },
    {
        id: 'zai-glm4',
        name: 'Zhipu AI GLM-4',
        provider: 'zai',
        api_key_env: 'ZAI_API_KEY',
        endpoint: 'https://open.bigmodel.cn/api/paas/v4',
        model_id: 'glm-4-plus',
        cost_per_1k: 0.10
    },
    {
        id: 'cohere-command',
        name: 'Cohere Command R+',
        provider: 'cohere',
        api_key_env: 'COHERE_API_KEY',
        endpoint: 'https://api.cohere.ai/v1',
        model_id: 'command-r-plus',
        cost_per_1k: 0.05
    },
    {
        id: 'nvidia-nim',
        name: 'NVIDIA NIM',
        provider: 'nvidia',
        api_key_env: 'NVIDIA_API_KEY',
        endpoint: 'https://integrate.api.nvidia.com/v1',
        model_id: 'meta/llama-3.1-405b-instruct',
        cost_per_1k: 0.05
    }
];

db.serialize(() => {
    // Ensure table exists (simplified create if not exists)
    db.run(`CREATE TABLE IF NOT EXISTS llm_providers(
        id TEXT PRIMARY KEY,
        name TEXT,
        provider TEXT,
        api_key TEXT,
        endpoint TEXT,
        model_id TEXT,
        cost_per_1k REAL DEFAULT 0,
        input_cost_per_1k REAL DEFAULT 0,
        output_cost_per_1k REAL DEFAULT 0,
        markup_multiplier REAL DEFAULT 1.0,
        is_active INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        visibility TEXT DEFAULT 'admin'
    )`);

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO llm_providers (id, name, provider, api_key, endpoint, model_id, cost_per_1k, is_active, visibility)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'admin')
    `);

    providers.forEach(p => {
        const apiKey = process.env[p.api_key_env];
        if (apiKey) {
            console.log(`Migrating ${p.name}...`);
            stmt.run(p.id, p.name, p.provider, apiKey, p.endpoint, p.model_id, p.cost_per_1k);
        } else {
            console.log(`Skipping ${p.name} - No API Key in .env`);
        }
    });

    stmt.finalize();
    console.log('Migration complete.');
});

db.close();
