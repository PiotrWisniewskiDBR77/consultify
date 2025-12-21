/**
 * Governance Audit Service
 * Step 14: Governance, Security & Enterprise Controls
 * 
 * Immutable audit logging with PII redaction and optional tamper-evident hash chain.
 * All administrative actions are logged here for SOC2/ISO compliance.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const PiiRedactor = require('../utils/piiRedactor');

// Valid action types for audit entries
const AUDIT_ACTIONS = {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    PUBLISH: 'PUBLISH',
    TOGGLE: 'TOGGLE',
    DELETE_SOFT: 'DELETE_SOFT',
    GRANT_PERMISSION: 'GRANT_PERMISSION',
    REVOKE_PERMISSION: 'REVOKE_PERMISSION',
    BREAK_GLASS_START: 'BREAK_GLASS_START',
    BREAK_GLASS_CLOSE: 'BREAK_GLASS_CLOSE'
};

// Resource types for audit entries
const RESOURCE_TYPES = {
    POLICY_RULE: 'POLICY_RULE',
    PLAYBOOK_TEMPLATE: 'PLAYBOOK_TEMPLATE',
    CONNECTOR: 'CONNECTOR',
    PERMISSION: 'PERMISSION',
    USER: 'USER',
    ORGANIZATION: 'ORGANIZATION',
    BREAK_GLASS_SESSION: 'BREAK_GLASS_SESSION',
    GLOBAL_TOGGLE: 'GLOBAL_TOGGLE'
};

/**
 * Compute SHA-256 hash for tamper evidence
 */
const computeHash = (prevHash, record) => {
    const data = `${prevHash || ''}|${record.id}|${record.actor_id}|${record.action}|${record.resource_type}|${record.resource_id}|${record.created_at}`;
    return crypto.createHash('sha256').update(data).digest('hex');
};

