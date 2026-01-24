/**
 * Audit Service
 * FLOW-AUDIT-001: Comprehensive audit logging for compliance
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorType: 'user' | 'system' | 'ai' | 'integration' | 'superadmin' | 'cron';
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  actorIp?: string;
  action: string;
  actionCategory: 'auth' | 'data' | 'admin' | 'ai' | 'system' | 'billing';
  actionDescription?: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  organizationId?: string;
  projectId?: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  changedFields?: string[];
  metadata?: Record<string, unknown>;
  result: 'success' | 'failure' | 'partial';
  errorMessage?: string;
}

export interface AuditLogInput {
  actorType: AuditLogEntry['actorType'];
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  actorIp?: string;
  actorUserAgent?: string;
  action: string;
  actionCategory: AuditLogEntry['actionCategory'];
  actionDescription?: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  organizationId?: string;
  projectId?: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  result?: 'success' | 'failure' | 'partial';
  errorMessage?: string;
  requestId?: string;
}

export interface AuditLogFilters {
  organizationId?: string;
  actorId?: string;
  actorType?: string;
  action?: string;
  actionCategory?: string;
  resourceType?: string;
  resourceId?: string;
  result?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

// ==========================================
// SERVICE
// ==========================================

class AuditService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Log an audit entry
   */
  async log(input: AuditLogInput): Promise<string> {
    const db = await this.getDb();
    const id = `audit-${uuidv4()}`;
    const now = new Date().toISOString();

    // Determine changed fields
    let changedFields: string[] = [];
    if (input.previousValues && input.newValues) {
      changedFields = this.getChangedFields(input.previousValues, input.newValues);
    }

    // Determine retention category
    const retentionCategory = this.getRetentionCategory(input.actionCategory);

    await db.run(
      `INSERT INTO audit_log (
                id, timestamp, actor_type, actor_id, actor_email, actor_name,
                actor_ip, actor_user_agent, action, action_category, action_description,
                resource_type, resource_id, resource_name, organization_id, project_id,
                previous_values, new_values, changed_fields, metadata, request_id,
                result, error_message, retention_category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        now,
        input.actorType,
        input.actorId || null,
        input.actorEmail || null,
        input.actorName || null,
        input.actorIp || null,
        input.actorUserAgent || null,
        input.action,
        input.actionCategory,
        input.actionDescription || null,
        input.resourceType,
        input.resourceId || null,
        input.resourceName || null,
        input.organizationId || null,
        input.projectId || null,
        input.previousValues ? JSON.stringify(input.previousValues) : null,
        input.newValues ? JSON.stringify(input.newValues) : null,
        changedFields.length > 0 ? JSON.stringify(changedFields) : null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.requestId || null,
        input.result || 'success',
        input.errorMessage || null,
        retentionCategory,
      ]
    );

    return id;
  }

  /**
   * Get audit logs with filters
   */
  async getLogs(filters: AuditLogFilters): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const db = await this.getDb();

    let whereClause = '1=1';
    const params: (string | number)[] = [];

    if (filters.organizationId) {
      whereClause += ' AND organization_id = ?';
      params.push(filters.organizationId);
    }

    if (filters.actorId) {
      whereClause += ' AND actor_id = ?';
      params.push(filters.actorId);
    }

    if (filters.actorType) {
      whereClause += ' AND actor_type = ?';
      params.push(filters.actorType);
    }

    if (filters.action) {
      whereClause += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.actionCategory) {
      whereClause += ' AND action_category = ?';
      params.push(filters.actionCategory);
    }

    if (filters.resourceType) {
      whereClause += ' AND resource_type = ?';
      params.push(filters.resourceType);
    }

    if (filters.resourceId) {
      whereClause += ' AND resource_id = ?';
      params.push(filters.resourceId);
    }

    if (filters.result) {
      whereClause += ' AND result = ?';
      params.push(filters.result);
    }

    if (filters.fromDate) {
      whereClause += ' AND timestamp >= ?';
      params.push(filters.fromDate.toISOString());
    }

    if (filters.toDate) {
      whereClause += ' AND timestamp <= ?';
      params.push(filters.toDate.toISOString());
    }

    // Get total count
    const countResult = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM audit_log WHERE ${whereClause}`,
      params
    );
    const total = countResult?.count || 0;

    // Get entries
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const rows = await db.all<{
      id: string;
      timestamp: string;
      actor_type: string;
      actor_id: string;
      actor_email: string;
      actor_name: string;
      actor_ip: string;
      action: string;
      action_category: string;
      action_description: string;
      resource_type: string;
      resource_id: string;
      resource_name: string;
      organization_id: string;
      project_id: string;
      previous_values: string;
      new_values: string;
      changed_fields: string;
      metadata: string;
      result: string;
      error_message: string;
    }>(`SELECT * FROM audit_log WHERE ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]);

    const entries = (rows || []).map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      actorType: r.actor_type as AuditLogEntry['actorType'],
      actorId: r.actor_id,
      actorEmail: r.actor_email,
      actorName: r.actor_name,
      actorIp: r.actor_ip,
      action: r.action,
      actionCategory: r.action_category as AuditLogEntry['actionCategory'],
      actionDescription: r.action_description,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      resourceName: r.resource_name,
      organizationId: r.organization_id,
      projectId: r.project_id,
      previousValues: r.previous_values ? JSON.parse(r.previous_values) : undefined,
      newValues: r.new_values ? JSON.parse(r.new_values) : undefined,
      changedFields: r.changed_fields ? JSON.parse(r.changed_fields) : undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      result: r.result as AuditLogEntry['result'],
      errorMessage: r.error_message,
    }));

    return { entries, total };
  }

  /**
   * Get single audit entry
   */
  async getEntry(entryId: string): Promise<AuditLogEntry | null> {
    const { entries } = await this.getLogs({ limit: 1 });
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      timestamp: string;
      actor_type: string;
      actor_id: string;
      actor_email: string;
      actor_name: string;
      actor_ip: string;
      action: string;
      action_category: string;
      action_description: string;
      resource_type: string;
      resource_id: string;
      resource_name: string;
      organization_id: string;
      project_id: string;
      previous_values: string;
      new_values: string;
      changed_fields: string;
      metadata: string;
      result: string;
      error_message: string;
    }>(`SELECT * FROM audit_log WHERE id = ?`, [entryId]);

    if (!row) return null;

    return {
      id: row.id,
      timestamp: row.timestamp,
      actorType: row.actor_type as AuditLogEntry['actorType'],
      actorId: row.actor_id,
      actorEmail: row.actor_email,
      actorName: row.actor_name,
      actorIp: row.actor_ip,
      action: row.action,
      actionCategory: row.action_category as AuditLogEntry['actionCategory'],
      actionDescription: row.action_description,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      organizationId: row.organization_id,
      projectId: row.project_id,
      previousValues: row.previous_values ? JSON.parse(row.previous_values) : undefined,
      newValues: row.new_values ? JSON.parse(row.new_values) : undefined,
      changedFields: row.changed_fields ? JSON.parse(row.changed_fields) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      result: row.result as AuditLogEntry['result'],
      errorMessage: row.error_message,
    };
  }

  /**
   * Get statistics for dashboard
   */
  async getStats(
    orgId: string,
    days: number = 7
  ): Promise<{
    byCategory: Record<string, number>;
    byResult: Record<string, number>;
    byDay: { date: string; count: number }[];
    topActions: { action: string; count: number }[];
  }> {
    const db = await this.getDb();
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // By category
    const categoryRows = await db.all<{ action_category: string; count: number }>(
      `SELECT action_category, COUNT(*) as count FROM audit_log 
             WHERE organization_id = ? AND timestamp >= ? 
             GROUP BY action_category`,
      [orgId, fromDate]
    );

    const byCategory: Record<string, number> = {};
    for (const row of categoryRows || []) {
      byCategory[row.action_category] = row.count;
    }

    // By result
    const resultRows = await db.all<{ result: string; count: number }>(
      `SELECT result, COUNT(*) as count FROM audit_log 
             WHERE organization_id = ? AND timestamp >= ? 
             GROUP BY result`,
      [orgId, fromDate]
    );

    const byResult: Record<string, number> = {};
    for (const row of resultRows || []) {
      byResult[row.result] = row.count;
    }

    // By day
    const dayRows = await db.all<{ date: string; count: number }>(
      `SELECT DATE(timestamp) as date, COUNT(*) as count FROM audit_log 
             WHERE organization_id = ? AND timestamp >= ? 
             GROUP BY DATE(timestamp) ORDER BY date`,
      [orgId, fromDate]
    );

    const byDay = (dayRows || []).map((r) => ({ date: r.date, count: r.count }));

    // Top actions
    const actionRows = await db.all<{ action: string; count: number }>(
      `SELECT action, COUNT(*) as count FROM audit_log 
             WHERE organization_id = ? AND timestamp >= ? 
             GROUP BY action ORDER BY count DESC LIMIT 10`,
      [orgId, fromDate]
    );

    const topActions = (actionRows || []).map((r) => ({ action: r.action, count: r.count }));

    return { byCategory, byResult, byDay, topActions };
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private getChangedFields(prev: Record<string, unknown>, next: Record<string, unknown>): string[] {
    const changed: string[] = [];
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

    for (const key of allKeys) {
      if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
        changed.push(key);
      }
    }

    return changed;
  }

  private getRetentionCategory(actionCategory: string): string {
    switch (actionCategory) {
      case 'auth':
        return 'security';
      case 'admin':
      case 'billing':
        return 'compliance';
      case 'system':
        return 'debug';
      default:
        return 'standard';
    }
  }
}

// Export singleton
const auditService = new AuditService();
export default auditService;

// Named exports
export const log = (input: AuditLogInput) => auditService.log(input);
export const getLogs = (filters: AuditLogFilters) => auditService.getLogs(filters);
export const getEntry = (entryId: string) => auditService.getEntry(entryId);
export const getStats = (orgId: string, days?: number) => auditService.getStats(orgId, days);

// Convenience methods for common actions
export const logAuth = (
  action: string,
  input: Omit<AuditLogInput, 'action' | 'actionCategory' | 'resourceType'>
) =>
  auditService.log({
    ...input,
    action: `auth.${action}`,
    actionCategory: 'auth',
    resourceType: 'session',
  });

export const logDataChange = (
  action: 'create' | 'update' | 'delete',
  resourceType: string,
  input: Omit<AuditLogInput, 'action' | 'actionCategory' | 'resourceType'>
) => auditService.log({ ...input, action: `data.${action}`, actionCategory: 'data', resourceType });

export const logAdminAction = (
  action: string,
  resourceType: string,
  input: Omit<AuditLogInput, 'action' | 'actionCategory' | 'resourceType'>
) =>
  auditService.log({ ...input, action: `admin.${action}`, actionCategory: 'admin', resourceType });

export const logAIAction = (
  action: string,
  input: Omit<AuditLogInput, 'action' | 'actionCategory' | 'actorType'>
) => auditService.log({ ...input, action: `ai.${action}`, actionCategory: 'ai', actorType: 'ai' });
