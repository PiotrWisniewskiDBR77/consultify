#!/usr/bin/env node
/**
 * LLM Repair Module
 * 
 * Auto-repairs LLM configuration issues:
 * - Syncs .env keys to database
 * - Sets fallback default provider
 * - Deactivates failed providers
 * - Resets circuit breakers
 * - Updates model configurations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const https = require('https');

// Paths
const DB_PATH = path.join(__dirname, '../../server/database.sqlite');
const ENV_PATH = path.join(__dirname, '../../.env');

// Provider configurations
const PROVIDERS = [
    {
        id: 'openai-gpt4o',
        name: 'OpenAI GPT-4o',
        provider: 'openai',
        env_key: 'OPENAI_API_KEY',
        endpoint: 'https://api.openai.com/v1',
        model_id: 'gpt-4o',
        cost_per_1k: 0.03,
        priority: 1
    },
    {
        id: 'openai-gpt4o-mini',
        name: 'OpenAI GPT-4o-mini',
        provider: 'openai',
        env_key: 'OPENAI_API_KEY',
        endpoint: 'https://api.openai.com/v1',
        model_id: 'gpt-4o-mini',
        cost_per_1k: 0.0015,
        priority: 2
    },
    {
        id: 'gemini-flash',
        name: 'Google Gemini 2.0 Flash',
        provider: 'google',
        env_key: 'GEMINI_API_KEY',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        model_id: 'gemini-2.0-flash',
        cost_per_1k: 0.00,
        priority: 3
    },
    {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        env_key: 'DEEPSEEK_API_KEY',
        endpoint: 'https://api.deepseek.com',
        model_id: 'deepseek-chat',
        cost_per_1k: 0.014,
        priority: 4
    },
    {
        id: 'qwen-turbo',
        name: 'Alibaba Qwen Turbo',
        provider: 'qwen',
        env_key: 'QWEN_API_KEY',
        endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        model_id: 'qwen-turbo',
        cost_per_1k: 0.01,
        priority: 5
    },
    {
        id: 'zai-glm4plus',
        name: 'Zhipu AI GLM-4 Plus',
        provider: 'zai',
        env_key: 'ZAI_API_KEY',
        endpoint: 'https://open.bigmodel.cn/api/paas/v4',
        model_id: 'glm-4-plus',
        cost_per_1k: 0.10,
        priority: 6
    },
    {
        id: 'cohere-command',
        name: 'Cohere Command R+',
        provider: 'cohere',
        env_key: 'COHERE_API_KEY',
        endpoint: 'https://api.cohere.ai/v1',
        model_id: 'command-r-plus-08-2024',
        cost_per_1k: 0.05,
        priority: 7
    },
    {
        id: 'nvidia-llama',
        name: 'NVIDIA Llama 3.1',
        provider: 'nvidia',
        env_key: 'NVIDIA_API_KEY',
        endpoint: 'https://integrate.api.nvidia.com/v1',
        model_id: 'meta/llama-3.1-70b-instruct',
        cost_per_1k: 0.05,
        priority: 8
    }
];

// Utilities
function loadEnv() {
    const env = {};
    if (!fs.existsSync(ENV_PATH)) return env;
    
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            env[match[1].trim()] = match[2].trim().replace(/^["'](.*)["']$/, '$1');
        }
    });
    return env;
}

function dbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function testProvider(provider, apiKey) {
    return new Promise((resolve) => {
        if (!apiKey) {
            resolve({ success: false, reason: 'No API key' });
            return;
        }

        let options;
        switch (provider) {
            case 'openai':
                options = {
                    hostname: 'api.openai.com',
                    path: '/v1/models',
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                    timeout: 10000
                };
                break;
            case 'google':
                options = {
                    hostname: 'generativelanguage.googleapis.com',
                    path: `/v1beta/models?key=${apiKey}`,
                    method: 'GET',
                    timeout: 10000
                };
                break;
            default:
                resolve({ success: true, reason: 'Skipped' });
                return;
        }

        const req = https.request(options, (res) => {
            resolve({ success: res.statusCode === 200 });
        });

        req.on('error', () => resolve({ success: false }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false }); });
        req.end();
    });
}

// Repair functions
async function ensureTableExists(db) {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS llm_providers (
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
            visibility TEXT DEFAULT 'public'
        )
    `;
    await dbRun(db, createTableSQL);
    return true;
}

async function syncProviders(db, env) {
    let synced = 0;
    
    for (const p of PROVIDERS) {
        const apiKey = env[p.env_key];
        if (!apiKey) continue;

        const existing = await dbGet(db, 'SELECT id FROM llm_providers WHERE id = ?', [p.id]);
        
        if (existing) {
            await dbRun(db, `
                UPDATE llm_providers 
                SET api_key = ?, endpoint = ?, model_id = ?, is_active = 1
                WHERE id = ?
            `, [apiKey, p.endpoint, p.model_id, p.id]);
        } else {
            await dbRun(db, `
                INSERT INTO llm_providers (id, name, provider, api_key, endpoint, model_id, cost_per_1k, is_active, is_default, visibility)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 'public')
            `, [p.id, p.name, p.provider, apiKey, p.endpoint, p.model_id, p.cost_per_1k]);
        }
        synced++;
    }
    
    return synced;
}

async function setDefaultProvider(db, env) {
    const hasDefault = await dbGet(db, 'SELECT id FROM llm_providers WHERE is_default = 1 AND is_active = 1');
    if (hasDefault) return false;

    // Find first working provider
    for (const p of PROVIDERS) {
        const apiKey = env[p.env_key];
        if (!apiKey) continue;

        const test = await testProvider(p.provider, apiKey);
        if (test.success) {
            await dbRun(db, 'UPDATE llm_providers SET is_default = 0');
            await dbRun(db, 'UPDATE llm_providers SET is_default = 1 WHERE id = ?', [p.id]);
            return true;
        }
    }

    return false;
}

async function deactivateInvalidProviders(db) {
    const providers = await dbAll(db, 'SELECT id, api_key FROM llm_providers WHERE is_active = 1');
    let deactivated = 0;

    for (const p of providers) {
        if (!p.api_key || p.api_key.includes('placeholder') || p.api_key === 'not-needed' || p.api_key.length < 10) {
            await dbRun(db, 'UPDATE llm_providers SET is_active = 0 WHERE id = ?', [p.id]);
            deactivated++;
        }
    }

    return deactivated;
}

async function resetCircuitBreakers(db) {
    // Check if circuit_breaker_state table exists
    try {
        await dbRun(db, `
            CREATE TABLE IF NOT EXISTS circuit_breaker_state (
                provider_id TEXT PRIMARY KEY,
                state TEXT DEFAULT 'closed',
                failure_count INTEGER DEFAULT 0,
                last_failure DATETIME,
                last_success DATETIME
            )
        `);
        await dbRun(db, "UPDATE circuit_breaker_state SET state = 'closed', failure_count = 0");
        return true;
    } catch {
        return false;
    }
}

// Main repair function
async function repair() {
    const results = {
        success: true,
        actions: [],
        errors: []
    };

    if (!fs.existsSync(DB_PATH)) {
        results.success = false;
        results.errors.push('Database not found');
        return results;
    }

    const env = loadEnv();
    const db = new sqlite3.Database(DB_PATH);

    try {
        // 1. Ensure table exists
        await ensureTableExists(db);
        results.actions.push('Ensured llm_providers table exists');

        // 2. Sync providers from .env
        const synced = await syncProviders(db, env);
        results.actions.push(`Synced ${synced} providers from .env`);

        // 3. Set default provider
        const defaultSet = await setDefaultProvider(db, env);
        if (defaultSet) {
            results.actions.push('Set default provider');
        }

        // 4. Deactivate invalid providers
        const deactivated = await deactivateInvalidProviders(db);
        if (deactivated > 0) {
            results.actions.push(`Deactivated ${deactivated} invalid providers`);
        }

        // 5. Reset circuit breakers
        const cbReset = await resetCircuitBreakers(db);
        if (cbReset) {
            results.actions.push('Reset circuit breakers');
        }

    } catch (error) {
        results.success = false;
        results.errors.push(error.message);
    } finally {
        db.close();
    }

    return results;
}

module.exports = { repair };

if (require.main === module) {
    repair().then(result => {
        console.log('\nLLM Repair Results:');
        console.log('─'.repeat(50));
        console.log(`Success: ${result.success}`);
        console.log('\nActions taken:');
        result.actions.forEach(a => console.log(`  ✓ ${a}`));
        if (result.errors.length > 0) {
            console.log('\nErrors:');
            result.errors.forEach(e => console.log(`  ✗ ${e}`));
        }
        process.exit(result.success ? 0 : 1);
    });
}

