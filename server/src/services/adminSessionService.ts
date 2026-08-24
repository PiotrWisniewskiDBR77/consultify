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

  private normalizeSessionType(sessionType?: string): 'standard' | 'jit' | 'break_glass' {
    const normalized = String(sessionType || 'standard')
      .trim()
      .toLowerCase();
    if (normalized === 'jit') return 'jit';
    if (normalized === 'break_glass' || normalized === 'break-glass') return 'break_glass';
    return 'standard';
  }

  private clampSessionHours(
    expiresInHours?: number,
    sessionType?: 'standard' | 'jit' | 'break_glass'
  ): number {
    const requested = Number.isFinite(Number(expiresInHours)) ? Number(expiresInHours) : 8;
    const normalizedType = this.normalizeSessionType(sessionType);
    const maxHours = normalizedType === 'break_glass' ? 1 : normalizedType === 'jit' ? 2 : 8;
    return Math.max(1, Math.min(requested, maxHours));
  }

  private computeExpiresAt(
    expiresInHours?: number,
    sessionType?: 'standard' | 'jit' | 'break_glass'
  ): string {
    const hours = this.clampSessionHours(expiresInHours, sessionType);
    const dt = new Date(Date.now() + hours * 60 * 60 * 1000);
    return dt.toISOString();
  }

  async getActiveSessions(adminId?: string, organizationId?: string): Promise<any[]> {
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
      sessionType: r.session_type || r.sessionType || 'standard',
      requestedCapability: r.requested_capability || r.requestedCapability || null,
      justification: r.justification || null,
      breakGlassReason: r.break_glass_reason || r.breakGlassReason || null,
      approvedBy: r.approved_by || r.approvedBy || null,
      createdBy: r.created_by || r.createdBy || null,
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
          s.session_type,
          s.requested_capability,
          s.justification,
          s.break_glass_reason,
          s.approved_by,
          s.created_by,
          u.email as admin_email,
          u.first_name as admin_first_name,
          u.last_name as admin_last_name
        FROM admin_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.is_active = 1
      `;
      const params: any[] = [];
      if (organizationId) {
        query += ' AND s.organization_id = ?';
        params.push(organizationId);
      }
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
          'standard' as session_type,
          NULL as requested_capability,
          NULL as justification,
          NULL as break_glass_reason,
          NULL as approved_by,
          NULL as created_by,
          u.email as admin_email,
          u.first_name as admin_first_name,
          u.last_name as admin_last_name
        FROM admin_sessions s
        JOIN users u ON s.admin_user_id = u.id
        WHERE s.expires_at > CURRENT_TIMESTAMP
      `;
      const params: any[] = [];
      if (organizationId) {
        query += ' AND s.organization_id = ?';
        params.push(organizationId);
      }
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
    const sessionType = this.normalizeSessionType(data?.sessionType);
    const ipAddress = data?.ipAddress || null;
    const userAgent = data?.userAgent || null;
    const sessionToken = this.uuidv4();
    const requestedCapability = data?.requestedCapability || null;
    const justification = data?.justification || null;
    const breakGlassReason = data?.breakGlassReason || null;
    const approvedBy = data?.approvedBy || null;
    const createdBy = data?.createdBy || adminId;
    const organizationId = data?.organizationId || null;
    const expiresAt = data?.expiresAt || this.computeExpiresAt(data?.expiresInHours, sessionType);

    try {
      // FIX (NOT-NULL sweep): admin_sessions.admin_user_id is NOT NULL with no DB
      // default (Postgres) — only the separate nullable `user_id` column was
      // written, which 500s with 23502.
      await this.db.run(
        `INSERT INTO admin_sessions
          (id, admin_user_id, user_id, session_token, expires_at, created_at, mfa_verified, is_active, ip_address, user_agent,
           session_type, requested_capability, justification, break_glass_reason, approved_by, created_by, organization_id)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          adminId,
          adminId,
          sessionToken,
          expiresAt,
          mfaVerified ? 1 : 0,
          1,
          ipAddress,
          userAgent,
          sessionType,
          requestedCapability,
          justification,
          breakGlassReason,
          approvedBy,
          createdBy,
          organizationId,
        ]
      );
    } catch (_err) {
      // Fallback to minimal schema.
      await this.db.run(
        `INSERT INTO admin_sessions (id, admin_user_id, session_token, expires_at, created_at, organization_id)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
        [id, adminId, sessionToken, expiresAt, organizationId]
      );
    }

    return (
      (await this.db.get('SELECT * FROM admin_sessions WHERE id = ?', [id]).catch(() => null)) || {
        id,
        adminId,
        sessionToken,
        expiresAt,
        sessionType,
        requestedCapability,
        justification,
        breakGlassReason,
        approvedBy,
        createdBy,
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
          SUM(CASE WHEN is_active = 1 AND mfa_verified = 1 THEN 1 ELSE 0 END) as "mfaVerified",
          SUM(CASE WHEN is_active = 1 AND session_type = 'jit' THEN 1 ELSE 0 END) as "jitActive",
          SUM(CASE WHEN is_active = 1 AND session_type = 'break_glass' THEN 1 ELSE 0 END) as "breakGlassActive",
          COUNT(DISTINCT user_id) as "uniqueAdmins"
        FROM admin_sessions
      `);
      return {
        total: row?.total || 0,
        active: row?.active || 0,
        mfaVerified: row?.mfaVerified || 0,
        jitActive: (row as any)?.jitActive || 0,
        breakGlassActive: (row as any)?.breakGlassActive || 0,
        uniqueAdmins: row?.uniqueAdmins || 0,
      };
    } catch (_err) {
      const row = await this.db.get<{ total: number; active: number; uniqueAdmins: number }>(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as active,
          COUNT(DISTINCT admin_user_id) as "uniqueAdmins"
        FROM admin_sessions
      `);
      return {
        total: row?.total || 0,
        active: row?.active || 0,
        mfaVerified: 0,
        jitActive: 0,
        breakGlassActive: 0,
        uniqueAdmins: row?.uniqueAdmins || 0,
      };
    }
  }
}

const adminSessionService = new AdminSessionServiceClass();
export default adminSessionService;
