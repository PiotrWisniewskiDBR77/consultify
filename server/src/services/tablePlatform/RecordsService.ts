/**
 * Table Platform Records Service
 * Record CRUD with auto-field population, optimistic locking, and batch operations
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';
import attachmentService from './AttachmentService.js';
import auditService from './AuditService.js';
import { automationService } from './AutomationService.js';
import confidenceScoringService from './ConfidenceScoringService.js';
import { ConflictError, PermissionError, ValidationError } from './ErrorHandling.js';
import { fieldPermissionService } from './FieldPermissionService.js';
import { recomputeAffectedFields } from './formulaEngine.js';
import { tablePlatformRealtime } from './RealtimeService.js';
import recordWatchService from './RecordWatchService.js';
import relationService from './RelationService.js';
import schemaValidationService from './SchemaValidationService.js';
import { webhookDispatcher } from './WebhookDispatcherService.js';
import { webhookRelayService } from './WebhookRelayService.js';

const MAX_BATCH_SIZE = 10;
const MAX_UNDO_STACK = 20;

async function resolveUserName(userId: string): Promise<string> {
  try {
    const pool = getDatabase();
    const r = await pool.query(
      "SELECT COALESCE(TRIM(first_name || ' ' || last_name), email, id::text) as display_name FROM users WHERE id = $1",
      [userId]
    );
    if (r.rows.length > 0) return (r.rows[0] as any).display_name;
    return userId;
  } catch {
    return userId;
  }
}

interface UndoEntry {
  recordId: string;
  tableId: string;
  previousData: Record<string, unknown>;
  timestamp: number;
}

const undoBuffers = new Map<string, UndoEntry[]>();

function pushUndo(userId: string, entry: UndoEntry): void {
  let stack = undoBuffers.get(userId);
  if (!stack) {
    stack = [];
    undoBuffers.set(userId, stack);
  }
  stack.push(entry);
  if (stack.length > MAX_UNDO_STACK) {
    stack.shift();
  }
}

function popUndo(userId: string): UndoEntry | undefined {
  const stack = undoBuffers.get(userId);
  if (!stack || stack.length === 0) return undefined;
  return stack.pop();
}
const CURSOR_DELIM = '|';

const AUTO_FIELD_TYPES = new Set([
  'createdTime',
  'createdBy',
  'lastModifiedTime',
  'lastModifiedBy',
  'autoNumber',
]);

async function hasRecordVersionColumn(): Promise<boolean> {
  return await getTableColumns('tp_records')
    .then((cols) => cols.has('version'))
    .catch(() => false);
}

interface AutoField {
  id: string;
  type: string;
  options?: Record<string, unknown>;
}

async function loadAutoFields(tableId: string): Promise<AutoField[]> {
  const db = getDatabase();
  const result = await db.query(
    `SELECT id, field_type AS type, options FROM tp_fields
     WHERE table_id = $1 AND field_type = ANY($2)`,
    [tableId, Array.from(AUTO_FIELD_TYPES)]
  );
  return result.rows as AutoField[];
}

async function computeAutoNumber(
  tableId: string,
  fieldId: string,
  fieldOptions?: Record<string, unknown>
): Promise<number> {
  const db = getDatabase();
  await db.query(`SELECT pg_advisory_xact_lock(hashtext($1 || $2))`, [tableId, fieldId]);
  const result = await db.query(
    `SELECT COALESCE(MAX((data->>$2)::integer), 0) AS max_val
     FROM tp_records WHERE table_id = $1`,
    [tableId, fieldId]
  );
  const maxVal = parseInt(String((result.rows[0] as { max_val: string }).max_val), 10);
  if (maxVal > 0) return maxVal + 1;
  const start = Number(fieldOptions?.start) || 1;
  return start;
}

async function populateAutoFieldsForCreate(
  data: Record<string, unknown>,
  autoFields: AutoField[],
  userId: string | undefined,
  autoNumberValues: Map<string, number>
): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  const enriched = { ...data };
  let displayName: string | undefined;

  for (const field of autoFields) {
    switch (field.type) {
      case 'createdTime':
        enriched[field.id] = now;
        break;
      case 'createdBy':
        enriched[field.id] = userId ?? null;
        break;
      case 'lastModifiedTime':
        enriched[field.id] = now;
        break;
      case 'lastModifiedBy':
        enriched[field.id] = userId ?? null;
        break;
      case 'autoNumber': {
        const val = autoNumberValues.get(field.id);
        if (val != null) enriched[field.id] = val;
        break;
      }
    }
  }

  if (userId) {
    displayName = await resolveUserName(userId);
    enriched.__created_by = userId;
    enriched.__created_by_name = displayName;
    enriched.__modified_by = userId;
    enriched.__modified_by_name = displayName;
  }

  return enriched;
}

async function populateAutoFieldsForUpdate(
  data: Record<string, unknown>,
  autoFields: AutoField[],
  userId: string | undefined
): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  const enriched = { ...data };
  for (const field of autoFields) {
    if (field.type === 'lastModifiedTime') {
      enriched[field.id] = now;
    } else if (field.type === 'lastModifiedBy') {
      enriched[field.id] = userId ?? null;
    }
  }

  if (userId) {
    const displayName = await resolveUserName(userId);
    enriched.__modified_by = userId;
    enriched.__modified_by_name = displayName;
  }

  return enriched;
}

export interface BatchOperation {
  type: 'create' | 'update' | 'delete';
  data?: Record<string, unknown>;
  recordId?: string;
}

export interface BatchError {
  index: number;
  operationType: string;
  error: string;
}

export interface BatchRecordsResponse {
  results: Array<{ index: number; result: unknown }>;
  errors: BatchError[];
}

export interface UpsertResult {
  createdRecords: unknown[];
  updatedRecords: unknown[];
  errors: Array<{ index: number; error: string }>;
}

/** Sanitize field name for JSONB key - allow only alphanumeric and underscore */
function sanitizeFieldKey(field: string): string {
  return field.replace(/[^a-zA-Z0-9_]/g, '');
}

