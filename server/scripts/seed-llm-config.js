#!/usr/bin/env node
/**
 * Consolidated LLM Configuration Seed Script
 * 
 * This script replaces:
 * - server/seed/seed_llm_providers.js
 * - server/scripts/seed_llm.js  
 * - server/seed_models.js
 * - server/update_keys.js
 * 
 * Features:
 * - Initializes llm_providers table with correct schema
 * - Seeds default providers from environment variables
 * - Updates endpoints to correct URLs
 * - Syncs database with .env configuration
 * - Supports both SQLite and PostgreSQL
 * 
 * Usage:
 *   node server/scripts/seed-llm-config.js [--force] [--dry-run]
 * 
 * Options:
 *   --force    Overwrite existing configurations
 *   --dry-run  Show what would be done without making changes
 *   --verbose  Show detailed output
 */

require('dotenv').config();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// ============================================================================
// CONFIGURATION
// ============================================================================

const ARGS = {
    force: process.argv.includes('--force'),
    dryRun: process.argv.includes('--dry-run'),
    verbose: process.argv.includes('--verbose')
};

// Provider definitions with canonical environment variable names
const PROVIDER_CONFIGS = [
    {
        provider: 'openai',
        name: 'GPT-4o',
        model_id: 'gpt-4o',
        envKey: 'OPENAI_API_KEY',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        input_cost_per_1k: 0.005,
        output_cost_per_1k: 0.015,
        is_default: 0,
        visibility: 'public',
        priority: 10
    },
    {
        provider: 'openai',
        name: 'GPT-4o Mini',
        model_id: 'gpt-4o-mini',
        envKey: 'OPENAI_API_KEY',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        input_cost_per_1k: 0.00015,
        output_cost_per_1k: 0.0006,
        is_default: 0,
        visibility: 'public',
        priority: 9
    },
    {
        provider: 'openai',
        name: 'O1 Preview (Reasoning)',
        model_id: 'o1-preview',
        envKey: 'OPENAI_API_KEY',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        input_cost_per_1k: 0.015,
        output_cost_per_1k: 0.06,
        is_default: 0,
        visibility: 'admin',
        priority: 11
    },
    {
        provider: 'google',
        name: 'Gemini 2.0 Flash',
        model_id: 'gemini-2.0-flash',
        envKey: 'GOOGLE_API_KEY',
        envKeyAliases: ['GEMINI_API_KEY', 'GOOGLE_AI_KEY', 'GOOGLE_AI_API_KEY'],
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        input_cost_per_1k: 0.000,
        output_cost_per_1k: 0.000,
        is_default: 1,  // Default - free tier available
        visibility: 'public',
        priority: 12
    },
    {
        provider: 'google',
        name: 'Gemini 1.5 Pro',
        model_id: 'gemini-1.5-pro',
        envKey: 'GOOGLE_API_KEY',
        envKeyAliases: ['GEMINI_API_KEY'],
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        input_cost_per_1k: 0.00125,
        output_cost_per_1k: 0.005,
        is_default: 0,
        visibility: 'public',
        priority: 8
    },
    {
        provider: 'anthropic',
        name: 'Claude 3.5 Sonnet',
        model_id: 'claude-3-5-sonnet-20241022',
        envKey: 'ANTHROPIC_API_KEY',
        endpoint: 'https://api.anthropic.com/v1/messages',
        input_cost_per_1k: 0.003,
        output_cost_per_1k: 0.015,
        is_default: 0,
        visibility: 'public',
        priority: 10
    },
    {
        provider: 'deepseek',
        name: 'DeepSeek Chat',
        model_id: 'deepseek-chat',
        envKey: 'DEEPSEEK_API_KEY',
        endpoint: 'https://api.deepseek.com/chat/completions',
        input_cost_per_1k: 0.00014,
        output_cost_per_1k: 0.00028,
        is_default: 0,
        visibility: 'public',
        priority: 7
    },
    {
        provider: 'qwen',
        name: 'Qwen Max',
        model_id: 'qwen-max',
        envKey: 'ALIBABA_API_KEY',
        envKeyAliases: ['QWEN_API_KEY'],
        endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
        input_cost_per_1k: 0.004,
        output_cost_per_1k: 0.012,
        is_default: 0,
        visibility: 'public',
        priority: 6
    },
    {
        provider: 'zai',
        name: 'GLM-4 (Zhipu AI)',
        model_id: 'glm-4',
        envKey: 'ZAI_API_KEY',
        endpoint: 'https://api.z.ai/api/paas/v4/chat/completions',
        input_cost_per_1k: 0.01,
        output_cost_per_1k: 0.01,
        is_default: 0,
        visibility: 'admin',
        priority: 5
    },
    {
        provider: 'nvidia',
        name: 'Llama 3.1 70B (NVIDIA)',
        model_id: 'meta/llama-3.1-70b-instruct',
        envKey: 'NVIDIA_API_KEY',
        endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
        input_cost_per_1k: 0.00059,
        output_cost_per_1k: 0.00079,
        is_default: 0,
        visibility: 'public',
        priority: 6
    },
    {
        provider: 'cohere',
        name: 'Command R+',
        model_id: 'command-r-plus',
        envKey: 'COHERE_API_KEY',
        endpoint: 'https://api.cohere.ai/v1/chat',
        input_cost_per_1k: 0.003,
        output_cost_per_1k: 0.015,
        is_default: 0,
        visibility: 'public',
        priority: 5
    }
];

