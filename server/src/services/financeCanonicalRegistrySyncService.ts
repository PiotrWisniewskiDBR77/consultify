import {
  getCanonicalLineDefinitions,
  getCanonicalLineVersionTag,
} from './financeCanonicalRegistry.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

let syncPromise: Promise<void> | null = null;
let lastVerifiedVersion: string | null = null;

type ColumnRow = { column_name: string };
type CountRow = { count: number };

async function loadSchemaColumns(): Promise<Set<string>> {
  const rows = await dbAll<ColumnRow>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'financial_statement_lines'
     ORDER BY ordinal_position`,
    [],
    { fallback: false }
  );
  return new Set(rows.map((row) => String(row.column_name)));
}

async function loadCurrentCount(): Promise<number> {
  const row = await dbAll<CountRow>(
    `SELECT COUNT(*)::int as count FROM financial_statement_lines`,
    [],
    { fallback: false }
  );
  return Number(row[0]?.count || 0);
}

async function upsertCanonicalLines(columns: Set<string>): Promise<void> {
  const definitions = getCanonicalLineDefinitions();
  const hasExtendedSchema = columns.has('line_name_en');
  const hasAggregationLevel = columns.has('aggregation_level');
  const hasRequiredLevel = columns.has('required_level');
  const hasSignConvention = columns.has('sign_convention');
  const hasTotalFlags = columns.has('is_total') && columns.has('is_subtotal');
  const hasComputed = columns.has('is_computed');
  const hasFormulaJson = columns.has('formula_json');
  const hasDeaggregationReady = columns.has('deaggregation_ready');
  const hasTaxonomyVersion = columns.has('taxonomy_version');
  const hasIsActive = columns.has('is_active');

  for (const line of definitions) {
    if (hasExtendedSchema) {
      const insertColumns = [
        'id',
        'organization_id',
        'statement_type',
        'line_code',
        'line_name',
        'line_name_en',
        'line_name_pl',
        'parent_line_id',
        'sort_order',
        'is_system',
      ];
      const values: unknown[] = [
        line.id,
        null,
        line.statementType,
        line.code,
        line.labelEn,
        line.labelEn,
        line.labelPl,
        line.parentId || null,
        line.sortOrder,
        true,
      ];

      if (hasAggregationLevel) {
        insertColumns.push('aggregation_level');
        values.push(line.aggregationLevel);
      }
      if (hasRequiredLevel) {
        insertColumns.push('required_level');
        values.push(line.requiredLevel);
      }
      if (hasSignConvention) {
        insertColumns.push('sign_convention');
        values.push(line.signConvention);
      }
      if (hasTotalFlags) {
        insertColumns.push('is_total', 'is_subtotal');
        values.push(Boolean(line.isTotal), Boolean(line.isSubtotal));
      }
      if (hasComputed) {
        insertColumns.push('is_computed');
        values.push(Boolean(line.isComputed));
      }
      if (hasFormulaJson) {
        insertColumns.push('formula_json');
        values.push(line.formulaJson ? JSON.stringify(line.formulaJson) : null);
      }
      if (hasDeaggregationReady) {
        insertColumns.push('deaggregation_ready');
        values.push(Boolean(line.deaggregationReady));
      }
      if (hasTaxonomyVersion) {
        insertColumns.push('taxonomy_version');
        values.push(getCanonicalLineVersionTag());
      }
      if (hasIsActive) {
        insertColumns.push('is_active');
        values.push(true);
      }

      const placeholders = insertColumns.map(() => '?').join(', ');
      const updates = [
        'statement_type = EXCLUDED.statement_type',
        'line_code = EXCLUDED.line_code',
        'line_name = EXCLUDED.line_name',
        'line_name_en = EXCLUDED.line_name_en',
        'line_name_pl = EXCLUDED.line_name_pl',
        'parent_line_id = EXCLUDED.parent_line_id',
        'sort_order = EXCLUDED.sort_order',
        'is_system = TRUE',
      ];
      if (hasAggregationLevel) updates.push('aggregation_level = EXCLUDED.aggregation_level');
      if (hasRequiredLevel) updates.push('required_level = EXCLUDED.required_level');
      if (hasSignConvention) updates.push('sign_convention = EXCLUDED.sign_convention');
      if (hasTotalFlags) {
        updates.push('is_total = EXCLUDED.is_total', 'is_subtotal = EXCLUDED.is_subtotal');
      }
      if (hasComputed) updates.push('is_computed = EXCLUDED.is_computed');
      if (hasFormulaJson) updates.push('formula_json = EXCLUDED.formula_json');
      if (hasDeaggregationReady) updates.push('deaggregation_ready = EXCLUDED.deaggregation_ready');
      if (hasTaxonomyVersion) updates.push('taxonomy_version = EXCLUDED.taxonomy_version');
      if (hasIsActive) updates.push('is_active = TRUE');

      await dbRun(
        `INSERT INTO financial_statement_lines (${insertColumns.join(', ')})
         VALUES (${placeholders})
         ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}`,
        values,
        { fallback: false }
      );
      continue;
    }

    await dbRun(
      `INSERT INTO financial_statement_lines (
        id, organization_id, statement_type, line_code, line_name, line_name_pl, parent_line_id, sort_order, is_system
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        statement_type = EXCLUDED.statement_type,
        line_code = EXCLUDED.line_code,
        line_name = EXCLUDED.line_name,
        line_name_pl = EXCLUDED.line_name_pl,
        parent_line_id = EXCLUDED.parent_line_id,
        sort_order = EXCLUDED.sort_order,
        is_system = TRUE`,
      [
        line.id,
        null,
        line.statementType,
        line.code,
        line.labelEn,
        line.labelPl,
        line.parentId || null,
        line.sortOrder,
        true,
      ],
      { fallback: false }
    );
  }
}

async function performSync(): Promise<void> {
  const version = getCanonicalLineVersionTag();
  if (lastVerifiedVersion === version) return;

  const definitions = getCanonicalLineDefinitions();
  const columns = await loadSchemaColumns();
  const currentCount = await loadCurrentCount();
  if (currentCount >= definitions.length) {
    lastVerifiedVersion = version;
    return;
  }

  logger.info('[FinanceCanonicalRegistrySync] Syncing canonical line definitions', {
    currentCount,
    expectedCount: definitions.length,
    version,
  });
  await upsertCanonicalLines(columns);
  const finalCount = await loadCurrentCount();
  lastVerifiedVersion = version;
  logger.info('[FinanceCanonicalRegistrySync] Sync complete', {
    currentCount: finalCount,
    version,
  });
}

export async function ensureCanonicalRegistryInDatabase(): Promise<void> {
  if (syncPromise) {
    await syncPromise;
    return;
  }
  syncPromise = performSync().finally(() => {
    syncPromise = null;
  });
  await syncPromise;
}
