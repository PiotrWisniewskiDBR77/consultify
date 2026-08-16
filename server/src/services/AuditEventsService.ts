/**
 * AuditEventsService — V4-ENT-03 Unified audit log
 * Writes to audit_events table (actorId, actorType, action, resourceType, resourceId, before, after, metadata, timestamp)
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

export type ActorType = 'USER' | 'SYSTEM' | 'AI' | 'INTEGRATION' | 'CONSULTANT';

export interface AuditEventInput {
  actorId?: string;
  actorType: ActorType;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  organizationId?: string;
  ip?: string;
  userAgent?: string;
}

export interface AuditEventFilters {
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  actorType?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
  organizationId?: string;
}

class AuditEventsService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Log an audit event
   */
  async log(input: AuditEventInput): Promise<string> {
    const db = await this.getDb();
    const id = `ae-${uuidv4()}`;
    try {
      await db.run(
        `INSERT INTO audit_events (
          id, ts, actor_id, actor_type, org_id, action, resource_type, resource_id,
          before_json, after_json, metadata_json, ip, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          new Date().toISOString(),
          input.actorId || null,
          input.actorType,
          input.organizationId || null,
          input.action,
          input.resourceType,
          input.resourceId || null,
          input.before ? JSON.stringify(input.before) : null,
          input.after ? JSON.stringify(input.after) : null,
          input.metadata ? JSON.stringify(input.metadata) : '{}',
          input.ip || null,
          input.userAgent || null,
        ]
      );
      return id;
    } catch (err: any) {
      const message = String(err?.message || '');
      logger.warn('[AuditEventsService] Unified insert failed, trying legacy schema:', message);
      try {
        await db.run(
          `INSERT INTO audit_events (
            id, ts, actor_id, actor_user_id, actor_type, org_id,
            action, action_type, resource_type, resource_id, entity_type, entity_id,
            before_json, after_json, metadata_json, ip, user_agent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            new Date().toISOString(),
            // The canonical actor_id may be protected by a FK on older
            // databases. The compatibility lane preserves an unknown or
            // external actor in actor_user_id instead of losing the event.
            null,
            input.actorId || null,
            input.actorType,
            input.organizationId || null,
            input.action,
            input.action,
            input.resourceType,
            input.resourceId || null,
            input.resourceType,
            input.resourceId || null,
            input.before ? JSON.stringify(input.before) : null,
            input.after ? JSON.stringify(input.after) : null,
            JSON.stringify({
              before: input.before || null,
              after: input.after || null,
              ...(input.metadata || {}),
            }),
            input.ip || null,
            input.userAgent || null,
          ]
        );
        return id;
      } catch (legacyErr: any) {
        logger.error('[AuditEventsService] Failed to log:', legacyErr?.message || message);
        throw new Error(`AUDIT_WRITE_FAILED: ${legacyErr?.message || message}`);
      }
    }
  }

  /**
   * Query audit events with filters
   */
  async query(filters: AuditEventFilters): Promise<{ data: any[]; total: number }> {
    const db = await this.getDb();
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (filters.organizationId) {
      conditions.push('org_id = ?');
      params.push(filters.organizationId);
    }
    if (filters.resourceType) {
      conditions.push('resource_type = ?');
      params.push(filters.resourceType);
    }
    if (filters.resourceId) {
      conditions.push('resource_id = ?');
      params.push(filters.resourceId);
    }
    if (filters.actorId) {
      conditions.push('actor_id = ?');
      params.push(filters.actorId);
    }
    if (filters.actorType) {
      conditions.push('actor_type = ?');
      params.push(filters.actorType);
    }
    if (filters.fromDate) {
      conditions.push('ts >= ?');
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      conditions.push('ts <= ?');
      params.push(filters.toDate);
    }

    const where = conditions.join(' AND ');
    const limit = Math.min(filters.limit ?? 100, 1000);
    const offset = filters.offset ?? 0;

    const countResult = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM audit_events WHERE ${where}`,
      params
    );
    const total = Number(countResult?.count ?? 0);

    const data = await db.all(
      // Unified schema (624) is live everywhere; legacy 019 columns
      // (actor_user_id/action_type/entity_type/entity_id) never coexist and
      // referencing them in COALESCE made Postgres 500 (parse-time column check).
      `SELECT id, ts as timestamp,
              actor_id as "actorId",
              actor_type as "actorType",
              action as action,
              resource_type as "resourceType",
              resource_id as "resourceId",
              before_json as "before", after_json as "after", metadata_json as metadata
       FROM audit_events WHERE ${where} ORDER BY ts DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const parsed = (data || []).map((row: any) => ({
      ...row,
      before: row.before ? JSON.parse(row.before) : undefined,
      after: row.after ? JSON.parse(row.after) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    }));

    return { data: parsed, total };
  }
}

export const auditEventsService = new AuditEventsService();
export default auditEventsService;
