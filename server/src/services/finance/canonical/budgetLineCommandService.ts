import { createHash } from 'node:crypto';

import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';
import { withPgTransaction } from '../../../utils/queryHelpers.js';

export type BudgetLineSource = 'baseline' | 'manual' | 'driver' | 'formula';

export interface BudgetLinePatch {
  baselineValue?: string;
  source?: BudgetLineSource;
  driverKpiId?: string | null;
  driverFormula?: string | null;
  isLocked?: boolean;
}

export interface ApplyBudgetLineCommandParams {
  organizationId: string;
  userId: string;
  budgetId: string;
  lineId: string;
  expectedVersion: number;
  idempotencyKey: string;
  patch: BudgetLinePatch;
}

export interface BudgetLineCommandResult {
  budgetId: string;
  line: {
    id: string;
    lineCode: string;
    baselineValue: string;
    source: BudgetLineSource;
    driverKpiId: string | null;
    driverFormula: string | null;
    isLocked: boolean;
  };
  budgetVersion: number;
  replay: boolean;
}

export class BudgetLineCommandError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizePatch(input: BudgetLinePatch): BudgetLinePatch {
  const patch: BudgetLinePatch = {};
  if (input.baselineValue !== undefined) {
    const value = String(input.baselineValue).trim();
    if (!DECIMAL.test(value) || value.length > 80)
      throw new BudgetLineCommandError(
        'INVALID_BUDGET_LINE_VALUE',
        400,
        'baselineValue must be a finite decimal string'
      );
    patch.baselineValue = value;
  }
  if (input.source !== undefined) {
    if (!['baseline', 'manual', 'driver', 'formula'].includes(input.source))
      throw new BudgetLineCommandError('INVALID_BUDGET_LINE_SOURCE', 400, 'source is invalid');
    patch.source = input.source;
  }
  if (input.driverKpiId !== undefined) {
    if (input.driverKpiId !== null && !String(input.driverKpiId).trim())
      throw new BudgetLineCommandError(
        'INVALID_BUDGET_LINE_DRIVER',
        400,
        'driverKpiId cannot be blank'
      );
    patch.driverKpiId = input.driverKpiId === null ? null : String(input.driverKpiId).trim();
  }
  if (input.driverFormula !== undefined) {
    const formula = input.driverFormula === null ? null : String(input.driverFormula).trim();
    if (formula !== null && formula.length > 4000)
      throw new BudgetLineCommandError(
        'INVALID_BUDGET_LINE_FORMULA',
        400,
        'driverFormula is too long'
      );
    patch.driverFormula = formula;
  }
  if (input.isLocked !== undefined) {
    if (typeof input.isLocked !== 'boolean')
      throw new BudgetLineCommandError('INVALID_BUDGET_LINE_LOCK', 400, 'isLocked must be boolean');
    patch.isLocked = input.isLocked;
  }
  if (Object.keys(patch).length === 0)
    throw new BudgetLineCommandError(
      'EMPTY_BUDGET_LINE_PATCH',
      400,
      'At least one field is required'
    );
  return patch;
}

