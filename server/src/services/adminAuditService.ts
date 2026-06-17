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
      'INSERT INTO admin_audit_logs (id, admin_id, action_type, metadata_json, risk_score, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, adminId, actionType, JSON.stringify(details), riskScore, 'unresolved']
    );

    return { id, adminId, actionType, riskScore, riskLevel };
  }

  private extractOrgIdFromMetadata(log: any): string {
    if (!log?.metadata_json) return '';
    try {
      const meta =
        typeof log.metadata_json === 'string'
          ? JSON.parse(log.metadata_json)
          : log.metadata_json;
      return String(
        meta?.orgId || meta?.organizationId || meta?.details?.orgId || ''
      ).trim();
    } catch {
      return '';
    }
  }

  async getLogs(filters: any = {}): Promise<any> {
    const { limit = 10, offset = 0, organizationId } = filters;
    // Fetch a wide window so org-scoped callers get enough rows after filtering.
    // When an orgId is requested we over-fetch then slice; without orgId we
    // honour limit/offset directly (superadmin / backward-compat path).
    const fetchLimit = organizationId ? Math.max(limit * 20, 1000) : limit;
    const fetchOffset = organizationId ? 0 : offset;

    const logs = await this.db.all(
      'SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [fetchLimit, fetchOffset]
    );

    if (!organizationId) {
      return logs;
    }

    // Org-scope: filter by orgId embedded in metadata_json, then apply pagination.
    const orgStr = String(organizationId).trim();
    if (!orgStr) {
      // Empty orgId — return nothing rather than leaking all-tenant data.
      return [];
    }

    const scoped = (logs || []).filter(
      (log: any) => this.extractOrgIdFromMetadata(log) === orgStr
    );
    return scoped.slice(offset, offset + limit);
  }

  async resolveLog(id: string, resolvedBy: string): Promise<boolean> {
    const result = await this.db.run(
      'UPDATE admin_audit_logs SET status = ?, resolved_by = ? WHERE id = ?',
      ['resolved', resolvedBy, id]
    );
    return (result as any).changes > 0;
  }

  async getStats(organizationId?: string): Promise<any> {
    if (organizationId) {
      // No organization_id column — derive stats from org-scoped getLogs.
      const logs = await this.getLogs({ limit: 2000, offset: 0, organizationId });
      return {
        total_logs: logs.length,
        unresolved_count: logs.filter((l: any) => l.status !== 'resolved').length,
      };
    }
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
