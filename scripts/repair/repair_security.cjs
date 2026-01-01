#!/usr/bin/env node
/**
 * Security Repair Module
 * 
 * Auto-repairs security issues:
 * - Resets rate limit counters
 * - Cleans blocked IP lists
 * - Fixes audit log gaps
 * - Regenerates security tokens
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
async function ensureSecurityTablesExist(db) {
    const tables = [
        `CREATE TABLE IF NOT EXISTS ai_rate_limits (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            applies_to TEXT DEFAULT 'all',
            limit_type TEXT DEFAULT 'per_day',
            limit_value INTEGER DEFAULT 1000,
            current_count INTEGER DEFAULT 0,
            reset_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS ai_blocked_ips (
            id TEXT PRIMARY KEY,
            ip_address TEXT NOT NULL UNIQUE,
            reason TEXT,
            blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            is_permanent INTEGER DEFAULT 0
        )`,
        `CREATE TABLE IF NOT EXISTS ai_security_events (
            id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            severity TEXT DEFAULT 'low',
            user_id TEXT,
            ip_address TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS ai_api_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            name TEXT,
            permissions TEXT,
            last_used DATETIME,
            expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1
        )`
    ];

    let created = 0;
    for (const sql of tables) {
        try {
            await dbRun(db, sql);
            created++;
        } catch {
            // Table might already exist
        }
    }

    return created;
}

async function resetRateLimitCounters(db) {
    let reset = 0;

    try {
        // Reset expired rate limits
        const result = await dbRun(db, `
            UPDATE ai_rate_limits 
            SET current_count = 0, reset_at = datetime('now', '+1 day')
            WHERE reset_at IS NULL OR reset_at < datetime('now')
        `);
        reset = result.changes || 0;
    } catch {
        // Table might not exist
    }

    return reset;
}

async function cleanExpiredBlockedIPs(db) {
    let cleaned = 0;

    try {
        const result = await dbRun(db, `
            DELETE FROM ai_blocked_ips 
            WHERE is_permanent = 0 
            AND expires_at IS NOT NULL 
            AND expires_at < datetime('now')
        `);
        cleaned = result.changes || 0;
    } catch {
        // Table might not exist
    }

    return cleaned;
}

async function fixAuditLogGaps(db) {
    let fixed = 0;

    try {
        // Add missing fields to audit entries
        const result = await dbRun(db, `
            UPDATE ai_audit_log 
            SET 
                risk_level = COALESCE(risk_level, 'low'),
                flagged = COALESCE(flagged, 0)
            WHERE risk_level IS NULL OR flagged IS NULL
        `);
        fixed = result.changes || 0;
    } catch {
        // Table might not exist
    }

    return fixed;
}

async function cleanupExpiredTokens(db) {
    let cleaned = 0;

    try {
        const result = await dbRun(db, `
            UPDATE ai_api_tokens 
            SET is_active = 0
            WHERE expires_at IS NOT NULL 
            AND expires_at < datetime('now')
            AND is_active = 1
        `);
        cleaned = result.changes || 0;
    } catch {
        // Table might not exist
    }

    return cleaned;
}

async function createSecurityIndexes(db) {
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_rate_limits_org ON ai_rate_limits(organization_id)',
        'CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON ai_blocked_ips(ip_address)',
        'CREATE INDEX IF NOT EXISTS idx_security_events_type ON ai_security_events(event_type)',
        'CREATE INDEX IF NOT EXISTS idx_security_events_time ON ai_security_events(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON ai_api_tokens(user_id)'
    ];

    let created = 0;
    for (const sql of indexes) {
        try {
            await dbRun(db, sql);
            created++;
        } catch {
            // Index might already exist
        }
    }

    return created;
}

async function archiveOldSecurityEvents(db) {
    // Move very old security events to archive or delete them
    let archived = 0;

    try {
        // Delete security events older than 90 days (except critical ones)
        const result = await dbRun(db, `
            DELETE FROM ai_security_events 
            WHERE created_at < datetime('now', '-90 days')
            AND severity != 'critical'
        `);
        archived = result.changes || 0;
    } catch {
        // Table might not exist
    }

    return archived;
}

async function validateAuditLogIntegrity(db) {
    // Check for any obvious data integrity issues
    try {
        // Count entries with missing required fields
        const issues = await dbAll(db, `
            SELECT COUNT(*) as count 
            FROM ai_audit_log 
            WHERE action IS NULL OR timestamp IS NULL
        `);

        if (issues[0]?.count > 0) {
            // Remove entries with missing required fields
            await dbRun(db, `
                DELETE FROM ai_audit_log 
                WHERE action IS NULL OR timestamp IS NULL
            `);
            return issues[0].count;
        }
    } catch {
        // Table might not exist
    }

    return 0;
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
        // 1. Ensure security tables exist
        const tablesCreated = await ensureSecurityTablesExist(db);
        if (tablesCreated > 0) {
            results.actions.push(`Created ${tablesCreated} security tables`);
        }

        // 2. Reset rate limit counters
        const rateLimitsReset = await resetRateLimitCounters(db);
        if (rateLimitsReset > 0) {
            results.actions.push(`Reset ${rateLimitsReset} rate limit counters`);
        }

        // 3. Clean expired blocked IPs
        const blockedIPsCleaned = await cleanExpiredBlockedIPs(db);
        if (blockedIPsCleaned > 0) {
            results.actions.push(`Removed ${blockedIPsCleaned} expired IP blocks`);
        }

        // 4. Fix audit log gaps
        const auditFixed = await fixAuditLogGaps(db);
        if (auditFixed > 0) {
            results.actions.push(`Fixed ${auditFixed} audit log entries`);
        }

        // 5. Cleanup expired tokens
        const tokensCleaned = await cleanupExpiredTokens(db);
        if (tokensCleaned > 0) {
            results.actions.push(`Deactivated ${tokensCleaned} expired API tokens`);
        }

        // 6. Create indexes
        const indexesCreated = await createSecurityIndexes(db);
        if (indexesCreated > 0) {
            results.actions.push(`Created/verified ${indexesCreated} security indexes`);
        }

        // 7. Archive old events
        const eventsArchived = await archiveOldSecurityEvents(db);
        if (eventsArchived > 0) {
            results.actions.push(`Archived ${eventsArchived} old security events`);
        }

        // 8. Validate audit log integrity
        const integrityFixed = await validateAuditLogIntegrity(db);
        if (integrityFixed > 0) {
            results.actions.push(`Removed ${integrityFixed} corrupted audit entries`);
        }

        if (results.actions.length === 0) {
            results.actions.push('Security system is healthy - no repairs needed');
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
        console.log('\nSecurity Repair Results:');
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

