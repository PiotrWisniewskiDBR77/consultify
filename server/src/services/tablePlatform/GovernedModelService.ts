/**
 * Governed Model Service
 * KPI definitions, dimensions, trust flags — the analytics semantic layer.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

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
      const row = (await db.query('SELECT * FROM tp_governed_models WHERE model_id = $1', [modelId])).rows[0];
      return (row ?? { model_id: modelId }) as Record<string, unknown>;
    } catch (e) {
      logger.error('[GovernedModelService] createModel failed', { baseId, error: (e as Error).message });
      throw e;
    }
  },

  async getModel(modelId: string): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    try {
      const modelResult = await db.query('SELECT * FROM tp_governed_models WHERE model_id = $1', [modelId]);
      const model = modelResult.rows[0] as Record<string, unknown> | undefined;
      if (!model) return null;

      const kpis = (await db.query(
        'SELECT * FROM tp_kpi_definitions WHERE model_id = $1 ORDER BY created_at ASC',
        [modelId]
      )).rows;

      const dimensions = (await db.query(
        'SELECT * FROM tp_dimensions WHERE model_id = $1 ORDER BY created_at ASC',
        [modelId]
      )).rows;

      const sources = (await db.query(
        'SELECT * FROM tp_model_sources WHERE model_id = $1 ORDER BY created_at ASC',
        [modelId]
      )).rows;

      model.kpis = kpis;
      model.dimensions = dimensions;
      model.sources = sources;
      return model;
    } catch (e) {
      logger.error('[GovernedModelService] getModel failed', { modelId, error: (e as Error).message });
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
      logger.error('[GovernedModelService] listModels failed', { baseId, error: (e as Error).message });
      throw e;
    }
  },

  async updateModel(
    modelId: string,
    updates: { name?: string; description?: string; status?: string }
  ): Promise<Record<string, unknown> | null> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_governed_models WHERE model_id = $1', [modelId])).rows[0];
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

      const after = (await db.query('SELECT * FROM tp_governed_models WHERE model_id = $1', [modelId])).rows[0];
      return (after ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[GovernedModelService] updateModel failed', { modelId, error: (e as Error).message });
      throw e;
    }
  },

  async deleteModel(modelId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_governed_models WHERE model_id = $1', [modelId])).rows[0];
      if (!before) return false;
      await db.query('DELETE FROM tp_governed_models WHERE model_id = $1', [modelId]);
      return true;
    } catch (e) {
      logger.error('[GovernedModelService] deleteModel failed', { modelId, error: (e as Error).message });
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
      const row = (await db.query('SELECT * FROM tp_kpi_definitions WHERE kpi_id = $1', [kpiId])).rows[0];
      return (row ?? { kpi_id: kpiId }) as Record<string, unknown>;
    } catch (e) {
      logger.error('[GovernedModelService] addKpi failed', { modelId, code: kpi.code, error: (e as Error).message });
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
      logger.error('[GovernedModelService] listKpis failed', { modelId, error: (e as Error).message });
      throw e;
    }
  },

  async removeKpi(kpiId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query('DELETE FROM tp_kpi_definitions WHERE kpi_id = $1', [kpiId]);
      return (result.rowCount ?? 0) > 0;
    } catch (e) {
      logger.error('[GovernedModelService] removeKpi failed', { kpiId, error: (e as Error).message });
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
      const row = (await db.query('SELECT * FROM tp_dimensions WHERE dimension_id = $1', [dimensionId])).rows[0];
      return (row ?? { dimension_id: dimensionId }) as Record<string, unknown>;
    } catch (e) {
      logger.error('[GovernedModelService] addDimension failed', { modelId, name: dim.name, error: (e as Error).message });
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
      logger.error('[GovernedModelService] listDimensions failed', { modelId, error: (e as Error).message });
      throw e;
    }
  },

  async removeDimension(dimensionId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query('DELETE FROM tp_dimensions WHERE dimension_id = $1', [dimensionId]);
      return (result.rowCount ?? 0) > 0;
    } catch (e) {
      logger.error('[GovernedModelService] removeDimension failed', { dimensionId, error: (e as Error).message });
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
      const row = (await db.query(
        'SELECT * FROM tp_model_sources WHERE model_id = $1 AND table_id = $2',
        [modelId, tableId]
      )).rows[0];
      return (row ?? { id }) as Record<string, unknown>;
    } catch (e) {
      logger.error('[GovernedModelService] addModelSource failed', { modelId, tableId, error: (e as Error).message });
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
      logger.error('[GovernedModelService] listModelSources failed', { modelId, error: (e as Error).message });
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
      logger.error('[GovernedModelService] setSourceTrust failed', { id, error: (e as Error).message });
      throw e;
    }
  },

  // ==========================================
  // KPI COMPUTATION
  // ==========================================

  async computeKpi(kpiId: string): Promise<{ kpiId: string; value: number | null; computedAt: string }> {
    const db = getDatabase();
    try {
      const kpiRow = (await db.query('SELECT * FROM tp_kpi_definitions WHERE kpi_id = $1', [kpiId])).rows[0] as Record<string, unknown> | undefined;
      if (!kpiRow) {
        throw new Error(`KPI ${kpiId} not found`);
      }

      const formulaType = kpiRow.formula_type as string;
      const sourceTableId = kpiRow.source_table_id as string | null;
      const sourceFieldId = kpiRow.source_field_id as string | null;

      let value: number | null = null;

      if (formulaType === 'field_sum' && sourceTableId && sourceFieldId) {
        const result = await db.query(
          `SELECT SUM((data->>$2)::numeric) AS val FROM tp_records WHERE table_id = $1`,
          [sourceTableId, sourceFieldId]
        );
        value = result.rows[0]?.val != null ? Number(result.rows[0].val) : null;
      } else if (formulaType === 'field_avg' && sourceTableId && sourceFieldId) {
        const result = await db.query(
          `SELECT AVG((data->>$2)::numeric) AS val FROM tp_records WHERE table_id = $1`,
          [sourceTableId, sourceFieldId]
        );
        value = result.rows[0]?.val != null ? Number(result.rows[0].val) : null;
      } else if (formulaType === 'field_count' && sourceTableId) {
        const result = await db.query(
          'SELECT COUNT(*) AS val FROM tp_records WHERE table_id = $1',
          [sourceTableId]
        );
        value = Number(result.rows[0]?.val ?? 0);
      } else if (formulaType === 'expression') {
        value = 0;
      } else if (formulaType === 'canonical_line') {
        value = 0;
      }

      return { kpiId, value, computedAt: new Date().toISOString() };
    } catch (e) {
      logger.error('[GovernedModelService] computeKpi failed', { kpiId, error: (e as Error).message });
      throw e;
    }
  },
};

export default governedModelService;
