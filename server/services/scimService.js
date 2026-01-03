/**
 * SCIM 2.0 Service
 * 
 * Implements SCIM 2.0 protocol for user/group provisioning
 * RFC 7643 (Core Schema) and RFC 7644 (Protocol)
 * 
 * Features:
 * - User provisioning (create, update, delete)
 * - Group provisioning and mapping
 * - Token management
 * - Sync logging
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database');

// SCIM 2.0 Core Schemas
const SCIM_SCHEMAS = {
    USER: 'urn:ietf:params:scim:schemas:core:2.0:User',
    GROUP: 'urn:ietf:params:scim:schemas:core:2.0:Group',
    ENTERPRISE_USER: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User',
    LIST_RESPONSE: 'urn:ietf:params:scim:api:messages:2.0:ListResponse',
    PATCH_OP: 'urn:ietf:params:scim:api:messages:2.0:PatchOp',
    ERROR: 'urn:ietf:params:scim:api:messages:2.0:Error'
};

class SCIMService {
    // ====== SERVICE PROVIDER CONFIGURATION ======

    /**
     * Get or create SCIM service provider configuration for an organization
     */
    async getServiceProvider(organizationId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM scim_service_providers WHERE organization_id = ?',
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
    }

    /**
     * Create or update SCIM service provider configuration
     */
    async upsertServiceProvider(organizationId, config) {
        const id = uuidv4();
        const existing = await this.getServiceProvider(organizationId);

        return new Promise((resolve, reject) => {
            if (existing) {
                db.run(
                    `UPDATE scim_service_providers SET
                        patch_supported = ?,
                        bulk_supported = ?,
                        filter_supported = ?,
                        is_active = ?,
                        updated_at = datetime('now')
                    WHERE organization_id = ?`,
                    [
                        config.patchSupported ?? existing.patch_supported,
                        config.bulkSupported ?? existing.bulk_supported,
                        config.filterSupported ?? existing.filter_supported,
                        config.isActive ?? existing.is_active,
                        organizationId
                    ],
                    function(err) {
                        if (err) return reject(err);
                        resolve({ id: existing.id, updated: true });
                    }
                );
            } else {
                const baseUrl = config.baseUrl || `/api/scim/v2`;
                db.run(
                    `INSERT INTO scim_service_providers (
                        id, organization_id, base_url, patch_supported, bulk_supported,
                        filter_supported, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id, organizationId, baseUrl,
                        config.patchSupported ?? 1,
                        config.bulkSupported ?? 0,
                        config.filterSupported ?? 1,
                        config.isActive ?? 1
                    ],
                    function(err) {
                        if (err) return reject(err);
                        resolve({ id, created: true });
                    }
                );
            }
        });
    }

    /**
     * Get SCIM service provider configuration response (RFC 7644)
     */
    getServiceProviderConfig(organizationId, baseUrl) {
        return {
            schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
            documentationUri: `${baseUrl}/docs/scim`,
            patch: {
                supported: true
            },
            bulk: {
                supported: false,
                maxOperations: 1000,
                maxPayloadSize: 1048576
            },
            filter: {
                supported: true,
                maxResults: 200
            },
            changePassword: {
                supported: false
            },
            sort: {
                supported: false
            },
            etag: {
                supported: false
            },
            authenticationSchemes: [
                {
                    type: 'oauthbearertoken',
                    name: 'OAuth Bearer Token',
                    description: 'Authentication using OAuth 2.0 Bearer Token',
                    specUri: 'https://tools.ietf.org/html/rfc6750',
                    documentationUri: `${baseUrl}/docs/scim/auth`,
                    primary: true
                }
            ],
            meta: {
                resourceType: 'ServiceProviderConfig',
                location: `${baseUrl}/scim/v2/ServiceProviderConfig`
            }
        };
    }

    // ====== TOKEN MANAGEMENT ======

    /**
     * Generate a new SCIM bearer token
     */
    async generateToken(organizationId, name, options = {}) {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = await bcrypt.hash(token, 10);
        const tokenPrefix = token.substring(0, 8);
        const id = uuidv4();

        const scopes = options.scopes || ['users:read', 'users:write', 'groups:read', 'groups:write'];
        const expiresAt = options.expiresAt || null;

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO scim_tokens (
                    id, organization_id, name, description, token_hash, token_prefix,
                    scopes, expires_at, is_active, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                [
                    id, organizationId, name, options.description || null,
                    tokenHash, tokenPrefix, JSON.stringify(scopes),
                    expiresAt, options.createdBy || null
                ],
                function(err) {
                    if (err) return reject(err);
                    // Return the plain token only once - it cannot be retrieved again
                    resolve({
                        id,
                        token: `scim_${token}`,
                        tokenPrefix,
                        name,
                        scopes,
                        expiresAt
                    });
                }
            );
        });
    }

    /**
     * Validate a SCIM token and return the associated organization
     */
    async validateToken(bearerToken) {
        if (!bearerToken || !bearerToken.startsWith('scim_')) {
            return null;
        }

        const token = bearerToken.replace('scim_', '');
        const tokenPrefix = token.substring(0, 8);

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT st.*, sp.organization_id 
                 FROM scim_tokens st
                 JOIN scim_service_providers sp ON st.organization_id = sp.organization_id
                 WHERE st.token_prefix = ? AND st.is_active = 1
                 AND (st.expires_at IS NULL OR st.expires_at > datetime('now'))`,
                [tokenPrefix],
                async (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    const isValid = await bcrypt.compare(token, row.token_hash);
                    if (!isValid) return resolve(null);

                    // Update last used
                    db.run(
                        `UPDATE scim_tokens SET last_used_at = datetime('now'), usage_count = usage_count + 1 WHERE id = ?`,
                        [row.id]
                    );

                    resolve({
                        tokenId: row.id,
                        organizationId: row.organization_id,
                        scopes: JSON.parse(row.scopes || '[]'),
                        name: row.name
                    });
                }
            );
        });
    }

    /**
     * List all tokens for an organization
     */
    async listTokens(organizationId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT id, name, description, token_prefix, scopes, 
                        last_used_at, usage_count, expires_at, is_active, created_at
                 FROM scim_tokens
                 WHERE organization_id = ?
                 ORDER BY created_at DESC`,
                [organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows.map(r => ({
                        ...r,
                        scopes: JSON.parse(r.scopes || '[]'),
                        is_active: r.is_active === 1
                    })));
                }
            );
        });
    }

    /**
     * Revoke a SCIM token
     */
    async revokeToken(tokenId, revokedBy) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE scim_tokens SET is_active = 0, revoked_at = datetime('now'), revoked_by = ? WHERE id = ?`,
                [revokedBy, tokenId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ revoked: this.changes > 0 });
                }
            );
        });
    }

    // ====== USER OPERATIONS (SCIM 2.0) ======

    /**
     * Create a SCIM user
     */
    async createUser(organizationId, scimUser, tokenId) {
        const scimId = uuidv4();
        const userId = uuidv4();

        // Extract user attributes from SCIM format
        const email = scimUser.userName || scimUser.emails?.[0]?.value;
        const firstName = scimUser.name?.givenName || '';
        const lastName = scimUser.name?.familyName || '';
        const displayName = scimUser.displayName || `${firstName} ${lastName}`.trim();
        const externalId = scimUser.externalId;

        if (!email) {
            throw { status: 400, scimType: 'invalidValue', detail: 'userName (email) is required' };
        }

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Check if user already exists
                db.get(
                    'SELECT id FROM users WHERE email = ? AND organization_id = ?',
                    [email, organizationId],
                    (err, existing) => {
                        if (err) return reject(err);

                        if (existing) {
                            return reject({
                                status: 409,
                                scimType: 'uniqueness',
                                detail: `User with email ${email} already exists`
                            });
                        }

                        // Create user in users table
                        const tempPassword = crypto.randomBytes(16).toString('hex');

                        db.run(
                            `INSERT INTO users (id, email, first_name, last_name, display_name, password, 
                                               organization_id, role, is_active, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, 'member', ?, datetime('now'))`,
                            [userId, email, firstName, lastName, displayName, tempPassword, 
                             organizationId, scimUser.active !== false ? 1 : 0],
                            (err) => {
                                if (err) return reject(err);

                                // Create SCIM mapping
                                db.run(
                                    `INSERT INTO scim_user_mappings (id, organization_id, user_id, scim_id, external_id, last_synced_at)
                                     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                                    [uuidv4(), organizationId, userId, scimId, externalId],
                                    (err) => {
                                        if (err) return reject(err);

                                        // Log the operation
                                        this.logOperation(organizationId, tokenId, 'CREATE', 'User', scimId, externalId, scimUser, 201, null);

                                        // Return SCIM response
                                        resolve(this.formatUserResponse(userId, scimId, {
                                            email,
                                            firstName,
                                            lastName,
                                            displayName,
                                            active: scimUser.active !== false,
                                            externalId
                                        }));
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });
    }

    /**
     * Get a SCIM user by SCIM ID
     */
    async getUser(organizationId, scimId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT u.*, sm.scim_id, sm.external_id
                 FROM users u
                 JOIN scim_user_mappings sm ON u.id = sm.user_id
                 WHERE sm.scim_id = ? AND sm.organization_id = ?`,
                [scimId, organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    resolve(this.formatUserResponse(row.id, row.scim_id, {
                        email: row.email,
                        firstName: row.first_name,
                        lastName: row.last_name,
                        displayName: row.display_name,
                        active: row.is_active === 1,
                        externalId: row.external_id
                    }));
                }
            );
        });
    }

    /**
     * List users with SCIM filtering
     */
    async listUsers(organizationId, options = {}) {
        const { filter, startIndex = 1, count = 100 } = options;
        const offset = Math.max(0, startIndex - 1);

        let whereClause = 'sm.organization_id = ?';
        const params = [organizationId];

        // Parse simple SCIM filter (userName eq "value")
        if (filter) {
            const match = filter.match(/(\w+)\s+eq\s+"([^"]+)"/i);
            if (match) {
                const [, attr, value] = match;
                if (attr.toLowerCase() === 'username') {
                    whereClause += ' AND u.email = ?';
                    params.push(value);
                } else if (attr.toLowerCase() === 'externalid') {
                    whereClause += ' AND sm.external_id = ?';
                    params.push(value);
                }
            }
        }

        return new Promise((resolve, reject) => {
            // Get total count
            db.get(
                `SELECT COUNT(*) as total
                 FROM users u
                 JOIN scim_user_mappings sm ON u.id = sm.user_id
                 WHERE ${whereClause}`,
                params,
                (err, countRow) => {
                    if (err) return reject(err);

                    // Get paginated results
                    db.all(
                        `SELECT u.*, sm.scim_id, sm.external_id
                         FROM users u
                         JOIN scim_user_mappings sm ON u.id = sm.user_id
                         WHERE ${whereClause}
                         ORDER BY u.created_at DESC
                         LIMIT ? OFFSET ?`,
                        [...params, count, offset],
                        (err, rows) => {
                            if (err) return reject(err);

                            const users = rows.map(row => this.formatUserResponse(row.id, row.scim_id, {
                                email: row.email,
                                firstName: row.first_name,
                                lastName: row.last_name,
                                displayName: row.display_name,
                                active: row.is_active === 1,
                                externalId: row.external_id
                            }));

                            resolve({
                                schemas: [SCIM_SCHEMAS.LIST_RESPONSE],
                                totalResults: countRow.total,
                                startIndex,
                                itemsPerPage: users.length,
                                Resources: users
                            });
                        }
                    );
                }
            );
        });
    }

    /**
     * Update a SCIM user (PUT - full replace)
     */
    async updateUser(organizationId, scimId, scimUser, tokenId) {
        const email = scimUser.userName || scimUser.emails?.[0]?.value;
        const firstName = scimUser.name?.givenName || '';
        const lastName = scimUser.name?.familyName || '';
        const displayName = scimUser.displayName || `${firstName} ${lastName}`.trim();

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT u.id, sm.scim_id, sm.external_id
                 FROM users u
                 JOIN scim_user_mappings sm ON u.id = sm.user_id
                 WHERE sm.scim_id = ? AND sm.organization_id = ?`,
                [scimId, organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) {
                        return reject({ status: 404, scimType: 'noTarget', detail: 'User not found' });
                    }

                    db.run(
                        `UPDATE users SET 
                            email = ?, first_name = ?, last_name = ?, display_name = ?,
                            is_active = ?, updated_at = datetime('now')
                         WHERE id = ?`,
                        [email, firstName, lastName, displayName, scimUser.active !== false ? 1 : 0, row.id],
                        (err) => {
                            if (err) return reject(err);

                            // Update external_id if provided
                            if (scimUser.externalId) {
                                db.run(
                                    `UPDATE scim_user_mappings SET external_id = ?, last_synced_at = datetime('now') WHERE scim_id = ?`,
                                    [scimUser.externalId, scimId]
                                );
                            }

                            this.logOperation(organizationId, tokenId, 'UPDATE', 'User', scimId, scimUser.externalId, scimUser, 200, null);

                            resolve(this.formatUserResponse(row.id, scimId, {
                                email,
                                firstName,
                                lastName,
                                displayName,
                                active: scimUser.active !== false,
                                externalId: scimUser.externalId || row.external_id
                            }));
                        }
                    );
                }
            );
        });
    }

    /**
     * Patch a SCIM user (partial update)
     */
    async patchUser(organizationId, scimId, operations, tokenId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT u.*, sm.scim_id, sm.external_id
                 FROM users u
                 JOIN scim_user_mappings sm ON u.id = sm.user_id
                 WHERE sm.scim_id = ? AND sm.organization_id = ?`,
                [scimId, organizationId],
                async (err, row) => {
                    if (err) return reject(err);
                    if (!row) {
                        return reject({ status: 404, scimType: 'noTarget', detail: 'User not found' });
                    }

                    // Process PATCH operations
                    const updates = {};
                    for (const op of operations) {
                        const path = op.path?.toLowerCase();
                        const value = op.value;

                        switch (op.op.toLowerCase()) {
                            case 'replace':
                            case 'add':
                                if (path === 'active') updates.is_active = value ? 1 : 0;
                                else if (path === 'username') updates.email = value;
                                else if (path === 'displayname') updates.display_name = value;
                                else if (path === 'name.givenname') updates.first_name = value;
                                else if (path === 'name.familyname') updates.last_name = value;
                                else if (path === 'externalid') updates.external_id = value;
                                break;
                        }
                    }

                    if (Object.keys(updates).length > 0) {
                        const setClauses = [];
                        const params = [];

                        for (const [key, value] of Object.entries(updates)) {
                            if (key !== 'external_id') {
                                setClauses.push(`${key} = ?`);
                                params.push(value);
                            }
                        }

                        if (setClauses.length > 0) {
                            setClauses.push("updated_at = datetime('now')");
                            params.push(row.id);

                            db.run(
                                `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
                                params
                            );
                        }

                        if (updates.external_id) {
                            db.run(
                                `UPDATE scim_user_mappings SET external_id = ?, last_synced_at = datetime('now') WHERE scim_id = ?`,
                                [updates.external_id, scimId]
                            );
                        }
                    }

                    this.logOperation(organizationId, tokenId, 'PATCH', 'User', scimId, null, { operations }, 200, null);

                    // Return updated user
                    const user = await this.getUser(organizationId, scimId);
                    resolve(user);
                }
            );
        });
    }

    /**
     * Delete a SCIM user
     */
    async deleteUser(organizationId, scimId, tokenId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT u.id, sm.external_id
                 FROM users u
                 JOIN scim_user_mappings sm ON u.id = sm.user_id
                 WHERE sm.scim_id = ? AND sm.organization_id = ?`,
                [scimId, organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) {
                        return reject({ status: 404, scimType: 'noTarget', detail: 'User not found' });
                    }

                    // Soft delete - deactivate user
                    db.run(
                        `UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?`,
                        [row.id],
                        (err) => {
                            if (err) return reject(err);

                            // Delete SCIM mapping
                            db.run(`DELETE FROM scim_user_mappings WHERE scim_id = ?`, [scimId]);

                            this.logOperation(organizationId, tokenId, 'DELETE', 'User', scimId, row.external_id, null, 204, null);

                            resolve({ deleted: true });
                        }
                    );
                }
            );
        });
    }

    // ====== GROUP OPERATIONS ======

    /**
     * Get group mappings for an organization
     */
    async getGroupMappings(organizationId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM scim_group_mappings WHERE organization_id = ? ORDER BY external_group_name`,
                [organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }

    /**
     * Create or update a group mapping
     */
    async upsertGroupMapping(organizationId, mapping) {
        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO scim_group_mappings (id, organization_id, external_group_id, external_group_name, internal_role, custom_role_id, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(organization_id, external_group_id) DO UPDATE SET
                    external_group_name = excluded.external_group_name,
                    internal_role = excluded.internal_role,
                    custom_role_id = excluded.custom_role_id,
                    is_active = excluded.is_active,
                    updated_at = datetime('now')`,
                [
                    id, organizationId, mapping.externalGroupId, mapping.externalGroupName,
                    mapping.internalRole, mapping.customRoleId || null, mapping.isActive ?? 1
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve({ id, changes: this.changes });
                }
            );
        });
    }

    /**
     * Delete a group mapping
     */
    async deleteGroupMapping(organizationId, mappingId) {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM scim_group_mappings WHERE id = ? AND organization_id = ?`,
                [mappingId, organizationId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ deleted: this.changes > 0 });
                }
            );
        });
    }

    // ====== SYNC LOGGING ======

    /**
     * Log a SCIM operation
     */
    async logOperation(organizationId, tokenId, operation, resourceType, resourceId, externalId, requestBody, responseStatus, errorMessage) {
        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO scim_sync_logs (
                    id, organization_id, scim_token_id, operation, resource_type,
                    resource_id, external_id, request_body, response_status, status, error_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, organizationId, tokenId, operation, resourceType,
                    resourceId, externalId, JSON.stringify(requestBody),
                    responseStatus, errorMessage ? 'error' : 'success', errorMessage
                ],
                function(err) {
                    if (err) {
                        console.error('[SCIM] Failed to log operation:', err);
                        return resolve(null); // Don't fail the main operation
                    }
                    resolve({ id });
                }
            );
        });
    }

    /**
     * Get sync logs for an organization
     */
    async getSyncLogs(organizationId, options = {}) {
        const { limit = 100, offset = 0, status, operation, resourceType } = options;

        let whereClause = 'organization_id = ?';
        const params = [organizationId];

        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }
        if (operation) {
            whereClause += ' AND operation = ?';
            params.push(operation);
        }
        if (resourceType) {
            whereClause += ' AND resource_type = ?';
            params.push(resourceType);
        }

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM scim_sync_logs
                 WHERE ${whereClause}
                 ORDER BY created_at DESC
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows.map(r => ({
                        ...r,
                        request_body: r.request_body ? JSON.parse(r.request_body) : null
                    })));
                }
            );
        });
    }

    // ====== HELPER METHODS ======

    /**
     * Format a user as a SCIM response
     */
    formatUserResponse(userId, scimId, user) {
        return {
            schemas: [SCIM_SCHEMAS.USER],
            id: scimId,
            externalId: user.externalId,
            userName: user.email,
            name: {
                formatted: `${user.firstName} ${user.lastName}`.trim(),
                familyName: user.lastName,
                givenName: user.firstName
            },
            displayName: user.displayName,
            emails: [
                {
                    value: user.email,
                    type: 'work',
                    primary: true
                }
            ],
            active: user.active,
            meta: {
                resourceType: 'User',
                location: `/scim/v2/Users/${scimId}`
            }
        };
    }

    /**
     * Create a SCIM error response
     */
    createErrorResponse(status, scimType, detail) {
        return {
            schemas: [SCIM_SCHEMAS.ERROR],
            status: status.toString(),
            scimType,
            detail
        };
    }

    /**
     * Get schema definitions
     */
    getSchemas() {
        return {
            schemas: [SCIM_SCHEMAS.LIST_RESPONSE],
            totalResults: 2,
            itemsPerPage: 2,
            startIndex: 1,
            Resources: [
                {
                    id: SCIM_SCHEMAS.USER,
                    name: 'User',
                    description: 'User Account',
                    attributes: [
                        { name: 'userName', type: 'string', required: true },
                        { name: 'name', type: 'complex' },
                        { name: 'displayName', type: 'string' },
                        { name: 'emails', type: 'complex', multiValued: true },
                        { name: 'active', type: 'boolean' },
                        { name: 'externalId', type: 'string' }
                    ],
                    meta: { resourceType: 'Schema', location: '/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:User' }
                },
                {
                    id: SCIM_SCHEMAS.GROUP,
                    name: 'Group',
                    description: 'Group',
                    attributes: [
                        { name: 'displayName', type: 'string', required: true },
                        { name: 'members', type: 'complex', multiValued: true },
                        { name: 'externalId', type: 'string' }
                    ],
                    meta: { resourceType: 'Schema', location: '/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:Group' }
                }
            ]
        };
    }

    /**
     * Get resource types
     */
    getResourceTypes() {
        return {
            schemas: [SCIM_SCHEMAS.LIST_RESPONSE],
            totalResults: 2,
            Resources: [
                {
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
                    id: 'User',
                    name: 'User',
                    endpoint: '/Users',
                    schema: SCIM_SCHEMAS.USER,
                    meta: { resourceType: 'ResourceType', location: '/scim/v2/ResourceTypes/User' }
                },
                {
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
                    id: 'Group',
                    name: 'Group',
                    endpoint: '/Groups',
                    schema: SCIM_SCHEMAS.GROUP,
                    meta: { resourceType: 'ResourceType', location: '/scim/v2/ResourceTypes/Group' }
                }
            ]
        };
    }
}

module.exports = new SCIMService();




