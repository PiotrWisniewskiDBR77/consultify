// @ts-nocheck
/**
 * Refresh Token Service
 * Enterprise SaaS Architecture - TypeScript Backend
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

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { authRuntimeConfig } from '../config/authRuntime.js';
import { config } from '../config/Config.js';
import { getDatabase } from '../database/Database.js';
import type { IDatabase, RunResult } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';
// Safe to import statically: demoPrincipalGuard imports THIS module dynamically,
// inside a function, precisely so the two do not form a load-time cycle.
import { assertDemoPrincipalMayReceiveCredentials } from './demo/demoPrincipalGuard.js';

const getForcedSuperAdminEmails = (): Set<string> => {
  const raw = String(process.env.FORCE_SUPERADMIN_EMAILS || '');
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
};

// ==========================================
// TYPES
// ==========================================

export interface TokenPairOptions {
  deviceInfo?: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt?: string;
  gracePeriod?: boolean;
}

export interface RefreshTokenOptions {
  ip?: string | null;
  userAgent?: string | null;
}

export interface ActiveSession {
  id: string;
  deviceInfo: string;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface StoredRefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  token_family: string;
  device_info: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  last_used_at: string | null;
  email?: string;
  role?: string;
  organization_id?: string;
  user_status?: string;
}

interface User {
  id: string;
  email: string;
  role: string;
  organization_id: string;
  /** When true, embed in JWT (DEMO org). */
  isDemo?: boolean;
}

async function isDemoOrganizationId(db: IDatabase, organizationId: string): Promise<boolean> {
  if (!organizationId) return false;
  try {
    const row = await db.get<{ organization_type?: string }>(
      'SELECT organization_type FROM organizations WHERE id = ? LIMIT 1',
      [organizationId]
    );
    const t = String(row?.organization_type || '')
      .trim()
      .toUpperCase();
    return t === 'DEMO';
  } catch {
    return false;
  }
}

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  ACCESS_TOKEN_EXPIRY: authRuntimeConfig.accessTokenExpiry,
  ACCESS_TOKEN_EXPIRY_MS: authRuntimeConfig.accessTokenExpiryMs,
  REFRESH_TOKEN_EXPIRY_DAYS: authRuntimeConfig.refreshTokenExpiryDays,
  MAX_SESSIONS_PER_USER: 10,
  GRACE_PERIOD_SECONDS: 10,
};

// ==========================================
// REFRESH TOKEN SERVICE
// ==========================================

class RefreshTokenService {
  private db: IDatabase;

  constructor(dbInstance?: IDatabase) {
    this.db = dbInstance || getDatabase();
  }

  private async enforceForcedSuperAdmin(email: string | undefined, userId: string, role?: string) {
    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();
    if (!normalizedEmail) return { role };
    if (!getForcedSuperAdminEmails().has(normalizedEmail)) return { role };
    if (role === 'SUPERADMIN') return { role };

    // Best-effort: persist to DB so all future tokens are consistent.
    try {
      await this.dbRun(`UPDATE users SET role = ? WHERE id = ?`, ['SUPERADMIN', userId]);
    } catch (e: any) {
      logger.warn('[RefreshToken] Failed to persist forced SUPERADMIN role (continuing)', {
        email: normalizedEmail,
        userId,
        error: e?.message || e,
      });
    }
    return { role: 'SUPERADMIN' };
  }

  /**
   * Set dependencies (for testing)
   */
  setDependencies(deps: { db: IDatabase }): void {
    if (deps.db) {
      this.db = deps.db;
    }
  }

