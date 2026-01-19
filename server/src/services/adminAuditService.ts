/**
 * Admin Audit Service
 * Manages administrative action logging, risk assessment, and statistics.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import _logger from '../utils/Logger.js';

class AdminAuditServiceClass {
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

  calculateRiskScore(action: string, context: any = {}): number {
    let score = 0;

    const baseScores: Record<string, number> = {
      delete_organization: 90,
      create_user: 40,
      view_data: 10,
      update_billing: 60,
    };

    score = baseScores[action] || 20;

    if (context.isBulk) score += 20;
    if (context.isSensitive) score += 30;

    return Math.min(score, 100);
  }

  getRiskLevel(score: number): string {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  async logAction(data: any): Promise<any> {
    const id = this.uuidv4();
    const { adminId, actionType, details = {} } = data;
    const riskScore = this.calculateRiskScore(actionType, details);
    const riskLevel = this.getRiskLevel(riskScore);

    await this.db.run(
      'INSERT INTO admin_audit_logs (id, admin_id, action_type, metadata_json, risk_score, risk_level, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, adminId, actionType, JSON.stringify(details), riskScore, riskLevel, 'unresolved']
    );

    return { id, adminId, actionType, riskScore, riskLevel };
  }

  async getLogs(filters: any = {}): Promise<any> {
    const { limit = 10, offset = 0 } = filters;
    const logs = await this.db.all(
      'SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return logs;
  }

  async resolveLog(id: string, resolvedBy: string): Promise<boolean> {
    const result = await this.db.run(
      'UPDATE admin_audit_logs SET status = ?, resolved_by = ? WHERE id = ?',
      ['resolved', resolvedBy, id]
    );
    return (result as any).changes > 0;
  }

  async getStats(): Promise<any> {
    return await this.db.get(`
            SELECT 
                COUNT(*) as total_logs,
                SUM(CASE WHEN status = 'unresolved' THEN 1 ELSE 0 END) as unresolved_count
            FROM admin_audit_logs
        `);
  }

  async exportToCsv(filters: any = {}): Promise<string> {
    const logs = await this.getLogs(filters);
    if (logs.length === 0) return 'id,admin_id,action_type';
    const headers = Object.keys(logs[0]).join(',');
    const rows = logs.map((l: any) => Object.values(l).join(',')).join('\n');
    return `${headers}\n${rows}`;
  }

  async getRecentHighRisk(limit: number = 5): Promise<any[]> {
    return await this.db.all(
      'SELECT * FROM admin_audit_logs WHERE risk_score >= 60 ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  }

  async cleanupOldLogs(days: number = 90): Promise<number> {
    const result = await this.db.run(
      "DELETE FROM admin_audit_logs WHERE status = 'resolved' AND created_at < date('now', '-' || ? || ' days')",
      [days]
    );
    return (result as any).changes;
  }
}

const adminAuditService = new AdminAuditServiceClass();
export default adminAuditService;
