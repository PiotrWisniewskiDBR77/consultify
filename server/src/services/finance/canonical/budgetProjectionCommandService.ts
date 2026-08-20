import { createHash } from 'node:crypto';

import {
  computeProjections,
  computeSummaryMetrics,
  generateProjectionPeriods,
  type BudgetLine,
  type ProjectionData,
  type ScenarioAdjustment,
  type SummaryMetrics,
} from '../../budgetingService.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';
import { withPgTransaction } from '../../../utils/queryHelpers.js';

export interface ProjectBudgetScenarioParams {
  organizationId: string;
  userId: string;
  budgetId: string;
  scenarioId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface BudgetProjectionCommandResult {
  budgetId: string;
  scenario: {
    id: string;
    scenarioType: string;
    projections: ProjectionData;
    summaryMetrics: SummaryMetrics;
  };
  budgetVersion: number;
  projectionSha256: string;
  replay: boolean;
}

export class BudgetProjectionCommandError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function validateAdjustments(value: unknown): ScenarioAdjustment {
  const source = asObject(value);
  const result: ScenarioAdjustment = {};
  for (const [key, raw] of Object.entries(source)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      throw new BudgetProjectionCommandError(
        'BUDGET_SCENARIO_NOT_READY',
        409,
        'Scenario adjustments must contain finite numbers'
      );
    }
    result[key] = raw;
  }
  return result;
}

function assertProjectionIsFinite(projection: ProjectionData, summary: SummaryMetrics): void {
  const values = [
    ...Object.values(projection.lines).flatMap((periodValues) => Object.values(periodValues)),
    ...Object.values(summary),
  ];
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new BudgetProjectionCommandError(
      'BUDGET_PROJECTION_INVALID',
      409,
      'Projection produced a non-finite value'
    );
  }
}

