/**
 * Governed Model Service
 * KPI definitions, dimensions, trust flags — the analytics semantic layer.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import { evaluateFormula, extractFieldDependencies, parseFormula } from './formulaEngine.js';

interface KpiDefinition {
  code: string;
  labelEn: string;
  labelPl?: string;
  formulaType: 'field_sum' | 'field_avg' | 'field_count' | 'expression' | 'canonical_line';
  formulaConfig?: Record<string, unknown>;
  sourceTableId?: string;
  sourceFieldId?: string;
  unit?: string;
  format?: string;
}

interface DimensionDefinition {
  name: string;
  sourceTableId?: string;
  sourceFieldId?: string;
  dimensionType?: 'categorical' | 'temporal' | 'hierarchical';
}

const governedModelService = {
  async createModel(
    baseId: string,
    name: string,
    description?: string,
    createdBy?: string
  ): Promise<Record<string, unknown>> {
    const db = getDatabase();
    const modelId = uuidv4();
    try {
      await db.query(
        `INSERT INTO tp_governed_models (model_id, base_id, name, description, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [modelId, baseId, name, description ?? null, createdBy ?? null]
      );
      const row = (
        await db.query('SELECT * FROM tp_governed_models WHERE model_id = $1', [modelId])
      ).rows[0];
      return (row ?? { model_id: modelId }) as Record<string, unknown>;
    } catch (e) {
      logger.error('[GovernedModelService] createModel failed', {
        baseId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getModel(modelId: string): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    try {
      const modelResult = await db.query('SELECT * FROM tp_governed_models WHERE model_id = $1', [
        modelId,
      ]);
      const model = modelResult.rows[0] as Record<string, unknown> | undefined;
      if (!model) return null;

      const kpis = (
        await db.query(
          'SELECT * FROM tp_kpi_definitions WHERE model_id = $1 ORDER BY created_at ASC',
          [modelId]
        )
      ).rows;

      const dimensions = (
        await db.query('SELECT * FROM tp_dimensions WHERE model_id = $1 ORDER BY created_at ASC', [
          modelId,
        ])
      ).rows;

      const sources = (
        await db.query(
          'SELECT * FROM tp_model_sources WHERE model_id = $1 ORDER BY created_at ASC',
          [modelId]
        )
      ).rows;

      model.kpis = kpis;
      model.dimensions = dimensions;
      model.sources = sources;
      return model;
    } catch (e) {
      logger.error('[GovernedModelService] getModel failed', {
        modelId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async listModels(baseId: string): Promise<unknown[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'SELECT * FROM tp_governed_models WHERE base_id = $1 ORDER BY created_at ASC',
        [baseId]
      );
      return result.rows;
    } catch (e) {
      logger.error('[GovernedModelService] listModels failed', {
        baseId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async updateModel(
    modelId: string,
    updates: { name?: string; description?: string; status?: string }
  ): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    try {
      const before = (
        await db.query('SELECT * FROM tp_governed_models WHERE model_id = $1', [modelId])
      ).rows[0];
      if (!before) return null;

      const setClauses: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${idx++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClauses.push(`description = $${idx++}`);
        values.push(updates.description);
      }
      if (updates.status !== undefined) {
        setClauses.push(`status = $${idx++}`);
        values.push(updates.status);
      }
      if (setClauses.length === 0) return before as Record<string, unknown>;

      setClauses.push('updated_at = NOW()');
      values.push(modelId);
      await db.query(
        `UPDATE tp_governed_models SET ${setClauses.join(', ')} WHERE model_id = $${idx}`,
        values
      );

      const after = (
        await db.query('SELECT * FROM tp_governed_models WHERE model_id = $1', [modelId])
      ).rows[0];
      return (after ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[GovernedModelService] updateModel failed', {
        modelId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async deleteModel(modelId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const before = (
        await db.query('SELECT * FROM tp_governed_models WHERE model_id = $1', [modelId])
      ).rows[0];
      if (!before) return false;
      await db.query('DELETE FROM tp_governed_models WHERE model_id = $1', [modelId]);
      return true;
    } catch (e) {
      logger.error('[GovernedModelService] deleteModel failed', {
        modelId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  // ==========================================
  // KPI DEFINITIONS
  // ==========================================

  async addKpi(modelId: string, kpi: KpiDefinition): Promise<Record<string, unknown>> {
    const db = getDatabase();
    const kpiId = uuidv4();
    try {
      await db.query(
        `INSERT INTO tp_kpi_definitions
         (kpi_id, model_id, code, label_en, label_pl, formula_type, formula_config, source_table_id, source_field_id, unit, format)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          kpiId,
          modelId,
          kpi.code,
          kpi.labelEn,
          kpi.labelPl ?? null,
          kpi.formulaType,
          JSON.stringify(kpi.formulaConfig ?? {}),
          kpi.sourceTableId ?? null,
          kpi.sourceFieldId ?? null,
          kpi.unit ?? null,
          kpi.format ?? 'number',
        ]
      );
      const row = (await db.query('SELECT * FROM tp_kpi_definitions WHERE kpi_id = $1', [kpiId]))
        .rows[0];
      return (row ?? { kpi_id: kpiId }) as Record<string, unknown>;
    } catch (e) {
      logger.error('[GovernedModelService] addKpi failed', {
        modelId,
        code: kpi.code,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async listKpis(modelId: string): Promise<unknown[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'SELECT * FROM tp_kpi_definitions WHERE model_id = $1 ORDER BY created_at ASC',
        [modelId]
      );
      return result.rows;
    } catch (e) {
      logger.error('[GovernedModelService] listKpis failed', {
        modelId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async removeKpi(kpiId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query('DELETE FROM tp_kpi_definitions WHERE kpi_id = $1', [kpiId]);
      return (result.rowCount ?? 0) > 0;
    } catch (e) {
      logger.error('[GovernedModelService] removeKpi failed', {
        kpiId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  // ==========================================
  // DIMENSIONS
  // ==========================================

  async addDimension(modelId: string, dim: DimensionDefinition): Promise<Record<string, unknown>> {
    const db = getDatabase();
    const dimensionId = uuidv4();
    try {
      await db.query(
        `INSERT INTO tp_dimensions (dimension_id, model_id, name, source_table_id, source_field_id, dimension_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          dimensionId,
          modelId,
          dim.name,
          dim.sourceTableId ?? null,
          dim.sourceFieldId ?? null,
          dim.dimensionType ?? 'categorical',
        ]
      );
      const row = (
        await db.query('SELECT * FROM tp_dimensions WHERE dimension_id = $1', [dimensionId])
      ).rows[0];
      return (row ?? { dimension_id: dimensionId }) as Record<string, unknown>;
    } catch (e) {
      logger.error('[GovernedModelService] addDimension failed', {
        modelId,
        name: dim.name,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async listDimensions(modelId: string): Promise<unknown[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'SELECT * FROM tp_dimensions WHERE model_id = $1 ORDER BY created_at ASC',
        [modelId]
      );
      return result.rows;
    } catch (e) {
      logger.error('[GovernedModelService] listDimensions failed', {
        modelId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async removeDimension(dimensionId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query('DELETE FROM tp_dimensions WHERE dimension_id = $1', [
        dimensionId,
      ]);
      return (result.rowCount ?? 0) > 0;
    } catch (e) {
      logger.error('[GovernedModelService] removeDimension failed', {
        dimensionId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  // ==========================================
  // MODEL SOURCES (trust flags)
  // ==========================================

  async addModelSource(
    modelId: string,
    tableId: string,
    trusted = false,
    requiredProvenance?: string
  ): Promise<Record<string, unknown>> {
    const db = getDatabase();
    const id = uuidv4();
    try {
      await db.query(
        `INSERT INTO tp_model_sources (id, model_id, table_id, trusted, required_provenance)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (model_id, table_id) DO UPDATE SET trusted = EXCLUDED.trusted, required_provenance = EXCLUDED.required_provenance`,
        [id, modelId, tableId, trusted, requiredProvenance ?? null]
      );
      const row = (
        await db.query('SELECT * FROM tp_model_sources WHERE model_id = $1 AND table_id = $2', [
          modelId,
          tableId,
        ])
      ).rows[0];
      return (row ?? { id }) as Record<string, unknown>;
    } catch (e) {
      logger.error('[GovernedModelService] addModelSource failed', {
        modelId,
        tableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async listModelSources(modelId: string): Promise<unknown[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT ms.*, t.name AS table_name
         FROM tp_model_sources ms
         LEFT JOIN tp_tables t ON t.id = ms.table_id
         WHERE ms.model_id = $1
         ORDER BY ms.created_at ASC`,
        [modelId]
      );
      return result.rows;
    } catch (e) {
      logger.error('[GovernedModelService] listModelSources failed', {
        modelId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async setSourceTrust(id: string, trusted: boolean): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'UPDATE tp_model_sources SET trusted = $2 WHERE id = $1 RETURNING *',
        [id, trusted]
      );
      return (result.rows[0] ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[GovernedModelService] setSourceTrust failed', {
        id,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  // ==========================================
  // KPI COMPUTATION
  // ==========================================

  async computeKpi(
    kpiId: string
  ): Promise<{ kpiId: string; value: number | null; computedAt: string }> {
    try {
      const value = await computeKpiValue(kpiId, new Set<string>());
      return { kpiId, value, computedAt: new Date().toISOString() };
    } catch (e) {
      logger.error('[GovernedModelService] computeKpi failed', {
        kpiId,
        error: (e as Error).message,
      });
      throw e;
    }
  },
};

/**
 * Core KPI evaluator. Separated from the public `computeKpi` so the
 * `expression` type can recurse into other KPIs while carrying a `visited`
 * set for cycle detection.
 */
