import {
  withPinnedPostgresTransaction,
  type PinnedTransactionClient,
} from '../../../database/PostgresDatabase.js';
import { canonicalPayloadHash } from './contentHash.js';

const EDIT_ROLES = new Set(['OWNER', 'ADMIN', 'EDITOR', 'FINANCE_ADMIN', 'FINANCE_EDITOR']);

export class PredictionDraftError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export interface PredictionComputeContext {
  entityId: string;
  openingBalanceSheetPeriodId: string;
  forecastPeriods: Array<{
    periodId: string;
    label: string;
    periodStart: string;
    periodEnd: string;
  }>;
}

interface DriverOverrideCommand {
  id: string; scheduleType: string; driverCode: string; entityId: string; periodId: string;
  overrideSource: string; valueStatus: string; valueDecimal: string | null; unit: string;
  baselineValueDecimal: string | null; rationale: string | null; canonicalLineCode: string;
}
interface InitiativeCommand {
  id: string; initiativeCode: string; name: string; description: string | null; source: string | null;
  owner: string | null; confidencePct: string | null; defaultStartPeriodId: string | null;
  defaultRampMonths: number | null; defaultDurationMonths: number | null;
  implementationCostDecimal: string | null; status: string;
}
interface ImpactCommand {
  id: string; initiativeId: string; assumptionLabel: string; driverScheduleType: string | null;
  driverCode: string | null; kpiCatalogId: string | null; statementLineCode: string; entityId: string;
  amountKind: string; amountDecimal: string; amountUnit: string; sign: string;
  startPeriodId: string | null; rampMonths: number | null; durationMonths: number | null;
  decayPctPerPeriod: string | null; implementationCostDecimal: string | null;
  confidencePct: string | null; probabilityPct: string | null; cannibalizesImpactId: string | null;
}
interface FinancingCommand {
  id: string; financingKind: string; entityId: string; periodId: string | null;
  payload: Record<string, unknown>; sourceRef: Record<string, unknown> | null; rationale: string | null;
}
interface PredictionDraftCommand {
  name: string; description: string | null; scenarioMode: string;
  driverOverrides: DriverOverrideCommand[]; initiatives: InitiativeCommand[];
  impacts: ImpactCommand[]; financing: FinancingCommand[];
}

export interface PredictionDraftDto {
  businessVersionId: string;
  version: number;
  sourceBaselineVersionId: string;
  sourceBaselineContextVersion: number;
  sourceBaselineContextHash: string;
  sourceStatementVersionId: string;
  sourceAnalysisVersionId: string;
  name: string;
  description: string | null;
  scenarioMode: string;
  computeContext: PredictionComputeContext;
  driverOverrides: DriverOverrideCommand[];
  initiatives: InitiativeCommand[];
  impacts: ImpactCommand[];
  financing: FinancingCommand[];
  lastAssumptionChangeAt: string;
  lastComputeAt: string | null;
}

interface SourceContext {
  baselineVersionId: string;
  contextVersion: number;
  contextHash: string;
  statementVersionId: string;
  analysisVersionId: string;
  computeContext: PredictionComputeContext;
}

