/**
 * Security Policy Service
 * 
 * Manages organization security policies including:
 * - Password policies
 * - Session management
 * - IP allowlisting/blocklisting
 * - MFA enforcement
 * - Login attempt tracking
 * - Account lockouts
 */

// Dependency injection for testing
const deps = {
    _uuidv4: null,
    _db: null,

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; },

    get db() { return this._db; },
    set db(val) { this._db = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
    if (!deps._db) {
        const { default: db } = await import('../src/database/index.js');
        deps._db = db;
    }
}
import AuditService from './auditService.js';

// Database helpers
async function dbGet(sql, params = []) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function dbRun(sql, params = []) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

async function dbAll(sql, params = []) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Compliance presets
const COMPLIANCE_PRESETS = {
    none: {
        password_min_length: 8,
        password_require_uppercase: true,
        password_require_lowercase: true,
        password_require_numbers: true,
        password_require_special: false,
        password_expiry_days: 0,
        mfa_required: false,
        session_timeout_minutes: 480,
    },
    soc2: {
        password_min_length: 12,
        password_require_uppercase: true,
        password_require_lowercase: true,
        password_require_numbers: true,
        password_require_special: true,
        password_expiry_days: 90,
        password_history_count: 12,
        max_login_attempts: 5,
        lockout_duration_minutes: 30,
        mfa_required: true,
        session_timeout_minutes: 60,
        concurrent_sessions_limit: 3,
    },
    hipaa: {
        password_min_length: 14,
        password_require_uppercase: true,
        password_require_lowercase: true,
        password_require_numbers: true,
        password_require_special: true,
        password_expiry_days: 60,
        password_history_count: 24,
        max_login_attempts: 3,
        lockout_duration_minutes: 60,
        mfa_required: true,
        session_timeout_minutes: 15,
        concurrent_sessions_limit: 1,
        require_session_binding: true,
    },
    gdpr: {
        password_min_length: 10,
        password_require_uppercase: true,
        password_require_lowercase: true,
        password_require_numbers: true,
        password_require_special: false,
        password_expiry_days: 180,
        mfa_required: false,
        session_timeout_minutes: 240,
    },
};

