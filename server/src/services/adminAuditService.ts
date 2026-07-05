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

    // Derive the organization from the explicit field or the details payload so
    // the indexed `organization_id` column is populated. Historically callers
    // only embedded orgId inside metadata_json, which forced org-scoped reads to
    // over-fetch and JS-filter — unreliable once global audit volume grows past
    // the fetch window. We now persist orgId to its real column AND keep it in
    // metadata for backward compatibility with legacy rows/readers.
    const organizationId = String(
      data.organizationId ||
        data.orgId ||
        details.orgId ||
        details.organizationId ||
        ''
    ).trim();
    // `resource_type` is NOT NULL in the strict (migration 236) schema, so a
    // missing value throws and silently drops the audit row. Default it.
    const resourceType = String(
      data.resourceType || details.resourceType || actionType || 'admin_action'
    );

    // Fail-safe: an audit-write failure must NEVER block the underlying admin
    // action. Callers await this, so we swallow persistence errors here and log
    // a warning rather than propagating. `persisted` tells callers/tests whether
    // the row landed.
    let persisted = false;
    try {
      await this.db.run(
        `INSERT INTO admin_audit_logs
           (id, organization_id, admin_id, action_type, resource_type, metadata_json, risk_score, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          organizationId || null,
          adminId,
          actionType,
          resourceType,
          JSON.stringify(details),
          riskScore,
          'logged',
        ]
      );
      persisted = true;
    } catch (err) {
      this.logger?.warn?.(
        `[adminAudit] failed to persist audit entry action=${actionType} org=${organizationId || 'n/a'}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    return { id, adminId, actionType, organizationId, riskScore, riskLevel, persisted };
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

    if (!organizationId) {
      // Superadmin / backward-compat path: honour limit/offset directly.
      return await this.db.all(
        'SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
    }

    const orgStr = String(organizationId).trim();
    if (!orgStr) {
      // Empty orgId — return nothing rather than leaking all-tenant data.
      return [];
    }

    // Org-scope: prefer the indexed `organization_id` column. Rows written before
    // this column was populated only carry orgId inside metadata_json, so we OR in
    // a metadata match to stay backward compatible. This is a SQL-level filter, so
    // it never truncates on global audit volume the way the old top-N over-fetch did.
    const rows = await this.db.all(
      `SELECT * FROM admin_audit_logs
        WHERE organization_id = ?
           OR (organization_id IS NULL AND metadata_json LIKE ?)
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
      [orgStr, `%"${orgStr}"%`, limit, offset]
    );

    // Legacy rows can carry a different orgId in metadata (the LIKE is a coarse
    // prefilter), so re-check metadata for NULL-column rows to avoid cross-tenant leaks.
    return (rows || []).filter((log: any) => {
      if (
        log.organization_id !== null &&
        log.organization_id !== undefined &&
        String(log.organization_id).trim() !== ''
      ) {
        return String(log.organization_id).trim() === orgStr;
      }
      return this.extractOrgIdFromMetadata(log) === orgStr;
    });
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
                SUM(CASE WHEN status <> 'resolved' THEN 1 ELSE 0 END) as unresolved_count
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
