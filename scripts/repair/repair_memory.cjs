#!/usr/bin/env node
/**
 * Memory Repair Module
 * 
 * Auto-repairs memory system issues:
 * - Clears corrupted memory entries
 * - Rebuilds memory indexes
 * - Resets stale sessions
 * - Fixes orphaned references
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Paths
const DB_PATH = path.join(__dirname, '../../server/database.sqlite');

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

function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Repair functions
async function ensureMemoryTablesExist(db) {
    const tables = [
        `CREATE TABLE IF NOT EXISTS ai_session_memory (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            user_id TEXT,
            key TEXT NOT NULL,
            value TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME
        )`,
        `CREATE TABLE IF NOT EXISTS ai_project_memory (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            organization_id TEXT,
            key TEXT NOT NULL,
            value TEXT,
            significance REAL DEFAULT 0.5,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS ai_organization_memory (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    ];

    let created = 0;
    for (const sql of tables) {
        try {
            await dbRun(db, sql);
            created++;
        } catch (e) {
            // Table might already exist
        }
    }

    return created;
}

async function clearExpiredSessions(db) {
    let cleared = 0;

    try {
        // Clear expired session memory
        const result = await dbRun(db, `
            DELETE FROM ai_session_memory 
            WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
        `);
        cleared += result.changes || 0;
    } catch {
        // Table might not exist
    }

    return cleared;
}

async function clearCorruptedEntries(db) {
    let cleared = 0;

    // Tables to check for corrupted JSON values
    const tables = ['ai_session_memory', 'ai_project_memory', 'ai_organization_memory'];

    for (const table of tables) {
        try {
            // Get all entries
            const entries = await dbAll(db, `SELECT id, value FROM ${table}`);
            
            for (const entry of entries) {
                if (entry.value) {
                    try {
                        // Try to parse JSON
                        JSON.parse(entry.value);
                    } catch {
                        // Invalid JSON, delete entry
                        await dbRun(db, `DELETE FROM ${table} WHERE id = ?`, [entry.id]);
                        cleared++;
                    }
                }
            }
        } catch {
            // Table might not exist
        }
    }

    return cleared;
}

async function rebuildMemoryIndexes(db) {
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_session_memory_session ON ai_session_memory(session_id)',
        'CREATE INDEX IF NOT EXISTS idx_session_memory_user ON ai_session_memory(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_project_memory_project ON ai_project_memory(project_id)',
        'CREATE INDEX IF NOT EXISTS idx_project_memory_org ON ai_project_memory(organization_id)',
        'CREATE INDEX IF NOT EXISTS idx_org_memory_org ON ai_organization_memory(organization_id)',
        'CREATE INDEX IF NOT EXISTS idx_learning_patterns_type ON ai_learning_patterns(pattern_type)'
    ];

    let created = 0;
    for (const sql of indexes) {
        try {
            await dbRun(db, sql);
            created++;
        } catch {
            // Index might already exist or table doesn't exist
        }
    }

    return created;
}

async function fixOrphanedConversationMessages(db) {
    let fixed = 0;

    try {
        // Delete messages with no parent conversation
        const result = await dbRun(db, `
            DELETE FROM conversation_messages 
            WHERE conversation_id NOT IN (SELECT id FROM conversations)
        `);
        fixed = result.changes || 0;
    } catch {
        // Tables might not exist
    }

    return fixed;
}

async function cleanupLearningPatterns(db) {
    let cleaned = 0;

    try {
        // Remove patterns with no success and high failure count
        const result = await dbRun(db, `
            DELETE FROM ai_learning_patterns 
            WHERE success_count = 0 AND failure_count > 10
        `);
        cleaned += result.changes || 0;

        // Remove very old unused patterns
        const oldResult = await dbRun(db, `
            DELETE FROM ai_learning_patterns 
            WHERE last_used < datetime('now', '-90 days')
            AND success_count < 5
        `);
        cleaned += oldResult.changes || 0;
    } catch {
        // Table might not exist
    }

    return cleaned;
}

async function resetStaleLocks(db) {
    // If there are any lock tables, reset stale locks
    try {
        await dbRun(db, `
            UPDATE ai_session_memory 
            SET value = json_replace(value, '$.locked', 0)
            WHERE json_extract(value, '$.locked') = 1
            AND created_at < datetime('now', '-1 hour')
        `);
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

    const db = new sqlite3.Database(DB_PATH);

    try {
        // 1. Ensure memory tables exist
        const tablesCreated = await ensureMemoryTablesExist(db);
        if (tablesCreated > 0) {
            results.actions.push(`Created ${tablesCreated} memory tables`);
        }

        // 2. Clear expired sessions
        const expiredCleared = await clearExpiredSessions(db);
        if (expiredCleared > 0) {
            results.actions.push(`Cleared ${expiredCleared} expired session entries`);
        }

        // 3. Clear corrupted entries
        const corruptedCleared = await clearCorruptedEntries(db);
        if (corruptedCleared > 0) {
            results.actions.push(`Removed ${corruptedCleared} corrupted entries`);
        }

        // 4. Rebuild indexes
        const indexesCreated = await rebuildMemoryIndexes(db);
        if (indexesCreated > 0) {
            results.actions.push(`Created/verified ${indexesCreated} memory indexes`);
        }

        // 5. Fix orphaned messages
        const orphansFixed = await fixOrphanedConversationMessages(db);
        if (orphansFixed > 0) {
            results.actions.push(`Removed ${orphansFixed} orphaned conversation messages`);
        }

        // 6. Cleanup learning patterns
        const patternsCleaned = await cleanupLearningPatterns(db);
        if (patternsCleaned > 0) {
            results.actions.push(`Cleaned ${patternsCleaned} stale learning patterns`);
        }

        // 7. Reset stale locks
        const locksReset = await resetStaleLocks(db);
        if (locksReset) {
            results.actions.push('Reset stale memory locks');
        }

        if (results.actions.length === 0) {
            results.actions.push('Memory system is healthy - no repairs needed');
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
        console.log('\nMemory Repair Results:');
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

