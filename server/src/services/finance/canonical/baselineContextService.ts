import {
  withPinnedPostgresTransaction,
  type PinnedTransactionClient,
} from '../../../database/PostgresDatabase.js';
import { canonicalPayloadHash } from './contentHash.js';

const EDIT_ROLES = new Set(['OWNER', 'ADMIN', 'EDITOR', 'FINANCE_ADMIN', 'FINANCE_EDITOR']);

export class BaselineContextError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export interface BaselineForecastPeriod {
  periodId: string;
  label: string;
  periodStart: string;
  periodEnd: string;
}

export interface BaselineWorkspaceContext {
  businessVersionId: string;
  sourceStatementVersionId: string;
  sourceAnalysisVersionId: string;
  entityId: string;
  openingBalanceSheetPeriodId: string;
  forecastPeriods: BaselineForecastPeriod[];
  assumptionRowOrder: Array<{
    scheduleType: string;
    driverCode: string;
    entityId: string;
    periodId: string;
  }>;
  version: number;
}

interface ContextRow {
  business_version_id: string;
  source_statement_version_id: string;
  source_analysis_version_id: string;
  entity_id: string;
  opening_balance_sheet_period_id: string;
  forecast_period_ids: string[];
  version: number;
}

async function readContextTx(
  tx: PinnedTransactionClient,
  organizationId: string,
  businessVersionId: string
): Promise<BaselineWorkspaceContext> {
  const identity = await tx.queryOne<{ artifact_type: string }>(
    `SELECT a.artifact_type
       FROM finance_business_versions bv
       JOIN finance_artifacts a ON a.artifact_id = bv.artifact_id AND a.organization_id = bv.organization_id
      WHERE bv.organization_id = ? AND bv.business_version_id = ?`,
    [organizationId, businessVersionId]
  );
  if (!identity || identity.artifact_type !== 'BASELINE_MODEL') {
    throw new BaselineContextError('NOT_FOUND', 404, 'Baseline business version not found');
  }

  const row = await tx.queryOne<ContextRow>(
    `SELECT business_version_id, source_statement_version_id, source_analysis_version_id,
            entity_id, opening_balance_sheet_period_id,
            forecast_period_ids, version
       FROM finance_baseline_workspace_contexts
      WHERE organization_id = ? AND business_version_id = ?`,
    [organizationId, businessVersionId]
  );
  if (!row) {
    throw new BaselineContextError(
      'BASELINE_CONTEXT_NOT_CONFIGURED',
      409,
      'Baseline workspace context has not been configured'
    );
  }
  const authority = await tx.queryOne<{ ok: number }>(
    `SELECT 1 AS ok
       FROM finance_business_versions statement_bv
       JOIN finance_artifacts statement_artifact
         ON statement_artifact.artifact_id = statement_bv.artifact_id
        AND statement_artifact.organization_id = statement_bv.organization_id
       JOIN finance_business_versions analysis_bv
         ON analysis_bv.organization_id = statement_bv.organization_id
        AND analysis_bv.business_version_id = ?
       JOIN finance_artifacts analysis_artifact
         ON analysis_artifact.artifact_id = analysis_bv.artifact_id
        AND analysis_artifact.organization_id = analysis_bv.organization_id
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
        AND statement_artifact.artifact_type = 'STATEMENT_PACK'
        AND analysis_bv.status = 'APPROVED'
        AND analysis_artifact.artifact_type = 'HISTORICAL_ANALYSIS'`,
    [
      row.source_analysis_version_id,
      businessVersionId,
      businessVersionId,
      organizationId,
      row.source_statement_version_id,
    ]
  );
  if (!authority) {
    throw new BaselineContextError(
      'BASELINE_CONTEXT_SOURCE_STALE',
      409,
      'Baseline context source authority is no longer current'
    );
  }

  const periodIds = Array.isArray(row.forecast_period_ids) ? row.forecast_period_ids : [];
  const periods = await tx.queryAll<{
    period_id: string;
    label: string;
    period_start: string;
    period_end: string;
  }>(
    `SELECT period_id, label, period_start::text, period_end::text
       FROM finance_stmt_periods
      WHERE organization_id = ? AND period_id = ANY(?)
      ORDER BY period_start, period_id`,
    [organizationId, periodIds]
  );
  if (periods.length !== periodIds.length) {
    throw new BaselineContextError(
      'BASELINE_CONTEXT_INVALID',
      409,
      'Configured forecast periods are incomplete'
    );
  }
  const byId = new Map(periods.map((period) => [period.period_id, period]));
  const ordered = periodIds.map((periodId) => byId.get(periodId));
  if (ordered.some((period) => !period)) {
    throw new BaselineContextError(
      'BASELINE_CONTEXT_INVALID',
      409,
      'Configured forecast period order is invalid'
    );
  }

  const assumptions = await tx.queryAll<{
    schedule_type: string;
    driver_code: string;
    entity_id: string;
    period_id: string;
  }>(
    `SELECT DISTINCT schedule_type, driver_code, entity_id, period_id
       FROM finance_baseline_assumptions
      WHERE organization_id = ? AND business_version_id = ? AND entity_id = ?
      ORDER BY schedule_type, driver_code, entity_id, period_id`,
    [organizationId, businessVersionId, row.entity_id]
  );
  if (assumptions.length === 0) {
    throw new BaselineContextError(
      'BASELINE_CONTEXT_NOT_READY',
      409,
      'Baseline context has no governed assumption rows to edit'
    );
  }

  return {
    businessVersionId: row.business_version_id,
    sourceStatementVersionId: row.source_statement_version_id,
    sourceAnalysisVersionId: row.source_analysis_version_id,
    entityId: row.entity_id,
    openingBalanceSheetPeriodId: row.opening_balance_sheet_period_id,
    forecastPeriods: ordered.map((period) => ({
      periodId: period!.period_id,
      label: period!.label,
      periodStart: period!.period_start,
      periodEnd: period!.period_end,
    })),
    assumptionRowOrder: assumptions.map((row) => ({
      scheduleType: row.schedule_type,
      driverCode: row.driver_code,
      entityId: row.entity_id,
      periodId: row.period_id,
    })),
    version: row.version,
  };
}

