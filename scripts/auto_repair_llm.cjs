#!/usr/bin/env node
/**
 * auto_repair_llm.cjs - LLM Configuration Auto-Repair Script
 * 
 * Automatically repairs common LLM configuration issues:
 * - Syncs .env keys to database
 * - Sets default provider if missing
 * - Deactivates providers with invalid keys
 * - Fixes audit log schema
 * 
 * Run: node scripts/auto_repair_llm.cjs
 * 
 * Sources of truth:
 * - .env (API keys - MASTER)
 * - llm_providers table (runtime config)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const https = require('https');

// ============ Configuration ============
const DB_PATH = path.join(__dirname, '../server/database.sqlite');
const ENV_PATH = path.join(__dirname, '../.env');

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
        name: 'Cohere Command R+ (08-2024)',
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

// ============ Utilities ============

function loadEnv() {
    const env = {};
    if (!fs.existsSync(ENV_PATH)) {
        console.error('❌ .env file not found!');
        return env;
    }
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
            env[key] = value;
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

// Quick connection test
async function testProvider(provider, apiKey) {
    return new Promise((resolve) => {
        if (!apiKey) {
            resolve({ success: false, reason: 'No API key' });
            return;
        }

        let options;
        let data;

        switch (provider) {
            case 'openai':
                options = {
                    hostname: 'api.openai.com',
                    path: '/v1/models',
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                    timeout: 10000
                };
                data = null;
                break;
            case 'google':
                options = {
                    hostname: 'generativelanguage.googleapis.com',
                    path: `/v1beta/models?key=${apiKey}`,
                    method: 'GET',
                    timeout: 10000
                };
                data = null;
                break;
            case 'nvidia':
                options = {
                    hostname: 'integrate.api.nvidia.com',
                    path: '/v1/models',
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                    timeout: 10000
                };
                data = null;
                break;
            default:
                resolve({ success: true, reason: 'Skipped (no quick test)' });
                return;
        }

        const req = https.request(options, (res) => {
            if (res.statusCode === 200) {
                resolve({ success: true });
            } else {
                resolve({ success: false, reason: `HTTP ${res.statusCode}` });
            }
        });

        req.on('error', (e) => resolve({ success: false, reason: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, reason: 'Timeout' }); });
        if (data) req.write(data);
        req.end();
    });
}

// ============ Repair Functions ============

async function repairProviders(db, env) {
    console.log('\n📦 Syncing providers from .env to database...\n');
    
    let repaired = 0;
    let skipped = 0;

    for (const p of PROVIDERS) {
        const apiKey = env[p.env_key];
        
        if (!apiKey) {
            console.log(`  ⚪ ${p.name.padEnd(25)} - No key in .env, skipping`);
            skipped++;
            continue;
        }

        // Check if provider exists
        const existing = await dbGet(db, 'SELECT id, api_key FROM llm_providers WHERE id = ?', [p.id]);
        
        if (existing) {
            // Update if key changed
            if (existing.api_key !== apiKey) {
                await dbRun(db, `
                    UPDATE llm_providers 
                    SET api_key = ?, is_active = 1, endpoint = ?, model_id = ?
                    WHERE id = ?
                `, [apiKey, p.endpoint, p.model_id, p.id]);
                console.log(`  🔄 ${p.name.padEnd(25)} - Updated API key`);
                repaired++;
            } else {
                console.log(`  ✅ ${p.name.padEnd(25)} - Already synced`);
            }
        } else {
            // Insert new provider
            await dbRun(db, `
                INSERT INTO llm_providers (id, name, provider, api_key, endpoint, model_id, cost_per_1k, is_active, is_default, visibility)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 'public')
            `, [p.id, p.name, p.provider, apiKey, p.endpoint, p.model_id, p.cost_per_1k]);
            console.log(`  ➕ ${p.name.padEnd(25)} - Added to database`);
            repaired++;
        }
    }

    return { repaired, skipped };
}

async function repairDefaultProvider(db, env) {
    console.log('\n🎯 Checking default provider...\n');

    const defaultProvider = await dbGet(db, 'SELECT id, name FROM llm_providers WHERE is_default = 1 AND is_active = 1');
    
    if (defaultProvider) {
        console.log(`  ✅ Default provider is set: ${defaultProvider.name}`);
        return false;
    }

    // Find first working provider
    for (const p of PROVIDERS) {
        const apiKey = env[p.env_key];
        if (!apiKey) continue;

        const test = await testProvider(p.provider, apiKey);
        if (test.success) {
            await dbRun(db, 'UPDATE llm_providers SET is_default = 0');
            await dbRun(db, 'UPDATE llm_providers SET is_default = 1 WHERE id = ?', [p.id]);
            console.log(`  🔧 Set default provider: ${p.name}`);
            return true;
        }
    }

    console.log('  ⚠️  Could not find a working provider to set as default');
    return false;
}

async function repairAuditLogSchema(db) {
    console.log('\n📋 Checking audit log schema...\n');

    // Check if columns exist
    const tableInfo = await dbAll(db, "PRAGMA table_info(ai_audit_log)");
    const columns = tableInfo.map(col => col.name);
    
    const requiredColumns = [
        { name: 'model', type: 'TEXT' },
        { name: 'tokens_used', type: 'INTEGER DEFAULT 0' },
        { name: 'cost_usd', type: 'REAL DEFAULT 0' }
    ];

    let added = 0;
    for (const col of requiredColumns) {
        if (!columns.includes(col.name)) {
            try {
                await dbRun(db, `ALTER TABLE ai_audit_log ADD COLUMN ${col.name} ${col.type}`);
                console.log(`  ➕ Added column: ${col.name}`);
                added++;
            } catch (e) {
                if (!e.message.includes('duplicate column')) {
                    console.log(`  ❌ Failed to add ${col.name}: ${e.message}`);
                }
            }
        }
    }

    if (added === 0) {
        console.log('  ✅ Audit log schema is correct');
    }

    return added > 0;
}

async function cleanupInvalidProviders(db) {
    console.log('\n🧹 Cleaning up invalid providers...\n');

    const providers = await dbAll(db, "SELECT id, name, api_key FROM llm_providers WHERE is_active = 1");
    let cleaned = 0;

    for (const p of providers) {
        if (!p.api_key || p.api_key.includes('placeholder') || p.api_key === 'not-needed' || p.api_key.length < 10) {
            await dbRun(db, 'UPDATE llm_providers SET is_active = 0 WHERE id = ?', [p.id]);
            console.log(`  🗑️  Deactivated: ${p.name} (invalid key)`);
            cleaned++;
        }
    }

    if (cleaned === 0) {
        console.log('  ✅ No invalid providers found');
    }

    return cleaned;
}

// ============ Main ============

async function main() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║           LLM CONFIGURATION AUTO-REPAIR               ║');
    console.log('╚═══════════════════════════════════════════════════════╝');

    const env = loadEnv();
    const db = new sqlite3.Database(DB_PATH);

    try {
        // 1. Ensure table exists
        await dbRun(db, `CREATE TABLE IF NOT EXISTS llm_providers(
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
        )`);

        // 2. Sync providers
        const { repaired: syncRepaired } = await repairProviders(db, env);

        // 3. Set default
        const defaultRepaired = await repairDefaultProvider(db, env);

        // 4. Cleanup invalid
        const cleaned = await cleanupInvalidProviders(db);

        // 5. Fix audit schema
        const schemaRepaired = await repairAuditLogSchema(db);

        // Summary
        console.log('\n═══════════════════════════════════════════════════════════');
        const totalRepairs = syncRepaired + (defaultRepaired ? 1 : 0) + cleaned + (schemaRepaired ? 1 : 0);
        
        if (totalRepairs > 0) {
            console.log(`✅ Completed ${totalRepairs} repair(s)`);
        } else {
            console.log('✅ No repairs needed - system is healthy!');
        }

        console.log('\n💡 Run "node scripts/test_all_llm.cjs" to verify all connections.');

    } catch (error) {
        console.error('\n❌ Repair failed:', error.message);
        process.exit(1);
    } finally {
        db.close();
    }
}

main().catch(console.error);

