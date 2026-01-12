#!/usr/bin/env node
/**
 * Database Repair Module
 * 
 * Auto-repairs database issues:
 * - Creates missing tables
 * - Adds missing columns
 * - Fixes schema inconsistencies
 * - Rebuilds indexes
 * - Vacuum and optimize
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Paths
const DB_PATH = path.join(__dirname, '../../server/database.sqlite');

// Required tables and their schemas
const REQUIRED_TABLES = {
    ai_audit_log: `
        CREATE TABLE IF NOT EXISTS ai_audit_log (
            id TEXT PRIMARY KEY,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id TEXT,
            organization_id TEXT,
            action TEXT,
            resource_type TEXT,
            resource_id TEXT,
            request_summary TEXT,
            response_summary TEXT,
            model_used TEXT,
            tokens_used INTEGER,
            cost_usd REAL,
            ip_address TEXT,
            user_agent TEXT,
            risk_level TEXT,
            flagged INTEGER DEFAULT 0,
            flag_reason TEXT
        )
    `,
    ai_rate_limits: `
        CREATE TABLE IF NOT EXISTS ai_rate_limits (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            applies_to TEXT DEFAULT 'all',
            limit_type TEXT DEFAULT 'per_day',
            limit_value INTEGER DEFAULT 1000,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    ai_learning_patterns: `
        CREATE TABLE IF NOT EXISTS ai_learning_patterns (
            id TEXT PRIMARY KEY,
            pattern_hash TEXT UNIQUE,
            pattern_type TEXT,
            pattern_data TEXT,
            success_count INTEGER DEFAULT 0,
            failure_count INTEGER DEFAULT 0,
            last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    ai_data_access_log: `
        CREATE TABLE IF NOT EXISTS ai_data_access_log (
            id TEXT PRIMARY KEY,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id TEXT,
            organization_id TEXT,
            data_type TEXT,
            data_id TEXT,
            access_type TEXT,
            purpose TEXT,
            ai_request_id TEXT
        )
    `,
    conversations: `
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT,
            title TEXT DEFAULT 'New Conversation',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_archived INTEGER DEFAULT 0,
            metadata TEXT
        )
    `,
    conversation_messages: `
        CREATE TABLE IF NOT EXISTS conversation_messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
    `,
    ai_prompt_templates: `
        CREATE TABLE IF NOT EXISTS ai_prompt_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            template_blocks TEXT,
            variables TEXT,
            is_active INTEGER DEFAULT 1,
            version INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT
        )
    `,
    ai_prompt_blocks: `
        CREATE TABLE IF NOT EXISTS ai_prompt_blocks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT,
            content TEXT NOT NULL,
            variables TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    knowledge_base: `
        CREATE TABLE IF NOT EXISTS knowledge_base (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            title TEXT NOT NULL,
            content TEXT,
            source_type TEXT DEFAULT 'document',
            source_url TEXT,
            embedding BLOB,
            metadata TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    knowledge_chunks: `
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
            id TEXT PRIMARY KEY,
            knowledge_id TEXT NOT NULL,
            chunk_index INTEGER,
            content TEXT NOT NULL,
            embedding BLOB,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (knowledge_id) REFERENCES knowledge_base(id) ON DELETE CASCADE
        )
    `
};

// Required indexes
const REQUIRED_INDEXES = [
    'CREATE INDEX IF NOT EXISTS idx_ai_audit_log_user ON ai_audit_log(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_ai_audit_log_org ON ai_audit_log(organization_id)',
    'CREATE INDEX IF NOT EXISTS idx_ai_audit_log_timestamp ON ai_audit_log(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv ON conversation_messages(conversation_id)',
    'CREATE INDEX IF NOT EXISTS idx_ai_learning_patterns_hash ON ai_learning_patterns(pattern_hash)',
    'CREATE INDEX IF NOT EXISTS idx_knowledge_base_org ON knowledge_base(organization_id)',
    'CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_kb ON knowledge_chunks(knowledge_id)'
];

// Utilities
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

// Repair functions
async function createMissingTables(db) {
    const existingTables = await dbAll(db, "SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = existingTables.map(t => t.name);
    let created = 0;

    for (const [tableName, createSQL] of Object.entries(REQUIRED_TABLES)) {
        if (!tableNames.includes(tableName)) {
            try {
                await dbRun(db, createSQL);
                created++;
            } catch (e) {
                console.error(`Failed to create ${tableName}: ${e.message}`);
            }
        }
    }

    return created;
}

async function addMissingColumns(db) {
    const columnAdditions = [
        { table: 'ai_audit_log', column: 'model_used', type: 'TEXT' },
        { table: 'ai_audit_log', column: 'tokens_used', type: 'INTEGER' },
        { table: 'ai_audit_log', column: 'cost_usd', type: 'REAL' },
        { table: 'conversations', column: 'metadata', type: 'TEXT' },
        { table: 'conversation_messages', column: 'metadata', type: 'TEXT' }
    ];

    let added = 0;

    for (const col of columnAdditions) {
        try {
            const tableInfo = await dbAll(db, `PRAGMA table_info(${col.table})`);
            const columns = tableInfo.map(c => c.name);
            
            if (!columns.includes(col.column)) {
                await dbRun(db, `ALTER TABLE ${col.table} ADD COLUMN ${col.column} ${col.type}`);
                added++;
            }
        } catch (e) {
            // Table might not exist yet
        }
    }

    return added;
}

async function createIndexes(db) {
    let created = 0;

    for (const indexSQL of REQUIRED_INDEXES) {
        try {
            await dbRun(db, indexSQL);
            created++;
        } catch (e) {
            // Index might already exist or table doesn't exist
        }
    }

    return created;
}

async function vacuumDatabase(db) {
    try {
        await dbRun(db, 'VACUUM');
        return true;
    } catch {
        return false;
    }
}

async function analyzeDatabase(db) {
    try {
        await dbRun(db, 'ANALYZE');
        return true;
    } catch {
        return false;
    }
}

async function checkIntegrity(db) {
    try {
        const result = await dbAll(db, 'PRAGMA integrity_check');
        return result[0]?.integrity_check === 'ok';
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
        // Create database directory if needed
        const dbDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        results.actions.push('Database will be created');
    }

    const db = new sqlite3.Database(DB_PATH);

    try {
        // 1. Check integrity
        const isIntact = await checkIntegrity(db);
        if (isIntact) {
            results.actions.push('Database integrity check passed');
        } else {
            results.errors.push('Database integrity check failed');
            results.success = false;
        }

        // 2. Create missing tables
        const tablesCreated = await createMissingTables(db);
        if (tablesCreated > 0) {
            results.actions.push(`Created ${tablesCreated} missing tables`);
        }

        // 3. Add missing columns
        const columnsAdded = await addMissingColumns(db);
        if (columnsAdded > 0) {
            results.actions.push(`Added ${columnsAdded} missing columns`);
        }

        // 4. Create indexes
        const indexesCreated = await createIndexes(db);
        if (indexesCreated > 0) {
            results.actions.push(`Created/verified ${indexesCreated} indexes`);
        }

        // 5. Analyze database
        const analyzed = await analyzeDatabase(db);
        if (analyzed) {
            results.actions.push('Database analyzed for query optimization');
        }

        // 6. Vacuum database (optional, can be slow)
        // const vacuumed = await vacuumDatabase(db);
        // if (vacuumed) {
        //     results.actions.push('Database vacuumed');
        // }

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
        console.log('\nDatabase Repair Results:');
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

