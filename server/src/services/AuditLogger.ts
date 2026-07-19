/**
 * Audit Logger Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Centralized audit logging with multi-tenant context
 * Logs all critical operations for compliance and security
 *
 * SCHEMA NOTE (fala 3, schema-drift fix): the real `audit_logs` table
 * (server/migrations/000_z_core_baseline.sql — the one that actually wins
 * on Postgres via CREATE TABLE IF NOT EXISTS) has columns
 * `id, timestamp, user_id, action_type, resource_type, resource_id,
 * organization_id, details, ip_address, user_agent, created_at`.
 * It has NO `action`, `success`, `error_message` or `metadata` columns, and
 * `id` has no default. This file used to target a schema that never existed
 * on Postgres (42703 on every call). `success`/`errorMessage`/`metadata` are
 * now folded into the `details` JSON column, matching the pattern already
 * used by presentationStudioOrchestrationService.ts / presentationStudioLayoutCapacityAdminService.ts
 * for the same table.
 */

import { getDatabase } from '../database/Database.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface AuditLogEntry {
  id?: string;
  userId?: string;
  organizationId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface AuditLogQuery {
  userId?: string;
  organizationId?: string;
  action?: string;
  resourceType?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

// ==========================================
// SCHEMA-MAPPING HELPERS
// ==========================================

interface StoredDetails {
  success?: boolean;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** `details` is stored as JSON text; be tolerant of null/empty/malformed values. */
function parseDetails(raw: unknown): StoredDetails {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as StoredDetails) : {};
  } catch {
    return {};
  }
}

/** `timestamp` comes back from Postgres as a Date (or ISO string); normalize to epoch ms. */
function toEpochMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

// ==========================================
// AUDIT LOGGER CLASS
// ==========================================

