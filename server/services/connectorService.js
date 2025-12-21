/**
 * Connector Service
 * Step 17: Integrations & Secrets Platform
 * 
 * CRUD operations for organization connector configurations.
 * Handles encryption of secrets and RBAC enforcement.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const secretsVault = require('./secretsVault');
const connectorRegistry = require('./connectorRegistry');
const auditLogger = require('../utils/auditLogger');

const ConnectorService = {
    /**
     * Get catalog of all available connectors.
     * @returns {Promise<Object[]>} Array of connector definitions
     */
    getCatalog: async () => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT key, name, category, capabilities_json, icon_url, documentation_url, is_available 
                 FROM connectors WHERE is_available = 1 ORDER BY category, name`,
                [],
                (err, rows) => {
                    if (err) return reject(err);

                    const connectors = rows.map(row => ({
                        ...row,
                        capabilities: JSON.parse(row.capabilities_json || '[]')
                    }));

                    resolve(connectors);
                }
            );
        });
    },

    /**
     * Get organization's configured connectors.
     * Secrets are always redacted in the response.
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object[]>} Array of org connector configs
     */
    getOrgConfigs: async (orgId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT occ.*, c.name, c.category, c.capabilities_json,
                        ch.last_check_at, ch.last_ok_at, ch.last_error_code, ch.consecutive_failures
                 FROM org_connector_configs occ
                 JOIN connectors c ON occ.connector_key = c.key
                 LEFT JOIN connector_health ch ON occ.org_id = ch.org_id AND occ.connector_key = ch.connector_key
                 WHERE occ.org_id = ?
                 ORDER BY c.category, c.name`,
                [orgId],
                (err, rows) => {
                    if (err) return reject(err);

                    const configs = rows.map(row => {
                        // Decrypt secrets for redaction
                        let redactedSecrets = {};
                        if (row.encrypted_secrets) {
                            try {
                                const secrets = secretsVault.decrypt(row.encrypted_secrets);
                                redactedSecrets = secretsVault.redact(secrets);
                            } catch {
                                redactedSecrets = { error: 'decryption_failed' };
                            }
                        }

                        return {
                            id: row.id,
                            connector_key: row.connector_key,
                            name: row.name,
                            category: row.category,
                            capabilities: JSON.parse(row.capabilities_json || '[]'),
                            status: row.status,
                            scopes: JSON.parse(row.scopes_json || '[]'),
                            sandbox_mode: !!row.sandbox_mode,
                            configured_by: row.configured_by,
                            created_at: row.created_at,
                            updated_at: row.updated_at,
                            secrets: redactedSecrets,
                            health: {
                                last_check_at: row.last_check_at,
                                last_ok_at: row.last_ok_at,
                                last_error_code: row.last_error_code,
                                consecutive_failures: row.consecutive_failures || 0
                            }
                        };
                    });

                    resolve(configs);
                }
            );
        });
    },

    /**
     * Connect an integration for an organization.
     * Encrypts and stores secrets.
     * @param {string} orgId - Organization ID
     * @param {string} connectorKey - Connector key (e.g., 'slack')
     * @param {Object} secrets - Credentials object
     * @param {string[]} scopes - Optional: requested scopes
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Created config (secrets redacted)
     */
    connect: async (orgId, connectorKey, secrets, scopes = [], options = {}) => {
        const { configuredBy, sandboxMode = false } = options;

        // Validate connector exists
        const connector = connectorRegistry.getConnector(connectorKey);
        if (!connector) {
            throw new Error(`Unknown connector: ${connectorKey}`);
        }

        // Validate required credentials
        const validation = connectorRegistry.validateCredentials(connectorKey, secrets);
        if (!validation.valid) {
            throw new Error(`Missing required credentials: ${validation.missing.join(', ')}`);
        }

        // Encrypt secrets
        const encryptedSecrets = secretsVault.encrypt(secrets);

        const id = `conn-${uuidv4()}`;
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO org_connector_configs 
                 (id, org_id, connector_key, status, encrypted_secrets, scopes_json, sandbox_mode, configured_by, created_at, updated_at)
                 VALUES (?, ?, ?, 'CONNECTED', ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(org_id, connector_key) DO UPDATE SET
                    status = 'CONNECTED',
                    encrypted_secrets = excluded.encrypted_secrets,
                    scopes_json = excluded.scopes_json,
                    sandbox_mode = excluded.sandbox_mode,
                    configured_by = excluded.configured_by,
                    updated_at = excluded.updated_at`,
                [id, orgId, connectorKey, encryptedSecrets, JSON.stringify(scopes), sandboxMode ? 1 : 0, configuredBy, now, now],
                function (err) {
                    if (err) return reject(err);

                    // Log audit event
                    auditLogger.info('CONNECTOR_CONNECTED', {
                        org_id: orgId,
                        connector_key: connectorKey,
                        configured_by: configuredBy,
                        sandbox_mode: sandboxMode
                    });

                    resolve({
                        id,
                        connector_key: connectorKey,
                        status: 'CONNECTED',
                        scopes,
                        sandbox_mode: sandboxMode,
                        secrets: secretsVault.redact(secrets),
                        created_at: now
                    });
                }
            );
        });
    },

    /**
     * Disconnect an integration.
     * @param {string} orgId - Organization ID
     * @param {string} connectorKey - Connector key
     * @param {string} disconnectedBy - User ID
     * @returns {Promise<boolean>} Success
     */
    disconnect: async (orgId, connectorKey, disconnectedBy) => {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM org_connector_configs WHERE org_id = ? AND connector_key = ?`,
                [orgId, connectorKey],
                function (err) {
                    if (err) return reject(err);

                    if (this.changes === 0) {
                        return resolve(false);
                    }

                    // Also delete health record
                    db.run(
                        `DELETE FROM connector_health WHERE org_id = ? AND connector_key = ?`,
                        [orgId, connectorKey]
                    );

                    auditLogger.info('CONNECTOR_DISCONNECTED', {
                        org_id: orgId,
                        connector_key: connectorKey,
                        disconnected_by: disconnectedBy
                    });

                    resolve(true);
                }
            );
        });
    },

    /**
     * Update secrets for an existing connection (rotation).
     * @param {string} orgId - Organization ID
     * @param {string} connectorKey - Connector key
     * @param {Object} secrets - New credentials
     * @param {string} updatedBy - User ID
     * @returns {Promise<boolean>} Success
     */
    updateSecret: async (orgId, connectorKey, secrets, updatedBy) => {
        // Validate connector exists
        const connector = connectorRegistry.getConnector(connectorKey);
        if (!connector) {
            throw new Error(`Unknown connector: ${connectorKey}`);
        }

        // Validate required credentials
        const validation = connectorRegistry.validateCredentials(connectorKey, secrets);
        if (!validation.valid) {
            throw new Error(`Missing required credentials: ${validation.missing.join(', ')}`);
        }

        const encryptedSecrets = secretsVault.encrypt(secrets);
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE org_connector_configs 
                 SET encrypted_secrets = ?, updated_at = ?, configured_by = ?
                 WHERE org_id = ? AND connector_key = ?`,
                [encryptedSecrets, now, updatedBy, orgId, connectorKey],
                function (err) {
                    if (err) return reject(err);

                    if (this.changes === 0) {
                        return resolve(false);
                    }

                    auditLogger.info('CONNECTOR_SECRET_ROTATED', {
                        org_id: orgId,
                        connector_key: connectorKey,
                        updated_by: updatedBy
                    });

                    resolve(true);
                }
            );
        });
    },

    /**
     * Get decrypted secrets for a connector (internal use only).
     * Should never be exposed to API responses.
     * @param {string} orgId - Organization ID
     * @param {string} connectorKey - Connector key
     * @returns {Promise<Object|null>} Decrypted secrets or null
     */
    getSecrets: async (orgId, connectorKey) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT encrypted_secrets, status FROM org_connector_configs 
                 WHERE org_id = ? AND connector_key = ?`,
                [orgId, connectorKey],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row || !row.encrypted_secrets) return resolve(null);
                    if (row.status !== 'CONNECTED') return resolve(null);

                    try {
                        const secrets = secretsVault.decrypt(row.encrypted_secrets);
                        resolve(secrets);
                    } catch (e) {
                        reject(new Error('Failed to decrypt secrets'));
                    }
                }
            );
        });
    },

    /**
     * Get connector config including sandbox mode.
     * @param {string} orgId - Organization ID
     * @param {string} connectorKey - Connector key
     * @returns {Promise<Object|null>} Config or null
     */
    getConfig: async (orgId, connectorKey) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM org_connector_configs WHERE org_id = ? AND connector_key = ?`,
                [orgId, connectorKey],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);

                    resolve({
                        ...row,
                        scopes: JSON.parse(row.scopes_json || '[]'),
                        sandbox_mode: !!row.sandbox_mode
                    });
                }
            );
        });
    }
};

module.exports = ConnectorService;
