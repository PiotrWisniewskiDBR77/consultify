/**
 * Module Sync Service
 * Handles governed model → Consultify module sync (Results, Finance, Execution, Initiatives).
 * Uses tp_module_sync_results as a bridge table to track sync state.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export type TargetModule = 'results' | 'finance' | 'execution' | 'initiatives';

export interface SyncResult {
  syncId: string;
  syncedRecords: number;
  syncStatus: 'success' | 'error' | 'partial';
  errorMessage?: string;
}

export interface LinkStatusEntry {
  linked: boolean;
  lastSync?: string;
  recordCount?: number;
  errors?: string[];
}

/**
 * Load source table IDs for a governed model
 */
async function getModelSourceTableIds(modelId: string): Promise<string[]> {
  const db = getDatabase();
  const result = await db.query('SELECT table_id FROM tp_model_sources WHERE model_id = $1', [
    modelId,
  ]);
  return ((result.rows || []) as Array<{ table_id: string }>).map((r) => r.table_id);
}

/**
 * Count records across all source tables of the model
 */
async function countSourceRecords(modelId: string): Promise<number> {
  const tableIds = await getModelSourceTableIds(modelId);
  if (tableIds.length === 0) return 0;

  const db = getDatabase();
  const result = await db.query(
    `SELECT COUNT(*) AS cnt FROM tp_records WHERE table_id = ANY($1::uuid[])`,
    [tableIds]
  );
  return Number((result.rows[0] as { cnt: string })?.cnt ?? 0);
}

/**
 * Run sync for a target module and record the result in tp_module_sync_results
 */
export async function syncToModule(
  modelId: string,
  targetModule: TargetModule,
  options: {
    fieldMapping?: Record<string, unknown>;
    fieldMappings?: Record<string, string>;
    tableId?: string;
    kpiIds?: string[];
  }
): Promise<SyncResult> {
  const db = getDatabase();
  const syncId = uuidv4();

  let syncedRecords = 0;
  let syncStatus: 'success' | 'error' | 'partial' = 'success';
  let errorMessage: string | null = null;

  try {
    syncedRecords = await countSourceRecords(modelId);

    // Merge fieldMapping/fieldMappings for storage
    const fieldMapping = (options.fieldMapping ?? options.fieldMappings ?? {}) as Record<
      string,
      unknown
    >;
    if (options.tableId) {
      (fieldMapping as Record<string, string>)['_targetTableId'] = options.tableId;
    }
    if (options.kpiIds?.length) {
      (fieldMapping as Record<string, unknown>)['_kpiIds'] = options.kpiIds;
    }

    await db.query(
      `INSERT INTO tp_module_sync_results
        (id, model_id, target_module, field_mapping, synced_record_count, last_sync_at, sync_status, error_message)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
       ON CONFLICT (model_id, target_module) DO UPDATE SET
         field_mapping = EXCLUDED.field_mapping,
         synced_record_count = EXCLUDED.synced_record_count,
         last_sync_at = NOW(),
         sync_status = EXCLUDED.sync_status,
         error_message = EXCLUDED.error_message`,
      [
        syncId,
        modelId,
        targetModule,
        JSON.stringify(fieldMapping),
        syncedRecords,
        syncStatus,
        errorMessage,
      ]
    );

    return { syncId, syncedRecords, syncStatus, errorMessage: errorMessage ?? undefined };
  } catch (e) {
    errorMessage = (e as Error).message;
    syncStatus = 'error';
    logger.error('[ModuleSyncService] syncToModule failed', {
      modelId,
      targetModule,
      error: errorMessage,
    });

    try {
      await db.query(
        `INSERT INTO tp_module_sync_results
          (id, model_id, target_module, field_mapping, synced_record_count, last_sync_at, sync_status, error_message)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
         ON CONFLICT (model_id, target_module) DO UPDATE SET
           synced_record_count = EXCLUDED.synced_record_count,
           last_sync_at = NOW(),
           sync_status = EXCLUDED.sync_status,
           error_message = EXCLUDED.error_message`,
        [
          syncId,
          modelId,
          targetModule,
          JSON.stringify(options.fieldMapping ?? options.fieldMappings ?? {}),
          0,
          syncStatus,
          errorMessage,
        ]
      );
    } catch (inner) {
      logger.error('[ModuleSyncService] Failed to record sync error', {
        modelId,
        targetModule,
        error: (inner as Error).message,
      });
    }

    return { syncId, syncedRecords: 0, syncStatus, errorMessage };
  }
}

/**
 * Get link status for all modules for a given model
 */
export async function getLinkStatus(
  modelId: string
): Promise<Record<TargetModule, LinkStatusEntry>> {
  const db = getDatabase();
  const result = await db.query(
    `SELECT target_module, field_mapping, synced_record_count, last_sync_at, sync_status, error_message
     FROM tp_module_sync_results
     WHERE model_id = $1`,
    [modelId]
  );

  const status: Record<TargetModule, LinkStatusEntry> = {
    results: { linked: false, recordCount: 0, errors: [] },
    finance: { linked: false, recordCount: 0, errors: [] },
    execution: { linked: false, recordCount: 0, errors: [] },
    initiatives: { linked: false, recordCount: 0, errors: [] },
  };

  for (const _row of result.rows || []) {
    const row = _row as {
      target_module: string;
      last_sync_at?: string;
      synced_record_count?: number;
      error_message?: string;
    };
    const mod = row.target_module as TargetModule;
    if (mod in status) {
      status[mod] = {
        linked: true,
        lastSync: row.last_sync_at ? new Date(row.last_sync_at).toISOString() : undefined,
        recordCount: Number(row.synced_record_count ?? 0),
        errors: row.error_message ? [row.error_message] : [],
      };
    }
  }

  return status;
}
