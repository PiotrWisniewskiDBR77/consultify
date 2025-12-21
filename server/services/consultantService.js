/**
 * Consultant Service
 * 
 * Manages the "Consultant Mode" features:
 * - Consultant identity & status
 * - Multi-organization access (links)
 * - Consultant-generated invites (Trial & Add-to-Org)
 * 
 * @module ConsultantService
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const AccessCodeService = require('./accessCodeService');


const CONSULTANT_INVITE_TYPES = {
    TRIAL_ORG: 'TRIAL_ORG',         // Invites a new company to start a trial
    TRIAL_USER: 'TRIAL_USER',       // Invites a user to an existing trial org (if allowed)
    ORG_ADD_CONSULTANT: 'ORG_ADD_CONSULTANT' // Invites an existing org to add this consultant
};

const ConsultantService = {
    INVITE_TYPES: CONSULTANT_INVITE_TYPES,

    /**
     * Check if a user is a registered consultant
     * @param {string} userId 
     * @returns {Promise<Object|null>} Consultant record or null
     */
    getConsultantProfile: async (userId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM consultants WHERE id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Register a user as a consultant (Internal/Admin use)
     * @param {string} userId 
     * @param {string} displayName 
     * @returns {Promise<Object>}
     */
    registerConsultant: async (userId, displayName) => {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO consultants (id, display_name, status) VALUES (?, ?, 'ACTIVE')
                 ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name`,
                [userId, displayName],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id: userId, displayName, status: 'ACTIVE' });
                }
            );
        });
    },

    /**
     * Get all organizations linked to a consultant
     * @param {string} consultantId 
     * @returns {Promise<Array>} List of organizations with permissions
     */
    getLinkedOrganizations: async (consultantId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    o.id, o.name, o.status, o.billing_status, o.trial_expires_at,
                    l.id as link_id, l.permission_scope, l.status as link_status, l.created_at as linked_at
                 FROM consultant_org_links l
                 JOIN organizations o ON l.organization_id = o.id
                 WHERE l.consultant_id = ? AND l.status = 'ACTIVE'
                 ORDER BY l.created_at DESC`,
                [consultantId],
                (err, rows) => {
                    if (err) return reject(err);
                    // Parse scope JSON
                    const results = rows.map(row => ({
                        ...row,
                        permission_scope: row.permission_scope ? JSON.parse(row.permission_scope) : {}
                    }));
                    resolve(results);
                }
            );
        });
    },

    /**
     * Verify if a consultant has access to a specific organization
     * @param {string} consultantId 
     * @param {string} organizationId 
     * @returns {Promise<Object|null>} Link record if valid, null otherwise
     */
    verifyAccess: async (consultantId, organizationId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM consultant_org_links 
                 WHERE consultant_id = ? AND organization_id = ? AND status = 'ACTIVE'`,
                [consultantId, organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);
                    resolve({
                        ...row,
                        permission_scope: row.permission_scope ? JSON.parse(row.permission_scope) : {}
                    });
                }
            );
        });
    },

    /**
     * Generate a short, human-friendly invite code
     * @returns {string} e.g. "CONS-A1B2"
     */
    _generateCode: () => {
        // 8 chars alphanumeric, upper case
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    /**
     * Create a consultant invite code
     * @param {Object} params
     * @param {string} params.consultantId
     * @param {string} params.type - CONSULTANT_INVITE_TYPES
     * @param {string} [params.targetEmail] - Optional restriction
     * @param {string} [params.targetCompanyName] - Optional pre-fill
     * @param {number} [params.maxUses=1]
     * @param {number} [params.expiresInDays=30]
     * @returns {Promise<Object>} Created invite
     */
    /**
     * Create a consultant invite code
     * Uses unified AccessCodeService
     */
    createInvite: async ({ consultantId, type, targetEmail, targetCompanyName, maxUses = 1, expiresInDays = 30 }) => {
        if (!Object.values(CONSULTANT_INVITE_TYPES).includes(type)) {
            throw new Error('Invalid invite type');
        }

        // Map Consultant types to AccessCode types
        const accessCodeType = type === 'ORG_ADD_CONSULTANT' ? 'CONSULTANT' : 'TRIAL';

        const metadata = {
            subtype: type,
            targetEmail,
            targetCompanyName,
            source: 'CONSULTANT_DASHBOARD'
        };

        const result = await AccessCodeService.generateCode({
            type: accessCodeType,
            createdByConsultantId: consultantId,
            maxUses,
            expiresInDays,
            metadata
        });

        // Return structure compatible with legacy callers if needed, or new structure
        return {
            id: result.id,
            code: result.code,
            type: type, // Return original type for consistency
            invite_type: type,
            expiresAt: result.expiresAt,
            maxUses: result.maxUses
        };
    },

    /**
     * Validate an invite code
     * Uses unified AccessCodeService
     */
    validateInvite: async (code) => {
        try {
            const result = await AccessCodeService.validateCode(code);

            // Transform to expected Consultant Invite format
            return {
                invite_code: result.code,
                // If subtype exists in metadata, use it, else map type
                invite_type: result.metadata.subtype || (result.type === 'CONSULTANT' ? 'ORG_ADD_CONSULTANT' : 'TRIAL_ORG'),
                consultant_id: result.createdByConsultantId,
                status: 'valid',
                expires_at: null, // AccessCodeService checks expiry, returns plain obj. We can fetch row if needed but this suffices.
                max_uses: null,
                uses_count: null,
                metadata: result.metadata
            };
        } catch (err) {
            throw new Error('Invalid or expired invite code');
        }
    },

    /**
     * Record usage of an invite code
     * DEPRECATED: AccessCodeService handles usage
     */
    recordInviteUsage: async (code) => {
        // No-op, handled by AccessCodeService.acceptCode
        return;
    },

    /**
     * List invites created by a consultant
     * Uses AccessCodeService
     */
    getConsultantInvites: async (consultantId) => {
        const codes = await AccessCodeService.listCodes(consultantId, 'CONSULTANT');
        // Transform back
        return codes.map(c => ({
            id: c.id,
            invite_code: c.code,
            invite_type: c.metadata.subtype || c.type,
            created_at: c.created_at,
            expires_at: c.expires_at,
            uses_count: c.uses_count,
            max_uses: c.max_uses,
            target_email: c.metadata.targetEmail,
            target_company_name: c.metadata.targetCompanyName
        }));
    },

    // ... (linkConsultantToOrg and ensureLink methods remain unique to this service) ... 

    // Improved Link Implementation to handle no-unique-constraint schema
    ensureLink: async (consultantId, organizationId, createdByUserId, permissions = {}) => {
        const id = uuidv4();
        const permissionJson = JSON.stringify(permissions);

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.get(
                    `SELECT id FROM consultant_org_links WHERE consultant_id = ? AND organization_id = ?`,
                    [consultantId, organizationId],
                    (err, row) => {
                        if (err) return reject(err);

                        if (row) {
                            db.run(
                                `UPDATE consultant_org_links 
                                 SET status = 'ACTIVE', permission_scope = ? 
                                 WHERE id = ?`,
                                [permissionJson, row.id],
                                (err) => {
                                    if (err) return reject(err);
                                    resolve({ id: row.id, status: 'ACTIVE' });
                                }
                            );
                        } else {
                            db.run(
                                `INSERT INTO consultant_org_links 
                                 (id, consultant_id, organization_id, created_by_user_id, permission_scope, status)
                                 VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
                                [id, consultantId, organizationId, createdByUserId, permissionJson],
                                (err) => {
                                    if (err) return reject(err);
                                    resolve({ id, status: 'ACTIVE' });
                                }
                            );
                        }
                    }
                );
            });
        });
    },

    acceptInvite: async (inviteCode, userId, targetOrganizationId = null) => {
        // 1. Consume Code (Atomic)
        // AccessCodeService.acceptCode checks validity, expiry, limits and increments usage
        const acceptedCode = await AccessCodeService.acceptCode({
            code: inviteCode,
            actorUserId: userId
        });

        if (!acceptedCode.ok) {
            throw new Error(acceptedCode.error || 'Failed to accept code');
        }

        const inviteType = acceptedCode.metadata?.subtype || acceptedCode.type;
        const consultantId = acceptedCode.consultantId;

        // 2. Perform Specific Logic
        if (inviteType === 'TRIAL_ORG' || inviteType === 'TRIAL') {
            // A. Consultant invited a Client to start a Trial
            await new Promise((res, rej) => {
                db.run(
                    "UPDATE users SET attribution_source = 'CONSULTANT_INVITE', attribution_data = ? WHERE id = ?",
                    [JSON.stringify({ consultantId, code: inviteCode }), userId],
                    (err) => err ? rej(err) : res()
                );
            });
        } else if (inviteType === 'ORG_ADD_CONSULTANT' || inviteType === 'CONSULTANT') {
            // B. Organization invited a Consultant to join
            const orgId = targetOrganizationId || acceptedCode.organizationId;

            if (!orgId) {
                if (!targetOrganizationId) throw new Error("Organization context required to link consultant");
            }

            await ConsultantService.ensureLink(consultantId, orgId || targetOrganizationId, userId, { role: 'CONSULTANT', permissions: ['VIEW_ALL', 'COMMENT'] });
        }

        // Return compatible result
        return { success: true, type: inviteType, consultantId };
    },

    /**
     * Update permissions for a consultant link
     */
    updateLinkPermissions: async (linkId, permissions) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE consultant_org_links SET permission_scope = ? WHERE id = ?`,
                [JSON.stringify(permissions), linkId],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    },

    /**
     * Revoke consultant access
     */
    revokeLink: async (linkId) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE consultant_org_links SET status = 'REVOKED' WHERE id = ?`,
                [linkId],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }
};

module.exports = ConsultantService;