async function loadSourceContext(
  tx: PinnedTransactionClient,
  organizationId: string,
  predictionVersionId: string
): Promise<SourceContext> {
  const edges = await tx.queryAll<{ source_version_id: string }>(
    `SELECT le.source_version_id
       FROM finance_lineage_edges le
       JOIN finance_business_versions bv
         ON bv.business_version_id = le.source_version_id
        AND bv.organization_id = le.organization_id
       JOIN finance_artifacts a
         ON a.artifact_id = bv.artifact_id AND a.organization_id = bv.organization_id
      WHERE le.organization_id = ? AND le.target_version_id = ?
        AND le.edge_type = 'MODEL_TO_SCENARIO'
        AND le.source_artifact_type = 'BASELINE_MODEL'
        AND le.target_artifact_type = 'PREDICTION_SCENARIO'
        AND bv.status = 'APPROVED' AND a.artifact_type = 'BASELINE_MODEL'
      ORDER BY le.source_version_id`,
    [organizationId, predictionVersionId]
  );
  if (edges.length !== 1) {
    throw new PredictionDraftError(
      edges.length === 0 ? 'PREDICTION_SOURCE_NOT_READY' : 'PREDICTION_SOURCE_AMBIGUOUS',
      409,
      'Prediction requires exactly one approved Baseline source'
    );
  }
  const baselineVersionId = edges[0].source_version_id;
  const context = await tx.queryOne<{
    source_statement_version_id: string;
    source_analysis_version_id: string;
    entity_id: string;
    opening_balance_sheet_period_id: string;
    forecast_period_ids: string[];
    version: number;
  }>(
    `SELECT source_statement_version_id, source_analysis_version_id, entity_id,
            opening_balance_sheet_period_id, forecast_period_ids, version
       FROM finance_baseline_workspace_contexts
      WHERE organization_id = ? AND business_version_id = ?`,
    [organizationId, baselineVersionId]
  );
  if (!context) {
    throw new PredictionDraftError(
      'PREDICTION_SOURCE_NOT_READY',
      409,
      'Baseline workspace context is not configured'
    );
  }
  const authority = await tx.queryOne<{ ok: number }>(
    `SELECT 1 AS ok
       FROM finance_business_versions statement_bv
       JOIN finance_artifacts statement_a
         ON statement_a.artifact_id = statement_bv.artifact_id
        AND statement_a.organization_id = statement_bv.organization_id
       JOIN finance_business_versions analysis_bv
         ON analysis_bv.organization_id = statement_bv.organization_id
        AND analysis_bv.business_version_id = ?
       JOIN finance_artifacts analysis_a
         ON analysis_a.artifact_id = analysis_bv.artifact_id
        AND analysis_a.organization_id = analysis_bv.organization_id
       JOIN finance_lineage_edges statement_model
         ON statement_model.organization_id = statement_bv.organization_id
        AND statement_model.source_version_id = statement_bv.business_version_id
        AND statement_model.target_version_id = ?
        AND statement_model.edge_type = 'STATEMENT_TO_MODEL'
       JOIN finance_lineage_edges statement_analysis
         ON statement_analysis.organization_id = statement_bv.organization_id
        AND statement_analysis.source_version_id = statement_bv.business_version_id
        AND statement_analysis.target_version_id = analysis_bv.business_version_id
        AND statement_analysis.edge_type = 'STATEMENT_TO_ANALYSIS'
       JOIN finance_lineage_edges analysis_model
         ON analysis_model.organization_id = statement_bv.organization_id
        AND analysis_model.source_version_id = analysis_bv.business_version_id
        AND analysis_model.target_version_id = ?
        AND analysis_model.edge_type = 'ANALYSIS_TO_MODEL'
      WHERE statement_bv.organization_id = ?
        AND statement_bv.business_version_id = ?
        AND statement_bv.status = 'APPROVED'
        AND analysis_bv.status = 'APPROVED'
        AND statement_a.artifact_type = 'STATEMENT_PACK'
        AND analysis_a.artifact_type = 'HISTORICAL_ANALYSIS'`,
    [
      context.source_analysis_version_id,
      baselineVersionId,
      baselineVersionId,
      organizationId,
      context.source_statement_version_id,
    ]
  );
  if (!authority) {
    throw new PredictionDraftError(
      'PREDICTION_SOURCE_STALE',
      409,
      'Baseline source authority is stale'
    );
  }
  const periodIds = Array.isArray(context.forecast_period_ids) ? context.forecast_period_ids : [];
  const readiness = await tx.queryOne<{ entity_ok: boolean; opening_ok: boolean; opening_bs_ok: boolean; assumption_count: string }>(
    `SELECT
       EXISTS (SELECT 1 FROM finance_stmt_entities e
                WHERE e.organization_id = ? AND e.id = ?
                  AND e.business_version_id = ?) AS entity_ok,
       EXISTS (SELECT 1 FROM finance_stmt_periods p
                WHERE p.organization_id = ? AND p.period_id = ? AND p.period_type = 'MONTH') AS opening_ok,
       EXISTS (SELECT 1 FROM finance_stmt_lines line
                WHERE line.organization_id = ? AND line.business_version_id = ?
                  AND line.entity_id = ? AND line.period_id = ? AND line.statement_type = 'BS') AS opening_bs_ok,
       (SELECT count(*)::text FROM finance_baseline_assumptions ba
         WHERE ba.organization_id = ? AND ba.business_version_id = ? AND ba.entity_id = ?) AS assumption_count`,
    [organizationId, context.entity_id, context.source_statement_version_id,
      organizationId, context.opening_balance_sheet_period_id,
      organizationId, context.source_statement_version_id, context.entity_id,
      context.opening_balance_sheet_period_id,
      organizationId, baselineVersionId, context.entity_id]
  );
  if (!readiness?.entity_ok || !readiness.opening_ok || !readiness.opening_bs_ok || Number(readiness.assumption_count) < 1) {
    throw new PredictionDraftError('PREDICTION_SOURCE_NOT_READY', 409, 'Baseline context is not ready');
  }
  const periods = await tx.queryAll<{
    period_id: string;
    label: string;
    period_start: string;
    period_end: string;
    previous_period_id: string | null;
  }>(
    `SELECT period_id, label, period_start::text, period_end::text, previous_period_id
       FROM finance_stmt_periods
      WHERE organization_id = ? AND period_id = ANY(?)`,
    [organizationId, periodIds]
  );
  const byId = new Map(periods.map((period) => [period.period_id, period]));
  const ordered = periodIds.map((id) => byId.get(id));
  if (
    ordered.some((period) => !period) ||
    ordered.some((period, index) =>
      period!.previous_period_id !==
      (index === 0 ? context.opening_balance_sheet_period_id : ordered[index - 1]!.period_id)
    )
  ) {
    throw new PredictionDraftError('PREDICTION_SOURCE_STALE', 409, 'Forecast periods are stale');
  }
  const computeContext: PredictionComputeContext = {
    entityId: context.entity_id,
    openingBalanceSheetPeriodId: context.opening_balance_sheet_period_id,
    forecastPeriods: ordered.map((period) => ({
      periodId: period!.period_id,
      label: period!.label,
      periodStart: period!.period_start,
      periodEnd: period!.period_end,
    })),
  };
  const contextHash = canonicalPayloadHash({
    baselineVersionId,
    version: context.version,
    statementVersionId: context.source_statement_version_id,
    analysisVersionId: context.source_analysis_version_id,
    computeContext,
  });
  return {
    baselineVersionId,
    contextVersion: context.version,
    contextHash,
    statementVersionId: context.source_statement_version_id,
    analysisVersionId: context.source_analysis_version_id,
    computeContext,
  };
}

