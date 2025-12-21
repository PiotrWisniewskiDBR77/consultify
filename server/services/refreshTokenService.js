/**
 * Refresh Token Service
 * 
 * Handles secure refresh token management for JWT authentication.
 * 
 * Features:
 * - Secure token generation with family tracking
 * - Token rotation on refresh
 * - Refresh token theft detection
 * - Device tracking for session management
 * - Automatic cleanup of expired tokens
 * 
 * Security:
 * - Tokens hashed with SHA-256 before storage
 * - Token families for rotation detection
 * - Immediate revocation on suspicious activity
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const config = require('../config');

// Configuration
const CONFIG = {
    ACCESS_TOKEN_EXPIRY: '15m', // Short-lived access token
    ACCESS_TOKEN_EXPIRY_MS: 15 * 60 * 1000,
    REFRESH_TOKEN_EXPIRY_DAYS: 7,
    MAX_SESSIONS_PER_USER: 10
};

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

// Hash token for storage
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

const RefreshTokenService = {
    /**
     * Generate new token pair (access + refresh)
     * @param {Object} user - User object
     * @param {Object} options - Options like device info
     * @returns {Promise<{accessToken: string, refreshToken: string, expiresIn: number}>}
     */
    async generateTokenPair(user, options = {}) {
        const { deviceInfo = 'Unknown Device', ip = null, userAgent = null } = options;

        // Clean up excess sessions (keep only MAX_SESSIONS)
        await this._enforceSessionLimit(user.id);

        // Generate tokens
        const jti = uuidv4();
        const tokenFamily = uuidv4();
        const refreshToken = crypto.randomBytes(64).toString('hex');
        const refreshTokenHash = hashToken(refreshToken);

        // Access token (short-lived)
        const accessToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                organizationId: user.organization_id,
                jti
            },
            config.JWT_SECRET,
            { expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY }
        );

        // Store refresh token
        const expiresAt = new Date(
            Date.now() + CONFIG.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();

        await dbRun(
            `INSERT INTO refresh_tokens 
             (id, user_id, token_hash, token_family, device_info, ip_address, user_agent, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), user.id, refreshTokenHash, tokenFamily, deviceInfo, ip, userAgent, expiresAt]
        );

        return {
            accessToken,
            refreshToken,
            expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY_MS,
            expiresAt: new Date(Date.now() + CONFIG.ACCESS_TOKEN_EXPIRY_MS).toISOString()
        };
    },

    /**
     * Refresh access token using refresh token
     * @param {string} refreshToken - The refresh token
     * @param {Object} options - Options like IP for tracking
     * @returns {Promise<{accessToken: string, refreshToken: string} | null>}
     */
    async refreshAccessToken(refreshToken, options = {}) {
        const { ip = null, userAgent = null } = options;
        const tokenHash = hashToken(refreshToken);

        // Find valid refresh token
        const storedToken = await dbGet(
            `SELECT rt.*, u.email, u.role, u.organization_id, u.status as user_status
             FROM refresh_tokens rt
             JOIN users u ON rt.user_id = u.id
             WHERE rt.token_hash = ? 
               AND rt.revoked_at IS NULL 
               AND rt.expires_at > datetime('now')`,
            [tokenHash]
        );

        if (!storedToken) {
            // Check if this is a reused token (potential theft)
            const revokedToken = await dbGet(
                `SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NOT NULL`,
                [tokenHash]
            );

            if (revokedToken) {
                // Token was already used - revoke entire family (security breach)
                console.warn(`[RefreshToken] SECURITY: Reused token detected for user ${revokedToken.user_id}`);
                await this._revokeTokenFamily(revokedToken.token_family, 'security');
            }

            return null;
        }

        // Check if user is still active
        if (storedToken.user_status !== 'active') {
            await this._revokeAllUserTokens(storedToken.user_id, 'user_inactive');
            return null;
        }

        // Revoke current token (rotation)
        await dbRun(
            `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = 'rotation' WHERE id = ?`,
            [storedToken.id]
        );

        // Generate new token pair (same family)
        const newRefreshToken = crypto.randomBytes(64).toString('hex');
        const newRefreshTokenHash = hashToken(newRefreshToken);
        const jti = uuidv4();

        const expiresAt = new Date(
            Date.now() + CONFIG.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();

        // New access token
        const accessToken = jwt.sign(
            {
                id: storedToken.user_id,
                email: storedToken.email,
                role: storedToken.role,
                organizationId: storedToken.organization_id,
                jti
            },
            config.JWT_SECRET,
            { expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY }
        );

        // Store new refresh token (same family)
        await dbRun(
            `INSERT INTO refresh_tokens 
             (id, user_id, token_hash, token_family, device_info, ip_address, user_agent, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuidv4(),
                storedToken.user_id,
                newRefreshTokenHash,
                storedToken.token_family,
                storedToken.device_info,
                ip || storedToken.ip_address,
                userAgent || storedToken.user_agent,
                expiresAt
            ]
        );

        return {
            accessToken,
            refreshToken: newRefreshToken,
            expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY_MS
        };
    },

    /**
     * Revoke a specific refresh token
     * @param {string} refreshToken 
     * @param {string} reason 
     */
    async revokeToken(refreshToken, reason = 'logout') {
        const tokenHash = hashToken(refreshToken);

        await dbRun(
            `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = ? WHERE token_hash = ?`,
            [reason, tokenHash]
        );
    },

    /**
     * Revoke all tokens for a user (logout from all devices)
     * @param {string} userId 
     * @param {string} reason
     */
    async revokeAllUserTokens(userId, reason = 'logout_all') {
        await this._revokeAllUserTokens(userId, reason);
    },

    /**
     * Revoke a specific session by ID
     * @param {string} userId 
     * @param {string} sessionId 
     */
    async revokeSession(userId, sessionId) {
        await dbRun(
            `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = 'session_revoked' 
             WHERE id = ? AND user_id = ?`,
            [sessionId, userId]
        );
    },

    /**
     * Get active sessions for a user
     * @param {string} userId 
     */
    async getActiveSessions(userId) {
        const sessions = await dbAll(
            `SELECT id, device_info, ip_address, created_at, last_used_at
             FROM refresh_tokens
             WHERE user_id = ? AND revoked_at IS NULL AND expires_at > datetime('now')
             ORDER BY last_used_at DESC`,
            [userId]
        );

        return sessions.map(s => ({
            id: s.id,
            deviceInfo: s.device_info,
            ipAddress: s.ip_address,
            createdAt: s.created_at,
            lastUsedAt: s.last_used_at
        }));
    },

    /**
     * Cleanup expired tokens (run via cron)
     */
    async cleanupExpiredTokens() {
        const result = await dbRun(
            `DELETE FROM refresh_tokens WHERE expires_at < datetime('now') OR revoked_at < datetime('now', '-7 days')`
        );

        console.log(`[RefreshToken] Cleanup: Removed ${result.changes} expired tokens`);
        return result.changes;
    },

    // ==========================================
    // PRIVATE HELPERS
    // ==========================================

    async _revokeAllUserTokens(userId, reason) {
        await dbRun(
            `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = ? 
             WHERE user_id = ? AND revoked_at IS NULL`,
            [reason, userId]
        );
    },

    async _revokeTokenFamily(tokenFamily, reason) {
        await dbRun(
            `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = ? 
             WHERE token_family = ? AND revoked_at IS NULL`,
            [reason, tokenFamily]
        );
    },

    async _enforceSessionLimit(userId) {
        // Count active sessions
        const countResult = await dbGet(
            `SELECT COUNT(*) as count FROM refresh_tokens 
             WHERE user_id = ? AND revoked_at IS NULL AND expires_at > datetime('now')`,
            [userId]
        );

        if (countResult && countResult.count >= CONFIG.MAX_SESSIONS_PER_USER) {
            // Revoke oldest sessions
            const excess = countResult.count - CONFIG.MAX_SESSIONS_PER_USER + 1;

            await dbRun(
                `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = 'session_limit'
                 WHERE id IN (
                     SELECT id FROM refresh_tokens 
                     WHERE user_id = ? AND revoked_at IS NULL 
                     ORDER BY last_used_at ASC 
                     LIMIT ?
                 )`,
                [userId, excess]
            );
        }
    }
};

module.exports = RefreshTokenService;