const GovernanceAuditService = {
    AUDIT_ACTIONS,
    RESOURCE_TYPES,

    /**
     * Log an audit entry (immutable)
     * @param {Object} params - Audit parameters
     * @param {string} params.actorId - User ID of the actor
     * @param {string} params.actorRole - Role of the actor
     * @param {string} params.orgId - Organization ID
     * @param {string} params.action - Action type (CREATE, UPDATE, etc.)
     * @param {string} params.resourceType - Type of resource affected
     * @param {string} [params.resourceId] - ID of the resource affected
     * @param {Object} [params.before] - State before the action
     * @param {Object} [params.after] - State after the action
     * @param {string} [params.correlationId] - Correlation ID for tracing
     * @returns {Promise<Object>} - Created audit entry
     */
    logAudit: async ({
        actorId,
        actorRole,
        orgId,
        action,
        resourceType,
        resourceId = null,
        before = null,
        after = null,
        correlationId = null
    }) => {
        if (!actorId || !orgId || !action || !resourceType) {
            throw new Error('Missing required audit parameters: actorId, orgId, action, resourceType');
        }

        if (!Object.values(AUDIT_ACTIONS).includes(action)) {
            throw new Error(`Invalid action: ${action}`);
        }

        const auditId = uuidv4();
        const createdAt = new Date().toISOString();
        const corrId = correlationId || `audit-${uuidv4()}`;

        // Redact PII from before/after snapshots
        const beforeJson = before ? PiiRedactor.createAuditSnapshot(before) : null;
        const afterJson = after ? PiiRedactor.createAuditSnapshot(after) : null;

        return new Promise((resolve, reject) => {
            // Get previous hash for tamper-evident chain
            db.get(
                `SELECT record_hash FROM governance_audit_log 
                 WHERE organization_id = ? 
                 ORDER BY created_at DESC LIMIT 1`,
                [orgId],
                (err, prevRow) => {
                    if (err) {
                        console.error('[GovernanceAudit] Error fetching prev hash:', err);
                        // Continue without hash chain if error
                    }

                    const prevHash = prevRow?.record_hash || null;
                    const recordForHash = {
                        id: auditId,
                        actor_id: actorId,
                        action,
                        resource_type: resourceType,
                        resource_id: resourceId,
                        created_at: createdAt
                    };
                    const recordHash = computeHash(prevHash, recordForHash);

                    db.run(
                        `INSERT INTO governance_audit_log 
                         (id, organization_id, actor_id, actor_role, action, resource_type, 
                          resource_id, before_json, after_json, correlation_id, prev_hash, record_hash, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [auditId, orgId, actorId, actorRole, action, resourceType,
                            resourceId, beforeJson, afterJson, corrId, prevHash, recordHash, createdAt],
                        function (err) {
                            if (err) {
                                console.error('[GovernanceAudit] Insert error:', err);
                                return reject(err);
                            }

                            console.log(`[GovernanceAudit] Logged: ${action} on ${resourceType}/${resourceId} by ${actorId}`);
                            resolve({
                                id: auditId,
                                organizationId: orgId,
                                actorId,
                                action,
                                resourceType,
                                resourceId,
                                correlationId: corrId,
                                createdAt
                            });
                        }
                    );
                }
            );
        });
    },

    /**
     * Get audit log with filters and pagination
     * @param {Object} params - Query parameters
     * @param {string} params.orgId - Organization ID (required for ADMIN, optional for SUPERADMIN)
     * @param {boolean} [params.superadminBypass] - If true, fetch all orgs
     * @param {string} [params.action] - Filter by action type
     * @param {string} [params.resourceType] - Filter by resource type
     * @param {string} [params.resourceId] - Filter by resource ID
     * @param {string} [params.actorId] - Filter by actor
     * @param {string} [params.startDate] - Filter from date
     * @param {string} [params.endDate] - Filter to date
     * @param {number} [params.limit] - Max results (default 100)
     * @param {number} [params.offset] - Offset for pagination
     * @returns {Promise<Array>} - Audit entries
     */
    getAuditLog: async ({
        orgId,
        superadminBypass = false,
        action = null,
        resourceType = null,
        resourceId = null,
        actorId = null,
        startDate = null,
        endDate = null,
        limit = 100,
        offset = 0
    }) => {
        let sql = `SELECT * FROM governance_audit_log WHERE 1=1`;
        const params = [];

        // Organization isolation (unless SUPERADMIN bypass)
        if (!superadminBypass && orgId) {
            sql += ` AND organization_id = ?`;
            params.push(orgId);
        }

        if (action) {
            sql += ` AND action = ?`;
            params.push(action);
        }

        if (resourceType) {
            sql += ` AND resource_type = ?`;
            params.push(resourceType);
        }

        if (resourceId) {
            sql += ` AND resource_id = ?`;
            params.push(resourceId);
        }

        if (actorId) {
            sql += ` AND actor_id = ?`;
            params.push(actorId);
        }

        if (startDate) {
            sql += ` AND created_at >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            sql += ` AND created_at <= ?`;
            params.push(endDate);
        }

        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                const entries = (rows || []).map(row => ({
                    id: row.id,
                    organizationId: row.organization_id,
                    actorId: row.actor_id,
                    actorRole: row.actor_role,
                    action: row.action,
                    resourceType: row.resource_type,
                    resourceId: row.resource_id,
                    before: row.before_json ? JSON.parse(row.before_json) : null,
                    after: row.after_json ? JSON.parse(row.after_json) : null,
                    correlationId: row.correlation_id,
                    createdAt: row.created_at
                }));

                resolve(entries);
            });
        });
    },

    /**
     * Export audit log as CSV or JSON
     * @param {Object} params - Export parameters
     * @param {string} params.orgId - Organization ID
     * @param {string} [params.format] - 'csv' or 'json' (default: json)
     * @param {boolean} [params.superadminBypass] - If true, export all orgs
     * @returns {Promise<Object>} - { format, data }
     */
    exportAuditLog: async ({
        orgId,
        format = 'json',
        superadminBypass = false,
        startDate = null,
        endDate = null
    }) => {
        const entries = await GovernanceAuditService.getAuditLog({
            orgId,
            superadminBypass,
            startDate,
            endDate,
            limit: 10000 // Max export limit
        });

        if (format === 'csv') {
            const headers = ['id', 'organization_id', 'actor_id', 'actor_role', 'action',
                'resource_type', 'resource_id', 'correlation_id', 'created_at'];
            const csvRows = [headers.join(',')];

            entries.forEach(entry => {
                csvRows.push([
                    entry.id,
                    entry.organizationId,
                    entry.actorId,
                    entry.actorRole || '',
                    entry.action,
                    entry.resourceType,
                    entry.resourceId || '',
                    entry.correlationId || '',
                    entry.createdAt
                ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
            });

            return { format: 'csv', data: csvRows.join('\n') };
        }

        return { format: 'json', data: entries };
    },

    /**
     * Verify hash chain integrity for an organization's audit log
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object>} - { valid: boolean, errors: Array }
     */
    verifyHashChain: async (orgId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM governance_audit_log 
                 WHERE organization_id = ? 
                 ORDER BY created_at ASC`,
                [orgId],
                (err, rows) => {
                    if (err) return reject(err);

                    const errors = [];
                    let expectedPrevHash = null;

                    (rows || []).forEach((row, idx) => {
                        // Check prev_hash matches previous record's record_hash
                        if (row.prev_hash !== expectedPrevHash) {
                            errors.push({
                                index: idx,
                                id: row.id,
                                error: `prev_hash mismatch: expected ${expectedPrevHash}, got ${row.prev_hash}`
                            });
                        }

                        // Recompute hash and verify
                        const recomputed = computeHash(row.prev_hash, {
                            id: row.id,
                            actor_id: row.actor_id,
                            action: row.action,
                            resource_type: row.resource_type,
                            resource_id: row.resource_id,
                            created_at: row.created_at
                        });

                        if (row.record_hash !== recomputed) {
                            errors.push({
                                index: idx,
                                id: row.id,
                                error: `record_hash mismatch: stored ${row.record_hash}, computed ${recomputed}`
                            });
                        }

                        expectedPrevHash = row.record_hash;
                    });

                    resolve({
                        valid: errors.length === 0,
                        totalRecords: (rows || []).length,
                        errors
                    });
                }
            );
        });
    }
};

module.exports = GovernanceAuditService;
