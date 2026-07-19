/**
 * Finance Enterprise Service (V4-FINC-01 through V4-FINC-07)
 *
 * V4-FINC-01: Model versioning + scenario engine (branch/compare/merge)
 * V4-FINC-02: Multi-dimensional planning (dimensions, allocations, consolidation)
 * V4-FINC-03: Rolling forecast (budget versions, forecast cycles, variance alerts, approval gates)
 * V4-FINC-04: Excel/ERP connectors (bidirectional sync, reconciliation, provenance)
 * V4-FINC-05: Valuation audit trail (versioning, diff, assumptions audit)
 * V4-FINC-06: AI assumptions with citations + eval harness
 * V4-FINC-07: Finance → ROI link (assumptions from financial model, realized capture with evidence)
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as queryHelpers from '../utils/queryHelpers.js';

// ============================================================
// Types
// ============================================================

export interface ModelVersion {
  id: string;
  modelId: string;
  versionNumber: number;
  parentVersionId: string | null;
  scenarioLabel: string;
  status: string;
  createdBy: string;
  createdAt: string;
}

export interface Dimension {
  id: string;
  dimensionName: string;
  dimensionType: string;
  hierarchy: unknown[];
}

export interface BudgetVersion {
  id: string;
  modelId: string;
  budgetType: string;
  fiscalYear: number;
  versionLabel: string;
  plannedData: Record<string, unknown>;
  actualData: Record<string, unknown>;
  varianceData: Record<string, unknown>;
  status: string;
}

export interface Connector {
  id: string;
  connectorType: string;
  name: string;
  config: Record<string, unknown>;
  syncDirection: string;
  lastSyncAt: string | null;
  lastSyncStatus: string;
}

export interface ValuationSnapshot {
  id: string;
  modelId: string;
  valuationMethod: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  version: number;
  createdBy: string;
  createdAt: string;
}

export interface AIAssumption {
  id: string;
  modelId: string;
  assumptionKey: string;
  assumptionValue: string;
  confidence: number;
  sourceCitations: unknown[];
  status: string;
}

export interface ROILink {
  id: string;
  modelId: string;
  initiativeId: string | null;
  benefitId: string | null;
  realizedValue: number | null;
  linkStatus: string;
}

// ============================================================
// Service
// ============================================================

class FinanceEnterpriseService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) this.db = await getDatabase();
    return this.db;
  }

  /**
   * SEC: verify the parent financial model belongs to the caller's org before
   * any child-row write (budget/allocation/forecast/valuation/assumption/ROI).
   * Reads are already org-scoped, but the create* paths previously trusted the
   * route's `modelId` blindly — letting org A graft child rows onto org B's
   * model (integrity / FK-injection). Throws 'Model not found'; the route maps
   * that message → 404 (same convention as resultsEnterpriseService).
   */
  private async assertModelOwned(orgId: string, modelId: string): Promise<void> {
    const owned = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM financial_models WHERE id = ? AND organization_id = ?`,
      [modelId, orgId]
    );
    if (!owned?.id) {
      throw new Error('Model not found');
    }
  }

  // ──────────────────────────────────────────────
  // V4-FINC-01: Model versioning + scenarios
  // ──────────────────────────────────────────────

  async createModelVersion(
    orgId: string,
    userId: string,
    data: { modelId: string; scenarioLabel?: string; parentVersionId?: string }
  ): Promise<ModelVersion> {
    // Parent-model ownership: org-scoped reads below return null for a foreign model,
    // but the INSERT would still graft a version row onto another org's model_id.
    // Mirror the 7 sibling child-writes (assertModelOwned throws 'Model not found').
    await this.assertModelOwned(orgId, data.modelId);

    const id = uuidv4();
    const now = new Date().toISOString();

    const lastVer = await queryHelpers.queryOne<any>(
      `SELECT MAX(version_number) as "maxV" FROM financial_model_versions WHERE organization_id = ? AND model_id = ?`,
      [orgId, data.modelId]
    );
    const versionNumber = (lastVer?.maxV || 0) + 1;

    let assumptionsSnapshot = '{}';
    let eventsSnapshot = '[]';
    let outputsSnapshot = '{}';

    if (data.parentVersionId) {
      const parent = await queryHelpers.queryOne<any>(
        `SELECT assumptions_snapshot, events_snapshot, outputs_snapshot FROM financial_model_versions WHERE id = ? AND organization_id = ?`,
        [data.parentVersionId, orgId]
      );
      if (parent) {
        assumptionsSnapshot = parent.assumptions_snapshot || '{}';
        eventsSnapshot = parent.events_snapshot || '[]';
        outputsSnapshot = parent.outputs_snapshot || '{}';
      }
    } else {
      const model = await queryHelpers.queryOne<any>(
        `SELECT assumptions_json FROM financial_models WHERE id = ? AND organization_id = ?`,
        [data.modelId, orgId]
      );
      if (model) assumptionsSnapshot = model.assumptions_json || '{}';
    }

    // financial_model_versions.version and .snapshot_data are NOT NULL with no
    // DB default — legacy predecessors of version_number and the three
    // *_snapshot columns this method already populates (schema evolved,
    // constraints on the old columns never got relaxed). Reuse the values
    // already computed above rather than inventing new ones: version mirrors
    // version_number, snapshot_data mirrors the combined snapshot JSON.
    const snapshotData = JSON.stringify({
      assumptions: JSON.parse(assumptionsSnapshot || '{}'),
      events: JSON.parse(eventsSnapshot || '[]'),
      outputs: JSON.parse(outputsSnapshot || '{}'),
    });

    await queryHelpers.queryRun(
      `INSERT INTO financial_model_versions
       (id, organization_id, model_id, version, version_number, snapshot_data, parent_version_id, scenario_label, assumptions_snapshot, events_snapshot, outputs_snapshot, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [
        id,
        orgId,
        data.modelId,
        versionNumber,
        versionNumber,
        snapshotData,
        data.parentVersionId || null,
        data.scenarioLabel || 'base',
        assumptionsSnapshot,
        eventsSnapshot,
        outputsSnapshot,
        userId,
        now,
      ]
    );

    return {
      id,
      modelId: data.modelId,
      versionNumber,
      parentVersionId: data.parentVersionId || null,
      scenarioLabel: data.scenarioLabel || 'base',
      status: 'draft',
      createdBy: userId,
      createdAt: now,
    };
  }

  async getModelVersions(orgId: string, modelId: string): Promise<ModelVersion[]> {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM financial_model_versions WHERE organization_id = ? AND model_id = ? ORDER BY version_number DESC`,
        [orgId, modelId]
      )) || [];
    return rows.map(mapModelVersionRow);
  }

  async compareVersions(orgId: string, fromVersionId: string, toVersionId: string) {
    const from = await queryHelpers.queryOne<any>(
      `SELECT * FROM financial_model_versions WHERE id = ? AND organization_id = ?`,
      [fromVersionId, orgId]
    );
    const to = await queryHelpers.queryOne<any>(
      `SELECT * FROM financial_model_versions WHERE id = ? AND organization_id = ?`,
      [toVersionId, orgId]
    );
    if (!from || !to) return null;

    const fromAssumptions = safeJson(from.assumptions_snapshot);
    const toAssumptions = safeJson(to.assumptions_snapshot);

    const changes: Array<{ key: string; from: unknown; to: unknown }> = [];
    const allKeys = new Set([...Object.keys(fromAssumptions), ...Object.keys(toAssumptions)]);
    for (const key of allKeys) {
      if (JSON.stringify(fromAssumptions[key]) !== JSON.stringify(toAssumptions[key])) {
        changes.push({ key, from: fromAssumptions[key], to: toAssumptions[key] });
      }
    }

    return {
      fromVersion: from.version_number,
      toVersion: to.version_number,
      fromScenario: from.scenario_label,
      toScenario: to.scenario_label,
      assumptionChanges: changes,
    };
  }

  async mergeVersion(orgId: string, versionId: string, userId: string): Promise<boolean> {
    const result = await queryHelpers.queryRun(
      `UPDATE financial_model_versions SET status = 'merged', merged_at = ?, merged_by = ? WHERE id = ? AND organization_id = ?`,
      [new Date().toISOString(), userId, versionId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  // ──────────────────────────────────────────────
  // V4-FINC-02: Dimensions + allocations + consolidation
  // ──────────────────────────────────────────────

  async createDimension(
    orgId: string,
    data: { dimensionName: string; dimensionType?: string; hierarchy?: unknown[] }
  ): Promise<Dimension> {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO financial_dimensions (id, organization_id, dimension_name, dimension_type, hierarchy) VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.dimensionName,
        data.dimensionType || 'custom',
        JSON.stringify(data.hierarchy || []),
      ]
    );
    return {
      id,
      dimensionName: data.dimensionName,
      dimensionType: data.dimensionType || 'custom',
      hierarchy: data.hierarchy || [],
    };
  }

  async getDimensions(orgId: string): Promise<Dimension[]> {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM financial_dimensions WHERE organization_id = ? ORDER BY created_at`,
        [orgId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      dimensionName: r.dimension_name,
      dimensionType: r.dimension_type,
      hierarchy: safeJsonArray(r.hierarchy),
    }));
  }

  async createAllocation(
    orgId: string,
    data: {
      modelId: string;
      sourceDimensionId?: string;
      targetDimensionId?: string;
      allocationMethod?: string;
      allocationRules?: Record<string, unknown>;
      amount?: number;
      period?: string;
    }
  ): Promise<{ id: string }> {
    await this.assertModelOwned(orgId, data.modelId);
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO financial_allocations (id, organization_id, model_id, source_dimension_id, target_dimension_id, allocation_method, allocation_rules, amount, period)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.modelId,
        data.sourceDimensionId || null,
        data.targetDimensionId || null,
        data.allocationMethod || 'proportional',
        JSON.stringify(data.allocationRules || {}),
        data.amount || null,
        data.period || null,
      ]
    );
    return { id };
  }

  async getAllocations(orgId: string, modelId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM financial_allocations WHERE organization_id = ? AND model_id = ? ORDER BY created_at`,
        [orgId, modelId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      modelId: r.model_id,
      sourceDimensionId: r.source_dimension_id,
      targetDimensionId: r.target_dimension_id,
      allocationMethod: r.allocation_method,
      allocationRules: safeJson(r.allocation_rules),
      amount: r.amount,
      period: r.period,
    }));
  }

  async createConsolidation(
    orgId: string,
    userId: string,
    data: {
      name: string;
      sourceModelIds: string[];
      consolidationRules?: Record<string, unknown>;
    }
  ): Promise<{ id: string }> {
    // IDOR guard: every source model id must belong to this org before we
    // persist it as a child row — otherwise org A could consolidate org B's
    // models (cross-org FK injection). Loop the same ownership assertion the
    // sibling create* methods use; throws 'Model not found' → route maps 404.
    for (const modelId of data.sourceModelIds) {
      await this.assertModelOwned(orgId, modelId);
    }
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO financial_consolidations (id, organization_id, name, source_model_ids, consolidation_rules, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.name,
        JSON.stringify(data.sourceModelIds),
        JSON.stringify(data.consolidationRules || {}),
        userId,
      ]
    );
    return { id };
  }

  async getConsolidations(orgId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM financial_consolidations WHERE organization_id = ? ORDER BY created_at DESC`,
        [orgId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      sourceModelIds: safeJsonArray(r.source_model_ids),
      consolidationRules: safeJson(r.consolidation_rules),
      resultSnapshot: safeJson(r.result_snapshot),
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
    }));
  }

  // ──────────────────────────────────────────────
  // V4-FINC-03: Rolling forecast + budget + variance
  // ──────────────────────────────────────────────

  async createBudgetVersion(
    orgId: string,
    userId: string,
    data: {
      modelId: string;
      budgetType?: string;
      fiscalYear: number;
      versionLabel?: string;
      plannedData: Record<string, unknown>;
    }
  ): Promise<BudgetVersion> {
    await this.assertModelOwned(orgId, data.modelId);
    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO financial_budget_versions
       (id, organization_id, model_id, budget_type, fiscal_year, version_label, planned_data, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
      [
        id,
        orgId,
        data.modelId,
        data.budgetType || 'annual',
        data.fiscalYear,
        data.versionLabel || 'v1',
        JSON.stringify(data.plannedData),
        userId,
        now,
        now,
      ]
    );
    return {
      id,
      modelId: data.modelId,
      budgetType: data.budgetType || 'annual',
      fiscalYear: data.fiscalYear,
      versionLabel: data.versionLabel || 'v1',
      plannedData: data.plannedData,
      actualData: {},
      varianceData: {},
      status: 'draft',
    };
  }

  async getBudgetVersions(orgId: string, modelId: string): Promise<BudgetVersion[]> {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM financial_budget_versions WHERE organization_id = ? AND model_id = ? ORDER BY fiscal_year DESC, version_label DESC`,
        [orgId, modelId]
      )) || [];
    return rows.map(mapBudgetVersionRow);
  }

  async updateBudgetActuals(
    orgId: string,
    budgetVersionId: string,
    actualData: Record<string, unknown>
  ): Promise<boolean> {
    const budget = await queryHelpers.queryOne<any>(
      `SELECT planned_data FROM financial_budget_versions WHERE id = ? AND organization_id = ?`,
      [budgetVersionId, orgId]
    );
    if (!budget) return false;

    const planned = safeJson(budget.planned_data);
    const variance: Record<string, unknown> = {};
    for (const key of Object.keys(actualData)) {
      const p = Number(planned[key]) || 0;
      const a = Number(actualData[key]) || 0;
      variance[key] = {
        planned: p,
        actual: a,
        delta: a - p,
        pct: p !== 0 ? ((a - p) / Math.abs(p)) * 100 : 0,
      };
    }

    await queryHelpers.queryRun(
      `UPDATE financial_budget_versions SET actual_data = ?, variance_data = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      [
        JSON.stringify(actualData),
        JSON.stringify(variance),
        new Date().toISOString(),
        budgetVersionId,
        orgId,
      ]
    );
    return true;
  }

  async approveBudget(
    orgId: string,
    budgetVersionId: string,
    userId: string
  ): Promise<{ id: string; status: 'approved' } | null> {
    const result = await queryHelpers.queryRun(
      `UPDATE financial_budget_versions SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      [userId, new Date().toISOString(), new Date().toISOString(), budgetVersionId, orgId]
    );
    if ((result?.changes || 0) === 0) return null;
    return { id: budgetVersionId, status: 'approved' };
  }

  async createForecastCycle(
    orgId: string,
    data: {
      modelId: string;
      cycleName: string;
      cycleType?: string;
      forecastHorizonMonths?: number;
    }
  ): Promise<{ id: string }> {
    await this.assertModelOwned(orgId, data.modelId);
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO financial_forecast_cycles (id, organization_id, model_id, cycle_name, cycle_type, forecast_horizon_months)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.modelId,
        data.cycleName,
        data.cycleType || 'monthly',
        data.forecastHorizonMonths || 12,
      ]
    );
    return { id };
  }

  async getVarianceAlerts(orgId: string, budgetVersionId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM financial_variance_alerts WHERE organization_id = ? AND budget_version_id = ? ORDER BY variance_pct DESC`,
        [orgId, budgetVersionId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      lineItem: r.line_item,
      period: r.period,
      plannedAmount: r.planned_amount,
      actualAmount: r.actual_amount,
      variancePct: r.variance_pct,
      severity: r.severity,
      acknowledgedBy: r.acknowledged_by,
      acknowledgedAt: r.acknowledged_at,
    }));
  }

  // ──────────────────────────────────────────────
  // V4-FINC-04: Connectors + sync
  // ──────────────────────────────────────────────

  async createConnector(
    orgId: string,
    userId: string,
    data: {
      connectorType: string;
      name: string;
      config: Record<string, unknown>;
      syncDirection?: string;
    }
  ): Promise<Connector> {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO financial_connectors (id, organization_id, connector_type, name, config, sync_direction, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.connectorType,
        data.name,
        JSON.stringify(data.config),
        data.syncDirection || 'import',
        userId,
      ]
    );
    return {
      id,
      connectorType: data.connectorType,
      name: data.name,
      config: data.config,
      syncDirection: data.syncDirection || 'import',
      lastSyncAt: null,
      lastSyncStatus: 'never',
    };
  }

  async getConnectors(orgId: string): Promise<Connector[]> {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM financial_connectors WHERE organization_id = ? ORDER BY created_at DESC`,
        [orgId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      connectorType: r.connector_type,
      name: r.name,
      config: safeJson(r.config),
      syncDirection: r.sync_direction,
      lastSyncAt: r.last_sync_at,
      lastSyncStatus: r.last_sync_status,
    }));
  }

  async logSync(
    orgId: string,
    connectorId: string,
    data: {
      syncType: string;
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsErrors: number;
      errorDetails?: unknown[];
    }
  ): Promise<{ id: string }> {
    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO financial_sync_log (id, organization_id, connector_id, sync_type, records_processed, records_created, records_updated, records_errors, error_details, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        connectorId,
        data.syncType,
        data.recordsProcessed,
        data.recordsCreated,
        data.recordsUpdated,
        data.recordsErrors,
        JSON.stringify(data.errorDetails || []),
        now,
        now,
      ]
    );

    await queryHelpers.queryRun(
      `UPDATE financial_connectors SET last_sync_at = ?, last_sync_status = ? WHERE id = ? AND organization_id = ?`,
      [now, data.recordsErrors > 0 ? 'error' : 'success', connectorId, orgId]
    );

    return { id };
  }

  async getSyncLog(orgId: string, connectorId: string, limit: number = 20) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM financial_sync_log WHERE organization_id = ? AND connector_id = ? ORDER BY created_at DESC LIMIT ?`,
        [orgId, connectorId, limit]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      syncType: r.sync_type,
      recordsProcessed: r.records_processed,
      recordsCreated: r.records_created,
      recordsUpdated: r.records_updated,
      recordsErrors: r.records_errors,
      errorDetails: safeJsonArray(r.error_details),
      reconciliationStatus: r.reconciliation_status,
      startedAt: r.started_at,
      completedAt: r.completed_at,
    }));
  }

  // ──────────────────────────────────────────────
  // V4-FINC-05: Valuation snapshots + audit
  // ──────────────────────────────────────────────

  async createValuationSnapshot(
    orgId: string,
    userId: string,
    data: {
      modelId: string;
      valuationMethod?: string;
      inputs: Record<string, unknown>;
      outputs: Record<string, unknown>;
    }
  ): Promise<ValuationSnapshot> {
    await this.assertModelOwned(orgId, data.modelId);
    const id = uuidv4();
    const now = new Date().toISOString();
    const assumptionsHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data.inputs))
      .digest('hex')
      .substring(0, 16);

    const lastVer = await queryHelpers.queryOne<any>(
      `SELECT MAX(version) as "maxV" FROM financial_valuation_snapshots WHERE organization_id = ? AND model_id = ?`,
      [orgId, data.modelId]
    );
    const version = (lastVer?.maxV || 0) + 1;

    await queryHelpers.queryRun(
      `INSERT INTO financial_valuation_snapshots (id, organization_id, model_id, valuation_method, assumptions_hash, inputs, outputs, version, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.modelId,
        data.valuationMethod || 'dcf',
        assumptionsHash,
        JSON.stringify(data.inputs),
        JSON.stringify(data.outputs),
        version,
        userId,
        now,
      ]
    );

    await queryHelpers.queryRun(
      `INSERT INTO financial_valuation_audit (id, organization_id, snapshot_id, action, actor_id, change_detail, created_at)
       VALUES (?, ?, ?, 'created', ?, '{}', ?)`,
      [uuidv4(), orgId, id, userId, now]
    );

    return {
      id,
      modelId: data.modelId,
      valuationMethod: data.valuationMethod || 'dcf',
      inputs: data.inputs,
      outputs: data.outputs,
      version,
      createdBy: userId,
      createdAt: now,
    };
  }

  async getValuationSnapshots(orgId: string, modelId: string): Promise<ValuationSnapshot[]> {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM financial_valuation_snapshots WHERE organization_id = ? AND model_id = ? ORDER BY version DESC`,
        [orgId, modelId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      modelId: r.model_id,
      valuationMethod: r.valuation_method,
      inputs: safeJson(r.inputs),
      outputs: safeJson(r.outputs),
      version: r.version,
      createdBy: r.created_by,
      createdAt: r.created_at,
    }));
  }

  async getValuationAudit(orgId: string, snapshotId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM financial_valuation_audit WHERE organization_id = ? AND snapshot_id = ? ORDER BY created_at DESC`,
        [orgId, snapshotId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      action: r.action,
      actorId: r.actor_id,
      changeDetail: safeJson(r.change_detail),
      createdAt: r.created_at,
    }));
  }

  // ──────────────────────────────────────────────
  // V4-FINC-06: AI assumptions
  // ──────────────────────────────────────────────

  async createAIAssumption(
    orgId: string,
    data: {
      modelId: string;
      assumptionKey: string;
      assumptionValue: string;
      confidence?: number;
      sourceCitations?: unknown[];
      aiModelUsed?: string;
    }
  ): Promise<AIAssumption> {
    await this.assertModelOwned(orgId, data.modelId);
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO financial_ai_assumptions (id, organization_id, model_id, assumption_key, assumption_value, confidence, source_citations, ai_model_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.modelId,
        data.assumptionKey,
        data.assumptionValue,
        data.confidence || 0.7,
        JSON.stringify(data.sourceCitations || []),
        data.aiModelUsed || null,
      ]
    );
    return {
      id,
      modelId: data.modelId,
      assumptionKey: data.assumptionKey,
      assumptionValue: data.assumptionValue,
      confidence: data.confidence || 0.7,
      sourceCitations: data.sourceCitations || [],
      status: 'proposed',
    };
  }

  async getAIAssumptions(orgId: string, modelId: string): Promise<AIAssumption[]> {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM financial_ai_assumptions WHERE organization_id = ? AND model_id = ? ORDER BY created_at DESC`,
        [orgId, modelId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      modelId: r.model_id,
      assumptionKey: r.assumption_key,
      assumptionValue: r.assumption_value,
      confidence: r.confidence,
      sourceCitations: safeJsonArray(r.source_citations),
      status: r.status,
    }));
  }

  async acceptAIAssumption(orgId: string, assumptionId: string, userId: string): Promise<boolean> {
    const result = await queryHelpers.queryRun(
      `UPDATE financial_ai_assumptions SET status = 'accepted', accepted_by = ?, accepted_at = ? WHERE id = ? AND organization_id = ?`,
      [userId, new Date().toISOString(), assumptionId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  // ──────────────────────────────────────────────
  // V4-FINC-07: ROI links
  // ──────────────────────────────────────────────

  async createROILink(
    orgId: string,
    data: {
      modelId: string;
      initiativeId?: string;
      benefitId?: string;
      assumptionIds?: string[];
    }
  ): Promise<ROILink> {
    await this.assertModelOwned(orgId, data.modelId);
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO financial_roi_links (id, organization_id, model_id, initiative_id, benefit_id, assumption_ids)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.modelId,
        data.initiativeId || null,
        data.benefitId || null,
        JSON.stringify(data.assumptionIds || []),
      ]
    );
    return {
      id,
      modelId: data.modelId,
      initiativeId: data.initiativeId || null,
      benefitId: data.benefitId || null,
      realizedValue: null,
      linkStatus: 'projected',
    };
  }

  async getROILinks(orgId: string, modelId: string): Promise<ROILink[]> {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM financial_roi_links WHERE organization_id = ? AND model_id = ? ORDER BY created_at DESC`,
        [orgId, modelId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      modelId: r.model_id,
      initiativeId: r.initiative_id,
      benefitId: r.benefit_id,
      realizedValue: r.realized_value,
      linkStatus: r.link_status,
    }));
  }

  async captureRealizedValue(
    orgId: string,
    linkId: string,
    data: {
      realizedValue: number;
      evidence: unknown[];
    }
  ): Promise<boolean> {
    const result = await queryHelpers.queryRun(
      `UPDATE financial_roi_links SET realized_value = ?, realized_evidence = ?, link_status = 'realized', updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [data.realizedValue, JSON.stringify(data.evidence), new Date().toISOString(), linkId, orgId]
    );
    return (result?.changes || 0) > 0;
  }
}

// ============================================================
// Helpers
// ============================================================

function safeJson(val: unknown): Record<string, unknown> {
  if (!val) return {};
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val as Record<string, unknown>);
  } catch {
    return {};
  }
}

function safeJsonArray(val: unknown): unknown[] {
  if (!val) return [];
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val as unknown[]);
  } catch {
    return [];
  }
}

function mapModelVersionRow(r: any): ModelVersion {
  return {
    id: r.id,
    modelId: r.model_id,
    versionNumber: r.version_number,
    parentVersionId: r.parent_version_id,
    scenarioLabel: r.scenario_label,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

function mapBudgetVersionRow(r: any): BudgetVersion {
  return {
    id: r.id,
    modelId: r.model_id,
    budgetType: r.budget_type,
    fiscalYear: r.fiscal_year,
    versionLabel: r.version_label,
    plannedData: safeJson(r.planned_data),
    actualData: safeJson(r.actual_data),
    varianceData: safeJson(r.variance_data),
    status: r.status,
  };
}

const financeEnterpriseService = new FinanceEnterpriseService();
export default financeEnterpriseService;
export { FinanceEnterpriseService, financeEnterpriseService };