const SecurityPolicyService = {
    /**
     * Get security policy for organization
     * Falls back to global defaults if no org-specific policy
     */
    async getPolicy(organizationId) {
        let policy = null;

        if (organizationId) {
            policy = await dbGet(
                `SELECT * FROM security_policies WHERE organization_id = ?`,
                [organizationId]
            );
        }

        if (!policy) {
            policy = await dbGet(
                `SELECT * FROM security_policies WHERE organization_id IS NULL`
            );
        }

        if (!policy) {
            // Return default policy
            return {
                ...COMPLIANCE_PRESETS.none,
                ipAllowlist: [],
                ipBlocklist: [],
                geoRestrictions: [],
                mfaMethods: ['totp'],
            };
        }

        return this._formatPolicy(policy);
    },

    /**
     * Create or update security policy for organization
     */
    async upsertPolicy(organizationId, updates, updatedBy = null) {
        const existing = await dbGet(
            `SELECT id FROM security_policies WHERE organization_id = ?`,
            [organizationId]
        );

        if (existing) {
            return this.updatePolicy(organizationId, updates, updatedBy);
        }

        const id = uuidv4();
        const preset = updates.compliancePreset || 'none';
        const presetValues = COMPLIANCE_PRESETS[preset] || COMPLIANCE_PRESETS.none;

        await dbRun(
            `INSERT INTO security_policies (
                id, organization_id,
                password_min_length, password_require_uppercase, password_require_lowercase,
                password_require_numbers, password_require_special, password_expiry_days, password_history_count,
                max_login_attempts, lockout_duration_minutes,
                session_timeout_minutes, concurrent_sessions_limit, require_session_binding,
                ip_allowlist, ip_blocklist, geo_restrictions,
                mfa_required, mfa_methods, mfa_remember_device_days,
                compliance_preset, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, organizationId,
                updates.passwordMinLength ?? presetValues.password_min_length,
                updates.passwordRequireUppercase ?? presetValues.password_require_uppercase ? 1 : 0,
                updates.passwordRequireLowercase ?? presetValues.password_require_lowercase ? 1 : 0,
                updates.passwordRequireNumbers ?? presetValues.password_require_numbers ? 1 : 0,
                updates.passwordRequireSpecial ?? presetValues.password_require_special ? 1 : 0,
                updates.passwordExpiryDays ?? presetValues.password_expiry_days,
                updates.passwordHistoryCount ?? presetValues.password_history_count ?? 3,
                updates.maxLoginAttempts ?? presetValues.max_login_attempts ?? 5,
                updates.lockoutDurationMinutes ?? presetValues.lockout_duration_minutes ?? 30,
                updates.sessionTimeoutMinutes ?? presetValues.session_timeout_minutes,
                updates.concurrentSessionsLimit ?? presetValues.concurrent_sessions_limit ?? 5,
                updates.requireSessionBinding ?? presetValues.require_session_binding ? 1 : 0,
                JSON.stringify(updates.ipAllowlist || []),
                JSON.stringify(updates.ipBlocklist || []),
                JSON.stringify(updates.geoRestrictions || []),
                updates.mfaRequired ?? presetValues.mfa_required ? 1 : 0,
                JSON.stringify(updates.mfaMethods || ['totp']),
                updates.mfaRememberDeviceDays ?? 30,
                preset,
                updatedBy
            ]
        );

        AuditService.logSystemEvent('SECURITY_POLICY_CREATED', 'security_policy', id, organizationId, {
            preset,
            createdBy: updatedBy,
        });

        return { id, success: true };
    },

    /**
     * Update existing security policy
     */
    async updatePolicy(organizationId, updates, updatedBy = null) {
        const fields = [];
        const params = [];

        const fieldMappings = {
            passwordMinLength: 'password_min_length',
            passwordRequireUppercase: 'password_require_uppercase',
            passwordRequireLowercase: 'password_require_lowercase',
            passwordRequireNumbers: 'password_require_numbers',
            passwordRequireSpecial: 'password_require_special',
            passwordExpiryDays: 'password_expiry_days',
            passwordHistoryCount: 'password_history_count',
            maxLoginAttempts: 'max_login_attempts',
            lockoutDurationMinutes: 'lockout_duration_minutes',
            sessionTimeoutMinutes: 'session_timeout_minutes',
            concurrentSessionsLimit: 'concurrent_sessions_limit',
            requireSessionBinding: 'require_session_binding',
            mfaRequired: 'mfa_required',
            mfaRememberDeviceDays: 'mfa_remember_device_days',
            compliancePreset: 'compliance_preset',
        };

        for (const [key, dbKey] of Object.entries(fieldMappings)) {
            if (updates[key] !== undefined) {
                fields.push(`${dbKey} = ?`);
                params.push(typeof updates[key] === 'boolean' ? (updates[key] ? 1 : 0) : updates[key]);
            }
        }

        if (updates.ipAllowlist) {
            fields.push('ip_allowlist = ?');
            params.push(JSON.stringify(updates.ipAllowlist));
        }

        if (updates.ipBlocklist) {
            fields.push('ip_blocklist = ?');
            params.push(JSON.stringify(updates.ipBlocklist));
        }

        if (updates.geoRestrictions) {
            fields.push('geo_restrictions = ?');
            params.push(JSON.stringify(updates.geoRestrictions));
        }

        if (updates.mfaMethods) {
            fields.push('mfa_methods = ?');
            params.push(JSON.stringify(updates.mfaMethods));
        }

        if (fields.length === 0) {
            return { success: true, message: 'No changes' };
        }

        fields.push('updated_at = datetime("now")');
        params.push(organizationId);

        await dbRun(
            `UPDATE security_policies SET ${fields.join(', ')} WHERE organization_id = ?`,
            params
        );

        AuditService.logSystemEvent('SECURITY_POLICY_UPDATED', 'security_policy', null, organizationId, {
            updatedFields: Object.keys(updates),
            updatedBy,
        });

        return { success: true };
    },

    /**
     * Apply a compliance preset
     */
    async applyPreset(organizationId, preset, updatedBy = null) {
        if (!COMPLIANCE_PRESETS[preset]) {
            throw new Error(`Unknown compliance preset: ${preset}`);
        }

        const presetValues = COMPLIANCE_PRESETS[preset];
        return this.upsertPolicy(organizationId, {
            ...presetValues,
            compliancePreset: preset,
        }, updatedBy);
    },

    /**
     * Validate password against policy
     */
    async validatePassword(password, organizationId = null) {
        const policy = await this.getPolicy(organizationId);
        const errors = [];

        if (password.length < policy.passwordMinLength) {
            errors.push(`Password must be at least ${policy.passwordMinLength} characters`);
        }

        if (policy.passwordRequireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (policy.passwordRequireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (policy.passwordRequireNumbers && !/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (policy.passwordRequireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    },

    /**
     * Check if password was recently used
     */
    async checkPasswordHistory(userId, passwordHash, organizationId = null) {
        const policy = await this.getPolicy(organizationId);
        
        if (!policy.passwordHistoryCount) {
            return { isReused: false };
        }

        const recentPasswords = await dbAll(
            `SELECT password_hash FROM password_history 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT ?`,
            [userId, policy.passwordHistoryCount]
        );

        const bcrypt = require('bcrypt');
        for (const entry of recentPasswords) {
            if (await bcrypt.compare(passwordHash, entry.password_hash)) {
                return { isReused: true, message: `Password was used in the last ${policy.passwordHistoryCount} passwords` };
            }
        }

        return { isReused: false };
    },

    /**
     * Record password in history
     */
    async recordPasswordHistory(userId, passwordHash) {
        await dbRun(
            `INSERT INTO password_history (id, user_id, password_hash)
             VALUES (?, ?, ?)`,
            [uuidv4(), userId, passwordHash]
        );
    },

    /**
     * Check IP against policy
     */
    async checkIPPolicy(ip, organizationId = null) {
        const policy = await this.getPolicy(organizationId);

        // Check blocklist first
        if (policy.ipBlocklist?.length > 0) {
            for (const blockedIP of policy.ipBlocklist) {
                if (this._matchIP(ip, blockedIP)) {
                    return { allowed: false, reason: 'IP is blocked' };
                }
            }
        }

        // Check allowlist (if set, only allow listed IPs)
        if (policy.ipAllowlist?.length > 0) {
            for (const allowedIP of policy.ipAllowlist) {
                if (this._matchIP(ip, allowedIP)) {
                    return { allowed: true };
                }
            }
            return { allowed: false, reason: 'IP not in allowlist' };
        }

        return { allowed: true };
    },

    /**
     * Record login attempt
     */
    async recordLoginAttempt(data) {
        const id = uuidv4();
        await dbRun(
            `INSERT INTO login_attempts (
                id, user_email, user_id, organization_id,
                success, failure_reason, auth_method,
                ip_address, user_agent, location,
                risk_score, risk_factors
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                data.email,
                data.userId,
                data.organizationId,
                data.success ? 1 : 0,
                data.failureReason,
                data.authMethod || 'password',
                data.ip,
                data.userAgent,
                data.location,
                data.riskScore || 0,
                JSON.stringify(data.riskFactors || []),
            ]
        );

        // Check for lockout
        if (!data.success) {
            await this._checkAndLockAccount(data.email, data.ip, data.organizationId);
        }

        return { id };
    },

    /**
     * Get login attempts for user or organization
     */
    async getLoginAttempts(filters = {}) {
        let query = `SELECT * FROM login_attempts WHERE 1=1`;
        const params = [];

        if (filters.userId) {
            query += ` AND user_id = ?`;
            params.push(filters.userId);
        }

        if (filters.organizationId) {
            query += ` AND organization_id = ?`;
            params.push(filters.organizationId);
        }

        if (filters.email) {
            query += ` AND user_email = ?`;
            params.push(filters.email);
        }

        if (filters.success !== undefined) {
            query += ` AND success = ?`;
            params.push(filters.success ? 1 : 0);
        }

        if (filters.since) {
            query += ` AND created_at >= ?`;
            params.push(filters.since);
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(filters.limit || 100);

        return dbAll(query, params);
    },

    /**
     * Check if account is locked
     */
    async isAccountLocked(email) {
        const lockout = await dbGet(
            `SELECT * FROM account_lockouts 
             WHERE user_email = ? 
             AND unlocked_at IS NULL 
             AND (expires_at IS NULL OR expires_at > datetime('now'))
             ORDER BY locked_at DESC LIMIT 1`,
            [email]
        );

        if (lockout) {
            return {
                locked: true,
                reason: lockout.reason,
                expiresAt: lockout.expires_at,
                lockedAt: lockout.locked_at,
            };
        }

        return { locked: false };
    },

    /**
     * Unlock account
     */
    async unlockAccount(email, unlockedBy = null) {
        await dbRun(
            `UPDATE account_lockouts 
             SET unlocked_at = datetime('now'), unlocked_by = ?
             WHERE user_email = ? AND unlocked_at IS NULL`,
            [unlockedBy, email]
        );

        AuditService.logSystemEvent('ACCOUNT_UNLOCKED', 'user', null, null, {
            email,
            unlockedBy,
        });

        return { success: true };
    },

    /**
     * Create a user session
     */
    async createSession(userId, sessionData) {
        const id = uuidv4();
        const policy = await this.getPolicy(sessionData.organizationId);

        // Check concurrent sessions limit
        const activeSessions = await dbAll(
            `SELECT id FROM user_sessions 
             WHERE user_id = ? AND is_active = 1`,
            [userId]
        );

        if (activeSessions.length >= policy.concurrentSessionsLimit) {
            // Terminate oldest session
            const oldestSession = await dbGet(
                `SELECT id FROM user_sessions 
                 WHERE user_id = ? AND is_active = 1 
                 ORDER BY created_at ASC LIMIT 1`,
                [userId]
            );
            if (oldestSession) {
                await this.terminateSession(oldestSession.id, 'concurrent_limit');
            }
        }

        const expiresAt = new Date(Date.now() + policy.sessionTimeoutMinutes * 60 * 1000).toISOString();

        await dbRun(
            `INSERT INTO user_sessions (
                id, user_id, organization_id,
                device_fingerprint, device_type, device_name, browser, os,
                ip_address, location, last_activity, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
            [
                id, userId, sessionData.organizationId,
                sessionData.deviceFingerprint,
                sessionData.deviceType,
                sessionData.deviceName,
                sessionData.browser,
                sessionData.os,
                sessionData.ip,
                sessionData.location,
                expiresAt,
            ]
        );

        return { sessionId: id, expiresAt };
    },

    /**
     * Get active sessions for user
     */
    async getUserSessions(userId) {
        return dbAll(
            `SELECT * FROM user_sessions 
             WHERE user_id = ? AND is_active = 1 
             ORDER BY last_activity DESC`,
            [userId]
        );
    },

    /**
     * Terminate session
     */
    async terminateSession(sessionId, reason = 'logout') {
        await dbRun(
            `UPDATE user_sessions 
             SET is_active = 0, terminated_at = datetime('now'), termination_reason = ?
             WHERE id = ?`,
            [reason, sessionId]
        );
    },

    /**
     * Terminate all sessions for user
     */
    async terminateAllSessions(userId, reason = 'logout_all', exceptSessionId = null) {
        let query = `UPDATE user_sessions 
                     SET is_active = 0, terminated_at = datetime('now'), termination_reason = ?
                     WHERE user_id = ? AND is_active = 1`;
        const params = [reason, userId];

        if (exceptSessionId) {
            query += ` AND id != ?`;
            params.push(exceptSessionId);
        }

        await dbRun(query, params);
    },

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    _formatPolicy(row) {
        return {
            id: row.id,
            organizationId: row.organization_id,
            // Password
            passwordMinLength: row.password_min_length,
            passwordRequireUppercase: !!row.password_require_uppercase,
            passwordRequireLowercase: !!row.password_require_lowercase,
            passwordRequireNumbers: !!row.password_require_numbers,
            passwordRequireSpecial: !!row.password_require_special,
            passwordExpiryDays: row.password_expiry_days,
            passwordHistoryCount: row.password_history_count,
            // Login
            maxLoginAttempts: row.max_login_attempts,
            lockoutDurationMinutes: row.lockout_duration_minutes,
            // Session
            sessionTimeoutMinutes: row.session_timeout_minutes,
            concurrentSessionsLimit: row.concurrent_sessions_limit,
            requireSessionBinding: !!row.require_session_binding,
            // IP
            ipAllowlist: JSON.parse(row.ip_allowlist || '[]'),
            ipBlocklist: JSON.parse(row.ip_blocklist || '[]'),
            geoRestrictions: JSON.parse(row.geo_restrictions || '[]'),
            // MFA
            mfaRequired: !!row.mfa_required,
            mfaMethods: JSON.parse(row.mfa_methods || '["totp"]'),
            mfaRememberDeviceDays: row.mfa_remember_device_days,
            // Meta
            compliancePreset: row.compliance_preset,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    },

    _matchIP(ip, pattern) {
        // Simple IP matching - supports exact match and CIDR notation
        if (ip === pattern) return true;
        
        // CIDR matching (simplified)
        if (pattern.includes('/')) {
            const [network, bits] = pattern.split('/');
            const ipParts = ip.split('.').map(Number);
            const networkParts = network.split('.').map(Number);
            const mask = ~((1 << (32 - parseInt(bits))) - 1);
            
            const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
            const networkNum = (networkParts[0] << 24) | (networkParts[1] << 16) | (networkParts[2] << 8) | networkParts[3];
            
            return (ipNum & mask) === (networkNum & mask);
        }

        // Wildcard matching (e.g., 192.168.*.*)
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '\\d+') + '$');
            return regex.test(ip);
        }

        return false;
    },

    async _checkAndLockAccount(email, ip, organizationId) {
        const policy = await this.getPolicy(organizationId);

        // Count recent failed attempts
        const recentAttempts = await dbAll(
            `SELECT id FROM login_attempts 
             WHERE user_email = ? AND success = 0 
             AND created_at > datetime('now', '-1 hour')`,
            [email]
        );

        if (recentAttempts.length >= policy.maxLoginAttempts) {
            // Lock the account
            const expiresAt = new Date(Date.now() + policy.lockoutDurationMinutes * 60 * 1000).toISOString();

            await dbRun(
                `INSERT INTO account_lockouts (
                    id, user_email, reason, failed_attempts, expires_at, ip_address
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [uuidv4(), email, 'failed_attempts', recentAttempts.length, expiresAt, ip]
            );

            AuditService.logSystemEvent('ACCOUNT_LOCKED', 'user', null, organizationId, {
                email,
                reason: 'failed_attempts',
                attempts: recentAttempts.length,
            });
        }
    },
};

export default SecurityPolicyService;