export async function projectBudgetScenario(
  params: ProjectBudgetScenarioParams
): Promise<BudgetProjectionCommandResult> {
  const idempotencyKey = params.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 200) {
    throw new BudgetProjectionCommandError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  }
  if (!Number.isInteger(params.expectedVersion) || params.expectedVersion < 1) {
    throw new BudgetProjectionCommandError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );
  }
  const requestSha256 = sha256({
    budgetId: params.budgetId,
    scenarioId: params.scenarioId,
    expectedVersion: params.expectedVersion,
  });

  return withPgTransaction(async (tx) => {
    const member = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members
          WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [params.organizationId, params.userId]
      )
    ).rows[0];
    if (String(member?.status || '').toUpperCase() !== 'ACTIVE') {
      throw new BudgetProjectionCommandError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    }
    if (!hasFinanceEditRole(member.role)) {
      throw new BudgetProjectionCommandError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance editor role is required'
      );
    }

    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${params.budgetId}:BUDGET_PROJECTION_COMMAND`,
    ]);
    const budget = (
      await tx.query<{
        id: string;
        status: string;
        version: number;
        period_start: string;
        period_end: string;
        granularity: string;
      }>(
        `SELECT id,status,version,period_start,period_end,granularity
           FROM budgets WHERE id=? AND organization_id=? FOR UPDATE`,
        [params.budgetId, params.organizationId]
      )
    ).rows[0];
    if (!budget) {
      throw new BudgetProjectionCommandError('BUDGET_NOT_FOUND', 404, 'Budget not found');
    }

    const prior = (
      await tx.query<{ request_sha256: string; response_json: BudgetProjectionCommandResult }>(
        `SELECT request_sha256,response_json
           FROM finance_budget_projection_command_receipts
          WHERE organization_id=? AND budget_id=? AND idempotency_key=?`,
        [params.organizationId, params.budgetId, idempotencyKey]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256) {
        throw new BudgetProjectionCommandError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another projection command'
        );
      }
      return { ...prior.response_json, replay: true };
    }

    if (budget.status !== 'DRAFT') {
      throw new BudgetProjectionCommandError(
        'BUDGET_IMMUTABLE',
        409,
        'Only a DRAFT budget can be projected'
      );
    }
    if (Number(budget.version) !== params.expectedVersion) {
      throw new BudgetProjectionCommandError(
        'BUDGET_VERSION_CONFLICT',
        409,
        'Budget version changed',
        { currentVersion: Number(budget.version) }
      );
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(budget.period_start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(budget.period_end) ||
      !['monthly', 'quarterly', 'annual'].includes(budget.granularity)
    ) {
      throw new BudgetProjectionCommandError(
        'BUDGET_NOT_READY',
        409,
        'Budget period configuration is invalid'
      );
    }

    const scenario = (
      await tx.query<{
        id: string;
        scenario_type: string;
        adjustments: unknown;
      }>(
        `SELECT id,scenario_type,adjustments
           FROM budget_scenarios WHERE id=? AND budget_id=? FOR UPDATE`,
        [params.scenarioId, params.budgetId]
      )
    ).rows[0];
    if (!scenario) {
      throw new BudgetProjectionCommandError(
        'BUDGET_SCENARIO_NOT_FOUND',
        404,
        'Budget scenario not found'
      );
    }
    if (!['base', 'optimistic', 'conservative'].includes(scenario.scenario_type)) {
      throw new BudgetProjectionCommandError(
        'BUDGET_SCENARIO_NOT_READY',
        409,
        'Scenario type is invalid'
      );
    }

    const lineRows = (
      await tx.query<{
        id: string;
        budget_id: string;
        line_code: string;
        line_name: string;
        statement_type: string;
        source: string;
        driver_kpi_id: string | null;
        driver_formula: string | null;
        baseline_value: string;
        is_locked: boolean;
        display_order: number;
      }>(
        `SELECT id,budget_id,line_code,line_name,statement_type,source,driver_kpi_id,
                driver_formula,baseline_value::text,is_locked,display_order
           FROM budget_lines WHERE budget_id=? ORDER BY display_order,id FOR SHARE`,
        [params.budgetId]
      )
    ).rows;
    if (lineRows.length === 0) {
      throw new BudgetProjectionCommandError(
        'BUDGET_NOT_READY',
        409,
        'Budget has no governed lines'
      );
    }
    const lines: BudgetLine[] = lineRows.map((row) => {
      const baselineValue = Number(row.baseline_value);
      if (!Number.isFinite(baselineValue)) {
        throw new BudgetProjectionCommandError(
          'BUDGET_NOT_READY',
          409,
          'Budget line has a non-finite baseline'
        );
      }
      return {
        id: row.id,
        budgetId: row.budget_id,
        lineCode: row.line_code,
        lineName: row.line_name,
        statementType: row.statement_type,
        source: row.source,
        driverKpiId: row.driver_kpi_id || undefined,
        driverFormula: row.driver_formula || undefined,
        baselineValue,
        isLocked: row.is_locked,
        displayOrder: Number(row.display_order),
      };
    });
    const periods = generateProjectionPeriods(
      budget.period_start,
      budget.period_end,
      budget.granularity
    );
    if (periods.length === 0 || periods.length > 600) {
      throw new BudgetProjectionCommandError(
        'BUDGET_NOT_READY',
        409,
        'Budget projection period set is invalid'
      );
    }
    const adjustments = validateAdjustments(scenario.adjustments);
    const projections = computeProjections(lines, periods, adjustments, scenario.scenario_type);
    const summaryMetrics = computeSummaryMetrics(projections);
    assertProjectionIsFinite(projections, summaryMetrics);
    const projectionSha256 = sha256({ projections, summaryMetrics });

    await tx.query(
      `UPDATE budget_scenarios
          SET projections=?::jsonb,summary_metrics=?::jsonb,updated_at=now()
        WHERE id=? AND budget_id=?`,
      [
        JSON.stringify(projections),
        JSON.stringify(summaryMetrics),
        params.scenarioId,
        params.budgetId,
      ]
    );
    const appliedVersion = params.expectedVersion + 1;
    const updated = await tx.query(
      `UPDATE budgets SET version=?,updated_at=now()
        WHERE id=? AND organization_id=? AND version=?`,
      [appliedVersion, params.budgetId, params.organizationId, params.expectedVersion]
    );
    if (updated.rowCount !== 1) {
      throw new BudgetProjectionCommandError(
        'BUDGET_VERSION_CONFLICT',
        409,
        'Budget version changed'
      );
    }

    const response: BudgetProjectionCommandResult = {
      budgetId: params.budgetId,
      scenario: {
        id: params.scenarioId,
        scenarioType: scenario.scenario_type,
        projections,
        summaryMetrics,
      },
      budgetVersion: appliedVersion,
      projectionSha256,
      replay: false,
    };
    await tx.query(
      `INSERT INTO finance_budget_projection_command_receipts
       (organization_id,budget_id,scenario_id,idempotency_key,request_sha256,
        projection_sha256,expected_budget_version,applied_budget_version,response_json,created_by)
       VALUES (?,?,?,?,?,?,?,?,?::jsonb,?)`,
      [
        params.organizationId,
        params.budgetId,
        params.scenarioId,
        idempotencyKey,
        requestSha256,
        projectionSha256,
        params.expectedVersion,
        appliedVersion,
        JSON.stringify(response),
        params.userId,
      ]
    );
    return response;
  });
}
