/**
 * SSO Service
 * 
 * SAML 2.0 and OIDC Single Sign-On implementation.
 * 
 * Features:
 * - SAML 2.0 SP implementation
 * - OIDC support
 * - Auto-provisioning
 * - Session management
 * - Single Logout (SLO)
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../database');
const AuditService = require('./auditService');

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Encryption for secrets
const ENCRYPTION_KEY = process.env.SSO_ENCRYPTION_KEY || process.env.MFA_ENCRYPTION_KEY;

function encrypt(text) {
    if (!ENCRYPTION_KEY || !text) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encrypted) {
    if (!ENCRYPTION_KEY || !encrypted || !encrypted.includes(':')) return encrypted;
    const parts = encrypted.split(':');
    if (parts.length !== 3) return encrypted;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const SSOService = {
    // ==========================================
    // SUPERADMIN: List all SSO configurations
    // ==========================================
    
    /**
     * List all SSO configurations across all organizations (SuperAdmin)
     */
    async listAllConfigurations() {
        const configs = await dbAll(`
            SELECT sc.*, o.name as organization_name 
            FROM sso_configurations sc
            LEFT JOIN organizations o ON sc.organization_id = o.id
            ORDER BY sc.created_at DESC
        `);
        
        return configs.map(config => ({
            id: config.id,
            organizationId: config.organization_id,
            organizationName: config.organization_name,
            providerType: config.provider_type,
            providerName: config.provider_name,
            isActive: !!config.is_active,
            isVerified: !!config.is_verified,
            enforceSso: !!config.enforce_sso,
            allowPasswordLogin: !!config.allow_password_login,
            autoProvisionUsers: !!config.auto_provision_users,
            defaultRole: config.default_role,
            createdAt: config.created_at,
            lastLoginAt: config.last_login_at,
        }));
    },
    
    /**
     * Toggle SSO configuration active status
     */
    async toggleConfiguration(configId, isActive) {
        await dbRun(
            `UPDATE sso_configurations SET is_active = ?, updated_at = datetime('now') WHERE id = ?`,
            [isActive ? 1 : 0, configId]
        );
        return { success: true };
    },
    
    /**
     * Delete SSO configuration
     */
    async deleteConfiguration(configId) {
        // First terminate all SSO sessions
        await dbRun(`DELETE FROM sso_sessions WHERE sso_config_id = ?`, [configId]);
        
        // Then delete the config
        await dbRun(`DELETE FROM sso_configurations WHERE id = ?`, [configId]);
        
        return { success: true };
    },
    
    // ==========================================
    // GOOGLE OIDC SUPPORT
    // ==========================================
    
    /**
     * Create Google OIDC configuration
     */
    async createGoogleConfig(organizationId, { clientId, clientSecret, allowedDomains = [] }, createdBy = null) {
        const existing = await dbGet(
            `SELECT id FROM sso_configurations WHERE organization_id = ?`,
            [organizationId]
        );

        if (existing) {
            throw new Error('SSO configuration already exists. Use updateGoogleConfig instead.');
        }

        const id = uuidv4();
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        
        await dbRun(
            `INSERT INTO sso_configurations 
             (id, organization_id, provider_type, provider_name,
              client_id, client_secret_encrypted,
              authorization_url, token_url, userinfo_url,
              attribute_mapping, allow_password_login, auto_provision_users, default_role,
              created_by)
             VALUES (?, ?, 'google', 'Google Workspace', ?, ?, ?, ?, ?, ?, 1, 1, 'USER', ?)`,
            [
                id, organizationId,
                clientId, clientSecret ? encrypt(clientSecret) : null,
                'https://accounts.google.com/o/oauth2/v2/auth',
                'https://oauth2.googleapis.com/token',
                'https://openidconnect.googleapis.com/v1/userinfo',
                JSON.stringify({ email: 'email', firstName: 'given_name', lastName: 'family_name', allowedDomains }),
                createdBy
            ]
        );

        AuditService.logSystemEvent('GOOGLE_SSO_CONFIG_CREATED', 'sso_configuration', id, organizationId, {
            allowedDomains,
        });

        return { 
            id, 
            redirectUri: `${baseUrl}/api/sso/google/callback`
        };
    },
    
    /**
     * Update Google OIDC configuration
     */
    async updateGoogleConfig(organizationId, updates, updatedBy = null) {
        const current = await this.getConfiguration(organizationId);
        if (!current) {
            throw new Error('SSO configuration not found');
        }

        const fields = [];
        const params = [];

        if (updates.clientId !== undefined) {
            fields.push('client_id = ?');
            params.push(updates.clientId);
        }
        
        if (updates.clientSecret !== undefined) {
            fields.push('client_secret_encrypted = ?');
            params.push(updates.clientSecret ? encrypt(updates.clientSecret) : null);
        }
        
        if (updates.allowedDomains !== undefined) {
            const mapping = JSON.parse(current.attributeMapping || '{}');
            mapping.allowedDomains = updates.allowedDomains;
            fields.push('attribute_mapping = ?');
            params.push(JSON.stringify(mapping));
        }
        
        if (updates.enforceSso !== undefined) {
            fields.push('enforce_sso = ?');
            params.push(updates.enforceSso ? 1 : 0);
        }
        
        if (updates.allowPasswordLogin !== undefined) {
            fields.push('allow_password_login = ?');
            params.push(updates.allowPasswordLogin ? 1 : 0);
        }
        
        if (updates.autoProvisionUsers !== undefined) {
            fields.push('auto_provision_users = ?');
            params.push(updates.autoProvisionUsers ? 1 : 0);
        }
        
        if (updates.defaultRole !== undefined) {
            fields.push('default_role = ?');
            params.push(updates.defaultRole);
        }

        fields.push('updated_at = datetime("now")');
        params.push(organizationId);

        await dbRun(
            `UPDATE sso_configurations SET ${fields.join(', ')} WHERE organization_id = ?`,
            params
        );

        return { success: true };
    },
    
    /**
     * Process Google OIDC callback
     */
    async processGoogleCallback(organizationId, code, requestInfo = {}) {
        const config = await this.getConfiguration(organizationId, true);
        if (!config || !config.isActive) {
            throw new Error('SSO not configured or not active');
        }

        const attemptId = uuidv4();

        try {
            // Exchange code for tokens
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    redirect_uri: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/sso/google/callback`,
                    grant_type: 'authorization_code',
                }).toString(),
            });

            const tokens = await tokenResponse.json();
            
            if (tokens.error) {
                throw new Error(tokens.error_description || tokens.error);
            }

            // Get user info
            const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
            });

            const userInfo = await userInfoResponse.json();
            
            // Validate domain if restricted
            const mapping = config.attributeMapping || {};
            if (mapping.allowedDomains && mapping.allowedDomains.length > 0) {
                const emailDomain = userInfo.email.split('@')[1];
                if (!mapping.allowedDomains.includes(emailDomain)) {
                    throw new Error(`Domain ${emailDomain} is not allowed for this organization`);
                }
            }

            // Find or create user
            let user = await dbGet(`SELECT * FROM users WHERE email = ?`, [userInfo.email]);
            let userCreated = false;

            if (!user) {
                if (!config.autoProvisionUsers) {
                    throw new Error('User not found and auto-provisioning disabled');
                }

                const userId = uuidv4();
                await dbRun(
                    `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status, sso_only)
                     VALUES (?, ?, ?, ?, ?, ?, 'active', 1)`,
                    [userId, organizationId, userInfo.email, userInfo.given_name, userInfo.family_name, config.defaultRole]
                );

                user = await dbGet(`SELECT * FROM users WHERE id = ?`, [userId]);
                userCreated = true;
            } else if (user.organization_id !== organizationId) {
                throw new Error('User belongs to different organization');
            }

            // Create SSO session
            const sessionId = uuidv4();
            const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

            await dbRun(
                `INSERT INTO sso_sessions (id, user_id, organization_id, sso_config_id, name_id, expires_at, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [sessionId, user.id, organizationId, config.id, userInfo.email, expiresAt, requestInfo.ip, requestInfo.userAgent]
            );

            // Log successful attempt
            await this._logAttempt({
                id: attemptId,
                organizationId,
                ssoConfigId: config.id,
                status: 'success',
                nameId: userInfo.email,
                userId: user.id,
                userCreated,
                ...requestInfo,
            });

            AuditService.logSystemEvent('GOOGLE_SSO_LOGIN', 'user', user.id, organizationId, {
                userCreated,
            });

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    organizationId: user.organization_id,
                },
                sessionId,
                expiresAt,
            };

        } catch (error) {
            await this._logAttempt({
                id: attemptId,
                organizationId,
                ssoConfigId: config?.id,
                status: 'failed',
                errorMessage: error.message,
                ...requestInfo,
            });

            throw error;
        }
    },
    
    /**
     * Generate Google OAuth URL
     */
    async getGoogleAuthUrl(organizationId) {
        const config = await this.getConfiguration(organizationId, true);
        if (!config || config.providerType !== 'google') {
            throw new Error('Google SSO not configured');
        }

        const state = Buffer.from(JSON.stringify({ organizationId })).toString('base64');
        const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/sso/google/callback`;
        
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            access_type: 'offline',
            prompt: 'select_account',
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    },

    /**
     * Create SSO configuration for organization
     * @param {string} organizationId 
     * @param {Object} config 
     */
    async createConfiguration(organizationId, config, createdBy = null) {
        const {
            providerType,
            providerName,
            // SAML
            idpEntityId,
            idpSsoUrl,
            idpSloUrl,
            idpCertificate,
            // OIDC
            clientId,
            clientSecret,
            authorizationUrl,
            tokenUrl,
            userinfoUrl,
            // Policies
            enforceSso = false,
            allowPasswordLogin = true,
            autoProvisionUsers = true,
            defaultRole = 'USER',
            // Attribute mapping
            attributeMapping = {},
        } = config;

        // Check if config already exists
        const existing = await dbGet(
            `SELECT id FROM sso_configurations WHERE organization_id = ?`,
            [organizationId]
        );

        if (existing) {
            throw new Error('SSO configuration already exists. Use updateConfiguration instead.');
        }

        const id = uuidv4();

        // SP configuration
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const spEntityId = `${baseUrl}/sso/metadata/${organizationId}`;
        const spAcsUrl = `${baseUrl}/api/sso/callback/${organizationId}`;
        const spSloUrl = `${baseUrl}/api/sso/logout/${organizationId}`;

        await dbRun(
            `INSERT INTO sso_configurations 
             (id, organization_id, provider_type, provider_name,
              idp_entity_id, idp_sso_url, idp_slo_url, idp_certificate,
              client_id, client_secret_encrypted, authorization_url, token_url, userinfo_url,
              sp_entity_id, sp_acs_url, sp_slo_url,
              attribute_mapping, enforce_sso, allow_password_login, auto_provision_users, default_role,
              created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, organizationId, providerType, providerName,
                idpEntityId, idpSsoUrl, idpSloUrl, idpCertificate,
                clientId, clientSecret ? encrypt(clientSecret) : null, authorizationUrl, tokenUrl, userinfoUrl,
                spEntityId, spAcsUrl, spSloUrl,
                JSON.stringify(attributeMapping), enforceSso ? 1 : 0, allowPasswordLogin ? 1 : 0,
                autoProvisionUsers ? 1 : 0, defaultRole,
                createdBy
            ]
        );

        AuditService.logSystemEvent('SSO_CONFIG_CREATED', 'sso_configuration', id, organizationId, {
            providerType,
        });

        return { id, spEntityId, spAcsUrl, spSloUrl };
    },

    /**
     * Get SSO configuration for organization
     * @param {string} organizationId 
     * @param {boolean} includeSecrets 
     */
    async getConfiguration(organizationId, includeSecrets = false) {
        const config = await dbGet(
            `SELECT * FROM sso_configurations WHERE organization_id = ?`,
            [organizationId]
        );

        if (!config) return null;

        const result = {
            id: config.id,
            organizationId: config.organization_id,
            providerType: config.provider_type,
            providerName: config.provider_name,
            isActive: !!config.is_active,
            isVerified: !!config.is_verified,

            // SAML
            idpEntityId: config.idp_entity_id,
            idpSsoUrl: config.idp_sso_url,
            idpSloUrl: config.idp_slo_url,
            idpCertificate: config.idp_certificate,

            // SP
            spEntityId: config.sp_entity_id,
            spAcsUrl: config.sp_acs_url,
            spSloUrl: config.sp_slo_url,

            // Policies
            enforceSso: !!config.enforce_sso,
            allowPasswordLogin: !!config.allow_password_login,
            autoProvisionUsers: !!config.auto_provision_users,
            defaultRole: config.default_role,

            // Attribute mapping
            attributeMapping: JSON.parse(config.attribute_mapping || '{}'),

            createdAt: config.created_at,
            updatedAt: config.updated_at,
        };

        if (includeSecrets) {
            result.clientId = config.client_id;
            result.clientSecret = config.client_secret_encrypted ? decrypt(config.client_secret_encrypted) : null;
        }

        return result;
    },

    /**
     * Update SSO configuration
     * @param {string} organizationId 
     * @param {Object} updates 
     */
    async updateConfiguration(organizationId, updates, updatedBy = null) {
        const current = await this.getConfiguration(organizationId);
        if (!current) {
            throw new Error('SSO configuration not found');
        }

        const fields = [];
        const params = [];

        const allowedFields = [
            'provider_name', 'idp_entity_id', 'idp_sso_url', 'idp_slo_url', 'idp_certificate',
            'client_id', 'authorization_url', 'token_url', 'userinfo_url',
            'enforce_sso', 'allow_password_login', 'auto_provision_users', 'default_role',
        ];

        for (const [key, value] of Object.entries(updates)) {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            if (allowedFields.includes(dbKey)) {
                fields.push(`${dbKey} = ?`);
                params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
            }
        }

        if (updates.clientSecret) {
            fields.push('client_secret_encrypted = ?');
            params.push(encrypt(updates.clientSecret));
        }

        if (updates.attributeMapping) {
            fields.push('attribute_mapping = ?');
            params.push(JSON.stringify(updates.attributeMapping));
        }

        fields.push('updated_at = datetime("now")');
        params.push(organizationId);

        await dbRun(
            `UPDATE sso_configurations SET ${fields.join(', ')} WHERE organization_id = ?`,
            params
        );

        AuditService.logSystemEvent('SSO_CONFIG_UPDATED', 'sso_configuration', current.id, organizationId, {
            updatedBy,
        });

        return { success: true };
    },

    /**
     * Activate SSO for organization
     * @param {string} organizationId 
     */
    async activate(organizationId) {
        const config = await this.getConfiguration(organizationId);
        if (!config) {
            throw new Error('SSO configuration not found');
        }

        // Basic validation
        if (config.providerType === 'saml') {
            if (!config.idpSsoUrl || !config.idpCertificate) {
                throw new Error('SAML configuration incomplete: SSO URL and certificate required');
            }
        } else if (config.providerType === 'oidc') {
            if (!config.clientId) {
                throw new Error('OIDC configuration incomplete: client ID required');
            }
        }

        await dbRun(
            `UPDATE sso_configurations SET is_active = 1, updated_at = datetime('now') WHERE organization_id = ?`,
            [organizationId]
        );

        AuditService.logSystemEvent('SSO_ACTIVATED', 'organization', organizationId, organizationId);

        return { success: true };
    },

    /**
     * Deactivate SSO
     * @param {string} organizationId 
     */
    async deactivate(organizationId) {
        await dbRun(
            `UPDATE sso_configurations SET is_active = 0, updated_at = datetime('now') WHERE organization_id = ?`,
            [organizationId]
        );

        AuditService.logSystemEvent('SSO_DEACTIVATED', 'organization', organizationId, organizationId);

        return { success: true };
    },

    /**
     * Generate SP metadata XML for SAML
     * @param {string} organizationId 
     */
    async generateMetadata(organizationId) {
        const config = await this.getConfiguration(organizationId);
        if (!config) {
            throw new Error('SSO configuration not found');
        }

        // Generate basic SAML SP metadata
        const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" 
                     entityID="${config.spEntityId}">
    <md:SPSSODescriptor AuthnRequestsSigned="false" 
                        WantAssertionsSigned="true" 
                        protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
        <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
        <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
                                     Location="${config.spAcsUrl}" 
                                     index="0" 
                                     isDefault="true"/>
        <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" 
                                Location="${config.spSloUrl}"/>
    </md:SPSSODescriptor>
    <md:Organization>
        <md:OrganizationName xml:lang="en">Consultify</md:OrganizationName>
        <md:OrganizationDisplayName xml:lang="en">Consultify</md:OrganizationDisplayName>
        <md:OrganizationURL xml:lang="en">${process.env.FRONTEND_URL || 'https://consultify.app'}</md:OrganizationURL>
    </md:Organization>
</md:EntityDescriptor>`;

        return metadata;
    },

    /**
     * Process SAML assertion
     * @param {string} organizationId 
     * @param {Object} assertion - Parsed SAML assertion
     */
    async processSAMLAssertion(organizationId, assertion, requestInfo = {}) {
        const config = await this.getConfiguration(organizationId);
        if (!config || !config.isActive) {
            throw new Error('SSO not configured or not active');
        }

        const attemptId = uuidv4();

        try {
            // Extract user info from assertion using attribute mapping
            const mapping = config.attributeMapping;
            const email = assertion.attributes?.[mapping.email] || assertion.nameId;
            const firstName = assertion.attributes?.[mapping.firstName];
            const lastName = assertion.attributes?.[mapping.lastName];

            if (!email) {
                throw new Error('No email found in SAML assertion');
            }

            // Find or create user
            let user = await dbGet(`SELECT * FROM users WHERE email = ?`, [email]);
            let userCreated = false;

            if (!user) {
                if (!config.autoProvisionUsers) {
                    throw new Error('User not found and auto-provisioning disabled');
                }

                // Create user
                const userId = uuidv4();
                await dbRun(
                    `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status, sso_only)
                     VALUES (?, ?, ?, ?, ?, ?, 'active', 1)`,
                    [userId, organizationId, email, firstName, lastName, config.defaultRole]
                );

                user = await dbGet(`SELECT * FROM users WHERE id = ?`, [userId]);
                userCreated = true;
            } else if (user.organization_id !== organizationId) {
                throw new Error('User belongs to different organization');
            }

            // Create SSO session
            const sessionId = uuidv4();
            const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); // 8 hours

            await dbRun(
                `INSERT INTO sso_sessions (id, user_id, organization_id, sso_config_id, name_id, session_index, expires_at, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [sessionId, user.id, organizationId, config.id, assertion.nameId, assertion.sessionIndex, expiresAt, requestInfo.ip, requestInfo.userAgent]
            );

            // Log successful attempt
            await this._logAttempt({
                id: attemptId,
                organizationId,
                ssoConfigId: config.id,
                status: 'success',
                nameId: assertion.nameId,
                userId: user.id,
                userCreated,
                ...requestInfo,
            });

            AuditService.logSystemEvent('SSO_LOGIN', 'user', user.id, organizationId, {
                providerType: config.providerType,
                userCreated,
            });

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    organizationId: user.organization_id,
                },
                sessionId,
                expiresAt,
            };

        } catch (error) {
            // Log failed attempt
            await this._logAttempt({
                id: attemptId,
                organizationId,
                ssoConfigId: config?.id,
                status: 'failed',
                errorMessage: error.message,
                ...requestInfo,
            });

            throw error;
        }
    },

    /**
     * Terminate SSO session (logout)
     * @param {string} sessionId 
     * @param {string} reason 
     */
    async terminateSession(sessionId, reason = 'logout') {
        await dbRun(
            `UPDATE sso_sessions SET terminated_at = datetime('now'), termination_reason = ? WHERE id = ?`,
            [reason, sessionId]
        );
    },

    /**
     * Get login attempts for troubleshooting
     * @param {string} organizationId 
     * @param {Object} options 
     */
    async getLoginAttempts(organizationId, options = {}) {
        const { limit = 50, status = null } = options;

        let query = `SELECT * FROM sso_login_attempts WHERE organization_id = ?`;
        const params = [organizationId];

        if (status) {
            query += ` AND status = ?`;
            params.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        return dbAll(query, params);
    },

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    async _logAttempt(attempt) {
        await dbRun(
            `INSERT INTO sso_login_attempts 
             (id, organization_id, sso_config_id, status, error_code, error_message, name_id, user_id, user_created, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                attempt.id, attempt.organizationId, attempt.ssoConfigId,
                attempt.status, attempt.errorCode, attempt.errorMessage,
                attempt.nameId, attempt.userId, attempt.userCreated ? 1 : 0,
                attempt.ip, attempt.userAgent
            ]
        );
    },
};

module.exports = SSOService;
