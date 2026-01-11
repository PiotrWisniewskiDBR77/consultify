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

  async getActiveSessions(adminId?: string): Promise<any[]> {
    let query = `
            SELECT s.*, u.email as admin_email 
            FROM admin_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.is_active = 1
        `;
    const params: any[] = [];

    if (adminId) {
      query += ' AND s.user_id = ?';
      params.push(adminId);
    }

    return await this.db.all(query, params);
  }

  async createSession(data: any): Promise<any> {
    const id = this.uuidv4();
    const { userId, mfaVerified = 0, ipAddress, userAgent } = data;

    await this.db.run(
      'INSERT INTO admin_sessions (id, user_id, mfa_verified, is_active, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, mfaVerified ? 1 : 0, 1, ipAddress, userAgent]
    );

    return await this.db.get('SELECT * FROM admin_sessions WHERE id = ?', [id]);
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    const result = await this.db.run('UPDATE admin_sessions SET is_active = 0 WHERE id = ?', [
      sessionId,
    ]);
    return (result as any).changes > 0;
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
    let query = 'UPDATE admin_sessions SET is_active = 0 WHERE user_id = ? AND is_active = 1';
    const params: any[] = [userId];

    if (exceptSessionId) {
      query += ' AND id != ?';
      params.push(exceptSessionId);
    }

    const result = await this.db.run(query, params);
    return (result as any).changes;
  }

  async getSessionStats(): Promise<any> {
    return await this.db.get(
      'SELECT COUNT(*) as active_sessions FROM admin_sessions WHERE is_active = 1'
    );
  }
}

const adminSessionService = new AdminSessionServiceClass();
export default adminSessionService;
