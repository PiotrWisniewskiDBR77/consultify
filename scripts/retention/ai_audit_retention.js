#!/usr/bin/env node

/**
 * AI Audit Retention Script
 * Step 9.7: Archives old audit records based on retention policy.
 * 
 * Usage:
 *   node scripts/retention/ai_audit_retention.js [--dry-run]
 * 
 * Environment:
 *   AI_AUDIT_RETENTION_DAYS - Number of days to retain (default: 730)
 */

require('dotenv').config();
const db = require('../../server/database');

const RETENTION_DAYS = parseInt(process.env.AI_AUDIT_RETENTION_DAYS || '730', 10);
const DRY_RUN = process.argv.includes('--dry-run');

async function archiveOldRecords() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`[Retention] Retention policy: ${RETENTION_DAYS} days`);
    console.log(`[Retention] Cutoff date: ${cutoffISO}`);
    console.log(`[Retention] Dry run: ${DRY_RUN}`);

    // Count records to archive
    const decisionCount = await new Promise((resolve, reject) => {
        db.get(
            `SELECT COUNT(*) as count FROM action_decisions WHERE created_at < ? AND archived_at IS NULL`,
            [cutoffISO],
            (err, row) => {
                if (err) reject(err);
                else resolve(row?.count || 0);
            }
        );
    });

    const executionCount = await new Promise((resolve, reject) => {
        db.get(
            `SELECT COUNT(*) as count FROM action_executions WHERE created_at < ? AND archived_at IS NULL`,
            [cutoffISO],
            (err, row) => {
                if (err) reject(err);
                else resolve(row?.count || 0);
            }
        );
    });

    console.log(`[Retention] Decisions to archive: ${decisionCount}`);
    console.log(`[Retention] Executions to archive: ${executionCount}`);

    if (DRY_RUN) {
        console.log('[Retention] DRY RUN - No changes made.');
        return { decisions: decisionCount, executions: executionCount, archived: false };
    }

    const now = new Date().toISOString();

    // Archive decisions
    await new Promise((resolve, reject) => {
        db.run(
            `UPDATE action_decisions SET archived_at = ? WHERE created_at < ? AND archived_at IS NULL`,
            [now, cutoffISO],
            function (err) {
                if (err) reject(err);
                else {
                    console.log(`[Retention] Archived ${this.changes} decisions.`);
                    resolve(this.changes);
                }
            }
        );
    });

    // Archive executions
    await new Promise((resolve, reject) => {
        db.run(
            `UPDATE action_executions SET archived_at = ? WHERE created_at < ? AND archived_at IS NULL`,
            [now, cutoffISO],
            function (err) {
                if (err) reject(err);
                else {
                    console.log(`[Retention] Archived ${this.changes} executions.`);
                    resolve(this.changes);
                }
            }
        );
    });

    console.log('[Retention] Archival complete.');
    return { decisions: decisionCount, executions: executionCount, archived: true };
}

// Run if called directly
if (require.main === module) {
    archiveOldRecords()
        .then(result => {
            console.log('[Retention] Result:', result);
            process.exit(0);
        })
        .catch(err => {
            console.error('[Retention] Error:', err);
            process.exit(1);
        });
}

module.exports = { archiveOldRecords };