async function computeKpiValue(kpiId: string, visited: Set<string>): Promise<number | null> {
  const db = getDatabase();

  const kpiRow = (await db.query('SELECT * FROM tp_kpi_definitions WHERE kpi_id = $1', [kpiId]))
    .rows[0] as Record<string, unknown> | undefined;
  if (!kpiRow) {
    throw new Error(`KPI ${kpiId} not found`);
  }

  const formulaType = kpiRow.formula_type as string;
  const modelId = kpiRow.model_id as string;
  const sourceTableId = kpiRow.source_table_id as string | null;
  const sourceFieldId = kpiRow.source_field_id as string | null;
  const formulaConfig = parseFormulaConfig(kpiRow.formula_config);

  if (formulaType === 'field_sum' && sourceTableId && sourceFieldId) {
    const result = await db.query(
      `SELECT SUM((data->>$2)::numeric) AS val FROM tp_records WHERE table_id = $1`,
      [sourceTableId, sourceFieldId]
    );
    return (result.rows[0] as { val: string | null })?.val != null
      ? Number((result.rows[0] as { val: string }).val)
      : null;
  }

  if (formulaType === 'field_avg' && sourceTableId && sourceFieldId) {
    const result = await db.query(
      `SELECT AVG((data->>$2)::numeric) AS val FROM tp_records WHERE table_id = $1`,
      [sourceTableId, sourceFieldId]
    );
    return (result.rows[0] as { val: string | null })?.val != null
      ? Number((result.rows[0] as { val: string }).val)
      : null;
  }

  if (formulaType === 'field_count' && sourceTableId) {
    const result = await db.query('SELECT COUNT(*) AS val FROM tp_records WHERE table_id = $1', [
      sourceTableId,
    ]);
    return Number((result.rows[0] as { val: string })?.val ?? 0);
  }

  if (formulaType === 'expression') {
    return computeExpressionKpi(kpiId, modelId, formulaConfig, visited);
  }

  if (formulaType === 'canonical_line') {
    return computeCanonicalLineKpi(sourceTableId, sourceFieldId, formulaConfig);
  }

  return null;
}

