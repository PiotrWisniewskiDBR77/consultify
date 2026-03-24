/**
 * Schema Drift Detector — compares live source schema against stored mapping
 * and produces a drift report with auto-resolution capabilities.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import type { ExternalSchema, ConnectorRow } from './connectorFramework.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriftField {
  name: string;
  externalType?: string;
  inferredType?: string;
}

export interface TypeChange {
  name: string;
  oldType: string;
  newType: string;
  oldInferred: string;
  newInferred: string;
}

export interface DriftReport {
  hasDrift: boolean;
  added: DriftField[];
  removed: DriftField[];
  typeChanged: TypeChange[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// SchemaDriftDetector
// ---------------------------------------------------------------------------

export class SchemaDriftDetector {
  async detectDrift(
    connectorId: string,
    currentSchema: ExternalSchema
  ): Promise<DriftReport> {
    const db = getDatabase();
    const result = await db.query(
      'SELECT config, field_mapping FROM tp_connectors WHERE id = $1',
      [connectorId]
    );
    const row = result.rows[0] as Pick<ConnectorRow, 'config' | 'field_mapping'> | undefined;
    if (!row) {
      throw new Error(`Connector not found: ${connectorId}`);
    }

    const storedSchema = (row.config as Record<string, unknown>)._lastSchema as ExternalSchema | undefined;
    if (!storedSchema?.tables?.length) {
      await this.storeCurrentSchema(connectorId, currentSchema);
      return {
        hasDrift: false,
        added: [],
        removed: [],
        typeChanged: [],
        timestamp: new Date().toISOString(),
      };
    }

    const storedFields = new Map<string, { externalType: string; inferredType: string }>();
    for (const table of storedSchema.tables) {
      for (const field of table.fields) {
        storedFields.set(field.name, {
          externalType: field.externalType,
          inferredType: field.inferredType,
        });
      }
    }

    const currentFields = new Map<string, { externalType: string; inferredType: string }>();
    for (const table of currentSchema.tables) {
      for (const field of table.fields) {
        currentFields.set(field.name, {
          externalType: field.externalType,
          inferredType: field.inferredType,
        });
      }
    }

    const added: DriftField[] = [];
    const removed: DriftField[] = [];
    const typeChanged: TypeChange[] = [];

    for (const [name, cur] of currentFields) {
      const stored = storedFields.get(name);
      if (!stored) {
        added.push({ name, externalType: cur.externalType, inferredType: cur.inferredType });
      } else if (stored.externalType !== cur.externalType) {
        typeChanged.push({
          name,
          oldType: stored.externalType,
          newType: cur.externalType,
          oldInferred: stored.inferredType,
          newInferred: cur.inferredType,
        });
      }
    }

    for (const [name, stored] of storedFields) {
      if (!currentFields.has(name)) {
        removed.push({ name, externalType: stored.externalType, inferredType: stored.inferredType });
      }
    }

    const hasDrift = added.length > 0 || removed.length > 0 || typeChanged.length > 0;

    await this.storeCurrentSchema(connectorId, currentSchema);

    return {
      hasDrift,
      added,
      removed,
      typeChanged,
      timestamp: new Date().toISOString(),
    };
  }

  async autoResolveDrift(
    connectorId: string,
    drift: DriftReport
  ): Promise<void> {
    const db = getDatabase();
    const result = await db.query(
      'SELECT field_mapping FROM tp_connectors WHERE id = $1',
      [connectorId]
    );
    const row = result.rows[0] as { field_mapping: unknown } | undefined;
    if (!row) return;

    const mapping = Array.isArray(row.field_mapping)
      ? [...(row.field_mapping as Array<Record<string, unknown>>)]
      : [];

    for (const added of drift.added) {
      mapping.push({
        sourceField: added.name,
        targetFieldId: null,
        _status: 'unmapped_new',
        _detectedType: added.inferredType,
      });
    }

    for (const removed of drift.removed) {
      const entry = mapping.find((m) => m.sourceField === removed.name);
      if (entry) {
        entry._status = 'source_removed';
      }
    }

    for (const changed of drift.typeChanged) {
      const entry = mapping.find((m) => m.sourceField === changed.name);
      if (entry) {
        entry._status = 'type_changed';
        entry._oldType = changed.oldType;
        entry._newType = changed.newType;
      }
    }

    await db.query(
      `UPDATE tp_connectors SET field_mapping = $2, updated_at = NOW() WHERE id = $1`,
      [connectorId, JSON.stringify(mapping)]
    );

    logger.info('[SchemaDriftDetector] auto-resolved drift', {
      connectorId,
      added: drift.added.length,
      removed: drift.removed.length,
      typeChanged: drift.typeChanged.length,
    });
  }

  private async storeCurrentSchema(
    connectorId: string,
    schema: ExternalSchema
  ): Promise<void> {
    const db = getDatabase();
    await db.query(
      `UPDATE tp_connectors
       SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{_lastSchema}', $2::jsonb),
           updated_at = NOW()
       WHERE id = $1`,
      [connectorId, JSON.stringify(schema)]
    );
  }
}

export const schemaDriftDetector = new SchemaDriftDetector();
export default schemaDriftDetector;
