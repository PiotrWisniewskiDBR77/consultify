#!/usr/bin/env node
/**
 * Migration Script: SQLite to PostgreSQL
 * 
 * Migrates AI-related tables from SQLite to PostgreSQL with pgvector
 * 
 * Usage:
 *   DB_TYPE=postgres DATABASE_URL=postgres://... node scripts/migrate-sqlite-to-postgres.cjs
 */

require('dotenv').config();
const sqlite3 = require('sqlite3');
const { Pool } = require('pg');
const path = require('path');

const SQLITE_PATH = path.resolve(__dirname, '../server/consultify.db');

// PostgreSQL connection
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// SQLite connection
const sqliteDb = new sqlite3.Database(SQLITE_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Failed to open SQLite database:', err.message);
        process.exit(1);
    }
});

// Helper: Run SQLite query
const sqliteAll = (query, params = []) => new Promise((resolve, reject) => {
    sqliteDb.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
    });
});

// Helper: Run PostgreSQL query
const pgQuery = (query, params = []) => pgPool.query(query, params);

async function migrateTable(tableName, transformer) {
    console.log(`\n📦 Migrating ${tableName}...`);
    
    try {
        const rows = await sqliteAll(`SELECT * FROM ${tableName}`);
        console.log(`   Found ${rows.length} rows`);
        
        if (rows.length === 0) {
            console.log('   No data to migrate');
            return 0;
        }
        
        let migrated = 0;
        for (const row of rows) {
            try {
                const { query, params } = transformer(row);
                await pgQuery(query, params);
                migrated++;
            } catch (err) {
                // Skip duplicates
                if (err.code === '23505') {
                    console.log(`   Skipped duplicate: ${row.id || row.key || 'unknown'}`);
                } else {
                    console.error(`   Error migrating row:`, err.message);
                }
            }
        }
        
        console.log(`   ✅ Migrated ${migrated}/${rows.length} rows`);
        return migrated;
        
    } catch (err) {
        if (err.message.includes('no such table')) {
            console.log(`   Table doesn't exist in SQLite, skipping`);
            return 0;
        }
        throw err;
    }
}

async function migrate() {
    console.log('🚀 Starting SQLite to PostgreSQL migration...\n');
    console.log(`SQLite: ${SQLITE_PATH}`);
    console.log(`PostgreSQL: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')}`);
    
    const stats = {
        ai_audit_logs: 0,
        ai_system_prompts: 0,
        ai_knowledge_embeddings: 0,
        llm_providers: 0
    };
    
    // 1. Migrate ai_audit_logs
    stats.ai_audit_logs = await migrateTable('ai_audit_logs', (row) => ({
        query: `
            INSERT INTO ai_audit_logs 
            (timestamp, user_id, organization_id, capability, model, latency_ms, 
             has_screen_context, screen_context_hash, success, error_message, tokens_used, cost_usd)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT DO NOTHING
        `,
        params: [
            row.timestamp,
            row.user_id,
            row.organization_id,
            row.capability,
            row.model,
            row.latency_ms,
            !!row.has_screen_context,
            row.screen_context_hash,
            row.success === 1 || row.success === true,
            row.error_message,
            row.tokens_used || 0,
            row.cost_usd || 0
        ]
    }));
    
    // 2. Migrate ai_system_prompts
    stats.ai_system_prompts = await migrateTable('ai_system_prompts', (row) => ({
        query: `
            INSERT INTO ai_system_prompts 
            (key, description, content, context_config, is_active, version)
            VALUES ($1, $2, $3, $4::jsonb, $5, $6)
            ON CONFLICT (key) DO UPDATE SET
                content = EXCLUDED.content,
                description = EXCLUDED.description,
                updated_at = NOW()
        `,
        params: [
            row.key,
            row.description,
            row.content,
            row.context_config || '{}',
            row.is_active === 1 || row.is_active === true,
            row.version || 1
        ]
    }));
    
    // 3. Migrate ai_knowledge_embeddings (with pgvector conversion)
    stats.ai_knowledge_embeddings = await migrateTable('ai_knowledge_embeddings', (row) => {
        // Parse JSON embedding to pgvector format
        let embeddingVector = null;
        if (row.embedding) {
            try {
                const embeddingArray = JSON.parse(row.embedding);
                embeddingVector = `[${embeddingArray.join(',')}]`;
            } catch (e) {
                console.log(`   Warning: Could not parse embedding for ${row.id}`);
            }
        }
        
        return {
            query: `
                INSERT INTO ai_knowledge_embeddings 
                (document_id, chunk_index, chunk_text, embedding, metadata, source_type)
                VALUES ($1, $2, $3, $4::vector, $5::jsonb, $6)
                ON CONFLICT DO NOTHING
            `,
            params: [
                row.document_id,
                row.chunk_index || 0,
                row.content || row.chunk_text,
                embeddingVector,
                row.metadata || '{}',
                row.source_type || 'project'
            ]
        };
    });
    
    // 4. Migrate llm_providers
    stats.llm_providers = await migrateTable('llm_providers', (row) => ({
        query: `
            INSERT INTO llm_providers 
            (id, name, provider, api_key, endpoint, model_id, cost_per_1k, 
             input_cost_per_1k, output_cost_per_1k, markup_multiplier, is_active, is_default, visibility)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                api_key = EXCLUDED.api_key,
                is_active = EXCLUDED.is_active
        `,
        params: [
            row.id,
            row.name,
            row.provider,
            row.api_key,
            row.endpoint,
            row.model_id,
            row.cost_per_1k || 0,
            row.input_cost_per_1k || 0,
            row.output_cost_per_1k || 0,
            row.markup_multiplier || 1.0,
            row.is_active === 1 || row.is_active === true,
            row.is_default === 1 || row.is_default === true,
            row.visibility || 'admin'
        ]
    }));
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(50));
    Object.entries(stats).forEach(([table, count]) => {
        console.log(`   ${table}: ${count} rows`);
    });
    console.log('='.repeat(50));
    console.log('\n✅ Migration completed!\n');
    
    // Cleanup
    sqliteDb.close();
    await pgPool.end();
}

// Run migration
migrate().catch(err => {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
});