type FilterOp = 'contains' | 'equals' | 'isEmpty' | 'isNotEmpty' | 'gt' | 'lt';
type FilterSpec = { field: string; op: FilterOp; value?: unknown };
type SortSpec = { field: string; dir: 'asc' | 'desc' };

async function getAttachmentFieldIds(tableId: string): Promise<Set<string>> {
  const db = getDatabase();
  const result = await db.query(
    "SELECT id FROM tp_fields WHERE table_id = $1 AND field_type = 'attachment'",
    [tableId]
  );
  return new Set(result.rows.map((r: any) => r.id));
}

async function enrichAttachmentFields(
  records: any[],
  attachmentFieldIds: Set<string>
): Promise<void> {
  if (attachmentFieldIds.size === 0) return;

  const allIds: string[] = [];
  for (const record of records) {
    const data = record.data as Record<string, unknown> | undefined;
    if (!data) continue;
    for (const fieldId of attachmentFieldIds) {
      const val = data[fieldId];
      if (Array.isArray(val)) {
        for (const id of val) {
          if (typeof id === 'string' && !allIds.includes(id)) {
            allIds.push(id);
          }
        }
      }
    }
  }

  if (allIds.length === 0) return;

  const metas = await attachmentService.getAttachmentsByIds(allIds);
  const metaMap = new Map(metas.map((m) => [m.id, m]));

  for (const record of records) {
    const data = record.data as Record<string, unknown> | undefined;
    if (!data) continue;
    for (const fieldId of attachmentFieldIds) {
      const val = data[fieldId];
      if (Array.isArray(val)) {
        data[fieldId] = val
          .map((id: string) => {
            const meta = metaMap.get(id);
            if (!meta) return null;
            return {
              id: meta.id,
              filename: meta.file_name,
              mimetype: meta.mime_type,
              size: Number(meta.size_bytes),
              downloadUrl: meta.download_url,
            };
          })
          .filter(Boolean);
      }
    }
  }
}

async function getBaseIdForTable(tableId: string): Promise<string | null> {
  const db = getDatabase();
  const r = await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]);
  return (r.rows[0] as { base_id?: string } | undefined)?.base_id ?? null;
}

