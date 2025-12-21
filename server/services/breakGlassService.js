/**
 * Break-Glass Service
 * Step 14: Governance, Security & Enterprise Controls
 * 
 * Emergency override management with full audit logging.
 * Allows SUPERADMIN to temporarily bypass security controls.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const GovernanceAuditService = require('./governanceAuditService');

// Allowed break-glass scopes
const BREAK_GLASS_SCOPES = {
    POLICY_ENGINE_DISABLED: 'policy_engine_disabled',
    APPROVAL_BYPASS: 'approval_bypass',
    RATE_LIMIT_BYPASS: 'rate_limit_bypass',
    AUDIT_BYPASS: 'audit_bypass',
    EMERGENCY_ACCESS: 'emergency_access'
};

// Default session duration (2 hours)
const DEFAULT_DURATION_MINUTES = 120;

// Maximum session duration (24 hours)
const MAX_DURATION_MINUTES = 1440;

const BreakGlassService = {
    SCOPES: BREAK_GLASS_SCOPES,
    DEFAULT_DURATION_MINUTES,
    MAX_DURATION_MINUTES,

    /**
     * Start a break-glass session
     * @param {Object} params - Session parameters
     * @param {string} params.actorId - User ID starting the session
     * @param {string} params.actorRole - Role of the actor (should be SUPERADMIN)
     * @param {string} params.orgId - Organization ID
     * @param {string} params.reason - Justification for break-glass
     * @param {string} params.scope - Scope of the override
     * @param {number} [params.durationMinutes] - Duration in minutes (default: 120)
     * @returns {Promise<Object>} - Created session
     */
    startSession: async ({
        actorId,
        actorRole,
        orgId,
        reason,
        scope,
        durationMinutes = DEFAULT_DURATION_MINUTES
    }) => {
        if (!actorId || !orgId || !reason || !scope) {
            throw new Error('Missing required parameters: actorId, orgId, reason, scope');
        }

        // Validate scope
        const validScopes = Object.values(BREAK_GLASS_SCOPES);
        if (!validScopes.includes(scope)) {
            throw new Error(`Invalid scope: ${scope}. Valid scopes: ${validScopes.join(', ')}`);
        }

        // Enforce max duration
        const duration = Math.min(durationMinutes, MAX_DURATION_MINUTES);

        // Check if there's already an active session for this scope in this org
        const existingSession = await BreakGlassService.getActiveSession(orgId, scope);
        if (existingSession) {
            throw new Error(`Active break-glass session already exists for scope: ${scope}`);
        }

        const sessionId = uuidv4();
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + duration * 60 * 1000);

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO break_glass_sessions 
                 (id, organization_id, actor_id, reason, scope, expires_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [sessionId, orgId, actorId, reason, scope, expiresAt.toISOString(), createdAt.toISOString()],
                async function (err) {
                    if (err) {
                        console.error('[BreakGlass] Insert error:', err);
                        return reject(err);
                    }

                    // Log to governance audit
                    try {
                        await GovernanceAuditService.logAudit({
                            actorId,
                            actorRole,
                            orgId,
                            action: GovernanceAuditService.AUDIT_ACTIONS.BREAK_GLASS_START,
                            resourceType: GovernanceAuditService.RESOURCE_TYPES.BREAK_GLASS_SESSION,
                            resourceId: sessionId,
                            after: { sessionId, scope, reason, expiresAt: expiresAt.toISOString() }
                        });
                    } catch (auditErr) {
                        console.error('[BreakGlass] Audit log error:', auditErr);
                        // Don't fail the operation, but log the error
                    }

                    console.log(`[BreakGlass] Session started: ${sessionId} (scope: ${scope}) by ${actorId}`);
                    resolve({
                        id: sessionId,
                        organizationId: orgId,
                        actorId,
                        reason,
                        scope,
                        expiresAt: expiresAt.toISOString(),
                        createdAt: createdAt.toISOString()
                    });
                }
            );
        });
    },

    /**
     * Close a break-glass session early
     * @param {string} sessionId - Session ID
     * @param {string} actorId - User ID closing the session
     * @param {string} actorRole - Role of the actor
     * @returns {Promise<Object>} - Closed session
     */
    closeSession: async (sessionId, actorId, actorRole) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM break_glass_sessions WHERE id = ?`,
                [sessionId],
                async (err, session) => {
                    if (err) return reject(err);
                    if (!session) {
                        const error = new Error('Session not found');
                        error.code = 'SESSION_NOT_FOUND';
                        return reject(error);
                    }

                    if (session.closed_at) {
                        const error = new Error('Session already closed');
                        error.code = 'SESSION_ALREADY_CLOSED';
                        return reject(error);
                    }

                    const closedAt = new Date().toISOString();

                    db.run(
                        `UPDATE break_glass_sessions SET closed_at = ? WHERE id = ?`,
                        [closedAt, sessionId],
                        async function (updateErr) {
                            if (updateErr) return reject(updateErr);

                            // Log to governance audit
                            try {
                                await GovernanceAuditService.logAudit({
                                    actorId,
                                    actorRole,
                                    orgId: session.organization_id,
                                    action: GovernanceAuditService.AUDIT_ACTIONS.BREAK_GLASS_CLOSE,
                                    resourceType: GovernanceAuditService.RESOURCE_TYPES.BREAK_GLASS_SESSION,
                                    resourceId: sessionId,
                                    before: { sessionId, scope: session.scope, closedAt: null },
                                    after: { sessionId, scope: session.scope, closedAt }
                                });
                            } catch (auditErr) {
                                console.error('[BreakGlass] Audit log error:', auditErr);
                            }

                            console.log(`[BreakGlass] Session closed: ${sessionId} by ${actorId}`);
                            resolve({
                                id: sessionId,
                                organizationId: session.organization_id,
                                scope: session.scope,
                                closedAt,
                                closedBy: actorId
                            });
                        }
                    );
                }
            );
        });
    },

    /**
     * Get active sessions for an organization
     * @param {string} orgId - Organization ID
     * @returns {Promise<Array>} - Active sessions
     */
    getActiveSessions: async (orgId) => {
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM break_glass_sessions 
                 WHERE organization_id = ? 
                 AND expires_at > ? 
                 AND closed_at IS NULL
                 ORDER BY created_at DESC`,
                [orgId, now],
                (err, rows) => {
                    if (err) return reject(err);

                    resolve((rows || []).map(row => ({
                        id: row.id,
                        organizationId: row.organization_id,
                        actorId: row.actor_id,
                        reason: row.reason,
                        scope: row.scope,
                        expiresAt: row.expires_at,
                        createdAt: row.created_at
                    })));
                }
            );
        });
    },

    /**
     * Get a specific active session by org and scope
     * @param {string} orgId - Organization ID
     * @param {string} scope - Break-glass scope
     * @returns {Promise<Object|null>} - Active session or null
     */
    getActiveSession: async (orgId, scope) => {
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM break_glass_sessions 
                 WHERE organization_id = ? 
                 AND scope = ?
                 AND expires_at > ? 
                 AND closed_at IS NULL`,
                [orgId, scope, now],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    resolve({
                        id: row.id,
                        organizationId: row.organization_id,
                        actorId: row.actor_id,
                        reason: row.reason,
                        scope: row.scope,
                        expiresAt: row.expires_at,
                        createdAt: row.created_at
                    });
                }
            );
        });
    },

    /**
     * Check if break-glass is active for a specific scope
     * @param {string} orgId - Organization ID
     * @param {string} scope - Break-glass scope
     * @returns {Promise<boolean>} - True if break-glass is active
     */
    isBreakGlassActive: async (orgId, scope) => {
        const session = await BreakGlassService.getActiveSession(orgId, scope);
        return session !== null;
    },

    /**
     * Get all active sessions across all orgs (SUPERADMIN only)
     * @returns {Promise<Array>} - All active sessions
     */
    getAllActiveSessions: async () => {
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT bgs.*, o.name as organization_name, u.email as actor_email
                 FROM break_glass_sessions bgs
                 LEFT JOIN organizations o ON o.id = bgs.organization_id
                 LEFT JOIN users u ON u.id = bgs.actor_id
                 WHERE bgs.expires_at > ? 
                 AND bgs.closed_at IS NULL
                 ORDER BY bgs.created_at DESC`,
                [now],
                (err, rows) => {
                    if (err) return reject(err);

                    resolve((rows || []).map(row => ({
                        id: row.id,
                        organizationId: row.organization_id,
                        organizationName: row.organization_name,
                        actorId: row.actor_id,
                        actorEmail: row.actor_email,
                        reason: row.reason,
                        scope: row.scope,
                        expiresAt: row.expires_at,
                        createdAt: row.created_at
                    })));
                }
            );
        });
    }
};

module.exports = BreakGlassService;
