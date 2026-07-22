/**
 * Table Platform Migration Service
 * Converts legacy workspace graph (extensions.table + nodes) into the new table platform format
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import AuditService from './AuditService.js';
import MetadataService from './MetadataService.js';
import RecordsService from './RecordsService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LegacyColumn {
  key: string;
  header: string;
  type: string;
  visible?: boolean;
  width?: number;
  options?: string[];
  optionColors?: Record<string, string>;
  formula?: string;
  aiPrompt?: string;
  aggregation?: string;
}

export interface LegacyView {
  id: string;
  name: string;
  sort?: unknown;
  filters?: unknown;
  groupBy?: string;
  layout?: string;
  columns?: unknown[];
}

export interface LegacyNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  position?: unknown;
}

export interface LegacyGraph {
  nodes: LegacyNode[];
  edges: Array<{ id: string; source: string; target: string }>;
  extensions?: {
    table?: {
      columns: LegacyColumn[];
      views?: LegacyView[];
      activeViewId?: string;
      viewState?: { sort?: unknown; filters?: unknown; groupBy?: string };
      formatting?: unknown[];
    };
  };
}

export interface MigrationResult {
  success: boolean;
  baseId: string;
  tableId: string;
  fieldsMigrated: number;
  recordsMigrated: number;
  viewsMigrated: number;
  warnings: string[];
  fieldMapping: Record<string, string>;
}

export interface ValidationResult {
  valid: boolean;
  legacyNodeCount: number;
  newRecordCount: number;
  legacyColumnCount: number;
  newFieldCount: number;
  discrepancies: string[];
}

export interface FieldMappingEntry {
  name: string;
  fieldType: string;
  legacyKey: string;
  options?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 10;

// Map legacy column types to TP field types (snake_case for MetadataService)
const LEGACY_TYPE_TO_TP: Record<string, string> = {
  text: 'single_line_text',
  number: 'number',
  date: 'date',
  select: 'single_select',
  multiselect: 'multi_select',
  checkbox: 'checkbox',
  url: 'url',
  email: 'email',
  rating: 'number',
  formula: 'single_line_text',
  progress: 'percent',
  currency: 'currency',
  phone: 'phone',
  relation: 'single_line_text',
  default: 'single_line_text',
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const migrationService = {
  /**
   * Build field mapping from legacy columns to TP field definitions.
   *
   * `nodes` (optional): realne dane wierszy. Legacy kolumny typu number/currency
   * często niosą wolny tekst („2.4 mln PLN", „800 km") — RecordsService.createRecord
   * waliduje typy, więc optymistyczne mapowanie wywracało cały batch
   * („Record validation failed", workspace idea-1783507968242, 2026-07-22).
   * Gdy jakakolwiek niepusta wartość kolumny nie parsuje się jako liczba,
   * degradujemy typ do single_line_text — zero utraty danych.
   */
  buildFieldMapping(legacyColumns: LegacyColumn[], nodes?: LegacyNode[]): FieldMappingEntry[] {
    if (!Array.isArray(legacyColumns) || legacyColumns.length === 0) {
      return [];
    }
    const NUMERIC_TP = new Set(['number', 'currency', 'percent']);
    const columnHasNonNumericData = (key: string): boolean => {
      if (!Array.isArray(nodes) || nodes.length === 0) return false;
      return nodes.some((n) => {
        const v = n?.data?.[key];
        if (v === undefined || v === null || v === '') return false;
        return Number.isNaN(Number(String(v).replace(',', '.')));
      });
    };
    return legacyColumns.map((col) => {
      const legacyType = (col.type || 'default').toLowerCase();
      let fieldType = LEGACY_TYPE_TO_TP[legacyType] ?? 'single_line_text';
      if (NUMERIC_TP.has(fieldType) && columnHasNonNumericData(col.key)) {
        fieldType = 'single_line_text';
      }
      const options: Record<string, unknown> = {};
      if (col.options?.length && ['single_select', 'multi_select'].includes(fieldType)) {
        options.choices = col.options.map((opt, i) => ({
          id: `opt-${i}`,
          label: opt,
          color: col.optionColors?.[opt] ?? undefined,
        }));
      }
      return {
        name: col.header || col.key || 'Unnamed',
        fieldType,
        legacyKey: col.key,
        options: Object.keys(options).length ? options : undefined,
      };
    });
  },

  /**
   * Convert a legacy node to a record payload using field mapping
   */
  convertNodeToRecord(
    node: LegacyNode,
    fieldMapping: Map<string, string>
  ): Record<string, unknown> {
    const data = node.data ?? {};
    const record: Record<string, unknown> = {};

    for (const [legacyKey, fieldId] of fieldMapping) {
      let value: unknown;
      if (legacyKey === 'label' || legacyKey === 'title') {
        value = data.label ?? data.title ?? data[legacyKey];
      } else {
        value = data[legacyKey];
      }
      if (value !== undefined && value !== null) {
        record[fieldId] = value;
      }
    }

    return record;
  },

  /**
   * Migrate a legacy workspace graph into the new table platform
   */
  async migrateWorkspace(
    workspaceId: string,
    orgId: string,
    graph: LegacyGraph,
    migratedBy?: string
  ): Promise<MigrationResult> {
    const warnings: string[] = [];
    const fieldMapping: Record<string, string> = {};

    const columns = graph.extensions?.table?.columns ?? [];
    const views = graph.extensions?.table?.views ?? [];
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];

    logger.info('[MigrationService] migrateWorkspace starting', {
      workspaceId,
      orgId,
      columnCount: columns.length,
      viewCount: views.length,
      nodeCount: nodes.length,
    });

    // Edge case: empty graph
    if (columns.length === 0 && nodes.length === 0) {
      warnings.push('Empty graph: no columns and no nodes. Creating minimal base and table.');
    }

    // 1. Create base
    const base = await MetadataService.createBase(
      workspaceId,
      orgId,
      `Migrated from workspace ${workspaceId}`,
      migratedBy
    );
    if (!base) {
      throw new Error('Failed to create base');
    }
    const baseId = (base as { id: string }).id;

    // 2. Create table (creates default "Name" field and Grid view)
    const table = await MetadataService.createTable(
      baseId,
      'Migrated table',
      `Migrated from workspace ${workspaceId}`,
      migratedBy
    );
    if (!table) {
      throw new Error('Failed to create table');
    }
    const tableId = (table as { id: string }).id;
    const primaryFieldId = (table as { primary_field_id?: string }).primary_field_id;
    const existingFields = (table as { fields?: Array<{ id: string; name: string }> }).fields ?? [];

    // 3. Build field mapping and create fields
    const mappingEntries = this.buildFieldMapping(columns, nodes);
    let fieldsMigrated = 0;

    if (mappingEntries.length > 0) {
      const firstEntry = mappingEntries[0];
      if (primaryFieldId && existingFields.length > 0) {
        await MetadataService.updateField(primaryFieldId, { name: firstEntry.name });
        fieldMapping[firstEntry.legacyKey] = primaryFieldId;
        fieldMapping['label'] = primaryFieldId;
        fieldMapping['title'] = primaryFieldId;
        fieldsMigrated++;
      }

      for (let i = 1; i < mappingEntries.length; i++) {
        const entry = mappingEntries[i];
        const field = await MetadataService.createField(
          tableId,
          entry.name,
          entry.fieldType,
          entry.options,
          migratedBy
        );
        if (field) {
          fieldMapping[entry.legacyKey] = (field as { id: string }).id;
          fieldsMigrated++;
        }
      }
    } else if (primaryFieldId) {
      fieldMapping['label'] = primaryFieldId;
      fieldMapping['title'] = primaryFieldId;
      fieldsMigrated = 1;
    }

    const mappingMap = new Map<string, string>(Object.entries(fieldMapping));

    // 4. Create views (beyond the default Grid view)
    let viewsMigrated = 0;
    const allFieldIds = Object.values(fieldMapping);
    const defaultViewId = (table as { views?: Array<{ id: string }> }).views?.[0]?.id;
    if (defaultViewId && allFieldIds.length > 0) {
      await MetadataService.updateView(defaultViewId, {
        visibleFieldIds: allFieldIds,
      });
    }

    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      if (!v?.id || !v?.name) continue;
      try {
        const viewConfig: Record<string, unknown> = {};
        if (v.sort) viewConfig.sort = v.sort;
        if (v.filters) viewConfig.filters = v.filters;
        if (v.groupBy) viewConfig.groupBy = v.groupBy;
        if (v.layout) viewConfig.layout = v.layout;

        const view = await MetadataService.createView(
          tableId,
          v.name,
          (v.layout as string) ?? 'grid',
          viewConfig,
          migratedBy
        );
        if (view) {
          await MetadataService.updateView((view as { id: string }).id, {
            visibleFieldIds: allFieldIds.length > 0 ? allFieldIds : [primaryFieldId!],
          });
          viewsMigrated++;
        }
      } catch (e) {
        warnings.push(`Failed to migrate view "${v.name}": ${(e as Error).message}`);
        logger.warn('[MigrationService] view migration failed', {
          view: v.name,
          error: (e as Error).message,
        });
      }
    }

    // 5. Batch-create records
    let recordsMigrated = 0;
    const tableNodes = nodes.filter((n) => n?.type && n?.data);
    for (let i = 0; i < tableNodes.length; i += BATCH_SIZE) {
      const chunk = tableNodes.slice(i, i + BATCH_SIZE);
      const batchRecords = chunk.map((node) => ({
        data: this.convertNodeToRecord(node, mappingMap),
      }));
      try {
        const created = await RecordsService.batchCreate(tableId, batchRecords, migratedBy);
        recordsMigrated += created.length;
      } catch (e) {
        logger.error('[MigrationService] batch create failed', {
          chunkStart: i,
          error: (e as Error).message,
        });
        warnings.push(`Record batch at offset ${i} failed: ${(e as Error).message}`);
      }
    }

    if (tableNodes.length > 0 && recordsMigrated < tableNodes.length) {
      warnings.push(
        `Migrated ${recordsMigrated} of ${tableNodes.length} records; some batches may have failed`
      );
    }

    logger.info('[MigrationService] migrateWorkspace completed', {
      baseId,
      tableId,
      fieldsMigrated,
      recordsMigrated,
      viewsMigrated,
      warningCount: warnings.length,
    });

    return {
      success: warnings.filter((w) => w.includes('failed')).length === 0,
      baseId,
      tableId,
      fieldsMigrated,
      recordsMigrated,
      viewsMigrated,
      warnings,
      fieldMapping,
    };
  },

  /**
   * Validate that migrated data matches legacy
   */
  async validateMigration(
    workspaceId: string,
    baseId: string,
    graph?: LegacyGraph
  ): Promise<ValidationResult> {
    const discrepancies: string[] = [];
    let legacyNodeCount = 0;
    let legacyColumnCount = 0;

    if (graph) {
      legacyNodeCount = Array.isArray(graph.nodes) ? graph.nodes.length : 0;
      legacyColumnCount = graph.extensions?.table?.columns?.length ?? 0;
    } else {
      discrepancies.push(
        'Legacy graph not provided; pass graph in request body for full validation'
      );
    }

    const db = getDatabase();
    let newRecordCount = 0;
    let newFieldCount = 0;

    try {
      const baseResult = await db.query('SELECT id, workspace_id FROM tp_bases WHERE id = $1', [
        baseId,
      ]);
      const base = baseResult.rows[0];
      if (!base) {
        return {
          valid: false,
          legacyNodeCount,
          newRecordCount: 0,
          legacyColumnCount,
          newFieldCount: 0,
          discrepancies: ['Base not found'],
        };
      }

      const tablesResult = await db.query('SELECT id FROM tp_tables WHERE base_id = $1', [baseId]);
      const tableIds = (tablesResult.rows as Array<{ id: string }>).map((r) => r.id);

      for (const tid of tableIds) {
        const recCountResult = await db.query(
          'SELECT COUNT(*) AS cnt FROM tp_records WHERE table_id = $1',
          [tid]
        );
        newRecordCount += parseInt(
          String((recCountResult.rows[0] as { cnt: string })?.cnt ?? 0),
          10
        );

        const fieldCountResult = await db.query(
          'SELECT COUNT(*) AS cnt FROM tp_fields WHERE table_id = $1',
          [tid]
        );
        newFieldCount += parseInt(
          String((fieldCountResult.rows[0] as { cnt: string })?.cnt ?? 0),
          10
        );
      }

      if (graph) {
        if (legacyNodeCount !== newRecordCount) {
          discrepancies.push(
            `Record count mismatch: legacy ${legacyNodeCount} vs new ${newRecordCount}`
          );
        }
        const expectedFields = Math.max(legacyColumnCount, 1);
        if (Math.abs(legacyColumnCount - newFieldCount) > 1) {
          discrepancies.push(
            `Field count mismatch: legacy ${legacyColumnCount} vs new ${newFieldCount}`
          );
        }
      }
    } catch (e) {
      discrepancies.push(`Validation query failed: ${(e as Error).message}`);
    }

    return {
      valid: discrepancies.length === 0,
      legacyNodeCount,
      newRecordCount,
      legacyColumnCount,
      newFieldCount,
      discrepancies,
    };
  },

  /**
   * Roll back a migration by deleting the base (CASCADE removes tables, fields, views, records)
   */
  async rollbackMigration(baseId: string, rolledBackBy?: string): Promise<void> {
    const db = getDatabase();
    try {
      const baseResult = await db.query('SELECT * FROM tp_bases WHERE id = $1', [baseId]);
      const base = baseResult.rows[0];
      if (!base) {
        logger.warn('[MigrationService] rollbackMigration: base not found', { baseId });
        return;
      }

      await db.query('DELETE FROM tp_bases WHERE id = $1', [baseId]);
      await AuditService.logEvent('delete', 'base', baseId, rolledBackBy, base, undefined, {
        reason: 'migration_rollback',
      });
      logger.info('[MigrationService] rollbackMigration completed', {
        baseId,
        rolledBackBy,
      });
    } catch (e) {
      logger.error('[MigrationService] rollbackMigration failed', {
        baseId,
        error: (e as Error).message,
      });
      throw e;
    }
  },
};

export default migrationService;
