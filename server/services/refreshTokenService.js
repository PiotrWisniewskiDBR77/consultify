import BaseService from './BaseService.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../config.js';

/**
 * Refresh Token Service
 * 
 * Handles secure refresh token management for JWT authentication.
 */
class RefreshTokenService extends BaseService {
    constructor() {
        super();
        this.CONFIG = {
            ACCESS_TOKEN_EXPIRY: '365d', // Long-lived for development
            ACCESS_TOKEN_EXPIRY_MS: 365 * 24 * 60 * 60 * 1000, // 1 year
            REFRESH_TOKEN_EXPIRY_DAYS: 365,
            MAX_SESSIONS_PER_USER: 10
        };
    }

    /**
     * Initialize dependencies
     */
    async init() {
        await super.init();
        return this;
    }

    /**
     * Hash token for storage
     */
    _hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    /**
     * Generate new token pair (access + refresh)
     */
    async generateTokenPair(user, options = {}) {
        await this.init();
        const { deviceInfo = 'Unknown Device', ip = null, userAgent = null } = options;

        // Clean up excess sessions (keep only MAX_SESSIONS)
        await this._enforceSessionLimit(user.id);

        // Generate tokens
        const jti = uuidv4();
        const tokenFamily = uuidv4();
        const refreshToken = crypto.randomBytes(64).toString('hex');
        const refreshTokenHash = this._hashToken(refreshToken);

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
            { expiresIn: this.CONFIG.ACCESS_TOKEN_EXPIRY }
        );

        // Store refresh token
        const expiresAt = new Date(
            Date.now() + this.CONFIG.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();

        await this.queryRun(
            `INSERT INTO refresh_tokens 
             (id, user_id, token_hash, token_family, device_info, ip_address, user_agent, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), user.id, refreshTokenHash, tokenFamily, deviceInfo, ip, userAgent, expiresAt]
        );

        return {
            accessToken,
            refreshToken,
            expiresIn: this.CONFIG.ACCESS_TOKEN_EXPIRY_MS,
            expiresAt: new Date(Date.now() + this.CONFIG.ACCESS_TOKEN_EXPIRY_MS).toISOString()
        };
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshToken, options = {}) {
        await this.init();
        const { ip = null, userAgent = null } = options;
        const tokenHash = this._hashToken(refreshToken);

        // Find valid refresh token
        const storedToken = await this.queryOne(
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
            const revokedToken = await this.queryOne(
                `SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NOT NULL`,
                [tokenHash]
            );

            if (revokedToken) {
                // Check if token was revoked very recently (within grace period)
                const GRACE_PERIOD_SECONDS = 10;
                const revokedAt = new Date(revokedToken.revoked_at).getTime();
                const now = Date.now();
                const secondsSinceRevoke = (now - revokedAt) / 1000;

                if (revokedToken.revoked_reason === 'rotation' && secondsSinceRevoke < GRACE_PERIOD_SECONDS) {
                    console.log(`[RefreshToken] Grace period: Token was rotated ${secondsSinceRevoke.toFixed(1)}s ago`);

                    const latestToken = await this.queryOne(
                        `SELECT rt.*, u.email, u.role, u.organization_id, u.status as user_status
                         FROM refresh_tokens rt
                         JOIN users u ON rt.user_id = u.id
                         WHERE rt.token_family = ? 
                           AND rt.revoked_at IS NULL 
                           AND rt.expires_at > datetime('now')
                         ORDER BY rt.created_at DESC
                         LIMIT 1`,
                        [revokedToken.token_family]
                    );

                    if (latestToken) {
                        const jti = uuidv4();
                        const accessToken = jwt.sign(
                            {
                                id: latestToken.user_id,
                                email: latestToken.email,
                                role: latestToken.role,
                                organizationId: latestToken.organization_id,
                                jti
                            },
                            config.JWT_SECRET,
                            { expiresIn: this.CONFIG.ACCESS_TOKEN_EXPIRY }
                        );

                        return {
                            accessToken,
                            refreshToken: null,
                            expiresIn: this.CONFIG.ACCESS_TOKEN_EXPIRY_MS,
                            gracePeriod: true
                        };
                    }
                }

                // Token was already used outside grace period - revoke entire family
                console.warn(`[RefreshToken] SECURITY: Reused token detected for user ${revokedToken.user_id}`);
                await this._revokeTokenFamily(revokedToken.token_family, 'security');
            }

            return null;
        }

        // Check if user is still active
        if (storedToken.user_status !== 'active') {
            await this.revokeAllUserTokens(storedToken.user_id, 'user_inactive');
            return null;
        }

        // Revoke current token (rotation)
        await this.queryRun(
            `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = 'rotation' WHERE id = ?`,
            [storedToken.id]
        );

        // Generate new token pair (same family)
        const newRefreshToken = crypto.randomBytes(64).toString('hex');
        const newRefreshTokenHash = this._hashToken(newRefreshToken);
        const jti = uuidv4();

        const expiresAt = new Date(
            Date.now() + this.CONFIG.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
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
            { expiresIn: this.CONFIG.ACCESS_TOKEN_EXPIRY }
        );

        // Store new refresh token (same family)
        await this.queryRun(
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
            expiresIn: this.CONFIG.ACCESS_TOKEN_EXPIRY_MS
        };
    }

    /**
     * Revoke a specific refresh token
     */
    async revokeToken(refreshToken, reason = 'logout') {
        await this.init();
        const tokenHash = this._hashToken(refreshToken);

        await this.queryRun(
            `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = ? WHERE token_hash = ?`,
            [reason, tokenHash]
        );
    }

    /**
     * Revoke all tokens for a user
     */
    async revokeAllUserTokens(userId, reason = 'logout_all') {
        await this.init();
        await this.queryRun(
            `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = ? 
             WHERE user_id = ? AND revoked_at IS NULL`,
            [reason, userId]
        );
    }

    /**
     * Revoke a specific session by ID
     */
    async revokeSession(userId, sessionId) {
        await this.init();
        await this.queryRun(
            `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = 'session_revoked' 
             WHERE id = ? AND user_id = ?`,
            [sessionId, userId]
        );
    }

    /**
     * Get active sessions for a user
     */
    async getActiveSessions(userId) {
        await this.init();
        const sessions = await this.queryAll(
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
    }

    /**
     * Cleanup expired tokens
     */
    async cleanupExpiredTokens() {
        await this.init();
        const result = await this.queryRun(
            `DELETE FROM refresh_tokens WHERE expires_at < datetime('now') OR revoked_at < datetime('now', '-7 days')`
        );

        console.log(`[RefreshToken] Cleanup: Removed ${result.changes} expired tokens`);
        return result.changes;
    }

    // ==========================================
    // PRIVATE HELPERS
    // ==========================================

    async _revokeTokenFamily(tokenFamily, reason) {
        await this.queryRun(
            `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = ? 
             WHERE token_family = ? AND revoked_at IS NULL`,
            [reason, tokenFamily]
        );
    }

    async _enforceSessionLimit(userId) {
        const countResult = await this.queryOne(
            `SELECT COUNT(*) as count FROM refresh_tokens 
             WHERE user_id = ? AND revoked_at IS NULL AND expires_at > datetime('now')`,
            [userId]
        );

        if (countResult && countResult.count >= this.CONFIG.MAX_SESSIONS_PER_USER) {
            const excess = countResult.count - this.CONFIG.MAX_SESSIONS_PER_USER + 1;

            await this.queryRun(
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
}

const service = new RefreshTokenService();
export default service;