export async function getBaselineWorkspaceContext(
  organizationId: string,
  businessVersionId: string
): Promise<BaselineWorkspaceContext> {
  return withPinnedPostgresTransaction((tx) =>
    readContextTx(tx, organizationId, businessVersionId)
  );
}

export interface ConfigureBaselineContextInput {
  organizationId: string;
  businessVersionId: string;
  actorId: string;
  expectedVersion: number;
  idempotencyKey: string;
  entityId: string;
  openingBalanceSheetPeriodId: string;
  forecastPeriodIds: string[];
}

export async function configureBaselineWorkspaceContext(
  input: ConfigureBaselineContextInput
): Promise<BaselineWorkspaceContext & { replay: boolean }> {
  if (!input.idempotencyKey.trim()) {
    throw new BaselineContextError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw new BaselineContextError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a non-negative integer'
    );
  }
  if (
    !input.entityId ||
    !input.openingBalanceSheetPeriodId ||
    input.forecastPeriodIds.length === 0
  ) {
    throw new BaselineContextError(
      'INVALID_CONTEXT',
      400,
      'entityId, opening period and forecast periods are required'
    );
  }
  if (new Set(input.forecastPeriodIds).size !== input.forecastPeriodIds.length) {
    throw new BaselineContextError('INVALID_CONTEXT', 400, 'forecastPeriodIds must be unique');
  }

  const requestHash = canonicalPayloadHash({
    businessVersionId: input.businessVersionId,
    expectedVersion: input.expectedVersion,
    entityId: input.entityId,
    openingBalanceSheetPeriodId: input.openingBalanceSheetPeriodId,
    forecastPeriodIds: input.forecastPeriodIds,
  });

  return withPinnedPostgresTransaction(async (tx) => {
    await tx.queryRun(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
      `baseline-context:${input.organizationId}:${input.businessVersionId}`,
    ]);
    const membership = await tx.queryOne<{ role: string }>(
      `SELECT role FROM organization_members
        WHERE organization_id = ? AND user_id = ? AND status = 'ACTIVE'
        FOR UPDATE`,
      [input.organizationId, input.actorId]
    );
    if (!membership || !EDIT_ROLES.has(String(membership.role).toUpperCase())) {
      throw new BaselineContextError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance editor membership is required'
      );
    }
    const receipt = await tx.queryOne<{
      request_hash: string;
      response_json: BaselineWorkspaceContext;
    }>(
      `SELECT request_hash, response_json
         FROM finance_baseline_context_command_receipts
        WHERE organization_id = ? AND business_version_id = ? AND idempotency_key = ?`,
      [input.organizationId, input.businessVersionId, input.idempotencyKey]
    );
    if (receipt) {
      if (receipt.request_hash !== requestHash) {
        throw new BaselineContextError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key was already used with another payload'
        );
      }
      return { ...receipt.response_json, replay: true };
    }

    const identity = await tx.queryOne<{
      status: string;
      artifact_type: string;
      horizon_months: number;
    }>(
      `SELECT bv.status, a.artifact_type, bm.horizon_months
         FROM finance_business_versions bv
         JOIN finance_artifacts a ON a.artifact_id = bv.artifact_id AND a.organization_id = bv.organization_id
         JOIN finance_baseline_models bm ON bm.business_version_id = bv.business_version_id AND bm.organization_id = bv.organization_id
        WHERE bv.organization_id = ? AND bv.business_version_id = ?
        FOR UPDATE OF bv, bm`,
      [input.organizationId, input.businessVersionId]
    );
    if (!identity || identity.artifact_type !== 'BASELINE_MODEL') {
      throw new BaselineContextError('NOT_FOUND', 404, 'Baseline business version not found');
    }
    if (identity.status !== 'DRAFT') {
      throw new BaselineContextError(
        'BASELINE_CONTEXT_IMMUTABLE',
        409,
        'Only a DRAFT baseline context may be configured'
      );
    }
    if (identity.horizon_months !== input.forecastPeriodIds.length) {
      throw new BaselineContextError(
        'BASELINE_CONTEXT_HORIZON_MISMATCH',
        409,
        'Forecast period count must equal the model horizon'
      );
    }

    const sources = await tx.queryAll<{ source_version_id: string }>(
      `SELECT le.source_version_id
         FROM finance_lineage_edges le
         JOIN finance_business_versions source_bv
           ON source_bv.business_version_id = le.source_version_id
          AND source_bv.organization_id = le.organization_id
         JOIN finance_artifacts source_artifact
           ON source_artifact.artifact_id = source_bv.artifact_id
          AND source_artifact.organization_id = source_bv.organization_id
        WHERE le.organization_id = ? AND le.target_version_id = ?
          AND le.edge_type = 'STATEMENT_TO_MODEL'
          AND le.source_artifact_type = 'STATEMENT_PACK'
          AND le.target_artifact_type = 'BASELINE_MODEL'
          AND source_artifact.artifact_type = 'STATEMENT_PACK'
          AND source_bv.status = 'APPROVED'
        ORDER BY le.source_version_id`,
      [input.organizationId, input.businessVersionId]
    );
    if (sources.length !== 1) {
      throw new BaselineContextError(
        sources.length === 0 ? 'BASELINE_SOURCE_NOT_CONFIGURED' : 'BASELINE_SOURCE_AMBIGUOUS',
        409,
        sources.length === 0
          ? 'A Statement Pack source is required'
          : 'Exactly one Statement Pack source is required'
      );
    }
    const source = sources[0];
    const analyses = await tx.queryAll<{ source_version_id: string }>(
      `SELECT analysis_edge.source_version_id
         FROM finance_lineage_edges analysis_edge
         JOIN finance_business_versions analysis_bv
           ON analysis_bv.business_version_id = analysis_edge.source_version_id
          AND analysis_bv.organization_id = analysis_edge.organization_id
         JOIN finance_artifacts analysis_artifact
           ON analysis_artifact.artifact_id = analysis_bv.artifact_id
          AND analysis_artifact.organization_id = analysis_bv.organization_id
         JOIN finance_lineage_edges analysis_statement
           ON analysis_statement.organization_id = analysis_edge.organization_id
          AND analysis_statement.target_version_id = analysis_edge.source_version_id
          AND analysis_statement.edge_type = 'STATEMENT_TO_ANALYSIS'
          AND analysis_statement.source_version_id = ?
        WHERE analysis_edge.organization_id = ?
          AND analysis_edge.target_version_id = ?
          AND analysis_edge.edge_type = 'ANALYSIS_TO_MODEL'
          AND analysis_edge.source_artifact_type = 'HISTORICAL_ANALYSIS'
          AND analysis_edge.target_artifact_type = 'BASELINE_MODEL'
          AND analysis_artifact.artifact_type = 'HISTORICAL_ANALYSIS'
          AND analysis_bv.status = 'APPROVED'
        ORDER BY analysis_edge.source_version_id`,
      [source.source_version_id, input.organizationId, input.businessVersionId]
    );
    if (analyses.length !== 1) {
      throw new BaselineContextError(
        analyses.length === 0 ? 'BASELINE_ANALYSIS_NOT_CONFIGURED' : 'BASELINE_ANALYSIS_AMBIGUOUS',
        409,
        analyses.length === 0
          ? 'One compatible approved Historical Analysis source is required'
          : 'Exactly one compatible approved Historical Analysis source is required'
      );
    }
    const entity = await tx.queryOne<{ id: string }>(
      `SELECT id FROM finance_stmt_entities
        WHERE organization_id = ? AND business_version_id = ? AND id = ?`,
      [input.organizationId, source.source_version_id, input.entityId]
    );
    if (!entity)
      throw new BaselineContextError(
        'INVALID_CONTEXT_ENTITY',
        400,
        'Entity is not part of the source Statement Pack'
      );

    const periods = await tx.queryAll<{
      period_id: string;
      fiscal_calendar_id: string;
      period_type: string;
      period_start: string;
      period_end: string;
      previous_period_id: string | null;
    }>(
      `SELECT period_id, fiscal_calendar_id, period_type, period_start::text, period_end::text,
              previous_period_id
         FROM finance_stmt_periods
        WHERE organization_id = ? AND period_id = ANY(?)`,
      [input.organizationId, [input.openingBalanceSheetPeriodId, ...input.forecastPeriodIds]]
    );
    if (periods.length !== input.forecastPeriodIds.length + 1) {
      throw new BaselineContextError(
        'INVALID_CONTEXT_PERIOD',
        400,
        'One or more context periods are invalid'
      );
    }
    const periodById = new Map(periods.map((period) => [period.period_id, period]));
    const opening = periodById.get(input.openingBalanceSheetPeriodId)!;
    const forecast = input.forecastPeriodIds.map((id) => periodById.get(id)!);
    if (opening.period_type !== 'MONTH' || forecast.some((period) => period.period_type !== 'MONTH')) {
      throw new BaselineContextError('INVALID_CONTEXT_PERIOD', 400, 'All context periods must be monthly');
    }
    if (forecast.some((period) => period.fiscal_calendar_id !== opening.fiscal_calendar_id)) {
      throw new BaselineContextError(
        'INVALID_CONTEXT_PERIOD',
        400,
        'All periods must use the opening period calendar'
      );
    }
    for (let i = 0; i < forecast.length; i += 1) {
      const expectedPrevious = i === 0 ? opening.period_id : forecast[i - 1].period_id;
      if (
        forecast[i].previous_period_id !== expectedPrevious ||
        forecast[i].period_start <= opening.period_end ||
        (i > 0 && forecast[i].period_start <= forecast[i - 1].period_start)
      ) {
        throw new BaselineContextError(
          'INVALID_CONTEXT_PERIOD_ORDER',
          400,
          'Forecast periods must form a continuous ordered chain after opening'
        );
      }
    }
    const openingCell = await tx.queryOne<{ ok: number }>(
      `SELECT 1 AS ok
         FROM finance_stmt_lines l
         JOIN financial_statement_lines c ON c.id = l.canonical_line_id
        WHERE l.organization_id = ? AND l.business_version_id = ? AND l.entity_id = ?
          AND l.period_id = ? AND c.statement_type = 'BS'
        LIMIT 1`,
      [
        input.organizationId,
        source.source_version_id,
        input.entityId,
        input.openingBalanceSheetPeriodId,
      ]
    );
    if (!openingCell) {
      throw new BaselineContextError(
        'INVALID_OPENING_BALANCE_SHEET_PERIOD',
        409,
        'Opening period has no source balance-sheet data'
      );
    }

    const current = await tx.queryOne<{ version: number }>(
      `SELECT version FROM finance_baseline_workspace_contexts
        WHERE organization_id = ? AND business_version_id = ? FOR UPDATE`,
      [input.organizationId, input.businessVersionId]
    );
    const currentVersion = current?.version ?? 0;
    if (currentVersion !== input.expectedVersion) {
      throw new BaselineContextError(
        'BASELINE_CONTEXT_VERSION_CONFLICT',
        409,
        'Baseline context version changed',
        { currentVersion }
      );
    }
    const nextVersion = currentVersion + 1;
    await tx.queryRun(
      `INSERT INTO finance_baseline_workspace_contexts
         (organization_id, business_version_id, source_statement_version_id,
          source_analysis_version_id, entity_id, opening_balance_sheet_period_id,
          forecast_period_ids, version, configured_by)
       VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
       ON CONFLICT (business_version_id) DO UPDATE SET
         source_statement_version_id = EXCLUDED.source_statement_version_id,
         source_analysis_version_id = EXCLUDED.source_analysis_version_id,
         entity_id = EXCLUDED.entity_id,
         opening_balance_sheet_period_id = EXCLUDED.opening_balance_sheet_period_id,
         forecast_period_ids = EXCLUDED.forecast_period_ids,
         version = EXCLUDED.version,
         configured_by = EXCLUDED.configured_by,
         updated_at = now()`,
      [
        input.organizationId,
        input.businessVersionId,
        source.source_version_id,
        analyses[0].source_version_id,
        input.entityId,
        input.openingBalanceSheetPeriodId,
        JSON.stringify(input.forecastPeriodIds),
        nextVersion,
        input.actorId,
      ]
    );
    const response = await readContextTx(tx, input.organizationId, input.businessVersionId);
    await tx.queryRun(
      `INSERT INTO finance_baseline_context_command_receipts
         (organization_id, business_version_id, idempotency_key, request_hash, response_json, created_by)
       VALUES (?, ?, ?, ?, ?::jsonb, ?)`,
      [
        input.organizationId,
        input.businessVersionId,
        input.idempotencyKey,
        requestHash,
        JSON.stringify(response),
        input.actorId,
      ]
    );
    return { ...response, replay: false };
  });
}