function parseFormulaConfig(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

/**
 * `expression` KPI: evaluates a formula string that references OTHER KPIs in
 * the SAME governed model by their `code`. Reuses the platform formula engine
 * (parse/evaluate) rather than a new parser — KPI codes are treated as field
 * references, resolved to the recursively-computed value of the sibling KPI.
 *
 * formula_config shape (defensive; the only shape the formula engine supports):
 *   { "expression": "<formula referencing sibling KPI codes>" }
 *   e.g. { "expression": "revenue - cost" } or "(profit / revenue) * 100"
 *
 * Cycle-safe via the `visited` set (self-reference or A→B→A throws).
 * Missing/unparseable expression → null (never a fabricated 0).
 */
async function computeExpressionKpi(
  kpiId: string,
  modelId: string,
  formulaConfig: Record<string, unknown>,
  visited: Set<string>
): Promise<number | null> {
  const expression =
    typeof formulaConfig.expression === 'string'
      ? formulaConfig.expression
      : typeof formulaConfig.formula === 'string'
        ? (formulaConfig.formula as string)
        : null;

  if (!expression || expression.trim().length === 0) {
    logger.warn('[GovernedModelService] expression KPI missing formula_config.expression', {
      kpiId,
    });
    return null;
  }

  if (visited.has(kpiId)) {
    throw new Error(`Circular KPI expression dependency detected at KPI ${kpiId}`);
  }
  visited.add(kpiId);

  const ast = parseFormula(expression);
  const referencedCodes = extractFieldDependencies(ast);

  const db = getDatabase();
  const record: Record<string, unknown> = {};
  const fieldMap = new Map<string, string>();

  for (const code of referencedCodes) {
    const refRow = (
      await db.query('SELECT kpi_id FROM tp_kpi_definitions WHERE model_id = $1 AND code = $2', [
        modelId,
        code,
      ])
    ).rows[0] as { kpi_id: string } | undefined;

    if (!refRow) {
      logger.warn('[GovernedModelService] expression references unknown KPI code', {
        kpiId,
        code,
        modelId,
      });
      record[code] = 0;
      continue;
    }

    // Recurse (shares the visited set → cycles across KPIs are caught).
    const refValue = await computeKpiValue(refRow.kpi_id, visited);
    record[code] = refValue ?? 0;
    fieldMap.set(code, code);
  }

  visited.delete(kpiId);

  const result = evaluateFormula(ast, record, fieldMap);
  if (typeof result === 'number') return Number.isFinite(result) ? result : null;
  if (result === null || result === undefined) return null;
  const coerced = Number(result);
  return Number.isFinite(coerced) ? coerced : null;
}

/**
 * `canonical_line` KPI.
 *
 * DESIGN ASSUMPTION (documented — the enum value is the only spec that shipped
 * in migration 713; no formula_config schema, FE builder, test, or doc pins the
 * semantics). Migration 713 introduces this type ALONGSIDE the trust machinery
 * it adds in the same file: `tp_model_sources.trusted`, `required_provenance`,
 * and `ALTER TABLE tp_record_provenance ADD COLUMN trusted`. "Governed" models
 * exist to compute KPIs over GOVERNED (trusted/canonical) data only. The most
 * defensible interpretation is therefore: an aggregation IDENTICAL to
 * field_sum/avg/count, but restricted to records whose provenance is marked
 * `trusted = true` (the "canonical" / certified line of data). This keeps the
 * computation inside the tablePlatform data model rather than guessing keys into
 * the separate finance `financial_statement_lines` schema.
 *
 * formula_config: { "aggregation": "sum" | "avg" | "count" }  (default "sum")
 * A record counts as canonical iff it has ≥1 provenance row with trusted=true.
 * Returns null when the aggregation cannot be computed (no trusted records for
 * sum/avg) — never a fabricated 0.
 */
async function computeCanonicalLineKpi(
  sourceTableId: string | null,
  sourceFieldId: string | null,
  formulaConfig: Record<string, unknown>
): Promise<number | null> {
  if (!sourceTableId) {
    logger.warn('[GovernedModelService] canonical_line KPI missing source_table_id');
    return null;
  }

  const db = getDatabase();
  const aggregation =
    typeof formulaConfig.aggregation === 'string'
      ? (formulaConfig.aggregation as string).toLowerCase()
      : 'sum';

  // Only records with a trusted provenance row are "canonical".
  const trustedFilter = `r.id IN (SELECT record_id FROM tp_record_provenance WHERE trusted = true)`;

  if (aggregation === 'count') {
    const result = await db.query(
      `SELECT COUNT(*) AS val FROM tp_records r WHERE r.table_id = $1 AND ${trustedFilter}`,
      [sourceTableId]
    );
    return Number((result.rows[0] as { val: string })?.val ?? 0);
  }

  if (!sourceFieldId) {
    logger.warn(
      '[GovernedModelService] canonical_line KPI missing source_field_id for aggregation',
      { aggregation }
    );
    return null;
  }

  const sqlAgg = aggregation === 'avg' ? 'AVG' : 'SUM';
  const result = await db.query(
    `SELECT ${sqlAgg}((r.data->>$2)::numeric) AS val
       FROM tp_records r
      WHERE r.table_id = $1 AND ${trustedFilter}`,
    [sourceTableId, sourceFieldId]
  );
  return (result.rows[0] as { val: string | null })?.val != null
    ? Number((result.rows[0] as { val: string }).val)
    : null;
}

export default governedModelService;