const recordsService = {
  async createRecord(
    tableId: string,
    data: Record<string, unknown>,
    createdBy?: string
  ): Promise<any> {
    const db = getDatabase();
    const id = uuidv4();
    try {
      // Apply default values before validation
      const allFieldsResult = await db.query('SELECT * FROM tp_fields WHERE table_id = $1', [
        tableId,
      ]);
      const allFields = allFieldsResult.rows as Array<{
        id: string;
        name: string;
        field_type: string;
        options: Record<string, unknown> | null;
      }>;
      for (const field of allFields) {
        const opts = field.options;
        if (
          opts?.default !== undefined &&
          data[field.id] === undefined &&
          data[field.name] === undefined
        ) {
          data[field.id] = opts.default;
        }
      }

      const validation = await schemaValidationService.validateRecord(tableId, data);
      if (!validation.valid) {
        throw new ValidationError('Record validation failed', {
          errors: validation.errors,
        });
      }

      schemaValidationService.validateRecordSize(data);

      const autoFields = await loadAutoFields(tableId);
      const autoNumberValues = new Map<string, number>();

      for (const af of autoFields) {
        if (af.type === 'autoNumber') {
          const nextVal = await computeAutoNumber(
            tableId,
            af.id,
            af.options as Record<string, unknown> | undefined
          );
          autoNumberValues.set(af.id, nextVal);
        }
      }

      const enrichedData = await populateAutoFieldsForCreate(
        data,
        autoFields,
        createdBy,
        autoNumberValues
      );

      await db.query(
        `INSERT INTO tp_records (id, table_id, data, created_by)
         VALUES ($1, $2, $3, $4)`,
        [id, tableId, JSON.stringify(enrichedData), createdBy ?? null]
      );
      let row = (await db.query('SELECT * FROM tp_records WHERE id = $1', [id])).rows[0];
      await auditService.logEvent('create', 'record', id, createdBy, undefined, row, {
        table_id: tableId,
      });

      try {
        const allFieldIds = Object.keys(enrichedData);
        if (allFieldIds.length > 0) {
          await recomputeAffectedFields(tableId, allFieldIds, id);
          row = (await db.query('SELECT * FROM tp_records WHERE id = $1', [id])).rows[0];
        }
      } catch (recomputeErr) {
        logger.warn('[RecordsService] formula recompute after create failed', {
          recordId: id,
          error: (recomputeErr as Error).message,
        });
      }

      // Block B · EPIC-T9: confidence recompute. The service no-ops when the
      // ENABLE_RECORD_PROVENANCE flag is OFF; we only re-read the row when
      // the score actually changed so we keep DB I/O parity with the
      // pre-Block-B path until provenance is rolled out.
      try {
        const outcome = await confidenceScoringService.recompute(id);
        if (outcome.applied) {
          row = (await db.query('SELECT * FROM tp_records WHERE id = $1', [id])).rows[0];
        }
      } catch (provenanceErr) {
        logger.warn('[RecordsService] confidence recompute after create failed', {
          recordId: id,
          error: (provenanceErr as Error).message,
        });
      }

      // Cross-record recompute on create: normally a no-op (a fresh record has
      // no inbound links yet), but kept for symmetry with update and to cover
      // flows that pre-seed links before the row is fully materialized. The
      // back-reference query short-circuits cheaply when there are none.
      try {
        const changedFieldIds = Object.keys(enrichedData);
        if (changedFieldIds.length > 0) {
          const dependents = await relationService.recomputeDependentsOfSource(
            id,
            changedFieldIds
          );
          for (const dep of dependents) {
            try {
              const depRow = (
                await db.query('SELECT * FROM tp_records WHERE id = $1', [dep.recordId])
              ).rows[0];
              if (depRow) {
                tablePlatformRealtime.notifyRecordUpdated(dep.tableId, dep.recordId, depRow);
              }
            } catch {
              /* realtime is best-effort */
            }
          }
        }
      } catch (crossRecomputeErr) {
        logger.warn('[RecordsService] cross-record recompute after create failed', {
          recordId: id,
          error: (crossRecomputeErr as Error).message,
        });
      }

      try {
        tablePlatformRealtime.notifyRecordCreated(tableId, row);
      } catch {
        /* non-blocking */
      }

      if (row) {
        automationService.evaluateTriggers(tableId, 'record_created', row).catch((err) =>
          logger.warn('[Automations] trigger evaluation failed after create', {
            error: (err as Error).message,
          })
        );
      }

      getBaseIdForTable(tableId)
        .then((baseId) => {
          if (!baseId) return;
          webhookDispatcher
            .dispatchEvent(baseId, {
              source: 'publicApi',
              sourceMetadata: { userId: createdBy },
              actionType: 'createRecord',
              tableId,
              recordId: id,
              newCellValues: enrichedData,
            })
            .catch((err: unknown) => logger.warn('[RecordsService] event dispatch failed', err));
          webhookRelayService
            .dispatchEvent(baseId, 'record.created', { recordId: id, tableId, data: enrichedData })
            .catch((err: unknown) => logger.warn('[RecordsService] event dispatch failed', err));
        })
        .catch((err: unknown) => logger.warn('[RecordsService] event dispatch failed', err));

      return row ?? null;
    } catch (e) {
      logger.error('[RecordsService] createRecord failed', {
        tableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getRecord(recordId: string, userRole?: string): Promise<any> {
    const db = getDatabase();
    try {
      const result = await db.query('SELECT * FROM tp_records WHERE id = $1', [recordId]);
      const record = (result.rows[0] ?? null) as {
        table_id: string;
        data: Record<string, unknown>;
      } | null;
      if (record) {
        try {
          const attachFieldIds = await getAttachmentFieldIds(record.table_id);
          if (attachFieldIds.size > 0) {
            await enrichAttachmentFields([record], attachFieldIds);
          }
        } catch (enrichErr) {
          logger.warn('[RecordsService] attachment enrichment failed for getRecord', {
            recordId,
            error: (enrichErr as Error).message,
          });
        }

        if (userRole && record.data) {
          try {
            const hasPerms = await fieldPermissionService.tableHasFieldPermissions(record.table_id);
            if (hasPerms) {
              record.data = await fieldPermissionService.filterRecordFields(
                record,
                record.table_id,
                userRole
              );
            }
          } catch (permErr) {
            logger.warn('[RecordsService] field permission filtering failed for getRecord', {
              recordId,
              error: (permErr as Error).message,
            });
          }
        }
      }
      return record;
    } catch (e) {
      logger.error('[RecordsService] getRecord failed', { recordId, error: (e as Error).message });
      throw e;
    }
  },

  async updateRecord(
    recordId: string,
    data: Record<string, unknown>,
    updatedBy?: string,
    expectedVersion?: number,
    userRole?: string
  ): Promise<any> {
    const db = getDatabase();
    try {
      const versionColumnEnabled = await hasRecordVersionColumn();
      const before = (await db.query('SELECT * FROM tp_records WHERE id = $1', [recordId])).rows[0];
      if (!before) return null;
      const tableId = (before as { table_id: string }).table_id;

      if (userRole) {
        try {
          const hasPerms = await fieldPermissionService.tableHasFieldPermissions(tableId);
          if (hasPerms) {
            const writeCheck = await fieldPermissionService.validateWritePermissions(
              data,
              tableId,
              userRole
            );
            if (!writeCheck.allowed) {
              throw new PermissionError(
                `Write denied for fields: ${writeCheck.deniedFields.join(', ')}`
              );
            }
          }
        } catch (e) {
          if (e instanceof PermissionError) throw e;
          logger.warn('[RecordsService] field permission check failed', {
            recordId,
            error: (e as Error).message,
          });
        }
      }

      if (updatedBy) {
        const existingDataForUndo = (before as { data?: Record<string, unknown> }).data ?? {};
        pushUndo(updatedBy, {
          recordId,
          tableId,
          previousData: { ...existingDataForUndo },
          timestamp: Date.now(),
        });
      }

      const validation = await schemaValidationService.validateRecord(tableId, data, {
        recordId,
        isUpdate: true,
      });
      if (!validation.valid) {
        throw new ValidationError('Record validation failed', {
          errors: validation.errors,
        });
      }

      schemaValidationService.validateRecordSize(data);

      const autoFields = await loadAutoFields(tableId);
      const enrichedData = await populateAutoFieldsForUpdate(data, autoFields, updatedBy);

      const existingData = (before as { data?: Record<string, unknown> }).data ?? {};
      const merged = { ...existingData, ...enrichedData };

      if (expectedVersion != null) {
        if (!versionColumnEnabled) {
          throw new ConflictError(
            'Optimistic lock is unavailable because tp_records.version is missing',
            {
              recordId,
              expectedVersion,
            }
          );
        }
        const result = await db.query(
          `UPDATE tp_records
           SET data = $2, updated_at = NOW(), version = COALESCE(version, 0) + 1
           WHERE id = $1 AND COALESCE(version, 0) = $3`,
          [recordId, JSON.stringify(merged), expectedVersion]
        );
        if ((result as any).rowCount === 0) {
          throw new ConflictError('Record was modified by another user', {
            recordId,
            expectedVersion,
          });
        }
      } else {
        if (versionColumnEnabled) {
          await db.query(
            `UPDATE tp_records
             SET data = $2, updated_at = NOW(), version = COALESCE(version, 0) + 1
             WHERE id = $1`,
            [recordId, JSON.stringify(merged)]
          );
        } else {
          await db.query(
            `UPDATE tp_records
             SET data = $2, updated_at = NOW()
             WHERE id = $1`,
            [recordId, JSON.stringify(merged)]
          );
        }
      }

      let after = (await db.query('SELECT * FROM tp_records WHERE id = $1', [recordId])).rows[0];
      await auditService.logEvent(
        'update',
        'record',
        recordId,
        updatedBy,
        before,
        after,
        undefined
      );

      // Cell-level history: compute diff between old and new data
      if (updatedBy) {
        try {
          const cellChanges: Array<{ fieldId: string; oldValue: unknown; newValue: unknown }> = [];
          for (const key of Object.keys(enrichedData)) {
            const oldVal = existingData[key] ?? null;
            const newVal = merged[key] ?? null;
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
              cellChanges.push({ fieldId: key, oldValue: oldVal, newValue: newVal });
            }
          }
          if (cellChanges.length > 0) {
            await auditService.logCellChanges(recordId, tableId, cellChanges, updatedBy);
          }
        } catch (cellHistErr) {
          logger.warn('[RecordsService] cell history logging failed', {
            recordId,
            error: (cellHistErr as Error).message,
          });
        }
      }

      try {
        const changedFieldIds = Object.keys(enrichedData);
        if (changedFieldIds.length > 0) {
          await recomputeAffectedFields(tableId, changedFieldIds, recordId);
          after = (await db.query('SELECT * FROM tp_records WHERE id = $1', [recordId])).rows[0];
        }
      } catch (recomputeErr) {
        logger.warn('[RecordsService] formula recompute after update failed', {
          recordId,
          error: (recomputeErr as Error).message,
        });
      }

      // Block B · EPIC-T9: confidence recompute. Same contract as the create
      // path — feature-flag gated inside the service, only re-reads the row
      // when the score actually changed.
      try {
        const outcome = await confidenceScoringService.recompute(recordId);
        if (outcome.applied) {
          after = (await db.query('SELECT * FROM tp_records WHERE id = $1', [recordId])).rows[0];
        }
      } catch (provenanceErr) {
        logger.warn('[RecordsService] confidence recompute after update failed', {
          recordId,
          error: (provenanceErr as Error).message,
        });
      }

      // Cross-record recompute (root fix for "tabele kłamią"): the formula/
      // confidence passes above only refresh THIS record. Rollup/lookup fields
      // on OTHER records that link this one must also refresh when the source
      // cells they read change — otherwise dependent aggregates go stale until
      // the next link/unlink/delete. `recomputeComputedFields` previously only
      // ran on link mutations, never on a plain cell edit.
      try {
        const changedFieldIds = Object.keys(enrichedData);
        if (changedFieldIds.length > 0) {
          const dependents = await relationService.recomputeDependentsOfSource(
            recordId,
            changedFieldIds
          );
          for (const dep of dependents) {
            try {
              const depRow = (
                await db.query('SELECT * FROM tp_records WHERE id = $1', [dep.recordId])
              ).rows[0];
              if (depRow) {
                tablePlatformRealtime.notifyRecordUpdated(dep.tableId, dep.recordId, depRow);
              }
            } catch {
              /* realtime is best-effort */
            }
          }
        }
      } catch (crossRecomputeErr) {
        logger.warn('[RecordsService] cross-record recompute after update failed', {
          recordId,
          error: (crossRecomputeErr as Error).message,
        });
      }

      try {
        tablePlatformRealtime.notifyRecordUpdated(tableId, recordId, after);
      } catch {
        /* non-blocking */
      }

      if (after) {
        automationService.evaluateTriggers(tableId, 'record_updated', after).catch((err) =>
          logger.warn('[Automations] trigger evaluation failed after update', {
            error: (err as Error).message,
          })
        );
      }

      getBaseIdForTable(tableId)
        .then((baseId) => {
          if (!baseId) return;
          webhookDispatcher
            .dispatchEvent(baseId, {
              source: 'publicApi',
              sourceMetadata: { userId: updatedBy },
              actionType: 'updateRecord',
              tableId,
              recordId,
              oldCellValues: existingData,
              newCellValues: enrichedData,
            })
            .catch((err: unknown) => logger.warn('[RecordsService] event dispatch failed', err));
          webhookRelayService
            .dispatchEvent(baseId, 'record.updated', {
              recordId,
              tableId,
              data: enrichedData,
              previousData: existingData,
            })
            .catch((err: unknown) => logger.warn('[RecordsService] event dispatch failed', err));
        })
        .catch((err: unknown) => logger.warn('[RecordsService] event dispatch failed', err));

      recordWatchService
        .notifyWatchers(recordId, {
          action: 'update',
          recordId,
          tableId,
          actorId: updatedBy,
          changes: enrichedData,
        })
        .catch((err: unknown) => logger.warn('[RecordsService] event dispatch failed', err));

      return after ?? null;
    } catch (e) {
      logger.error('[RecordsService] updateRecord failed', {
        recordId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async deleteRecord(recordId: string, deletedBy?: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_records WHERE id = $1', [recordId])).rows[0];
      if (!before) return false;
      const tableId = (before as { table_id: string }).table_id;
      await relationService.onRecordDeleted(recordId);
      await db.query('DELETE FROM tp_records WHERE id = $1', [recordId]);
      await auditService.logEvent(
        'delete',
        'record',
        recordId,
        deletedBy,
        before,
        undefined,
        undefined
      );

      try {
        tablePlatformRealtime.notifyRecordDeleted(tableId, recordId);
      } catch {
        /* non-blocking */
      }

      getBaseIdForTable(tableId)
        .then((baseId) => {
          if (!baseId) return;
          webhookDispatcher
            .dispatchEvent(baseId, {
              source: 'publicApi',
              sourceMetadata: { userId: deletedBy },
              actionType: 'deleteRecord',
              tableId,
              recordId,
            })
            .catch((err: unknown) => logger.warn('[RecordsService] event dispatch failed', err));
          webhookRelayService
            .dispatchEvent(baseId, 'record.deleted', { recordId, tableId })
            .catch((err: unknown) => logger.warn('[RecordsService] event dispatch failed', err));
        })
        .catch((err: unknown) => logger.warn('[RecordsService] event dispatch failed', err));

      recordWatchService
        .notifyWatchers(recordId, {
          action: 'delete',
          recordId,
          tableId,
          actorId: deletedBy,
        })
        .catch((err: unknown) => logger.warn('[RecordsService] event dispatch failed', err));

      return true;
    } catch (e) {
      logger.error('[RecordsService] deleteRecord failed', {
        recordId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async listRecords(
    tableId: string,
    options: {
      viewId?: string;
      filters?: FilterSpec[];
      sorts?: SortSpec[];
      fields?: string[];
      pageSize?: number;
      cursor?: string;
      userRole?: string;
    } = {}
  ): Promise<{ records: unknown[]; total: number; cursor?: string; hasMore: boolean }> {
    const db = getDatabase();
    const pageSize = Math.min(options.pageSize ?? 50, 100);

    try {
      const params: unknown[] = [tableId];
      let paramIdx = 2;

      let whereClause = 'r.table_id = $1';
      if (options.filters?.length) {
        for (const f of options.filters) {
          const safeKey = sanitizeFieldKey(f.field) || 'id';
          switch (f.op) {
            case 'contains':
              whereClause += ` AND r.data->>$${paramIdx} ILIKE $${paramIdx + 1}`;
              params.push(safeKey, `%${String(f.value ?? '')}%`);
              paramIdx += 2;
              break;
            case 'equals':
              whereClause += ` AND r.data->>$${paramIdx} = $${paramIdx + 1}`;
              params.push(safeKey, f.value);
              paramIdx += 2;
              break;
            case 'isEmpty':
              whereClause += ` AND (r.data->>$${paramIdx} IS NULL OR r.data->>$${paramIdx} = '')`;
              params.push(safeKey);
              paramIdx++;
              break;
            case 'isNotEmpty':
              whereClause += ` AND r.data->>$${paramIdx} IS NOT NULL AND r.data->>$${paramIdx} != ''`;
              params.push(safeKey);
              paramIdx++;
              break;
            case 'gt':
              whereClause += ` AND (r.data->>$${paramIdx})::numeric > $${paramIdx + 1}`;
              params.push(safeKey, f.value);
              paramIdx += 2;
              break;
            case 'lt':
              whereClause += ` AND (r.data->>$${paramIdx})::numeric < $${paramIdx + 1}`;
              params.push(safeKey, f.value);
              paramIdx += 2;
              break;
          }
        }
      }

      const countResult = await db.query(
        `SELECT COUNT(*) AS total FROM tp_records r WHERE ${whereClause}`,
        params
      );
      const total = parseInt(String((countResult.rows[0] as { total?: string })?.total ?? 0), 10);

      let orderBy = 'r.created_at DESC, r.id ASC';
      if (options.sorts?.length) {
        const parts = options.sorts.map((s) => {
          const safe = sanitizeFieldKey(s.field) || 'id';
          return `r.data->>'${safe.replace(/'/g, "''")}' ${s.dir.toUpperCase()}`;
        });
        parts.push('r.created_at DESC');
        parts.push('r.id ASC');
        orderBy = parts.join(', ');
      }

      let cursorWhere = '';
      const finalParams = [...params];
      if (options.cursor) {
        const parts = options.cursor.split(CURSOR_DELIM);
        const cursorCreatedAt = parts[0];
        const cursorId = parts[1];
        if (cursorCreatedAt && cursorId) {
          cursorWhere = ` AND (r.created_at, r.id) < ($${paramIdx}, $${paramIdx + 1})`;
          finalParams.push(cursorCreatedAt, cursorId);
          paramIdx += 2;
        }
      }

      const selectFields = options.fields?.length
        ? options.fields
            .map((f) => {
              const safe = sanitizeFieldKey(f) || 'id';
              return `r.data->>'${safe.replace(/'/g, "''")}' AS "${safe.replace(/"/g, '""')}"`;
            })
            .join(', ') + ', r.id, r.table_id, r.created_at, r.updated_at, r.created_by'
        : 'r.*';

      const listSql = `SELECT ${selectFields} FROM tp_records r
        WHERE ${whereClause}${cursorWhere}
        ORDER BY ${orderBy}
        LIMIT $${paramIdx}`;
      finalParams.push(pageSize + 1);

      const listResult = await db.query(listSql, finalParams);
      const rows = listResult.rows;
      const hasMore = rows.length > pageSize;
      const records = hasMore ? rows.slice(0, pageSize) : rows;

      let nextCursor: string | undefined;
      if (hasMore && records.length) {
        const last = records[records.length - 1] as Record<string, unknown>;
        nextCursor = `${last.created_at}${CURSOR_DELIM}${last.id}`;
      }

      try {
        const attachFieldIds = await getAttachmentFieldIds(tableId);
        if (attachFieldIds.size > 0) {
          await enrichAttachmentFields(records, attachFieldIds);
        }
      } catch (enrichErr) {
        logger.warn('[RecordsService] attachment enrichment failed for listRecords', {
          tableId,
          error: (enrichErr as Error).message,
        });
      }

      if (options.userRole) {
        try {
          const hasPerms = await fieldPermissionService.tableHasFieldPermissions(tableId);
          if (hasPerms) {
            for (const record of records as any[]) {
              if (record.data) {
                record.data = await fieldPermissionService.filterRecordFields(
                  record,
                  tableId,
                  options.userRole!
                );
              }
            }
          }
        } catch (permErr) {
          logger.warn('[RecordsService] field permission filtering failed for listRecords', {
            tableId,
            error: (permErr as Error).message,
          });
        }
      }

      return { records, total, cursor: nextCursor, hasMore };
    } catch (e) {
      logger.error('[RecordsService] listRecords failed', { tableId, error: (e as Error).message });
      throw e;
    }
  },

  async batchRecords(
    tableId: string,
    operations: BatchOperation[],
    userId?: string,
    continueOnError = false
  ): Promise<BatchRecordsResponse> {
    const totalOps = operations.length;
    if (totalOps > MAX_BATCH_SIZE) {
      throw new ValidationError(
        `Batch operations limited to ${MAX_BATCH_SIZE}; received ${totalOps}`
      );
    }
    if (totalOps === 0) {
      return { results: [], errors: [] };
    }

    const response: BatchRecordsResponse = { results: [], errors: [] };

    if (!continueOnError) {
      const db = getDatabase();
      try {
        await db.query('BEGIN');
        for (let i = 0; i < operations.length; i++) {
          const op = operations[i];
          const result = await this._executeSingleOp(tableId, op, userId);
          response.results.push({ index: i, result });
        }
        await db.query('COMMIT');
      } catch (e) {
        await db.query('ROLLBACK').catch(() => {});
        logger.error('[RecordsService] batchRecords transaction failed', {
          tableId,
          error: (e as Error).message,
        });
        throw e;
      }
    } else {
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        try {
          const result = await this._executeSingleOp(tableId, op, userId);
          response.results.push({ index: i, result });
        } catch (e) {
          response.errors.push({
            index: i,
            operationType: op.type,
            error: (e as Error).message,
          });
        }
      }
    }

    return response;
  },

  async _executeSingleOp(tableId: string, op: BatchOperation, userId?: string): Promise<unknown> {
    switch (op.type) {
      case 'create':
        return this.createRecord(tableId, op.data ?? {}, userId);
      case 'update':
        if (!op.recordId) throw new ValidationError('recordId required for update');
        return this.updateRecord(op.recordId, op.data ?? {}, userId);
      case 'delete':
        if (!op.recordId) throw new ValidationError('recordId required for delete');
        return this.deleteRecord(op.recordId, userId);
      default:
        throw new ValidationError(`Unknown operation type: ${(op as any).type}`);
    }
  },

  async batchCreate(
    tableId: string,
    records: Array<{ data: Record<string, unknown> }>,
    createdBy?: string
  ): Promise<unknown[]> {
    const ops: BatchOperation[] = records.map((r) => ({ type: 'create' as const, data: r.data }));
    const resp = await this.batchRecords(tableId, ops, createdBy, false);
    return resp.results.map((r) => r.result);
  },

  async batchUpdate(
    records: Array<{ id: string; data: Record<string, unknown> }>,
    updatedBy?: string
  ): Promise<unknown[]> {
    if (records.length > MAX_BATCH_SIZE) {
      throw new ValidationError(`batchUpdate: max ${MAX_BATCH_SIZE} records allowed`);
    }
    const results: unknown[] = [];
    for (const rec of records) {
      const updated = await this.updateRecord(rec.id, rec.data, updatedBy);
      results.push(updated);
    }
    return results;
  },

  async batchDelete(recordIds: string[], deletedBy?: string): Promise<boolean[]> {
    if (recordIds.length > MAX_BATCH_SIZE) {
      throw new ValidationError(`batchDelete: max ${MAX_BATCH_SIZE} records allowed`);
    }
    const results: boolean[] = [];
    for (const id of recordIds) {
      const ok = await this.deleteRecord(id, deletedBy);
      results.push(ok);
    }
    return results;
  },

  async upsertRecords(
    tableId: string,
    records: Array<{ data: Record<string, unknown> }>,
    fieldsToMergeOn: string[],
    userId?: string
  ): Promise<UpsertResult> {
    if (records.length > MAX_BATCH_SIZE) {
      throw new ValidationError(
        `Upsert limited to ${MAX_BATCH_SIZE} records; received ${records.length}`
      );
    }
    if (!fieldsToMergeOn.length) {
      throw new ValidationError('fieldsToMergeOn must contain at least one field ID');
    }

    const db = getDatabase();
    const result: UpsertResult = { createdRecords: [], updatedRecords: [], errors: [] };

    for (let i = 0; i < records.length; i++) {
      try {
        const data = records[i].data;
        if (!data || typeof data !== 'object') {
          result.errors.push({ index: i, error: 'data is required and must be an object' });
          continue;
        }

        const whereParts: string[] = [];
        const params: unknown[] = [tableId];
        let paramIdx = 2;

        for (const fieldId of fieldsToMergeOn) {
          const safeKey = sanitizeFieldKey(fieldId);
          if (!safeKey) continue;
          const val = data[fieldId];
          if (val === undefined || val === null) {
            whereParts.push(`(r.data->>$${paramIdx} IS NULL)`);
            params.push(fieldId);
            paramIdx++;
          } else {
            whereParts.push(`r.data->>$${paramIdx} = $${paramIdx + 1}`);
            params.push(fieldId, String(val));
            paramIdx += 2;
          }
        }

        if (whereParts.length === 0) {
          result.errors.push({ index: i, error: 'No valid merge fields resolved' });
          continue;
        }

        const matchSql = `SELECT id FROM tp_records r WHERE r.table_id = $1 AND ${whereParts.join(' AND ')} LIMIT 1`;
        const matchResult = await db.query(matchSql, params);
        const existingId = (matchResult.rows[0] as { id?: string } | undefined)?.id;

        if (existingId) {
          const updated = await this.updateRecord(existingId, data, userId);
          result.updatedRecords.push(updated);
        } else {
          const created = await this.createRecord(tableId, data, userId);
          result.createdRecords.push(created);
        }
      } catch (e) {
        result.errors.push({ index: i, error: (e as Error).message });
      }
    }

    return result;
  },

  async searchAcrossBase(
    baseId: string,
    query: string,
    limit = 50
  ): Promise<{ tableId: string; tableName: string; records: unknown[] }[]> {
    const db = getDatabase();
    try {
      const tablesResult = await db.query('SELECT id, name FROM tp_tables WHERE base_id = $1', [
        baseId,
      ]);
      const tables = tablesResult.rows as { id: string; name: string }[];
      if (tables.length === 0) return [];

      const pattern = `%${query.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
      const results: { tableId: string; tableName: string; records: unknown[] }[] = [];
      let remaining = Math.min(limit, 200);

      for (const table of tables) {
        if (remaining <= 0) break;

        const searchResult = await db.query(
          `SELECT * FROM tp_records
           WHERE table_id = $1 AND data::text ILIKE $2
           ORDER BY updated_at DESC NULLS LAST
           LIMIT $3`,
          [table.id, pattern, remaining]
        );

        const records = searchResult.rows || [];
        if (records.length > 0) {
          results.push({
            tableId: table.id,
            tableName: table.name,
            records,
          });
          remaining -= records.length;
        }
      }

      return results;
    } catch (e) {
      logger.error('[RecordsService] searchAcrossBase failed', {
        baseId,
        query,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async undoLastEdit(tableId: string, userId: string): Promise<any> {
    const entry = popUndo(userId);
    if (!entry) return null;
    if (entry.tableId !== tableId) {
      pushUndo(userId, entry);
      return null;
    }

    const db = getDatabase();
    try {
      const current = (await db.query('SELECT * FROM tp_records WHERE id = $1', [entry.recordId]))
        .rows[0];
      if (!current) return null;

      await db.query(
        `UPDATE tp_records SET data = $2, updated_at = NOW(), version = COALESCE(version, 0) + 1 WHERE id = $1`,
        [entry.recordId, JSON.stringify(entry.previousData)]
      );

      const restored = (await db.query('SELECT * FROM tp_records WHERE id = $1', [entry.recordId]))
        .rows[0];
      await auditService.logEvent('undo', 'record', entry.recordId, userId, current, restored, {
        table_id: tableId,
      });

      try {
        tablePlatformRealtime.notifyRecordUpdated(tableId, entry.recordId, restored);
      } catch {
        /* non-blocking */
      }

      return restored ?? null;
    } catch (e) {
      logger.error('[RecordsService] undoLastEdit failed', {
        tableId,
        userId,
        error: (e as Error).message,
      });
      throw e;
    }
  },
};

export default recordsService;