export async function applyBudgetLineCommand(
  params: ApplyBudgetLineCommandParams
): Promise<BudgetLineCommandResult> {
  const idempotencyKey = params.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 200)
    throw new BudgetLineCommandError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  if (!Number.isInteger(params.expectedVersion) || params.expectedVersion < 1)
    throw new BudgetLineCommandError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );
  const patch = normalizePatch(params.patch);
  const requestSha256 = hash({
    budgetId: params.budgetId,
    lineId: params.lineId,
    expectedVersion: params.expectedVersion,
    patch,
  });

  return withPgTransaction(async (tx) => {
    const member = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members
          WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [params.organizationId, params.userId]
      )
    ).rows[0];
    if (String(member?.status || '').toUpperCase() !== 'ACTIVE')
      throw new BudgetLineCommandError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    if (!hasFinanceEditRole(member.role))
      throw new BudgetLineCommandError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance editor role is required'
      );

    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${params.budgetId}:BUDGET_LINE_COMMAND`,
    ]);
    const budget = (
      await tx.query<{ id: string; status: string; version: number }>(
        `SELECT id,status,version FROM budgets
          WHERE id=? AND organization_id=? FOR UPDATE`,
        [params.budgetId, params.organizationId]
      )
    ).rows[0];
    if (!budget) throw new BudgetLineCommandError('BUDGET_NOT_FOUND', 404, 'Budget not found');

    const prior = (
      await tx.query<{ request_sha256: string; response_json: BudgetLineCommandResult }>(
        `SELECT request_sha256,response_json
           FROM finance_budget_line_command_receipts
          WHERE organization_id=? AND budget_id=? AND idempotency_key=?`,
        [params.organizationId, params.budgetId, idempotencyKey]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256)
        throw new BudgetLineCommandError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another line command'
        );
      return { ...prior.response_json, replay: true };
    }

    if (budget.status !== 'DRAFT')
      throw new BudgetLineCommandError(
        'BUDGET_IMMUTABLE',
        409,
        'Only a DRAFT budget can be edited'
      );
    if (Number(budget.version) !== params.expectedVersion)
      throw new BudgetLineCommandError('BUDGET_VERSION_CONFLICT', 409, 'Budget version changed', {
        currentVersion: Number(budget.version),
      });

    const existing = (
      await tx.query<{
        id: string;
        line_code: string;
        baseline_value: string;
        source: BudgetLineSource;
        driver_kpi_id: string | null;
        driver_formula: string | null;
        is_locked: boolean;
      }>(
        `SELECT id,line_code,baseline_value::text,source,driver_kpi_id,driver_formula,is_locked
           FROM budget_lines WHERE id=? AND budget_id=? FOR UPDATE`,
        [params.lineId, params.budgetId]
      )
    ).rows[0];
    if (!existing)
      throw new BudgetLineCommandError('BUDGET_LINE_NOT_FOUND', 404, 'Budget line not found');

    const next = {
      baselineValue: patch.baselineValue ?? existing.baseline_value,
      source: patch.source ?? existing.source,
      driverKpiId: patch.driverKpiId !== undefined ? patch.driverKpiId : existing.driver_kpi_id,
      driverFormula:
        patch.driverFormula !== undefined ? patch.driverFormula : existing.driver_formula,
      isLocked: patch.isLocked ?? existing.is_locked,
    };
    await tx.query(
      `UPDATE budget_lines
          SET baseline_value=?,source=?,driver_kpi_id=?,driver_formula=?,is_locked=?
        WHERE id=? AND budget_id=?`,
      [
        next.baselineValue,
        next.source,
        next.driverKpiId,
        next.driverFormula,
        next.isLocked,
        params.lineId,
        params.budgetId,
      ]
    );
    const appliedVersion = params.expectedVersion + 1;
    await tx.query(
      `UPDATE budgets SET version=?,updated_at=now()
        WHERE id=? AND organization_id=? AND version=?`,
      [appliedVersion, params.budgetId, params.organizationId, params.expectedVersion]
    );
    const response: BudgetLineCommandResult = {
      budgetId: params.budgetId,
      line: {
        id: existing.id,
        lineCode: existing.line_code,
        baselineValue: next.baselineValue,
        source: next.source,
        driverKpiId: next.driverKpiId,
        driverFormula: next.driverFormula,
        isLocked: next.isLocked,
      },
      budgetVersion: appliedVersion,
      replay: false,
    };
    await tx.query(
      `INSERT INTO finance_budget_line_command_receipts
       (organization_id,budget_id,line_id,idempotency_key,request_sha256,
        expected_budget_version,applied_budget_version,response_json,created_by)
       VALUES (?,?,?,?,?,?,?,?::jsonb,?)`,
      [
        params.organizationId,
        params.budgetId,
        params.lineId,
        idempotencyKey,
        requestSha256,
        params.expectedVersion,
        appliedVersion,
        JSON.stringify(response),
        params.userId,
      ]
    );
    return response;
  });
}