  /**
   * Hash token for storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Database helper: Get single row
   */
  private async dbGet<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err: Error | null, row: unknown) => {
        if (err) reject(err);
        else resolve((row as T) || null);
      });
    });
  }

  /**
   * Database helper: Run query
   */
  private async dbRun(sql: string, params: unknown[] = []): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (this: any, err: Error | null) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Database helper: Get all rows
   */
  private async dbAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: Error | null, rows: unknown) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      });
    });
  }

  /**
   * Generate new token pair (access + refresh)
   */
  async generateTokenPair(user: User, options: TokenPairOptions = {}): Promise<TokenPair> {
    const { deviceInfo = 'Unknown Device', ip = null, userAgent = null } = options;

    // Ensure forced SUPERADMIN accounts never get a downgraded role in tokens.
    const forced = await this.enforceForcedSuperAdmin(user.email, user.id, user.role);
    if (forced.role) user.role = forced.role;

    // Clean up excess sessions (keep only MAX_SESSIONS)
    await this._enforceSessionLimit(user.id);

    const isDemoFlag =
      user.isDemo === true || (await isDemoOrganizationId(this.db, user.organization_id));

    // Generate tokens
    const jti = uuidv4();
    const tokenFamily = uuidv4();
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = this.hashToken(refreshToken);

    // Access token (short-lived)
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        isSuperAdmin: user.role === 'SUPERADMIN',
        isDemo: isDemoFlag,
        jti,
      },
      config.JWT_SECRET,
      { expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY }
    );

    // Store refresh token
    const expiresAt = new Date(
      Date.now() + CONFIG.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    await this.dbRun(
      `INSERT INTO refresh_tokens 
             (id, user_id, token_hash, token_family, device_info, ip_address, user_agent, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), user.id, refreshTokenHash, tokenFamily, deviceInfo, ip, userAgent, expiresAt]
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY_MS,
      expiresAt: new Date(Date.now() + CONFIG.ACCESS_TOKEN_EXPIRY_MS).toISOString(),
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    options: RefreshTokenOptions = {}
  ): Promise<TokenPair | null> {
    const { ip = null, userAgent = null } = options;
    const tokenHash = this.hashToken(refreshToken);

    // Find valid refresh token; prefer org-scoped role from organization_members
    const storedToken = await this.dbGet<StoredRefreshToken>(
      `SELECT rt.*, u.email,
              COALESCE(om.role, u.role) AS role,
              u.organization_id, u.status as user_status
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       LEFT JOIN organization_members om
              ON om.user_id = u.id
             AND om.organization_id = u.organization_id
             AND om.status = 'ACTIVE'
       WHERE rt.token_hash = ?
         AND rt.revoked_at IS NULL
         AND rt.expires_at > datetime('now')`,
      [tokenHash]
    );

    if (!storedToken) {
      // Check if this is a reused token (potential theft)
      const revokedToken = await this.dbGet<StoredRefreshToken>(
        `SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NOT NULL`,
        [tokenHash]
      );

      if (revokedToken) {
        // Check if token was revoked very recently (within grace period)
        // This handles multi-tab race conditions where multiple tabs try to refresh
        const revokedAt = new Date(revokedToken.revoked_at!).getTime();
        const now = Date.now();
        const secondsSinceRevoke = (now - revokedAt) / 1000;

        if (
          revokedToken.revoked_reason === 'rotation' &&
          secondsSinceRevoke < CONFIG.GRACE_PERIOD_SECONDS
        ) {
          // Token was just rotated - this is likely a multi-tab race condition
          // Return the latest valid token from the same family instead of treating as theft
          logger.info(
            `[RefreshToken] Grace period: Token was rotated ${secondsSinceRevoke.toFixed(1)}s ago, looking for new token in family`
          );

          const latestToken = await this.dbGet<StoredRefreshToken>(
            `SELECT rt.*, u.email,
                    COALESCE(om.role, u.role) AS role,
                    u.organization_id, u.status as user_status
             FROM refresh_tokens rt
             JOIN users u ON rt.user_id = u.id
             LEFT JOIN organization_members om
                    ON om.user_id = u.id
                   AND om.organization_id = u.organization_id
                   AND om.status = 'ACTIVE'
             WHERE rt.token_family = ?
               AND rt.revoked_at IS NULL
               AND rt.expires_at > datetime('now')
             ORDER BY rt.created_at DESC
             LIMIT 1`,
            [revokedToken.token_family]
          );

          if (latestToken) {
            // Enforce forced SUPERADMIN (best-effort DB fix + in-memory override)
            const forced = await this.enforceForcedSuperAdmin(
              latestToken.email,
              latestToken.user_id,
              latestToken.role
            );
            if (forced.role) latestToken.role = forced.role;

            // Found a valid token in the same family - return new tokens based on it
            // but DON'T rotate again (let the original refresh handle that)
            logger.info(
              `[RefreshToken] Grace period: Found valid token in family, returning current tokens`
            );

            // OPS-DEMO-002: the grace-period branch mints an access token before
            // any of the normal validity checks below, so it needs its own gate —
            // otherwise a lapsed demo principal refreshes straight through it.
            const graceDemoCheck = await assertDemoPrincipalMayReceiveCredentials(
              latestToken.user_id
            );
            if (!graceDemoCheck.allowed) {
              logger.info('[RefreshToken] Grace period refused: demo session ended');
              return null;
            }

            // Generate new access token only (don't rotate refresh token again)
            const jti = uuidv4();
            const isDemoGrace = await isDemoOrganizationId(this.db, latestToken.organization_id!);
            const accessToken = jwt.sign(
              {
                id: latestToken.user_id,
                email: latestToken.email!,
                role: latestToken.role!,
                organizationId: latestToken.organization_id!,
                isDemo: isDemoGrace,
                jti,
              },
              config.JWT_SECRET,
              { expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY }
            );

            // Return the existing refresh token from localStorage (client should still have it)
            // This prevents double-rotation issues
            return {
              accessToken,
              refreshToken: '', // Signal to client to keep existing refresh token
              expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY_MS,
              gracePeriod: true,
            };
          }
        }

        // Token was already used outside grace period - revoke entire family (security breach)
        logger.warn(
          `[RefreshToken] SECURITY: Reused token detected for user ${revokedToken.user_id} (${secondsSinceRevoke.toFixed(1)}s since revoke)`
        );
        await this._revokeTokenFamily(revokedToken.token_family, 'security');
      }

      return null;
    }

    // Enforce forced SUPERADMIN (best-effort DB fix + in-memory override)
    const forced = await this.enforceForcedSuperAdmin(
      storedToken.email,
      storedToken.user_id,
      storedToken.role
    );
    if (forced.role) storedToken.role = forced.role;

    // OPS-DEMO-002: refuse before ANY mint or rotation. Checked directly against
    // the demo session rather than via `user_status`, because retirement is lazy:
    // a refresh arriving after the TTU but before the first authenticated request
    // would otherwise still see `active` and rotate a fresh 7-day family.
    const demoCredentialCheck = await assertDemoPrincipalMayReceiveCredentials(
      storedToken.user_id
    );
    if (!demoCredentialCheck.allowed) {
      logger.info('[RefreshToken] Refresh refused: demo session ended');
      return null;
    }

    // Check if user is still active
    if (storedToken.user_status !== 'active') {
      await this._revokeAllUserTokens(storedToken.user_id, 'user_inactive');
      return null;
    }

    // Revoke current token (rotation)
    await this.dbRun(
      `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = 'rotation' WHERE id = ?`,
      [storedToken.id]
    );

    // Generate new token pair (same family)
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const newRefreshTokenHash = this.hashToken(newRefreshToken);
    const jti = uuidv4();

    const expiresAt = new Date(
      Date.now() + CONFIG.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const isDemoRefresh = await isDemoOrganizationId(this.db, storedToken.organization_id!);

    // New access token
    const accessToken = jwt.sign(
      {
        id: storedToken.user_id,
        email: storedToken.email!,
        role: storedToken.role!,
        organizationId: storedToken.organization_id!,
        isDemo: isDemoRefresh,
        jti,
      },
      config.JWT_SECRET,
      { expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY }
    );

    // Store new refresh token (same family)
    await this.dbRun(
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
        expiresAt,
      ]
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY_MS,
    };
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeToken(refreshToken: string, reason = 'logout'): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    await this.dbRun(
      `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = ? WHERE token_hash = ?`,
      [reason, tokenHash]
    );
  }

  /**
   * Revoke all tokens for a user (logout from all devices)
   */
  async revokeAllUserTokens(userId: string, reason = 'logout_all'): Promise<void> {
    await this._revokeAllUserTokens(userId, reason);
  }

  /**
   * Revoke a specific session by ID
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.dbRun(
      `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = 'session_revoked' 
             WHERE id = ? AND user_id = ?`,
      [sessionId, userId]
    );
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    const sessions = await this.dbAll<{
      id: string;
      device_info: string;
      ip_address: string | null;
      created_at: string;
      last_used_at: string | null;
    }>(
      `SELECT id, device_info, ip_address, created_at, last_used_at
             FROM refresh_tokens
             WHERE user_id = ? AND revoked_at IS NULL AND expires_at > datetime('now')
             ORDER BY last_used_at DESC`,
      [userId]
    );

    return sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.device_info,
      ipAddress: s.ip_address,
      createdAt: s.created_at,
      lastUsedAt: s.last_used_at,
    }));
  }

  /**
   * Cleanup expired tokens (run via cron)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.dbRun(
      `DELETE FROM refresh_tokens WHERE expires_at < datetime('now') OR revoked_at < datetime('now', '-7 days')`
    );

    logger.info(`[RefreshToken] Cleanup: Removed ${result.changes} expired tokens`);
    return result.changes;
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private async _revokeAllUserTokens(userId: string, reason: string): Promise<void> {
    await this.dbRun(
      `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = ? 
             WHERE user_id = ? AND revoked_at IS NULL`,
      [reason, userId]
    );
  }

  private async _revokeTokenFamily(tokenFamily: string, reason: string): Promise<void> {
    await this.dbRun(
      `UPDATE refresh_tokens SET revoked_at = datetime('now'), revoked_reason = ? 
             WHERE token_family = ? AND revoked_at IS NULL`,
      [reason, tokenFamily]
    );
  }

  private async _enforceSessionLimit(userId: string): Promise<void> {
    // Count active sessions
    const countResult = await this.dbGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM refresh_tokens 
             WHERE user_id = ? AND revoked_at IS NULL AND expires_at > datetime('now')`,
      [userId]
    );

    if (countResult && countResult.count >= CONFIG.MAX_SESSIONS_PER_USER) {
      // Revoke oldest sessions
      const excess = countResult.count - CONFIG.MAX_SESSIONS_PER_USER + 1;

      await this.dbRun(
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

// Export singleton instance
export const refreshTokenService = new RefreshTokenService();

// Export default instance (for backward compatibility)
export default refreshTokenService;

// Export class for testing
export { RefreshTokenService };
