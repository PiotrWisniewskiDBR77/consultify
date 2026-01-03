/**
 * Secret Manager Service
 * 
 * Manages API keys and secrets with:
 * - Rotation tracking
 * - Expiry monitoring
 * - Rotation audit logging
 * - Secure storage verification
 * 
 * Part of Security Excellence - Phase 3.2
 * 
 * @module secretManager
 */

import crypto from 'crypto';

// Dependency injection for testing
const deps = {
    _db: null,
    _aiLogger: null,
    _uuidv4: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get aiLogger() { return this._aiLogger; },
    set aiLogger(val) { this._aiLogger = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../database.js');
        deps._db = db;
    }
    if (!deps._aiLogger) {
        const { aiLogger } = await import('./ai/logger.js');
        deps._aiLogger = aiLogger;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
}

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    if (newDeps.db) deps.db = newDeps.db;
    if (newDeps.aiLogger) deps.aiLogger = newDeps.aiLogger;
    if (newDeps.uuidv4) deps.uuidv4 = newDeps.uuidv4;
}

// Secret types
const SECRET_TYPES = {
    API_KEY: 'api_key',
    ACCESS_TOKEN: 'access_token',
    OAUTH_SECRET: 'oauth_secret',
    ENCRYPTION_KEY: 'encryption_key',
    DATABASE_PASSWORD: 'database_password',
    WEBHOOK_SECRET: 'webhook_secret'
};

// Rotation policies (in days)
const ROTATION_POLICIES = {
    api_key: 90,           // API keys every 90 days
    access_token: 30,      // Access tokens every 30 days
    oauth_secret: 180,     // OAuth secrets every 180 days
    encryption_key: 365,   // Encryption keys every year
    database_password: 90, // DB passwords every 90 days
    webhook_secret: 90     // Webhook secrets every 90 days
};

// Warning thresholds (days before expiry)
const WARNING_THRESHOLDS = {
    CRITICAL: 7,    // 7 days before expiry
    WARNING: 14,    // 14 days before expiry
    NOTICE: 30      // 30 days before expiry
};