async function readPredictionDraftTx(
  tx: PinnedTransactionClient,
  organizationId: string,
  businessVersionId: string
): Promise<PredictionDraftDto> {
  const scenario = await tx.queryOne<Record<string, any>>(
    `SELECT s.*, bv.status, a.artifact_type
       FROM finance_prediction_scenarios s
       JOIN finance_business_versions bv
         ON bv.business_version_id = s.business_version_id
        AND bv.organization_id = s.organization_id
       JOIN finance_artifacts a
         ON a.artifact_id = bv.artifact_id AND a.organization_id = bv.organization_id
      WHERE s.organization_id = ? AND s.business_version_id = ?`,
    [organizationId, businessVersionId]
  );
  if (!scenario || scenario.artifact_type !== 'PREDICTION_SCENARIO') {
    throw new PredictionDraftError('NOT_FOUND', 404, 'Prediction scenario not found');
  }
  const source = await loadSourceContext(tx, organizationId, businessVersionId);
  if (
    scenario.source_baseline_version_id &&
    (scenario.source_baseline_version_id !== source.baselineVersionId ||
      scenario.source_baseline_context_version !== source.contextVersion ||
      scenario.source_baseline_context_hash !== source.contextHash)
  ) {
    throw new PredictionDraftError('PREDICTION_SOURCE_STALE', 409, 'Prediction source changed');
  }
  const [driverOverrides, initiatives, impacts, financing, compute] = await Promise.all([
    tx.queryAll<Record<string, unknown>>(
      `SELECT o.*, line.line_code AS canonical_line_code
         FROM finance_prediction_driver_overrides o
         LEFT JOIN financial_statement_lines line ON line.id = o.canonical_line_id
        WHERE o.organization_id = ? AND o.business_version_id = ?
        ORDER BY o.schedule_type, o.driver_code, o.entity_id, o.period_id, o.id`,
      [organizationId, businessVersionId]
    ),
    tx.queryAll<Record<string, unknown>>(
      `SELECT * FROM finance_prediction_initiatives
        WHERE organization_id = ? AND business_version_id = ? ORDER BY initiative_code, id`,
      [organizationId, businessVersionId]
    ),
    tx.queryAll<Record<string, unknown>>(
      `SELECT i.*, line.line_code AS statement_line_code
         FROM finance_prediction_impact_chain i
         JOIN financial_statement_lines line ON line.id = i.statement_line_id
        WHERE i.organization_id = ? AND i.business_version_id = ? ORDER BY i.id`,
      [organizationId, businessVersionId]
    ),
    tx.queryAll<Record<string, unknown>>(
      `SELECT * FROM finance_prediction_financing
        WHERE organization_id = ? AND business_version_id = ? ORDER BY financing_kind, period_id NULLS FIRST, id`,
      [organizationId, businessVersionId]
    ),
    tx.queryOne<{ last_compute_at: string | null }>(
      `SELECT max(updated_at)::text AS last_compute_at FROM finance_prediction_outputs
        WHERE organization_id = ? AND business_version_id = ?`,
      [organizationId, businessVersionId]
    ),
  ]);
  if (driverOverrides.some((row: any) => !row.canonical_line_id || !row.canonical_line_code)) {
    throw new PredictionDraftError(
      'PREDICTION_DRAFT_NOT_READY',
      409,
      'A historical driver override has no unambiguous canonical line binding'
    );
  }
  return {
    businessVersionId,
    version: Number(scenario.draft_version),
    sourceBaselineVersionId: source.baselineVersionId,
    sourceBaselineContextVersion: source.contextVersion,
    sourceBaselineContextHash: source.contextHash,
    sourceStatementVersionId: source.statementVersionId,
    sourceAnalysisVersionId: source.analysisVersionId,
    name: String(scenario.name),
    description: scenario.description == null ? null : String(scenario.description),
    scenarioMode: String(scenario.scenario_mode),
    computeContext: source.computeContext,
    driverOverrides: driverOverrides.map((row: any): DriverOverrideCommand => ({
      id: row.id, scheduleType: row.schedule_type, driverCode: row.driver_code,
      entityId: row.entity_id, periodId: row.period_id, overrideSource: row.override_source,
      valueStatus: row.value_status, valueDecimal: row.value_decimal == null ? null : String(row.value_decimal),
      unit: row.unit, baselineValueDecimal: row.baseline_value_decimal == null ? null : String(row.baseline_value_decimal),
      rationale: row.rationale, canonicalLineCode: row.canonical_line_code,
    })),
    initiatives: initiatives.map((row: any): InitiativeCommand => ({
      id: row.id, initiativeCode: row.initiative_code, name: row.name,
      description: row.description, source: row.source, owner: row.owner,
      confidencePct: row.confidence_pct == null ? null : String(row.confidence_pct), defaultStartPeriodId: row.default_start_period_id,
      defaultRampMonths: row.default_ramp_months, defaultDurationMonths: row.default_duration_months,
      implementationCostDecimal: row.implementation_cost_decimal == null ? null : String(row.implementation_cost_decimal), status: row.status,
    })),
    impacts: impacts.map((row: any): ImpactCommand => ({
      id: row.id, initiativeId: row.initiative_id, assumptionLabel: row.assumption_label,
      driverScheduleType: row.driver_schedule_type, driverCode: row.driver_code,
      kpiCatalogId: row.kpi_catalog_id, statementLineCode: row.statement_line_code,
      entityId: row.entity_id, amountKind: row.amount_kind, amountDecimal: String(row.amount_decimal),
      amountUnit: row.amount_unit, sign: row.sign, startPeriodId: row.start_period_id,
      rampMonths: row.ramp_months, durationMonths: row.duration_months,
      decayPctPerPeriod: row.decay_pct_per_period == null ? null : String(row.decay_pct_per_period),
      implementationCostDecimal: row.implementation_cost_decimal == null ? null : String(row.implementation_cost_decimal),
      confidencePct: row.confidence_pct == null ? null : String(row.confidence_pct),
      probabilityPct: row.probability_pct == null ? null : String(row.probability_pct),
      cannibalizesImpactId: row.cannibalizes_impact_id,
    })),
    financing: financing.map((row: any): FinancingCommand => ({
      id: row.id, financingKind: row.financing_kind, entityId: row.entity_id,
      periodId: row.period_id, payload: row.payload, sourceRef: row.source_ref,
      rationale: row.rationale,
    })),
    lastAssumptionChangeAt: String(scenario.updated_at),
    lastComputeAt: compute?.last_compute_at ?? null,
  };
}

