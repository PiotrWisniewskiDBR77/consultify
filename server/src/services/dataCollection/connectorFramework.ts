/**
 * Connector Framework — registry, runner, and core interfaces for data collection.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import RecordsService from '../tablePlatform/RecordsService.js';
import { type DriftReport, schemaDriftDetector } from './schemaDriftDetector.js';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface IConnector {
  type: string;
  testConnection(config: Record<string, unknown>): Promise<{ success: boolean; error?: string }>;
  fetchSchema(config: Record<string, unknown>): Promise<ExternalSchema>;
  fetchRecords(config: Record<string, unknown>, options?: FetchOptions): Promise<ExternalRecord[]>;
}

export interface ExternalSchema {
  tables: Array<{
    name: string;
    externalId?: string;
    fields: Array<{
      name: string;
      externalType: string;
      inferredType: string;
      sample?: unknown;
    }>;
  }>;
}

export interface ExternalRecord {
  externalId?: string;
  data: Record<string, unknown>;
}

export interface FetchOptions {
  limit?: number;
  offset?: number;
  since?: string;
}

export interface FieldMapping {
  sourceField: string;
  targetFieldId: string;
  transform?: string;
}

export interface RunResult {
  runId: string;
  status: 'success' | 'failed' | 'partial' | 'drift_detected';
  recordsFetched: number;
  recordsImported: number;
  recordsSkipped: number;
  recordsFailed: number;
  errors: Array<{ row?: number; error: string }>;
  durationMs: number;
  driftReport?: DriftReport;
}

export interface ConnectorRow {
  id: string;
  workspace_id: string;
  organization_id: string;
  name: string;
  connector_type: string;
  config: Record<string, unknown>;
  target_table_id: string | null;
  field_mapping: FieldMapping[];
  schedule: Record<string, unknown> | null;
  last_run_at: string | null;
  last_run_status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// ConnectorRegistry
// ---------------------------------------------------------------------------

class ConnectorRegistry {
  private connectors = new Map<string, IConnector>();

  register(type: string, connector: IConnector): void {
    this.connectors.set(type, connector);
  }

  get(type: string): IConnector {
    const c = this.connectors.get(type);
    if (!c) {
      throw new Error(`No connector registered for type: ${type}`);
    }
    return c;
  }

  listTypes(): string[] {
    return Array.from(this.connectors.keys());
  }
}

export const connectorRegistry = new ConnectorRegistry();

// ---------------------------------------------------------------------------
// ConnectorRunner
// ---------------------------------------------------------------------------

const IMPORT_BATCH_SIZE = 10;

export const connectorRunner = {
  async run(connectorId: string): Promise<RunResult> {
    const db = getDatabase();
    const startTime = Date.now();

    const connectorResult = await db.query('SELECT * FROM tp_connectors WHERE id = $1', [
      connectorId,
    ]);
    const connector = connectorResult.rows[0] as ConnectorRow | undefined;
    if (!connector) {
      throw new Error(`Connector not found: ${connectorId}`);
    }

    if (!connector.target_table_id) {
      throw new Error(`Connector ${connectorId} has no target table`);
    }

    const runId = uuidv4();
    await db.query(
      `INSERT INTO tp_connector_runs (id, connector_id, status, started_at)
       VALUES ($1, $2, 'running', NOW())`,
      [runId, connectorId]
    );

    const result: RunResult = {
      runId,
      status: 'success',
      recordsFetched: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      const impl = connectorRegistry.get(connector.connector_type);

      // Schema drift detection
      try {
        const currentSchema = await impl.fetchSchema(connector.config);
        const drift = await schemaDriftDetector.detectDrift(connectorId, currentSchema);
        if (drift.hasDrift) {
          result.driftReport = drift;
          logger.info('[ConnectorRunner] schema drift detected', { connectorId, drift });

          await db.query(`UPDATE tp_connector_runs SET metadata = $2 WHERE id = $1`, [
            runId,
            JSON.stringify({ drift_report: drift }),
          ]);

          const onDrift = (connector.config as Record<string, unknown>).onDrift as
            | string
            | undefined;
          if (onDrift === 'auto') {
            await schemaDriftDetector.autoResolveDrift(connectorId, drift);
          } else if (onDrift === 'pause') {
            result.status = 'drift_detected';
            result.durationMs = Date.now() - startTime;
            await db.query(
              `UPDATE tp_connector_runs
               SET status = 'drift_detected', completed_at = NOW(), duration_ms = $2
               WHERE id = $1`,
              [runId, result.durationMs]
            );
            await db.query(
              `UPDATE tp_connectors SET last_run_at = NOW(), last_run_status = 'drift_detected', updated_at = NOW()
               WHERE id = $1`,
              [connectorId]
            );
            return result;
          }
        }
      } catch (driftErr) {
        logger.warn('[ConnectorRunner] drift detection failed, continuing with sync', {
          connectorId,
          error: (driftErr as Error).message,
        });
      }

      const fetchConfig =
        connector.connector_type === 'webhook'
          ? { ...connector.config, _connectorId: connectorId }
          : connector.config;
      const externalRecords = await impl.fetchRecords(fetchConfig);
      result.recordsFetched = externalRecords.length;

      const fieldMapping: FieldMapping[] = Array.isArray(connector.field_mapping)
        ? connector.field_mapping
        : [];

      if (fieldMapping.length === 0) {
        throw new Error('No field mapping configured for connector');
      }

      const batches: ExternalRecord[][] = [];
      for (let i = 0; i < externalRecords.length; i += IMPORT_BATCH_SIZE) {
        batches.push(externalRecords.slice(i, i + IMPORT_BATCH_SIZE));
      }

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        const records: Array<{ data: Record<string, unknown> }> = [];

        for (let j = 0; j < batch.length; j++) {
          const ext = batch[j];
          try {
            const mapped = applyFieldMapping(ext.data, fieldMapping);
            records.push({ data: mapped });
          } catch (e) {
            result.recordsSkipped++;
            result.errors.push({
              row: batchIdx * IMPORT_BATCH_SIZE + j + 1,
              error: (e as Error).message,
            });
          }
        }

        if (records.length > 0) {
          try {
            const created = await RecordsService.batchCreate(
              connector.target_table_id,
              records,
              connector.created_by ?? undefined
            );

            const createdIds = (created as Array<{ id: string }>).map((r) => r.id);
            for (let k = 0; k < createdIds.length; k++) {
              const extRecord = batch[k];
              await db.query(
                `INSERT INTO tp_record_provenance (id, record_id, connector_id, source_type, source_id, source_metadata)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  uuidv4(),
                  createdIds[k],
                  connectorId,
                  'connector_sync',
                  extRecord?.externalId ?? null,
                  JSON.stringify({}),
                ]
              );
            }

            result.recordsImported += created.length;
          } catch (e) {
            result.recordsFailed += records.length;
            result.errors.push({
              error: `Batch ${batchIdx + 1} failed: ${(e as Error).message}`,
            });
          }
        }
      }

      if (result.recordsFailed > 0 && result.recordsImported > 0) {
        result.status = 'partial';
      } else if (result.recordsImported === 0 && result.recordsFetched > 0) {
        result.status = 'failed';
      }
    } catch (e) {
      result.status = 'failed';
      result.errors.push({ error: (e as Error).message });
      logger.error('[ConnectorRunner] run failed', {
        connectorId,
        error: (e as Error).message,
      });
    }

    result.durationMs = Date.now() - startTime;

    await db.query(
      `UPDATE tp_connector_runs
       SET status = $2, records_fetched = $3, records_imported = $4,
           records_skipped = $5, records_failed = $6, errors = $7,
           completed_at = NOW(), duration_ms = $8
       WHERE id = $1`,
      [
        runId,
        result.status,
        result.recordsFetched,
        result.recordsImported,
        result.recordsSkipped,
        result.recordsFailed,
        JSON.stringify(result.errors),
        result.durationMs,
      ]
    );

    await db.query(
      `UPDATE tp_connectors SET last_run_at = NOW(), last_run_status = $2, updated_at = NOW()
       WHERE id = $1`,
      [connectorId, result.status]
    );

    return result;
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyFieldMapping(
  sourceData: Record<string, unknown>,
  mapping: FieldMapping[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const m of mapping) {
    const value = sourceData[m.sourceField];
    if (value !== undefined) {
      result[m.targetFieldId] = value;
    }
  }
  return result;
}