// ============================================================================
// DATABASE HELPERS
// ============================================================================

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getApiKey(config) {
    // Check primary env key
    let key = process.env[config.envKey];
    if (key && key.trim()) return key.trim();

    // Check aliases
    if (config.envKeyAliases) {
        for (const alias of config.envKeyAliases) {
            key = process.env[alias];
            if (key && key.trim()) {
                console.log(`  ⚠️  Using deprecated env var ${alias}. Please migrate to ${config.envKey}`);
                return key.trim();
            }
        }
    }

    return null;
}

function log(message, type = 'info') {
    const prefix = {
        info: '  ',
        success: '✅',
        warning: '⚠️ ',
        error: '❌',
        skip: '⏭️ '
    };
    console.log(`${prefix[type] || '  '} ${message}`);
}

function logVerbose(message) {
    if (ARGS.verbose) {
        console.log(`     ${message}`);
    }
}

// ============================================================================
// MAIN SEEDING FUNCTIONS
// ============================================================================

async function ensureTableExists() {
    log('Ensuring llm_providers table exists...');
    
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS llm_providers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            provider TEXT NOT NULL,
            api_key TEXT,
            endpoint TEXT,
            model_id TEXT,
            cost_per_1k REAL DEFAULT 0,
            input_cost_per_1k REAL DEFAULT 0,
            output_cost_per_1k REAL DEFAULT 0,
            markup_multiplier REAL DEFAULT 1.0,
            is_active INTEGER DEFAULT 1,
            is_default INTEGER DEFAULT 0,
            visibility TEXT DEFAULT 'admin',
            priority INTEGER DEFAULT 0,
            last_health_check TEXT,
            health_status TEXT DEFAULT 'unknown',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `;

    if (!ARGS.dryRun) {
        await dbRun(createTableSQL);
    }
    
    log('Table ready', 'success');
}

async function migrateTable() {
    log('Checking for schema migrations...');
    
    const migrations = [
        'ALTER TABLE llm_providers ADD COLUMN priority INTEGER DEFAULT 0',
        'ALTER TABLE llm_providers ADD COLUMN last_health_check TEXT',
        'ALTER TABLE llm_providers ADD COLUMN health_status TEXT DEFAULT \'unknown\'',
        'ALTER TABLE llm_providers ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP',
        'ALTER TABLE llm_providers ADD COLUMN input_cost_per_1k REAL DEFAULT 0',
        'ALTER TABLE llm_providers ADD COLUMN output_cost_per_1k REAL DEFAULT 0'
    ];

    let migratedCount = 0;
    for (const sql of migrations) {
        try {
            if (!ARGS.dryRun) {
                await dbRun(sql);
            }
            migratedCount++;
            logVerbose(`Applied: ${sql.substring(0, 60)}...`);
        } catch (e) {
            // Column already exists - this is fine
        }
    }
    
    if (migratedCount > 0) {
        log(`Applied ${migratedCount} schema migrations`, 'success');
    }
}

async function seedProviders() {
    log('Seeding LLM providers...');
    
    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const config of PROVIDER_CONFIGS) {
        const apiKey = getApiKey(config);
        
        // Check if provider already exists
        const existing = await dbGet(
            'SELECT id, api_key, endpoint FROM llm_providers WHERE provider = ? AND model_id = ?',
            [config.provider, config.model_id]
        );

        if (existing) {
            // Provider exists - check if we should update
            const needsUpdate = ARGS.force || 
                (!existing.api_key && apiKey) ||
                (existing.endpoint !== config.endpoint);

            if (needsUpdate) {
                if (!ARGS.dryRun) {
                    await dbRun(`
                        UPDATE llm_providers 
                        SET api_key = COALESCE(?, api_key),
                            endpoint = ?,
                            input_cost_per_1k = ?,
                            output_cost_per_1k = ?,
                            priority = ?,
                            visibility = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [
                        apiKey,
                        config.endpoint,
                        config.input_cost_per_1k,
                        config.output_cost_per_1k,
                        config.priority,
                        config.visibility,
                        existing.id
                    ]);
                }
                log(`Updated ${config.name}`, 'success');
                updated++;
            } else {
                logVerbose(`Skipped ${config.name} (already configured)`);
                skipped++;
            }
        } else if (apiKey) {
            // New provider with API key - add it
            const id = uuidv4();
            
            if (!ARGS.dryRun) {
                await dbRun(`
                    INSERT INTO llm_providers 
                    (id, name, provider, api_key, endpoint, model_id, 
                     input_cost_per_1k, output_cost_per_1k, 
                     is_active, is_default, visibility, priority)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                `, [
                    id,
                    config.name,
                    config.provider,
                    apiKey,
                    config.endpoint,
                    config.model_id,
                    config.input_cost_per_1k,
                    config.output_cost_per_1k,
                    config.is_default,
                    config.visibility,
                    config.priority
                ]);
            }
            log(`Added ${config.name}`, 'success');
            added++;
        } else {
            logVerbose(`Skipped ${config.name} (no API key in environment)`);
            skipped++;
        }
    }

    console.log(`\nSummary: Added ${added}, Updated ${updated}, Skipped ${skipped}`);
}

