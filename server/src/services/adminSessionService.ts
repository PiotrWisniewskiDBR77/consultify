/**
 * Admin Session Service
 * Manages administrative sessions, MFA verification, and revocation.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import _logger from '../utils/Logger.js';

class AdminSessionServiceClass {
  private db: IDatabase;
  private uuidv4: typeof uuidv4;
  private logger: any;

  constructor(deps?: { db?: IDatabase; uuidv4?: typeof uuidv4; logger?: any }) {
    this.db = deps?.db || getDatabase();
    this.uuidv4 = deps?.uuidv4 || uuidv4;
    this.logger = deps?.logger || _logger;
  }

  setDependencies(deps: { db?: IDatabase; uuidv4?: typeof uuidv4; logger?: any }) {
    if (deps.db) this.db = deps.db;
    if (deps.uuidv4) this.uuidv4 = deps.uuidv4;
    if (deps.logger) this.logger = deps.logger;
  }

  private computeExpiresAt(expiresInHours?: number): string {
    const hours = Number.isFinite(Number(expiresInHours)) ? Number(expiresInHours) : 24;
    const dt = new Date(Date.now() + hours * 60 * 60 * 1000);
    return dt.toISOString();
  }

  async getActiveSessions(adminId?: string): Promise<any[]> {
    // Defensive strategy: the repo contains multiple historical `admin_sessions` schemas.
    // - Extended: user_id, is_active, mfa_verified, ip_address, user_agent, expires_at
    // - Minimal (initdb stub): admin_user_id, session_token, expires_at, created_at
    const mapRow = (r: any) => ({
      id: String(r.id),
      adminId: String(r.admin_id),
      ipAddress: r.ip_address || r.ipAddress || '',
      userAgent: r.user_agent || r.userAgent || 'Unknown',
      mfaVerified: !!(r.mfa_verified ?? r.mfaVerified),
      createdAt: r.created_at || r.createdAt || new Date().toISOString(),
      expiresAt:
        r.expires_at || r.expiresAt || r.created_at || r.createdAt || new Date().toISOString(),
      isActive: !!(r.is_active ?? r.isActive),
      admin: {
        email: r.admin_email || r.email || '',
        firstName: r.admin_first_name || r.first_name || '',
        lastName: r.admin_last_name || r.last_name || '',
      },
    });

    try {
      let query = `
        SELECT
          s.id,
          s.user_id as admin_id,
          s.ip_address,
          s.user_agent,
          s.mfa_verified,
          s.created_at,
          s.expires_at,
          s.is_active,
          u.email as admin_email,
          u.first_name as admin_first_name,
          u.last_name as admin_last_name
        FROM admin_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.is_active = 1
      `;
      const params: any[] = [];
      if (adminId) {
        query += ' AND s.user_id = ?';
        params.push(adminId);
      }
      const rows = await this.db.all(query, params);
      return (rows || []).map(mapRow);
    } catch (_err) {
      let query = `
        SELECT
          s.id,
          s.admin_user_id as admin_id,
          NULL as ip_address,
          NULL as user_agent,
          0 as mfa_verified,
          s.created_at,
          s.expires_at,
          CASE WHEN s.expires_at > CURRENT_TIMESTAMP THEN 1 ELSE 0 END as is_active,
          u.email as admin_email,
          u.first_name as admin_first_name,
          u.last_name as admin_last_name
        FROM admin_sessions s
        JOIN users u ON s.admin_user_id = u.id
        WHERE s.expires_at > CURRENT_TIMESTAMP
      `;
      const params: any[] = [];
      if (adminId) {
        query += ' AND s.admin_user_id = ?';
        params.push(adminId);
      }
      const rows = await this.db.all(query, params);
      return (rows || []).map(mapRow);
    }
  }

  async createSession(data: any): Promise<any> {
    const id = this.uuidv4();
    const adminId = data?.userId || data?.adminId;
    const mfaVerified = !!data?.mfaVerified;
    const ipAddress = data?.ipAddress || null;
    const userAgent = data?.userAgent || null;
    const sessionToken = this.uuidv4();
    const expiresAt = data?.expiresAt || this.computeExpiresAt(data?.expiresInHours);

    try {
      await this.db.run(
        `INSERT INTO admin_sessions
          (id, user_id, session_token, expires_at, created_at, mfa_verified, is_active, ip_address, user_agent)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
        [id, adminId, sessionToken, expiresAt, mfaVerified ? 1 : 0, 1, ipAddress, userAgent]
      );
    } catch (_err) {
      // Fallback to minimal schema.
      await this.db.run(
        `INSERT INTO admin_sessions (id, admin_user_id, session_token, expires_at, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [id, adminId, sessionToken, expiresAt]
      );
    }

    return (
      (await this.db.get('SELECT * FROM admin_sessions WHERE id = ?', [id]).catch(() => null)) || {
        id,
        adminId,
        sessionToken,
        expiresAt,
      }
    );
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      const result = await this.db.run('UPDATE admin_sessions SET is_active = 0 WHERE id = ?', [
        sessionId,
      ]);
      return (result as any).changes > 0;
    } catch (_err) {
      // Minimal schema: revoke by expiring or deleting.
      try {
        const result = await this.db.run(
          'UPDATE admin_sessions SET expires_at = CURRENT_TIMESTAMP WHERE id = ?',
          [sessionId]
        );
        return (result as any).changes > 0;
      } catch {
        const result = await this.db.run('DELETE FROM admin_sessions WHERE id = ?', [sessionId]);
        return (result as any).changes > 0;
      }
    }
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
    try {
      let query = 'UPDATE admin_sessions SET is_active = 0 WHERE user_id = ? AND is_active = 1';
      const params: any[] = [userId];
      if (exceptSessionId) {
        query += ' AND id != ?';
        params.push(exceptSessionId);
      }
      const result = await this.db.run(query, params);
      return (result as any).changes;
    } catch (_err) {
      let query =
        'UPDATE admin_sessions SET expires_at = CURRENT_TIMESTAMP WHERE admin_user_id = ? AND expires_at > CURRENT_TIMESTAMP';
      const params: any[] = [userId];
      if (exceptSessionId) {
        query += ' AND id != ?';
        params.push(exceptSessionId);
      }
      const result = await this.db.run(query, params);
      return (result as any).changes;
    }
  }

  async getSessionStats(): Promise<any> {
    try {
      const row = await this.db.get<{
        total: number;
        active: number;
        mfaVerified: number;
        uniqueAdmins: number;
      }>(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN is_active = 1 AND mfa_verified = 1 THEN 1 ELSE 0 END) as mfaVerified,
          COUNT(DISTINCT user_id) as uniqueAdmins
        FROM admin_sessions
      `);
      return {
        total: row?.total || 0,
        active: row?.active || 0,
        mfaVerified: row?.mfaVerified || 0,
        uniqueAdmins: row?.uniqueAdmins || 0,
      };
    } catch (_err) {
      const row = await this.db.get<{ total: number; active: number; uniqueAdmins: number }>(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as active,
          COUNT(DISTINCT admin_user_id) as uniqueAdmins
        FROM admin_sessions
      `);
      return {
        total: row?.total || 0,
        active: row?.active || 0,
        mfaVerified: 0,
        uniqueAdmins: row?.uniqueAdmins || 0,
      };
    }
  }
}

const adminSessionService = new AdminSessionServiceClass();
export default adminSessionService;
