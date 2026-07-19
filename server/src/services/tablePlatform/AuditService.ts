/**
 * Table Platform Audit Service
 * Audit event logging, revision history, activity feeds, and snapshot management.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FieldChange {
  fieldId: string;
  fieldName?: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface RecordRevision {
  id: string;
  recordId: string;
  userId?: string;
  userName?: string;
  action: string;
  changes: FieldChange[];
  timestamp: string;
}

export interface AuditEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorName?: string;
  details: Record<string, unknown>;
  timestamp: string;
  timeGroup?: string;
}

export interface Snapshot {
  id: string;
  baseId: string;
  name: string;
  createdBy?: string;
  createdAt: string;
  recordCount: number;
}

export interface SnapshotSummary {
  id: string;
  name: string;
  createdAt: string;
  recordCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFieldChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): FieldChange[] {
  if (!before && !after) return [];
  const changes: FieldChange[] = [];
  const allKeys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const key of allKeys) {
    const oldVal = before?.[key];
    const newVal = after?.[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ fieldId: key, oldValue: oldVal ?? null, newValue: newVal ?? null });
    }
  }
  return changes;
}

function assignTimeGroup(timestamp: string): string {
  const eventDate = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - eventDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return 'last_hour';
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (eventDate >= todayStart) return 'today';
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  if (eventDate >= yesterdayStart) return 'yesterday';
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
  if (eventDate >= weekStart) return 'this_week';
  return 'earlier';
}

function parseJsonSafe(val: unknown): Record<string, unknown> | null {
  if (val == null) return null;
  if (typeof val === 'object') return val as Record<string, unknown>;
  try {
    return JSON.parse(String(val));
  } catch {
    return null;
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

const auditService = {
  async logEvent(
    eventType: string,
    entityType: string,
    entityId: string,
    actorId?: string,
    before?: unknown,
    after?: unknown,
    metadata?: unknown
  ): Promise<void> {
    const db = getDatabase();
    try {
      await db.query(
        `INSERT INTO tp_audit_events (event_type, entity_type, entity_id, actor_id, before_data, after_data, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          eventType,
          entityType,
          entityId,
          actorId ?? null,
          before != null ? JSON.stringify(before) : null,
          after != null ? JSON.stringify(after) : null,
          metadata != null ? JSON.stringify(metadata) : '{}',
        ]
      );
    } catch (e) {
      logger.error('[AuditService] logEvent failed', {
        eventType,
        entityType,
        entityId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getEventsForEntity(entityType: string, entityId: string, limit = 100): Promise<unknown[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT * FROM tp_audit_events
         WHERE entity_type = $1 AND entity_id = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [entityType, entityId, limit]
      );
      return result.rows;
    } catch (e) {
      logger.error('[AuditService] getEventsForEntity failed', {
        entityType,
        entityId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getEventsForActor(actorId: string, limit = 100): Promise<unknown[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT * FROM tp_audit_events
         WHERE actor_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [actorId, limit]
      );
      return result.rows;
    } catch (e) {
      logger.error('[AuditService] getEventsForActor failed', {
        actorId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  // ── Task 2.2: Snapshot Management ──────────────────────────────────────────

  async createSnapshot(baseId: string, name?: string, userId?: string): Promise<Snapshot> {
    const db = getDatabase();
    const snapshotId = uuidv4();
    try {
      const tables = (await db.query('SELECT * FROM tp_tables WHERE base_id = $1', [baseId])).rows;
      const tableIds = tables.map((t: any) => t.id);

      const fields =
        tableIds.length > 0
          ? (await db.query(`SELECT * FROM tp_fields WHERE table_id = ANY($1)`, [tableIds])).rows
          : [];

      const views =
        tableIds.length > 0
          ? (await db.query(`SELECT * FROM tp_views WHERE table_id = ANY($1)`, [tableIds])).rows
          : [];

      const records =
        tableIds.length > 0
          ? (await db.query(`SELECT * FROM tp_records WHERE table_id = ANY($1)`, [tableIds])).rows
          : [];

      const snapshotData = { tables, fields, views, records };
      const snapshotName =
        name || `Snapshot ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

      await db.query(
        `INSERT INTO tp_audit_events (id, event_type, entity_type, entity_id, actor_id, after_data, metadata)
         VALUES ($1, 'snapshot', 'base', $2, $3, $4, $5)`,
        [
          snapshotId,
          baseId,
          userId ?? null,
          JSON.stringify(snapshotData),
          JSON.stringify({ snapshot_name: snapshotName, record_count: records.length }),
        ]
      );

      return {
        id: snapshotId,
        baseId,
        name: snapshotName,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        recordCount: records.length,
      };
    } catch (e) {
      logger.error('[AuditService] createSnapshot failed', { baseId, error: (e as Error).message });
      throw e;
    }
  },

  async listSnapshots(baseId: string): Promise<SnapshotSummary[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT id, created_at, metadata
         FROM tp_audit_events
         WHERE event_type = 'snapshot' AND entity_type = 'base' AND entity_id = $1
         ORDER BY created_at DESC`,
        [baseId]
      );

      return result.rows.map((row: any) => {
        const meta = parseJsonSafe(row.metadata) ?? {};
        return {
          id: row.id,
          name: String(meta.snapshot_name ?? 'Unnamed'),
          createdAt: row.created_at,
          recordCount: Number(meta.record_count ?? 0),
        } satisfies SnapshotSummary;
      });
    } catch (e) {
      logger.error('[AuditService] listSnapshots failed', { baseId, error: (e as Error).message });
      throw e;
    }
  },

  // ── Cell-Level History ──────────────────────────────────────────────────

  async logCellChanges(
    recordId: string,
    tableId: string,
    changes: Array<{ fieldId: string; oldValue: unknown; newValue: unknown }>,
    userId: string
  ): Promise<void> {
    if (changes.length === 0) return;
    const db = getDatabase();
    try {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let paramIdx = 1;

      for (const change of changes) {
        placeholders.push(
          `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5})`
        );
        values.push(
          recordId,
          tableId,
          change.fieldId,
          change.oldValue !== undefined ? JSON.stringify(change.oldValue) : null,
          change.newValue !== undefined ? JSON.stringify(change.newValue) : null,
          userId
        );
        paramIdx += 6;
      }

      await db.query(
        `INSERT INTO tp_cell_history (record_id, table_id, field_id, old_value, new_value, changed_by)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    } catch (e) {
      logger.error('[AuditService] logCellChanges failed', {
        recordId,
        tableId,
        error: (e as Error).message,
      });
    }
  },

  async getCellHistory(
    recordId: string,
    fieldId: string,
    limit = 50,
    offset = 0
  ): Promise<unknown[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT id, record_id, table_id, field_id, old_value, new_value, changed_by, changed_at
         FROM tp_cell_history
         WHERE record_id = $1 AND field_id = $2
         ORDER BY changed_at DESC
         LIMIT $3 OFFSET $4`,
        [recordId, fieldId, limit, offset]
      );
      return result.rows;
    } catch (e) {
      logger.error('[AuditService] getCellHistory failed', {
        recordId,
        fieldId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getRecordCellHistory(recordId: string, limit = 100): Promise<unknown[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT id, record_id, table_id, field_id, old_value, new_value, changed_by, changed_at
         FROM tp_cell_history
         WHERE record_id = $1
         ORDER BY changed_at DESC
         LIMIT $2`,
        [recordId, limit]
      );
      return result.rows;
    } catch (e) {
      logger.error('[AuditService] getRecordCellHistory failed', {
        recordId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async restoreSnapshot(snapshotId: string): Promise<void> {
    const db = getDatabase();
    try {
      const snapResult = await db.query(
        `SELECT entity_id, after_data, actor_id FROM tp_audit_events WHERE id = $1 AND event_type = 'snapshot'`,
        [snapshotId]
      );
      const snap = snapResult.rows[0] as any;
      if (!snap) throw new Error(`Snapshot ${snapshotId} not found`);

      const baseId = snap.entity_id;
      const data = parseJsonSafe(snap.after_data);
      if (!data) throw new Error('Snapshot data is empty');

      const { tables, fields, views, records } = data as {
        tables: any[];
        fields: any[];
        views: any[];
        records: any[];
      };

      const existingTables = (
        await db.query('SELECT id FROM tp_tables WHERE base_id = $1', [baseId])
      ).rows;
      const existingTableIds = existingTables.map((t: any) => t.id);

      if (existingTableIds.length > 0) {
        await db.query('DELETE FROM tp_records WHERE table_id = ANY($1)', [existingTableIds]);
        await db.query('DELETE FROM tp_views WHERE table_id = ANY($1)', [existingTableIds]);
        await db.query('DELETE FROM tp_fields WHERE table_id = ANY($1)', [existingTableIds]);
        await db.query('DELETE FROM tp_tables WHERE base_id = $1', [baseId]);
      }

      for (const t of tables ?? []) {
        await db.query(
          `INSERT INTO tp_tables (id, base_id, name, description, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            t.id,
            baseId,
            t.name,
            t.description ?? null,
            t.created_by ?? null,
            t.created_at,
            t.updated_at ?? t.created_at,
          ]
        );
      }

      for (const f of fields ?? []) {
        await db.query(
          `INSERT INTO tp_fields (id, table_id, name, field_type, config, field_order, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            f.id,
            f.table_id,
            f.name,
            f.field_type,
            JSON.stringify(f.config ?? {}),
            f.field_order ?? 0,
            f.created_at,
          ]
        );
      }

      for (const v of views ?? []) {
        await db.query(
          `INSERT INTO tp_views (id, table_id, name, view_type, config, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            v.id,
            v.table_id,
            v.name,
            v.view_type ?? 'grid',
            JSON.stringify(v.config ?? {}),
            v.created_by ?? null,
            v.created_at,
          ]
        );
      }

      for (const r of records ?? []) {
        await db.query(
          `INSERT INTO tp_records (id, table_id, data, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [
            r.id,
            r.table_id,
            JSON.stringify(r.data ?? {}),
            r.created_by ?? null,
            r.created_at,
            r.updated_at ?? r.created_at,
          ]
        );
      }

      await auditService.logEvent('restore', 'base', baseId, snap.actor_id, undefined, undefined, {
        restored_snapshot_id: snapshotId,
      });

      logger.info('[AuditService] snapshot restored', { snapshotId, baseId });
    } catch (e) {
      logger.error('[AuditService] restoreSnapshot failed', {
        snapshotId,
        error: (e as Error).message,
      });
      throw e;
    }
  },
};

export default auditService;
