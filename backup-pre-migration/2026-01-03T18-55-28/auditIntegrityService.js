/**
 * Audit Integrity Service
 * 
 * Implements tamper-evident audit logging with blockchain-style hash chains
 * Ensures audit logs cannot be modified without detection
 * 
 * Features:
 * - Block-based audit log integrity
 * - Hash chain verification
 * - Integrity verification
 * - Export with integrity proof
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../database');

// Configuration
const BLOCK_SIZE = 100; // Number of audit entries per block
const HASH_ALGORITHM = 'sha256';

class AuditIntegrityService {
    // ====== BLOCK MANAGEMENT ======

    /**
     * Create a new integrity block from recent audit entries
     */
    async createBlock() {
        return new Promise((resolve, reject) => {
            // Get the last block
            db.get(
                `SELECT * FROM audit_log_integrity ORDER BY block_number DESC LIMIT 1`,
                [],
                async (err, lastBlock) => {
                    if (err) return reject(err);

                    const blockNumber = lastBlock ? lastBlock.block_number + 1 : 1;
                    const previousBlockHash = lastBlock ? lastBlock.block_hash : null;

                    // Get audit entries that haven't been included in a block
                    // Assuming audit_events or security_events table
                    const startId = lastBlock ? lastBlock.block_end_id : null;

                    db.all(
                        `SELECT id, event_type, user_id, details, created_at 
                         FROM security_events 
                         ${startId ? 'WHERE id > ?' : ''}
                         ORDER BY created_at ASC
                         LIMIT ?`,
                        startId ? [startId, BLOCK_SIZE] : [BLOCK_SIZE],
                        async (err, entries) => {
                            if (err) return reject(err);
                            
                            if (!entries || entries.length === 0) {
                                return resolve({ created: false, reason: 'No new entries to block' });
                            }

                            // Calculate entries hash
                            const entriesHash = this.hashEntries(entries);
                            
                            // Calculate block hash (includes previous block hash)
                            const blockContent = JSON.stringify({
                                blockNumber,
                                previousBlockHash,
                                entriesHash,
                                entryCount: entries.length,
                                blockStartId: entries[0].id,
                                blockEndId: entries[entries.length - 1].id,
                            });
                            const blockHash = this.hash(blockContent);

                            const id = uuidv4();

                            db.run(
                                `INSERT INTO audit_log_integrity (
                                    id, block_number, block_start_id, block_end_id, entry_count,
                                    entries_hash, previous_block_hash, block_hash, verification_status
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'valid')`,
                                [
                                    id, blockNumber, entries[0].id, entries[entries.length - 1].id,
                                    entries.length, entriesHash, previousBlockHash, blockHash
                                ],
                                function(err) {
                                    if (err) return reject(err);
                                    resolve({
                                        created: true,
                                        blockNumber,
                                        entryCount: entries.length,
                                        blockHash,
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    }

    /**
     * Verify integrity of all blocks
     */
    async verifyAllBlocks() {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM audit_log_integrity ORDER BY block_number ASC`,
                [],
                async (err, blocks) => {
                    if (err) return reject(err);
                    
                    if (!blocks || blocks.length === 0) {
                        return resolve({ verified: true, blocks: 0, message: 'No blocks to verify' });
                    }

                    const results = {
                        verified: true,
                        blocks: blocks.length,
                        validBlocks: 0,
                        invalidBlocks: [],
                    };

                    let previousBlockHash = null;

                    for (const block of blocks) {
                        const isValid = await this.verifyBlock(block, previousBlockHash);
                        
                        if (isValid) {
                            results.validBlocks++;
                        } else {
                            results.verified = false;
                            results.invalidBlocks.push({
                                blockNumber: block.block_number,
                                id: block.id,
                            });
                        }

                        previousBlockHash = block.block_hash;
                    }

                    resolve(results);
                }
            );
        });
    }

    /**
     * Verify a single block
     */
    async verifyBlock(block, expectedPreviousHash = null) {
        // Check previous block hash chain
        if (expectedPreviousHash !== null && block.previous_block_hash !== expectedPreviousHash) {
            await this.updateBlockStatus(block.id, 'invalid');
            return false;
        }

        // Verify entries hash
        const entries = await this.getBlockEntries(block.block_start_id, block.block_end_id);
        const computedEntriesHash = this.hashEntries(entries);

        if (computedEntriesHash !== block.entries_hash) {
            await this.updateBlockStatus(block.id, 'invalid');
            return false;
        }

        // Verify block hash
        const blockContent = JSON.stringify({
            blockNumber: block.block_number,
            previousBlockHash: block.previous_block_hash,
            entriesHash: block.entries_hash,
            entryCount: block.entry_count,
            blockStartId: block.block_start_id,
            blockEndId: block.block_end_id,
        });
        const computedBlockHash = this.hash(blockContent);

        if (computedBlockHash !== block.block_hash) {
            await this.updateBlockStatus(block.id, 'invalid');
            return false;
        }

        await this.updateBlockStatus(block.id, 'valid');
        return true;
    }

    /**
     * Get entries within a block range
     */
    async getBlockEntries(startId, endId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT id, event_type, user_id, details, created_at 
                 FROM security_events 
                 WHERE id >= ? AND id <= ?
                 ORDER BY created_at ASC`,
                [startId, endId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    /**
     * Update block verification status
     */
    async updateBlockStatus(blockId, status) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE audit_log_integrity 
                 SET verification_status = ?, last_verified_at = datetime('now')
                 WHERE id = ?`,
                [status, blockId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    }

    // ====== EXPORT MANAGEMENT ======

    /**
     * Create an audit export with integrity proof
     */
    async createExport(organizationId, options) {
        const {
            exportType = 'json',
            dateRangeStart,
            dateRangeEnd,
            filters = {},
            createdBy,
        } = options;

        const id = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

        // Get events for export
        let query = `
            SELECT se.*, u.email as user_email
            FROM security_events se
            LEFT JOIN users u ON se.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (organizationId && filters.organizationScoped !== false) {
            // If we need to filter by organization, we'd need to join with users
            // For now, include all events
        }

        if (dateRangeStart) {
            query += ' AND se.created_at >= ?';
            params.push(dateRangeStart);
        }

        if (dateRangeEnd) {
            query += ' AND se.created_at <= ?';
            params.push(dateRangeEnd);
        }

        if (filters.eventType) {
            query += ' AND se.event_type = ?';
            params.push(filters.eventType);
        }

        if (filters.severity) {
            query += ' AND se.severity = ?';
            params.push(filters.severity);
        }

        query += ' ORDER BY se.created_at DESC';

        return new Promise((resolve, reject) => {
            db.all(query, params, async (err, events) => {
                if (err) return reject(err);

                // Generate export content
                let content;
                let contentHash;

                if (exportType === 'json') {
                    content = JSON.stringify(events, null, 2);
                    contentHash = this.hash(content);
                } else if (exportType === 'csv') {
                    content = this.eventsToCSV(events);
                    contentHash = this.hash(content);
                } else {
                    return reject(new Error('Unsupported export type'));
                }

                // Store export record
                db.run(
                    `INSERT INTO audit_exports (
                        id, organization_id, export_type, date_range_start, date_range_end,
                        filters, file_size, file_hash, status, expires_at, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
                    [
                        id, organizationId, exportType, dateRangeStart, dateRangeEnd,
                        JSON.stringify(filters), Buffer.byteLength(content, 'utf8'),
                        contentHash, expiresAt, createdBy
                    ],
                    function(err) {
                        if (err) return reject(err);
                        
                        resolve({
                            id,
                            exportType,
                            eventCount: events.length,
                            fileSize: Buffer.byteLength(content, 'utf8'),
                            hash: contentHash,
                            content,
                            expiresAt,
                        });
                    }
                );
            });
        });
    }

    /**
     * Get export by ID
     */
    async getExport(exportId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM audit_exports WHERE id = ?`,
                [exportId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
    }

    /**
     * List exports for an organization
     */
    async listExports(organizationId, options = {}) {
        const { limit = 50, offset = 0, status } = options;

        let query = `SELECT * FROM audit_exports WHERE organization_id = ?`;
        const params = [organizationId];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    /**
     * Record export download
     */
    async recordDownload(exportId) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE audit_exports 
                 SET download_count = download_count + 1, last_downloaded_at = datetime('now')
                 WHERE id = ?`,
                [exportId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ recorded: this.changes > 0 });
                }
            );
        });
    }

    // ====== HELPER METHODS ======

    /**
     * Hash a string using SHA-256
     */
    hash(content) {
        return crypto.createHash(HASH_ALGORITHM).update(content).digest('hex');
    }

    /**
     * Hash an array of audit entries
     */
    hashEntries(entries) {
        const content = entries.map(e => JSON.stringify({
            id: e.id,
            event_type: e.event_type,
            user_id: e.user_id,
            details: e.details,
            created_at: e.created_at,
        })).join('|');
        
        return this.hash(content);
    }

    /**
     * Convert events to CSV format
     */
    eventsToCSV(events) {
        if (!events || events.length === 0) {
            return 'id,event_type,severity,user_id,user_email,details,created_at\n';
        }

        const header = 'id,event_type,severity,user_id,user_email,details,created_at';
        const rows = events.map(e => {
            const details = typeof e.details === 'string' ? e.details : JSON.stringify(e.details);
            return [
                e.id,
                e.event_type || '',
                e.severity || '',
                e.user_id || '',
                e.user_email || '',
                `"${details.replace(/"/g, '""')}"`,
                e.created_at || '',
            ].join(',');
        });

        return [header, ...rows].join('\n');
    }

    /**
     * Get integrity status summary
     */
    async getIntegritySummary() {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    COUNT(*) as total_blocks,
                    SUM(CASE WHEN verification_status = 'valid' THEN 1 ELSE 0 END) as valid_blocks,
                    SUM(CASE WHEN verification_status = 'invalid' THEN 1 ELSE 0 END) as invalid_blocks,
                    SUM(entry_count) as total_entries,
                    MAX(block_created_at) as last_block_created,
                    MAX(last_verified_at) as last_verified
                 FROM audit_log_integrity`,
                [],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || {
                        total_blocks: 0,
                        valid_blocks: 0,
                        invalid_blocks: 0,
                        total_entries: 0,
                    });
                }
            );
        });
    }

    /**
     * Get blocks list
     */
    async getBlocks(limit = 100, offset = 0) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM audit_log_integrity ORDER BY block_number DESC LIMIT ? OFFSET ?`,
                [limit, offset],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
}

module.exports = new AuditIntegrityService();





