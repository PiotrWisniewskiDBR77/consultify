#!/usr/bin/env node

/**
 * Evidence Ledger Retention Script
 * Step 15: Cleans old evidence objects based on retention policy.
 * 
 * Usage:
 *   node scripts/retention/evidence_retention.js [--dry-run]
 * 
 * Environment:
 *   EVIDENCE_RETENTION_DAYS - Number of days to retain (default: 730)
 */

require('dotenv').config();
const db = require('../../server/database');

const RETENTION_DAYS = parseInt(process.env.EVIDENCE_RETENTION_DAYS || '730', 10);
const DRY_RUN = process.argv.includes('--dry-run');

async function archiveOldEvidence() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`[Evidence Retention] Retention policy: ${RETENTION_DAYS} days`);
    console.log(`[Evidence Retention] Cutoff date: ${cutoffISO}`);
    console.log(`[Evidence Retention] Dry run: ${DRY_RUN}`);

    // Count evidence objects to archive
    const evidenceCount = await new Promise((resolve, reject) => {
        db.get(
            `SELECT COUNT(*) as count FROM ai_evidence_objects WHERE created_at < ?`,
            [cutoffISO],
            (err, row) => {
                if (err) reject(err);
                else resolve(row?.count || 0);
            }
        );
    });

    // Count reasoning entries to archive
    const reasoningCount = await new Promise((resolve, reject) => {
        db.get(
            `SELECT COUNT(*) as count FROM ai_reasoning_ledger WHERE created_at < ?`,
            [cutoffISO],
            (err, row) => {
                if (err) reject(err);
                else resolve(row?.count || 0);
            }
        );
    });

    // Count evidence links to archive (orphaned links)
    const linksCount = await new Promise((resolve, reject) => {
        db.get(
            `SELECT COUNT(*) as count FROM ai_evidence_links WHERE created_at < ?`,
            [cutoffISO],
            (err, row) => {
                if (err) reject(err);
                else resolve(row?.count || 0);
            }
        );
    });

    console.log(`[Evidence Retention] Evidence objects to archive: ${evidenceCount}`);
    console.log(`[Evidence Retention] Reasoning entries to archive: ${reasoningCount}`);
    console.log(`[Evidence Retention] Evidence links to archive: ${linksCount}`);

    if (DRY_RUN) {
        console.log('[Evidence Retention] DRY RUN - No changes made.');
        return {
            evidence: evidenceCount,
            reasoning: reasoningCount,
            links: linksCount,
            archived: false
        };
    }

    // Delete old links first (referential integrity)
    await new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM ai_evidence_links WHERE created_at < ?`,
            [cutoffISO],
            function (err) {
                if (err) reject(err);
                else {
                    console.log(`[Evidence Retention] Deleted ${this.changes} evidence links.`);
                    resolve(this.changes);
                }
            }
        );
    });

    // Delete old evidence objects
    await new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM ai_evidence_objects WHERE created_at < ?`,
            [cutoffISO],
            function (err) {
                if (err) reject(err);
                else {
                    console.log(`[Evidence Retention] Deleted ${this.changes} evidence objects.`);
                    resolve(this.changes);
                }
            }
        );
    });

    // Delete old reasoning entries
    await new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM ai_reasoning_ledger WHERE created_at < ?`,
            [cutoffISO],
            function (err) {
                if (err) reject(err);
                else {
                    console.log(`[Evidence Retention] Deleted ${this.changes} reasoning entries.`);
                    resolve(this.changes);
                }
            }
        );
    });

    console.log('[Evidence Retention] Cleanup complete.');
    return {
        evidence: evidenceCount,
        reasoning: reasoningCount,
        links: linksCount,
        archived: true
    };
}

// Run if called directly
if (require.main === module) {
    archiveOldEvidence()
        .then(result => {
            console.log('[Evidence Retention] Result:', result);
            process.exit(0);
        })
        .catch(err => {
            console.error('[Evidence Retention] Error:', err);
            process.exit(1);
        });
}

module.exports = { archiveOldEvidence };