export async function getPredictionDraft(
  organizationId: string,
  businessVersionId: string
): Promise<PredictionDraftDto> {
  return withPinnedPostgresTransaction((tx) =>
    readPredictionDraftTx(tx, organizationId, businessVersionId)
  );
}

export interface ReplacePredictionDraftInput {
  organizationId: string;
  businessVersionId: string;
  actorId: string;
  expectedVersion: number;
  idempotencyKey: string;
  draft: PredictionDraftCommand;
}

export async function replacePredictionDraft(
  input: ReplacePredictionDraftInput
): Promise<PredictionDraftDto & { replay: boolean }> {
  if (!input.idempotencyKey.trim()) {
    throw new PredictionDraftError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new PredictionDraftError('INVALID_EXPECTED_VERSION', 400, 'expectedVersion must be a positive integer');
  }
  const mode = String(input.draft.scenarioMode ?? '');
  const name = String(input.draft.name ?? '').trim();
  const description = input.draft.description == null ? null : String(input.draft.description);
  const driverOverrides = Array.isArray(input.draft.driverOverrides) ? input.draft.driverOverrides : null;
  const initiatives = Array.isArray(input.draft.initiatives) ? input.draft.initiatives : null;
  const impacts = Array.isArray(input.draft.impacts) ? input.draft.impacts : null;
  const financing = Array.isArray(input.draft.financing) ? input.draft.financing : null;
  if (!name || !driverOverrides || !initiatives || !impacts || !financing) {
    throw new PredictionDraftError('INVALID_DRAFT', 400, 'Complete prediction draft is required');
  }
  if (!['STANDARD_BASE', 'STANDARD_UPSIDE', 'STANDARD_DOWNSIDE', 'DRIVER_OVERRIDE', 'FUNDAMENTAL_INITIATIVE'].includes(mode)) {
    throw new PredictionDraftError('INVALID_DRAFT', 400, 'Invalid scenario mode');
  }
  if (mode === 'STANDARD_BASE' && (driverOverrides.length || initiatives.length || impacts.length || financing.length)) {
    throw new PredictionDraftError('INVALID_DRAFT', 400, 'STANDARD_BASE cannot contain overlays');
  }
  if (mode !== 'FUNDAMENTAL_INITIATIVE' && (initiatives.length || impacts.length)) {
    throw new PredictionDraftError('INVALID_DRAFT', 400, 'Initiatives and impacts require FUNDAMENTAL_INITIATIVE mode');
  }
  if ((mode === 'STANDARD_BASE' || mode === 'STANDARD_UPSIDE' || mode === 'STANDARD_DOWNSIDE') && financing.length) {
    throw new PredictionDraftError('INVALID_DRAFT', 400, 'Standard modes cannot contain financing');
  }
  for (const row of driverOverrides as any[]) {
    const source = String(row?.overrideSource ?? '');
    if (
      (mode === 'STANDARD_UPSIDE' && source !== 'STANDARD_PRESET_UPSIDE') ||
      (mode === 'STANDARD_DOWNSIDE' && source !== 'STANDARD_PRESET_DOWNSIDE') ||
      ((mode === 'DRIVER_OVERRIDE' || mode === 'FUNDAMENTAL_INITIATIVE') && source !== 'MANUAL')
    ) {
      throw new PredictionDraftError('INVALID_DRAFT', 400, 'Override source does not match scenario mode');
    }
  }

  try {
    return await withPinnedPostgresTransaction(async (tx) => {
    await tx.queryRun(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
      `prediction-draft:${input.organizationId}:${input.businessVersionId}`,
    ]);
    const membership = await tx.queryOne<{ role: string }>(
      `SELECT role FROM organization_members
        WHERE organization_id = ? AND user_id = ? AND status = 'ACTIVE' FOR UPDATE`,
      [input.organizationId, input.actorId]
    );
    if (!membership || !EDIT_ROLES.has(String(membership.role).toUpperCase())) {
      throw new PredictionDraftError('FINANCE_EDIT_FORBIDDEN', 403, 'Finance editor membership is required');
    }
    const scenario = await tx.queryOne<{
      draft_version: number; status: string; scenario_mode: string; artifact_type: string;
      source_baseline_version_id: string | null; source_baseline_context_version: number | null;
      source_baseline_context_hash: string | null;
    }>(
      `SELECT s.draft_version, bv.status, s.scenario_mode, a.artifact_type,
              s.source_baseline_version_id, s.source_baseline_context_version,
              s.source_baseline_context_hash
         FROM finance_prediction_scenarios s
         JOIN finance_business_versions bv
           ON bv.business_version_id = s.business_version_id
          AND bv.organization_id = s.organization_id
         JOIN finance_artifacts a
           ON a.artifact_id = bv.artifact_id AND a.organization_id = bv.organization_id
        WHERE s.organization_id = ? AND s.business_version_id = ?
        FOR UPDATE OF s, bv`,
      [input.organizationId, input.businessVersionId]
    );
    if (!scenario || scenario.artifact_type !== 'PREDICTION_SCENARIO') {
      throw new PredictionDraftError('NOT_FOUND', 404, 'Prediction scenario not found');
    }
    const source = await loadSourceContext(tx, input.organizationId, input.businessVersionId);
    if (
      scenario.source_baseline_version_id != null &&
      (scenario.source_baseline_version_id !== source.baselineVersionId ||
        Number(scenario.source_baseline_context_version) !== source.contextVersion ||
        scenario.source_baseline_context_hash !== source.contextHash)
    ) {
      throw new PredictionDraftError('PREDICTION_SOURCE_STALE', 409, 'Prediction source changed');
    }
    const normalizeRows = (rows: any[]) => [...rows].sort((a, b) => String(a?.id ?? '').localeCompare(String(b?.id ?? '')));
    const normalizedDraft = {
      name,
      description,
      scenarioMode: mode,
      driverOverrides: normalizeRows(driverOverrides),
      initiatives: normalizeRows(initiatives),
      impacts: normalizeRows(impacts),
      financing: normalizeRows(financing),
    };
    const requestHash = canonicalPayloadHash({
      businessVersionId: input.businessVersionId,
      expectedVersion: input.expectedVersion,
      sourceBaselineVersionId: source.baselineVersionId,
      sourceBaselineContextVersion: source.contextVersion,
      sourceBaselineContextHash: source.contextHash,
      draft: normalizedDraft,
    });
    const receipt = await tx.queryOne<{ request_hash: string; response_json: PredictionDraftDto }>(
      `SELECT request_hash, response_json
         FROM finance_prediction_draft_command_receipts
        WHERE organization_id = ? AND business_version_id = ? AND idempotency_key = ?`,
      [input.organizationId, input.businessVersionId, input.idempotencyKey]
    );
    if (receipt) {
      if (receipt.request_hash !== requestHash) {
        throw new PredictionDraftError('IDEMPOTENCY_PAYLOAD_COLLISION', 409, 'Idempotency key payload changed');
      }
      return { ...receipt.response_json, replay: true };
    }
    if (scenario.status !== 'DRAFT') {
      throw new PredictionDraftError('PREDICTION_DRAFT_IMMUTABLE', 409, 'Only DRAFT scenarios are editable');
    }
    if (Number(scenario.draft_version) !== input.expectedVersion) {
      throw new PredictionDraftError('PREDICTION_DRAFT_VERSION_CONFLICT', 409, 'Prediction draft version changed', {
        currentVersion: Number(scenario.draft_version),
      });
    }
    if (mode !== scenario.scenario_mode && !(scenario.scenario_mode === 'DRIVER_OVERRIDE' && mode === 'FUNDAMENTAL_INITIATIVE')) {
      throw new PredictionDraftError('PREDICTION_MODE_TRANSITION_FORBIDDEN', 409, 'Scenario mode transition is not allowed');
    }
    const allowedPeriods = new Set(source.computeContext.forecastPeriods.map((period) => period.periodId));
    const entityId = source.computeContext.entityId;
    const ids = (rows: any[], label: string) => {
      const values = rows.map((row) => String(row?.id ?? ''));
      if (values.some((id) => !id) || new Set(values).size !== values.length) {
        throw new PredictionDraftError('INVALID_DRAFT', 400, `${label} ids must be nonblank and unique`);
      }
      return new Set(values);
    };
    ids(driverOverrides, 'Driver override');
    const initiativeIds = ids(initiatives, 'Initiative');
    const impactIds = ids(impacts, 'Impact');
    ids(financing, 'Financing');
    for (const row of driverOverrides as any[]) {
      if (String(row.entityId) !== entityId || !allowedPeriods.has(String(row.periodId))) {
        throw new PredictionDraftError('INVALID_DRAFT_CONTEXT', 400, 'Driver override is outside governed context');
      }
      if (!String(row.scheduleType ?? '') || !String(row.driverCode ?? '') || !String(row.canonicalLineCode ?? '')) {
        throw new PredictionDraftError('INVALID_DRAFT', 400, 'Driver override catalog identity is required');
      }
    }
    for (const row of impacts as any[]) {
      if (!initiativeIds.has(String(row.initiativeId)) || String(row.entityId) !== entityId) {
        throw new PredictionDraftError('INVALID_DRAFT_CONTEXT', 400, 'Impact is outside submitted aggregate');
      }
      if (row.startPeriodId != null && !allowedPeriods.has(String(row.startPeriodId))) {
        throw new PredictionDraftError('INVALID_DRAFT_CONTEXT', 400, 'Impact period is outside governed context');
      }
      if (row.cannibalizesImpactId != null && (!impactIds.has(String(row.cannibalizesImpactId)) || String(row.cannibalizesImpactId) === String(row.id))) {
        throw new PredictionDraftError('INVALID_DRAFT', 400, 'Invalid cannibalization reference');
      }
    }
    for (const row of initiatives as any[]) {
      if (row.defaultStartPeriodId != null && !allowedPeriods.has(String(row.defaultStartPeriodId))) {
        throw new PredictionDraftError('INVALID_DRAFT_CONTEXT', 400, 'Initiative period is outside governed context');
      }
    }
    const cannibalParent = new Map(
      (impacts as any[]).map((row) => [String(row.id), row.cannibalizesImpactId == null ? null : String(row.cannibalizesImpactId)])
    );
    for (const id of cannibalParent.keys()) {
      const seen = new Set<string>();
      let cursor: string | null = id;
      while (cursor != null) {
        if (seen.has(cursor)) throw new PredictionDraftError('INVALID_DRAFT', 400, 'Cannibalization cycle is not allowed');
        seen.add(cursor);
        cursor = cannibalParent.get(cursor) ?? null;
      }
    }
    const horizonWide = new Set(['SURPLUS_ALLOCATION_POLICY', 'COVENANT_DEFINITION', 'MIN_CASH_POLICY']);
    for (const row of financing as any[]) {
      const wide = horizonWide.has(String(row.financingKind));
      if (String(row.entityId) !== entityId || (wide ? row.periodId != null : !allowedPeriods.has(String(row.periodId)))) {
        throw new PredictionDraftError('INVALID_DRAFT_CONTEXT', 400, 'Financing is outside governed context');
      }
    }

    const nextVersion = input.expectedVersion + 1;
    await tx.queryRun(`DELETE FROM finance_prediction_impact_chain WHERE organization_id = ? AND business_version_id = ?`, [input.organizationId, input.businessVersionId]);
    await tx.queryRun(`DELETE FROM finance_prediction_financing WHERE organization_id = ? AND business_version_id = ?`, [input.organizationId, input.businessVersionId]);
    await tx.queryRun(`DELETE FROM finance_prediction_driver_overrides WHERE organization_id = ? AND business_version_id = ?`, [input.organizationId, input.businessVersionId]);
    await tx.queryRun(`DELETE FROM finance_prediction_initiatives WHERE organization_id = ? AND business_version_id = ?`, [input.organizationId, input.businessVersionId]);

    for (const row of initiatives as any[]) {
      await tx.queryRun(
        `INSERT INTO finance_prediction_initiatives
          (id, organization_id, business_version_id, initiative_code, name, description, source, owner,
           confidence_pct, default_start_period_id, default_ramp_months, default_duration_months,
           implementation_cost_decimal, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, input.organizationId, input.businessVersionId, row.initiativeCode, row.name, row.description ?? null,
          row.source ?? null, row.owner ?? null, row.confidencePct ?? null, row.defaultStartPeriodId ?? null,
          row.defaultRampMonths ?? null, row.defaultDurationMonths ?? null, row.implementationCostDecimal ?? null,
          row.status ?? 'DRAFT', input.actorId]
      );
    }
    for (const row of driverOverrides as any[]) {
      const canonicalLine = await tx.queryOne<{ id: string }>(
        `SELECT id FROM financial_statement_lines WHERE line_code = ?`,
        [row.canonicalLineCode]
      );
      if (!canonicalLine) throw new PredictionDraftError('INVALID_DRAFT', 400, 'Unknown canonical line');
      await tx.queryRun(
        `INSERT INTO finance_prediction_driver_overrides
          (id, organization_id, business_version_id, schedule_type, driver_code, entity_id, period_id,
           override_source, value_status, value_decimal, unit, baseline_value_decimal, rationale,
           canonical_line_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, input.organizationId, input.businessVersionId, row.scheduleType, row.driverCode, row.entityId,
          row.periodId, row.overrideSource, row.valueStatus, row.valueDecimal, row.unit,
          row.baselineValueDecimal ?? null, row.rationale ?? null, canonicalLine.id, input.actorId]
      );
    }
    for (const row of impacts as any[]) {
      const line = await tx.queryOne<{ id: string }>(`SELECT id FROM financial_statement_lines WHERE line_code = ?`, [row.statementLineCode]);
      if (!line) throw new PredictionDraftError('INVALID_DRAFT', 400, 'Unknown statement line');
      await tx.queryRun(
        `INSERT INTO finance_prediction_impact_chain
          (id, organization_id, business_version_id, initiative_id, assumption_label,
           driver_schedule_type, driver_code, kpi_catalog_id, statement_line_id, entity_id,
           amount_kind, amount_decimal, amount_unit, sign, start_period_id, ramp_months,
           duration_months, decay_pct_per_period, implementation_cost_decimal, confidence_pct,
          probability_pct, cannibalizes_impact_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, input.organizationId, input.businessVersionId, row.initiativeId, row.assumptionLabel,
          row.driverScheduleType ?? null, row.driverCode ?? null, row.kpiCatalogId ?? null, line.id,
          row.entityId, row.amountKind, row.amountDecimal, row.amountUnit, row.sign,
          row.startPeriodId ?? null, row.rampMonths ?? null, row.durationMonths ?? null,
          row.decayPctPerPeriod ?? null, row.implementationCostDecimal ?? null,
          row.confidencePct ?? null, row.probabilityPct ?? null, null, input.actorId]
      );
    }
    for (const row of impacts as any[]) {
      if (row.cannibalizesImpactId == null) continue;
      await tx.queryRun(
        `UPDATE finance_prediction_impact_chain SET cannibalizes_impact_id = ?
          WHERE organization_id = ? AND business_version_id = ? AND id = ?`,
        [row.cannibalizesImpactId, input.organizationId, input.businessVersionId, row.id]
      );
    }
    for (const row of financing as any[]) {
      await tx.queryRun(
        `INSERT INTO finance_prediction_financing
          (id, organization_id, business_version_id, financing_kind, entity_id, period_id,
           payload, source_ref, rationale, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?)`,
        [row.id, input.organizationId, input.businessVersionId, row.financingKind, row.entityId,
          row.periodId ?? null, JSON.stringify(row.payload ?? {}),
          row.sourceRef == null ? null : JSON.stringify(row.sourceRef), row.rationale ?? null, input.actorId]
      );
    }
    await tx.queryRun(
      `UPDATE finance_prediction_scenarios
          SET name = ?, description = ?, scenario_mode = ?, draft_version = ?,
              source_baseline_version_id = ?, source_baseline_context_version = ?,
              source_baseline_context_hash = ?, scenario_mode_promoted_by =
                CASE WHEN scenario_mode = 'DRIVER_OVERRIDE' AND ? = 'FUNDAMENTAL_INITIATIVE'
                     THEN ? ELSE scenario_mode_promoted_by END,
              updated_at = now()
        WHERE organization_id = ? AND business_version_id = ? AND draft_version = ?`,
      [name, description, mode, nextVersion, source.baselineVersionId, source.contextVersion,
        source.contextHash, mode, input.actorId, input.organizationId, input.businessVersionId, input.expectedVersion]
    );
    const response = await readPredictionDraftTx(tx, input.organizationId, input.businessVersionId);
    await tx.queryRun(
      `INSERT INTO finance_prediction_draft_command_receipts
        (organization_id, business_version_id, idempotency_key, request_hash, response_json,
         applied_version, created_by)
       VALUES (?, ?, ?, ?, ?::jsonb, ?, ?)`,
      [input.organizationId, input.businessVersionId, input.idempotencyKey, requestHash,
        JSON.stringify(response), nextVersion, input.actorId]
    );
    return { ...response, replay: false };
    });
  } catch (error: any) {
    if (error instanceof PredictionDraftError) throw error;
    if (['23503', '23505', '23514', '22P02', '22003'].includes(String(error?.code))) {
      throw new PredictionDraftError('INVALID_DRAFT', 400, 'Prediction draft violates its canonical contract');
    }
    throw error;
  }
}

export { EDIT_ROLES };
