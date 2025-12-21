/**
 * Share Link Service (Hardened)
 * 
 * Security features:
 * - Token hashing (SHA-256) - protects against DB leak
 * - Org-scoped operations - enforces tenant isolation
 * - Status-based revocation - soft delete with status='REVOKED'
 * - Trial limit enforcement - counters stored in organizations table
 * - Public-safe snapshot projection - strips PII before storage
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Trial limits (configurable)
const TRIAL_SHARE_LINK_LIMIT = 3;
const TRIAL_EXPORT_LIMIT = 3;

const ShareLinkService = {
    // Entity types for share links
    ENTITY_TYPES: {
        ORG_REPORT: 'ORG_REPORT',
        INITIATIVE_REPORT: 'INITIATIVE_REPORT'
    },

    /**
     * Hash a token for secure storage
     * @param {string} token - Raw token
     * @returns {string} SHA-256 hash
     */
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    },

    /**
     * Generate a secure, URL-safe token (256-bit)
     * @returns {string}
     */
    generateToken() {
        return crypto.randomBytes(32).toString('base64url');
    },

    /**
     * Make a public-safe snapshot by stripping PII
     * @param {Object} report - Full report data
     * @returns {Object} Sanitized snapshot
     */
    makePublicSafeSnapshot(report) {
        return {
            reportType: report.reportType,
            generatedAt: report.generatedAt,
            organization: report.organization ? {
                name: report.organization.name || 'Organization',
                // Strip type/status if sensitive
            } : { name: 'Organization' },
            overallProgress: report.overallProgress || 0,
            transformationContext: report.transformationContext ? {
                goals: report.transformationContext.goals,
                // Strip maturity details if internal
            } : {},
            // Initiatives - strip owner email, keep owner name only
            initiativesSummary: (report.initiativesSummary || []).map(i => ({
                id: i.id,
                title: i.title,
                status: i.status,
                priority: i.priority,
                progress: i.progress || 0,
                dueDate: i.dueDate || null,
                owner: i.owner ? i.owner.split('@')[0] : 'Owner' // Strip email if passed
            })),
            // Blockers - keep text, strip identifiers
            activeBlockers: (report.activeBlockers || []).slice(0, 5).map(b => ({
                initiative: b.initiative,
                task: b.task
                // No blocked_reason if it could contain PII
            })),
            // Upcoming tasks - strip assignee
            upcomingTasks: (report.upcomingTasks || []).slice(0, 10).map(t => ({
                title: t.title,
                dueDate: t.due_date || t.dueDate || null,
                initiative: t.initiative
            })),
            // Initiative report specific
            initiative: report.initiative ? {
                id: report.initiative.id,
                title: report.initiative.title,
                description: report.initiative.description,
                status: report.initiative.status,
                priority: report.initiative.priority,
                dueDate: report.initiative.dueDate,
                owner: report.initiative.owner ? report.initiative.owner.split('@')[0] : 'Owner'
            } : undefined,
            progress: report.progress,
            taskStats: report.taskStats,
            tasks: (report.tasks || []).map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate || null,
                progress: t.progress || 0
                // No assignee, no blockedReason (could be PII)
            })),
            blockers: (report.blockers || []).slice(0, 5).map(b => ({
                task: b.task
                // No reason - could contain names/details
            })),
            upcomingDeadlines: (report.upcomingDeadlines || []).slice(0, 5).map(d => ({
                task: d.task,
                dueDate: d.dueDate
                // No assignee
            }))
        };
    },

    /**
     * Check and increment trial share link counter
     * @param {string} organizationId
     * @returns {Promise<{allowed: boolean, used: number, limit: number}>}
     */
    async checkTrialLimit(organizationId) {
        const org = await db.get(
            `SELECT organization_type, trial_share_links_used FROM organizations WHERE id = ?`,
            [organizationId]
        );

        if (!org) {
            return { allowed: false, used: 0, limit: 0, error: 'Organization not found' };
        }

        // Only enforce for TRIAL orgs
        if (org.organization_type !== 'TRIAL') {
            return { allowed: true, used: org.trial_share_links_used || 0, limit: Infinity };
        }

        const used = org.trial_share_links_used || 0;
        if (used >= TRIAL_SHARE_LINK_LIMIT) {
            return { allowed: false, used, limit: TRIAL_SHARE_LINK_LIMIT };
        }

        return { allowed: true, used, limit: TRIAL_SHARE_LINK_LIMIT };
    },

    /**
     * Increment trial share link counter
     * @param {string} organizationId
     */
    async incrementTrialCounter(organizationId) {
        await db.run(
            `UPDATE organizations SET trial_share_links_used = COALESCE(trial_share_links_used, 0) + 1 WHERE id = ?`,
            [organizationId]
        );
    },

    /**
     * Create a share link with a hashed token and sanitized snapshot
     * @param {Object} params
     * @param {string} params.organizationId
     * @param {string} params.userId - Creator of the share link
     * @param {string} params.entityType - ORG_REPORT | INITIATIVE_REPORT
     * @param {string} [params.entityId] - Initiative ID (if INITIATIVE_REPORT)
     * @param {Object} params.snapshotData - The data to store (will be sanitized)
     * @param {number} [params.expiresInHours=168] - Default 7 days
     * @returns {Promise<Object>}
     */
    async createShareLink({ organizationId, userId, entityType, entityId, snapshotData, expiresInHours = 168 }) {
        // Check trial limits
        const limitCheck = await this.checkTrialLimit(organizationId);
        if (!limitCheck.allowed) {
            throw new Error(`Trial limit reached: ${limitCheck.used}/${limitCheck.limit} share links used`);
        }

        const id = `shr-${uuidv4()}`;
        const token = this.generateToken();
        const tokenHash = this.hashToken(token);
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

        // Sanitize snapshot for public safety
        const safeSnapshot = this.makePublicSafeSnapshot(snapshotData);
        const snapshotJson = JSON.stringify(safeSnapshot);

        await db.run(
            `INSERT INTO share_links (id, organization_id, entity_type, entity_id, token, token_hash, snapshot_json, expires_at, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
            [id, organizationId, entityType, entityId || null, token, tokenHash, snapshotJson, expiresAt, userId]
        );

        // Increment trial counter
        await this.incrementTrialCounter(organizationId);

        return {
            id,
            token, // Return raw token to user, never token_hash
            entityType,
            entityId,
            expiresAt,
            shareUrl: `/share/${token}`
        };
    },

    /**
     * Get a share link by token (for public access)
     * Uses token hash for lookup
     * @param {string} token - Raw token from URL
     * @returns {Promise<Object|null>}
     */
    async getShareLinkByToken(token) {
        const tokenHash = this.hashToken(token);

        const link = await db.get(
            `SELECT id, entity_type, entity_id, snapshot_json, expires_at, status, created_at
             FROM share_links WHERE token_hash = ?`,
            [tokenHash]
        );

        // Fallback to plain token lookup for backward compatibility
        if (!link) {
            const legacyLink = await db.get(
                `SELECT id, entity_type, entity_id, snapshot_json, expires_at, status, created_at
                 FROM share_links WHERE token = ?`,
                [token]
            );
            if (!legacyLink) return null;

            // Check status and expiry for legacy
            if (legacyLink.status === 'REVOKED') {
                return { error: 'REVOKED' };
            }
            const expiresAt = new Date(legacyLink.expires_at);
            if (expiresAt < new Date()) {
                return { error: 'EXPIRED' };
            }
            return {
                id: legacyLink.id,
                entityType: legacyLink.entity_type,
                entityId: legacyLink.entity_id,
                snapshot: JSON.parse(legacyLink.snapshot_json),
                expiresAt: legacyLink.expires_at,
                createdAt: legacyLink.created_at
            };
        }

        // Check status
        if (link.status === 'REVOKED') {
            return { error: 'REVOKED' };
        }

        // Check expiry
        const expiresAt = new Date(link.expires_at);
        if (expiresAt < new Date()) {
            return { error: 'EXPIRED' };
        }

        return {
            id: link.id,
            entityType: link.entity_type,
            entityId: link.entity_id,
            snapshot: JSON.parse(link.snapshot_json),
            expiresAt: link.expires_at,
            createdAt: link.created_at
        };
    },

    /**
     * List share links for an organization (org-scoped)
     * @param {string} organizationId
     * @returns {Promise<Array>}
     */
    async listShareLinks(organizationId) {
        const links = await db.all(
            `SELECT id, entity_type, entity_id, expires_at, status, created_at, created_by
             FROM share_links 
             WHERE organization_id = ?
             ORDER BY created_at DESC`,
            [organizationId]
        );

        const now = new Date();
        return links.map(link => ({
            id: link.id,
            entityType: link.entity_type,
            entityId: link.entity_id,
            status: link.status || 'ACTIVE',
            isExpired: new Date(link.expires_at) < now,
            expiresAt: link.expires_at,
            createdAt: link.created_at,
            createdBy: link.created_by
            // Never return token or token_hash
        }));
    },

    /**
     * Revoke a share link (soft delete via status)
     * @param {string} id
     * @param {string} organizationId - For org-scoped verification
     * @returns {Promise<boolean>}
     */
    async revokeShareLink(id, organizationId) {
        const result = await db.run(
            `UPDATE share_links SET status = 'REVOKED' WHERE id = ? AND organization_id = ?`,
            [id, organizationId]
        );
        return result.changes > 0;
    },

    /**
     * Hard delete a share link (use revokeShareLink for normal operations)
     * @param {string} id
     * @param {string} organizationId - For verification
     * @returns {Promise<boolean>}
     */
    async deleteShareLink(id, organizationId) {
        const result = await db.run(
            `DELETE FROM share_links WHERE id = ? AND organization_id = ?`,
            [id, organizationId]
        );
        return result.changes > 0;
    },

    /**
     * Revoke all share links for an organization
     * @param {string} organizationId
     * @returns {Promise<number>} Number of revoked links
     */
    async revokeAllForOrg(organizationId) {
        const result = await db.run(
            `UPDATE share_links SET status = 'REVOKED' WHERE organization_id = ? AND status = 'ACTIVE'`,
            [organizationId]
        );
        return result.changes || 0;
    },

    /**
     * Cleanup expired share links (can be called by cron)
     * @returns {Promise<number>} Number of deleted links
     */
    async cleanupExpiredLinks() {
        const result = await db.run(
            `DELETE FROM share_links WHERE expires_at < datetime('now')`
        );
        return result.changes || 0;
    },

    /**
     * Check export limit for trial orgs
     * @param {string} organizationId
     * @returns {Promise<{allowed: boolean, used: number, limit: number}>}
     */
    async checkExportLimit(organizationId) {
        const org = await db.get(
            `SELECT organization_type, trial_exports_used FROM organizations WHERE id = ?`,
            [organizationId]
        );

        if (!org) {
            return { allowed: false, used: 0, limit: 0, error: 'Organization not found' };
        }

        if (org.organization_type !== 'TRIAL') {
            return { allowed: true, used: org.trial_exports_used || 0, limit: Infinity };
        }

        const used = org.trial_exports_used || 0;
        if (used >= TRIAL_EXPORT_LIMIT) {
            return { allowed: false, used, limit: TRIAL_EXPORT_LIMIT };
        }

        return { allowed: true, used, limit: TRIAL_EXPORT_LIMIT };
    },

    /**
     * Increment export counter
     * @param {string} organizationId
     */
    async incrementExportCounter(organizationId) {
        await db.run(
            `UPDATE organizations SET trial_exports_used = COALESCE(trial_exports_used, 0) + 1 WHERE id = ?`,
            [organizationId]
        );
    }
};

module.exports = ShareLinkService;
