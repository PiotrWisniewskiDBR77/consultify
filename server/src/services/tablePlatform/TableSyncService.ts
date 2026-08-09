/**
 * Table Platform Table Sync Service
 * Synchronizes records between two tables based on field mapping and optional filters.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export interface TableSync {
  id: string;
  source_table_id: string;
  target_table_id: string;
  field_mapping: Record<string, string>;
  sync_mode: 'one_way' | 'two_way';
  filter_config: FilterConfig | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

interface FilterConfig {
  fieldId: string;
  operator: string;
  value: string;
}

interface SyncStats {
  created: number;
  updated: number;
  errors: number;
}

const SYNC_META_KEY = '__sync_source_record_id';

const tableSyncService = {
  async createSync(
    sourceTableId: string,
    targetTableId: string,
    fieldMapping: Record<string, string>,
    syncMode: 'one_way' | 'two_way' = 'one_way',
    filterConfig?: FilterConfig
  ): Promise<TableSync> {
    const db = getDatabase();
    try {
      if (sourceTableId === targetTableId) {
        throw new Error('Source and target tables must be different');
      }

      const result = await db.query(
        `INSERT INTO tp_table_syncs (source_table_id, target_table_id, field_mapping, sync_mode, filter_config)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          sourceTableId,
          targetTableId,
          JSON.stringify(fieldMapping),
          syncMode,
          filterConfig ? JSON.stringify(filterConfig) : null,
        ]
      );
      return result.rows[0] as TableSync;
    } catch (e) {
      logger.error('[TableSyncService] createSync failed', {
        sourceTableId,
        targetTableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getSync(syncId: string): Promise<TableSync | null> {
    const db = getDatabase();
    try {
      const result = await db.query('SELECT * FROM tp_table_syncs WHERE id = $1', [syncId]);
      return (result.rows[0] as TableSync) ?? null;
    } catch (e) {
      logger.error('[TableSyncService] getSync failed', {
        syncId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async listSyncs(tableId: string): Promise<TableSync[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT * FROM tp_table_syncs
         WHERE source_table_id = $1 OR target_table_id = $1
         ORDER BY created_at ASC`,
        [tableId]
      );
      return result.rows as TableSync[];
    } catch (e) {
      logger.error('[TableSyncService] listSyncs failed', {
        tableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async deleteSync(syncId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query('DELETE FROM tp_table_syncs WHERE id = $1', [syncId]);
      return (result as any).rowCount > 0;
    } catch (e) {
      logger.error('[TableSyncService] deleteSync failed', {
        syncId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async executeSync(syncId: string): Promise<SyncStats> {
    const db = getDatabase();
    const stats: SyncStats = { created: 0, updated: 0, errors: 0 };

    try {
      const sync = await tableSyncService.getSync(syncId);
      if (!sync) throw new Error(`Sync config not found: ${syncId}`);
      if (!sync.is_active) throw new Error(`Sync is not active: ${syncId}`);

      await tableSyncService._syncDirection(
        sync.source_table_id,
        sync.target_table_id,
        sync.field_mapping,
        sync.filter_config,
        stats
      );

      if (sync.sync_mode === 'two_way') {
        const reverseMapping: Record<string, string> = {};
        for (const [src, tgt] of Object.entries(sync.field_mapping)) {
          reverseMapping[tgt] = src;
        }
        await tableSyncService._syncDirection(
          sync.target_table_id,
          sync.source_table_id,
          reverseMapping,
          null,
          stats
        );
      }

      await db.query('UPDATE tp_table_syncs SET last_synced_at = NOW() WHERE id = $1', [syncId]);

      logger.info('[TableSyncService] sync completed', { syncId, stats });
      return stats;
    } catch (e) {
      logger.error('[TableSyncService] executeSync failed', {
        syncId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async _syncDirection(
    sourceTableId: string,
    targetTableId: string,
    fieldMapping: Record<string, string>,
    filterConfig: FilterConfig | null,
    stats: SyncStats
  ): Promise<void> {
    const db = getDatabase();

    let sourceQuery = 'SELECT * FROM tp_records WHERE table_id = $1';
    const sourceParams: unknown[] = [sourceTableId];

    if (filterConfig?.fieldId) {
      const op = filterConfig.operator || 'equals';
      if (op === 'equals') {
        sourceQuery += ` AND data->>$2 = $3`;
        sourceParams.push(filterConfig.fieldId, filterConfig.value);
      } else if (op === 'contains') {
        sourceQuery += ` AND data->>$2 ILIKE $3`;
        sourceParams.push(filterConfig.fieldId, `%${filterConfig.value}%`);
      } else if (op === 'is_not_empty') {
        sourceQuery += ` AND data->>$2 IS NOT NULL AND data->>$2 != ''`;
        sourceParams.push(filterConfig.fieldId);
      }
    }

    const sourceResult = await db.query(sourceQuery, sourceParams);
    const sourceRecords = sourceResult.rows as Array<{
      id: string;
      data: Record<string, unknown>;
    }>;

    for (const sourceRecord of sourceRecords) {
      try {
        const mappedData: Record<string, unknown> = {};
        for (const [srcField, tgtField] of Object.entries(fieldMapping)) {
          if (sourceRecord.data && sourceRecord.data[srcField] !== undefined) {
            mappedData[tgtField] = sourceRecord.data[srcField];
          }
        }
        mappedData[SYNC_META_KEY] = sourceRecord.id;

        const existingResult = await db.query(
          `SELECT id, data FROM tp_records
           WHERE table_id = $1 AND data->>$2 = $3
           LIMIT 1`,
          [targetTableId, SYNC_META_KEY, sourceRecord.id]
        );

        if (existingResult.rows.length > 0) {
          const existing = existingResult.rows[0] as { id: string; data: Record<string, unknown> };
          const merged = { ...existing.data, ...mappedData };
          await db.query(
            `UPDATE tp_records SET data = $2, updated_at = NOW(), version = COALESCE(version, 0) + 1
             WHERE id = $1`,
            [existing.id, JSON.stringify(merged)]
          );
          stats.updated++;
        } else {
          const newId = uuidv4();
          await db.query(
            `INSERT INTO tp_records (id, table_id, data)
             VALUES ($1, $2, $3)`,
            [newId, targetTableId, JSON.stringify(mappedData)]
          );
          stats.created++;
        }
      } catch (recErr) {
        logger.warn('[TableSyncService] failed to sync record', {
          sourceRecordId: sourceRecord.id,
          error: (recErr as Error).message,
        });
        stats.errors++;
      }
    }
  },
};

export default tableSyncService;
