/**
 * Organization Service
 * 
 * Handles core organization logic:
 * - Member management (RBAC source of truth)
 * - Billing status & Token balance management
 * - Organization details
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const OrganizationService = {
    // Role Constants
    ROLES: {
        OWNER: 'OWNER',
        ADMIN: 'ADMIN',
        MEMBER: 'MEMBER',
        CONSULTANT: 'CONSULTANT'
    },

    /**
     * Create a new organization with an initial OWNER
     * @param {Object} params
     * @param {string} params.userId - Creator (will be OWNER)
     * @param {string} params.name - Org name
     * @param {string} [params.email] - Optional email for billing contact
     * @returns {Promise<Object>}
     */
    createOrganization: async ({ userId, name, email }) => {
        const orgId = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // 1. Create Organization
                db.run(
                    `INSERT INTO organizations (id, name, status, billing_status, token_balance, created_by_user_id, created_at, is_active)
                     VALUES (?, ?, 'active', 'TRIAL', 0, ?, ?, 1)`,
                    [orgId, name, userId, now],
                    function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                    }
                );

                // 2. Add Creator as OWNER
                db.run(
                    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
                     VALUES (?, ?, ?, 'OWNER', 'ACTIVE', ?)`,
                    [uuidv4(), orgId, userId, now],
                    function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) return reject(commitErr);
                            resolve({ id: orgId, name, role: 'OWNER' });
                        });
                    }
                );
            });
        });
    },

    /**
     * Get organization details including billing and tokens
     * @param {string} orgId 
     * @returns {Promise<Object>}
     */
    getOrganization: async (orgId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT id, name, status, billing_status, token_balance, created_at 
                 FROM organizations WHERE id = ?`,
                [orgId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new Error('Organization not found'));
                    resolve(row);
                }
            );
        });
    },

    /**
     * Add a member to the organization
     * @param {Object} params
     * @param {string} params.organizationId
     * @param {string} params.userId
     * @param {string} params.role
     * @param {string} [params.invitedBy]
     * @returns {Promise<Object>}
     */
    addMember: async ({ organizationId, userId, role, invitedBy }) => {
        if (!Object.values(OrganizationService.ROLES).includes(role)) {
            throw new Error('Invalid role');
        }

        const id = uuidv4();
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organization_members (id, organization_id, user_id, role, status, invited_by_user_id)
                 VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
                [id, organizationId, userId, role, invitedBy],
                function (err) {
                    if (err) {
                        // Check for unique constraint violation
                        if (err.message.includes('UNIQUE constraint failed')) {
                            return reject(new Error('User is already a member of this organization'));
                        }
                        return reject(err);
                    }
                    resolve({ id, organizationId, userId, role });
                }
            );
        });
    },

    /**
     * Get members of an organization
     * @param {string} orgId 
     * @returns {Promise<Array>}
     */
    getMembers: async (orgId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT m.id, m.user_id, m.role, m.status, m.created_at, u.first_name, u.last_name, u.email
                 FROM organization_members m
                 JOIN users u ON m.user_id = u.id
                 WHERE m.organization_id = ?`,
                [orgId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Get organizations for a user
     * @param {string} userId 
     * @returns {Promise<Array>}
     */
    getUserOrganizations: async (userId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT o.id, o.name, o.billing_status, m.role
                 FROM organizations o
                 JOIN organization_members m ON o.id = m.organization_id
                 WHERE m.user_id = ?`,
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Activate billing (Stub)
     * Sets billing_status = ACTIVE and grants initial tokens
     * @param {string} orgId 
     * @returns {Promise<Object>}
     */
    activateBilling: async (orgId) => {
        const INITIAL_TOKENS = 100000; // Configurable

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Update Organization
                db.run(
                    `UPDATE organizations 
                     SET billing_status = 'ACTIVE', token_balance = IFNULL(token_balance, 0) + ? 
                     WHERE id = ?`,
                    [INITIAL_TOKENS, orgId],
                    function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        if (this.changes === 0) {
                            db.run('ROLLBACK');
                            return reject(new Error('Organization not found'));
                        }
                    }
                );

                // Update Billing Table (Stub)
                db.run(
                    `INSERT OR REPLACE INTO organization_billing (organization_id, status, updated_at)
                     VALUES (?, 'ACTIVE', CURRENT_TIMESTAMP)`,
                    [orgId],
                    function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) return reject(commitErr);
                            resolve({ success: true, billingStatus: 'ACTIVE', tokensAdded: INITIAL_TOKENS });
                        });
                    }
                );
            });
        });
    }
};

module.exports = OrganizationService;