class AuditLogger {
  private db: ReturnType<typeof getDatabase> | null = null;
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.AUDIT_LOGGING_ENABLED !== 'false';
  }

  /**
   * Initialize database connection
   */
  private async getDb() {
    if (!this.db) {
      this.db = getDatabase();
    }
    return this.db;
  }

  /**
   * Log an audit event
   */
  async log(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const db = await this.getDb();

      // Real audit_logs schema has no success/error_message/metadata columns —
      // fold them into `details` (JSON text, same convention as
      // presentationStudioOrchestrationService.ts's audit writer).
      const details = JSON.stringify({
        success: entry.success,
        errorMessage: entry.errorMessage ?? null,
        metadata: entry.metadata ?? null,
      });

      // Insert into audit_logs table (id has no DB default -> generate it here).
      await db.run(
        `INSERT INTO audit_logs (
                    id, timestamp, user_id, organization_id, action_type, resource_type, resource_id,
                    details, ip_address, user_agent, created_at
                ) VALUES (gen_random_uuid()::TEXT, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          entry.userId || null,
          entry.organizationId || null,
          entry.action,
          entry.resourceType,
          entry.resourceId || null,
          details,
          entry.ipAddress || null,
          entry.userAgent || null,
        ]
      );

      // Also log to application logger
      logger.info('[AuditLog]', {
        action: entry.action,
        resourceType: entry.resourceType,
        userId: entry.userId,
        organizationId: entry.organizationId,
        success: entry.success,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[AuditLogger] Failed to log audit event:', err);
      // Don't throw - audit logging failure shouldn't break the application
    }
  }

  /**
   * Log AI operation
   */
  async logAIOperation(
    userId: string,
    organizationId: string,
    action: string,
    resourceId: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: `ai.${action}`,
      resourceType: 'ai_operation',
      resourceId,
      success,
      metadata: {
        ...metadata,
        component: 'ai',
      },
    });
  }

  /**
   * Log data access
   */
  async logDataAccess(
    userId: string,
    organizationId: string,
    resourceType: string,
    resourceId: string,
    action: 'read' | 'write' | 'delete',
    success: boolean,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: `data.${action}`,
      resourceType,
      resourceId,
      success,
      ipAddress,
      metadata: {
        accessType: action,
      },
    });
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(
    userId: string,
    organizationId: string,
    action: 'login' | 'logout' | 'token_refresh' | 'mfa_challenge',
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: `auth.${action}`,
      resourceType: 'authentication',
      success,
      ipAddress,
      userAgent,
      errorMessage,
    });
  }

  /**
   * Log permission change
   */
  async logPermissionChange(
    userId: string,
    organizationId: string,
    targetUserId: string,
    permission: string,
    action: 'grant' | 'revoke',
    success: boolean
  ): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: `permission.${action}`,
      resourceType: 'permission',
      resourceId: targetUserId,
      success,
      metadata: {
        permission,
        targetUserId,
      },
    });
  }

  /**
   * Query audit logs
   */
  async query(query: AuditLogQuery): Promise<AuditLogEntry[]> {
    try {
      const db = await this.getDb();
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (query.userId) {
        conditions.push('user_id = ?');
        params.push(query.userId);
      }

      if (query.organizationId) {
        conditions.push('organization_id = ?');
        params.push(query.organizationId);
      }

      if (query.action) {
        conditions.push('action_type = ?');
        params.push(query.action);
      }

      if (query.resourceType) {
        conditions.push('resource_type = ?');
        params.push(query.resourceType);
      }

      if (query.startDate) {
        conditions.push('timestamp >= ?');
        params.push(new Date(query.startDate));
      }

      if (query.endDate) {
        conditions.push('timestamp <= ?');
        params.push(new Date(query.endDate));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = query.limit || 100;
      const offset = query.offset || 0;

      const logs = await db.all(
        `SELECT * FROM audit_logs ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return logs.map((log: any) => {
        const parsedDetails = parseDetails(log.details);
        return {
          id: log.id,
          userId: log.user_id,
          organizationId: log.organization_id,
          action: log.action_type,
          resourceType: log.resource_type,
          resourceId: log.resource_id,
          ipAddress: log.ip_address,
          userAgent: log.user_agent,
          success: parsedDetails.success ?? true,
          errorMessage: parsedDetails.errorMessage ?? undefined,
          metadata: parsedDetails.metadata ?? undefined,
          timestamp: toEpochMs(log.timestamp),
        };
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[AuditLogger] Failed to query audit logs:', err);
      return [];
    }
  }

  /**
   * Get audit log statistics
   */
  async getStats(
    organizationId?: string,
    startDate?: number,
    endDate?: number
  ): Promise<{
    total: number;
    byAction: Record<string, number>;
    byResourceType: Record<string, number>;
    successRate: number;
  }> {
    try {
      const db = await this.getDb();
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (organizationId) {
        conditions.push('organization_id = ?');
        params.push(organizationId);
      }

      if (startDate) {
        conditions.push('timestamp >= ?');
        params.push(new Date(startDate));
      }

      if (endDate) {
        conditions.push('timestamp <= ?');
        params.push(new Date(endDate));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const logs = await db.all(`SELECT * FROM audit_logs ${whereClause}`, params);

      const stats = {
        total: logs.length,
        byAction: {} as Record<string, number>,
        byResourceType: {} as Record<string, number>,
        successRate: 0,
      };

      let successCount = 0;

      logs.forEach((log: any) => {
        // Count by action
        stats.byAction[log.action_type] = (stats.byAction[log.action_type] || 0) + 1;

        // Count by resource type
        stats.byResourceType[log.resource_type] =
          (stats.byResourceType[log.resource_type] || 0) + 1;

        // Count successes
        if (parseDetails(log.details).success ?? true) {
          successCount++;
        }
      });

      stats.successRate = logs.length > 0 ? (successCount / logs.length) * 100 : 0;

      return stats;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[AuditLogger] Failed to get audit stats:', err);
      return {
        total: 0,
        byAction: {},
        byResourceType: {},
        successRate: 0,
      };
    }
  }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!instance) {
    instance = new AuditLogger();
  }
  return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export default AuditLogger;