const SecretManager = {
    SECRET_TYPES,
    ROTATION_POLICIES,

    /**
     * Register a secret for tracking
     * @param {Object} params - { providerId, secretType, secretHash, expiresAt }
     */
    registerSecret: async (params) => {
        await initDeps();
        const {
            providerId,
            secretType,
            secretHash = null,
            expiresAt = null,
            metadata = {}
        } = params;

        const id = deps.uuidv4();
        const now = new Date();
        
        // Calculate expiry based on rotation policy if not provided
        const policyDays = ROTATION_POLICIES[secretType] || 90;
        const calculatedExpiry = expiresAt || new Date(now.getTime() + policyDays * 24 * 60 * 60 * 1000);

        return new Promise((resolve, reject) => {
            deps.db.run(`
                INSERT INTO secret_rotation_tracking (
                    id, provider_id, secret_type, secret_hash,
                    created_at, expires_at, last_rotated_at,
                    rotation_count, status, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id,
                providerId,
                secretType,
                secretHash || SecretManager._hashSecret(providerId + secretType),
                now.toISOString(),
                calculatedExpiry.toISOString(),
                now.toISOString(),
                0,
                'active',
                JSON.stringify(metadata)
            ], function(err) {
                if (err) {
                    deps.aiLogger.error('SecretManager', `Failed to register secret: ${err.message}`);
                    return reject(err);
                }

                deps.aiLogger.info('SecretManager', `Registered secret for ${providerId} (${secretType})`);
                
                SecretManager._logAudit({
                    action: 'SECRET_REGISTERED',
                    providerId,
                    secretType,
                    secretId: id
                });

                resolve({ id, expiresAt: calculatedExpiry });
            });
        });
    },

    /**
     * Record a secret rotation
     * @param {string} providerId - Provider identifier
     * @param {string} secretType - Type of secret
     * @param {string} newSecretHash - Hash of the new secret (for verification)
     */
    recordRotation: async (providerId, secretType, newSecretHash = null) => {
        await initDeps();
        const now = new Date();
        const policyDays = ROTATION_POLICIES[secretType] || 90;
        const newExpiry = new Date(now.getTime() + policyDays * 24 * 60 * 60 * 1000);

        return new Promise((resolve, reject) => {
            deps.db.run(`
                UPDATE secret_rotation_tracking
                SET 
                    secret_hash = ?,
                    last_rotated_at = ?,
                    expires_at = ?,
                    rotation_count = rotation_count + 1,
                    status = 'active'
                WHERE provider_id = ? AND secret_type = ?
            `, [
                newSecretHash || SecretManager._hashSecret(providerId + secretType + now.toISOString()),
                now.toISOString(),
                newExpiry.toISOString(),
                providerId,
                secretType
            ], function(err) {
                if (err) {
                    deps.aiLogger.error('SecretManager', `Failed to record rotation: ${err.message}`);
                    return reject(err);
                }

                if (this.changes === 0) {
                    // Secret not found, register it
                    return SecretManager.registerSecret({ providerId, secretType, secretHash: newSecretHash })
                        .then(resolve)
                        .catch(reject);
                }

                deps.aiLogger.info('SecretManager', `Recorded rotation for ${providerId} (${secretType})`);
                
                SecretManager._logAudit({
                    action: 'SECRET_ROTATED',
                    providerId,
                    secretType,
                    newExpiry: newExpiry.toISOString()
                });

                resolve({ success: true, expiresAt: newExpiry });
            });
        });
    },

    /**
     * Check for secrets nearing expiry
     * @param {number} withinDays - Check secrets expiring within this many days
     */
    checkExpiringSecrets: async (withinDays = 30) => {
        await initDeps();
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() + withinDays);

        return new Promise((resolve) => {
            deps.db.all(`
                SELECT 
                    id, provider_id, secret_type, 
                    created_at, expires_at, last_rotated_at,
                    rotation_count, status
                FROM secret_rotation_tracking
                WHERE expires_at <= ? AND status = 'active'
                ORDER BY expires_at ASC
            `, [checkDate.toISOString()], (err, rows) => {
                if (err) {
                    deps.aiLogger.error('SecretManager', `Failed to check expiring secrets: ${err.message}`);
                    return resolve([]);
                }

                const now = new Date();
                const results = (rows || []).map(row => {
                    const expiresAt = new Date(row.expires_at);
                    const daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
                    
                    let severity;
                    if (daysUntilExpiry <= WARNING_THRESHOLDS.CRITICAL) {
                        severity = 'critical';
                    } else if (daysUntilExpiry <= WARNING_THRESHOLDS.WARNING) {
                        severity = 'warning';
                    } else {
                        severity = 'notice';
                    }

                    return {
                        ...row,
                        daysUntilExpiry,
                        severity,
                        isExpired: daysUntilExpiry <= 0
                    };
                });

                resolve(results);
            });
        });
    },

    /**
     * Get rotation status for all secrets
     */
    getRotationStatus: async (organizationId = null) => {
        await initDeps();
        return new Promise((resolve) => {
            let sql = `
                SELECT 
                    provider_id, secret_type, 
                    created_at, expires_at, last_rotated_at,
                    rotation_count, status
                FROM secret_rotation_tracking
                WHERE status = 'active'
            `;
            const params = [];

            if (organizationId) {
                sql += ` AND metadata LIKE ?`;
                params.push(`%"organizationId":"${organizationId}"%`);
            }

            deps.db.all(sql, params, (err, rows) => {
                if (err) {
                    return resolve({ secrets: [], summary: {} });
                }

                const now = new Date();
                const secrets = (rows || []).map(row => {
                    const expiresAt = new Date(row.expires_at);
                    const daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
                    
                    return {
                        ...row,
                        daysUntilExpiry,
                        isExpired: daysUntilExpiry <= 0,
                        needsRotation: daysUntilExpiry <= WARNING_THRESHOLDS.WARNING
                    };
                });

                const summary = {
                    total: secrets.length,
                    expired: secrets.filter(s => s.isExpired).length,
                    critical: secrets.filter(s => s.daysUntilExpiry <= WARNING_THRESHOLDS.CRITICAL && !s.isExpired).length,
                    warning: secrets.filter(s => s.daysUntilExpiry <= WARNING_THRESHOLDS.WARNING && s.daysUntilExpiry > WARNING_THRESHOLDS.CRITICAL).length,
                    healthy: secrets.filter(s => s.daysUntilExpiry > WARNING_THRESHOLDS.WARNING).length
                };

                resolve({ secrets, summary });
            });
        });
    },

    /**
     * Get rotation history for a secret
     */
    getRotationHistory: async (providerId, secretType, limit = 10) => {
        await initDeps();
        return new Promise((resolve) => {
            deps.db.all(`
                SELECT *
                FROM secret_rotation_audit
                WHERE provider_id = ? AND secret_type = ?
                ORDER BY created_at DESC
                LIMIT ?
            `, [providerId, secretType, limit], (err, rows) => {
                if (err) {
                    return resolve([]);
                }
                resolve(rows || []);
            });
        });
    },

    /**
     * Verify a secret matches stored hash
     * @param {string} providerId - Provider identifier
     * @param {string} secretType - Type of secret
     * @param {string} secretValue - Secret to verify
     */
    verifySecret: async (providerId, secretType, secretValue) => {
        await initDeps();
        const hash = SecretManager._hashSecret(secretValue);

        return new Promise((resolve) => {
            deps.db.get(`
                SELECT secret_hash, expires_at
                FROM secret_rotation_tracking
                WHERE provider_id = ? AND secret_type = ? AND status = 'active'
            `, [providerId, secretType], (err, row) => {
                if (err || !row) {
                    return resolve({ valid: false, reason: 'Secret not found' });
                }

                const isExpired = new Date(row.expires_at) < new Date();
                if (isExpired) {
                    return resolve({ valid: false, reason: 'Secret has expired' });
                }

                // Note: In production, use timing-safe comparison
                const matches = row.secret_hash === hash;
                resolve({
                    valid: matches,
                    reason: matches ? 'OK' : 'Hash mismatch'
                });
            });
        });
    },

    /**
     * Mark a secret as revoked
     */
    revokeSecret: async (providerId, secretType, reason = 'manual') => {
        await initDeps();
        return new Promise((resolve, reject) => {
            deps.db.run(`
                UPDATE secret_rotation_tracking
                SET status = 'revoked', metadata = json_set(COALESCE(metadata, '{}'), '$.revokedAt', ?, '$.revokeReason', ?)
                WHERE provider_id = ? AND secret_type = ? AND status = 'active'
            `, [
                new Date().toISOString(),
                reason,
                providerId,
                secretType
            ], function(err) {
                if (err) {
                    return reject(err);
                }

                SecretManager._logAudit({
                    action: 'SECRET_REVOKED',
                    providerId,
                    secretType,
                    reason
                });

                resolve({ success: this.changes > 0 });
            });
        });
    },

    /**
     * Get secrets that should be rotated
     */
    getSecretsForRotation: async () => {
        const expiringSecrets = await SecretManager.checkExpiringSecrets(WARNING_THRESHOLDS.WARNING);
        return expiringSecrets.filter(s => !s.isExpired);
    },

    /**
     * Send rotation reminders (integrate with notification system)
     */
    sendRotationReminders: async () => {
        await initDeps();
        const expiring = await SecretManager.checkExpiringSecrets(WARNING_THRESHOLDS.WARNING);
        
        const reminders = [];
        for (const secret of expiring) {
            if (secret.severity === 'critical' || secret.severity === 'warning') {
                reminders.push({
                    providerId: secret.provider_id,
                    secretType: secret.secret_type,
                    daysUntilExpiry: secret.daysUntilExpiry,
                    severity: secret.severity
                });
            }
        }

        if (reminders.length > 0) {
            deps.aiLogger.warn('SecretManager', `${reminders.length} secrets need rotation`, reminders);
        }

        return reminders;
    },

    // ========================================================================
    // Private Methods
    // ========================================================================

    /**
     * Hash a secret for storage (one-way)
     */
    _hashSecret: (value) => {
        return crypto
            .createHash('sha256')
            .update(value)
            .digest('hex');
    },

    /**
     * Log audit event
     */
    _logAudit: async (event) => {
        await initDeps();
        const id = deps.uuidv4();
        deps.db.run(`
            INSERT INTO secret_rotation_audit (
                id, action, provider_id, secret_type, details, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            id,
            event.action,
            event.providerId,
            event.secretType,
            JSON.stringify(event),
            new Date().toISOString()
        ], (err) => {
            if (err) {
                deps.aiLogger.error('SecretManager', `Failed to log audit: ${err.message}`);
            }
        });
    },

    /**
     * Set dependencies (for testing)
     */
    setDependencies
};

export default SecretManager;