async function updateEndpoints() {
    log('Updating provider endpoints to correct URLs...');
    
    const endpointUpdates = [
        { provider: 'openai', endpoint: 'https://api.openai.com/v1/chat/completions' },
        { provider: 'anthropic', endpoint: 'https://api.anthropic.com/v1/messages' },
        { provider: 'google', endpoint: 'https://generativelanguage.googleapis.com/v1beta' },
        { provider: 'gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta' },
        { provider: 'deepseek', endpoint: 'https://api.deepseek.com/chat/completions' },
        { provider: 'qwen', endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions' },
        { provider: 'zai', endpoint: 'https://api.z.ai/api/paas/v4/chat/completions' },
        { provider: 'z_ai', endpoint: 'https://api.z.ai/api/paas/v4/chat/completions' },
        { provider: 'nvidia', endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions' },
        { provider: 'cohere', endpoint: 'https://api.cohere.ai/v1/chat' }
    ];

    let updated = 0;
    for (const update of endpointUpdates) {
        if (!ARGS.dryRun) {
            const result = await dbRun(
                'UPDATE llm_providers SET endpoint = ?, updated_at = CURRENT_TIMESTAMP WHERE provider = ? AND (endpoint IS NULL OR endpoint = \'\' OR endpoint != ?)',
                [update.endpoint, update.provider, update.endpoint]
            );
            if (result.changes > 0) {
                log(`Fixed endpoint for ${update.provider}`, 'success');
                updated++;
            }
        } else {
            logVerbose(`Would update ${update.provider} endpoint`);
        }
    }

    if (updated > 0) {
        log(`Updated ${updated} endpoints`, 'success');
    }
}

async function ensureDefaultProvider() {
    log('Ensuring a default provider is set...');
    
    // Check if any provider is marked as default
    const defaultProvider = await dbGet(
        'SELECT id, name FROM llm_providers WHERE is_default = 1 AND is_active = 1'
    );

    if (defaultProvider) {
        log(`Default provider: ${defaultProvider.name}`, 'success');
        return;
    }

    // No default - set the first active provider with an API key
    const firstActive = await dbGet(
        'SELECT id, name FROM llm_providers WHERE is_active = 1 AND api_key IS NOT NULL AND api_key != \'\' ORDER BY priority DESC LIMIT 1'
    );

    if (firstActive) {
        if (!ARGS.dryRun) {
            await dbRun('UPDATE llm_providers SET is_default = 1 WHERE id = ?', [firstActive.id]);
        }
        log(`Set ${firstActive.name} as default provider`, 'success');
    } else {
        log('No active providers with API keys found', 'warning');
    }
}

async function printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('  LLM CONFIGURATION SUMMARY');
    console.log('='.repeat(60));

    const providers = await dbAll(
        'SELECT provider, name, model_id, is_active, is_default, visibility, api_key IS NOT NULL AND api_key != \'\' as has_key FROM llm_providers ORDER BY priority DESC'
    );

    console.log(`\n  Total providers: ${providers.length}`);
    console.log(`  With API keys: ${providers.filter(p => p.has_key).length}`);
    console.log(`  Active: ${providers.filter(p => p.is_active).length}`);

    const defaultP = providers.find(p => p.is_default);
    if (defaultP) {
        console.log(`  Default: ${defaultP.name}`);
    }

    console.log('\n  Configured providers:');
    for (const p of providers.filter(p => p.has_key)) {
        const status = p.is_active ? '✅' : '⏸️ ';
        const defaultMark = p.is_default ? ' ★' : '';
        console.log(`    ${status} ${p.name} (${p.model_id})${defaultMark}`);
    }

    console.log('\n  Missing API keys:');
    for (const p of providers.filter(p => !p.has_key)) {
        console.log(`    ⬜ ${p.name}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('  CONSULTIFY LLM CONFIG SEED SCRIPT');
    console.log('='.repeat(60));
    
    if (ARGS.dryRun) {
        console.log('  MODE: DRY RUN (no changes will be made)');
    }
    if (ARGS.force) {
        console.log('  MODE: FORCE (will overwrite existing configs)');
    }
    console.log('');

    try {
        await ensureTableExists();
        await migrateTable();
        await seedProviders();
        await updateEndpoints();
        await ensureDefaultProvider();
        
        if (!ARGS.dryRun) {
            await printSummary();
        }

        console.log('\n✅ LLM configuration seed complete!\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Seed failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();

