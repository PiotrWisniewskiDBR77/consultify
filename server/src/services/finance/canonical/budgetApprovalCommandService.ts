import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../../utils/queryHelpers.js';

const APPROVAL_ROLES = new Set(['OWNER', 'ADMIN', 'FINANCE_ADMIN']);

export interface ApproveBudgetParams {
  organizationId: string;
  userId: string;
  budgetId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface BudgetApprovalCommandResult {
  budgetId: string;
  snapshotId: string;
  status: 'APPROVED';
  budgetVersion: number;
  snapshotSha256: string;
  approvedBy: string;
  approvedAt: string;
  replay: boolean;
}

export class BudgetApprovalCommandError extends Error {
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

function isProjectionReady(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const periods = (value as { periods?: unknown }).periods;
  return (
    Array.isArray(periods) && periods.length > 0 && periods.every((row) => typeof row === 'string')
  );
}

export async function approveBudgetCommand(
  params: ApproveBudgetParams
): Promise<BudgetApprovalCommandResult> {
  const idempotencyKey = params.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 200) {
    throw new BudgetApprovalCommandError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  }
  if (!Number.isInteger(params.expectedVersion) || params.expectedVersion < 1) {
    throw new BudgetApprovalCommandError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );
  }
  const requestSha256 = sha256({
    budgetId: params.budgetId,
    expectedVersion: params.expectedVersion,
  });

  return withPgTransaction(async (tx) => {
    const membership = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members
          WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [params.organizationId, params.userId]
      )
    ).rows[0];
    if (String(membership?.status || '').toUpperCase() !== 'ACTIVE') {
      throw new BudgetApprovalCommandError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    }
    if (!APPROVAL_ROLES.has(String(membership.role || '').toUpperCase())) {
      throw new BudgetApprovalCommandError(
        'FINANCE_APPROVAL_FORBIDDEN',
        403,
        'Finance approval role is required'
      );
    }

    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${params.budgetId}:BUDGET_APPROVAL_COMMAND`,
    ]);
    const budget = (
      await tx.query<{
        id: string;
        status: string;
        version: number;
        created_by: string | null;
        title: string;
        period_start: string;
        period_end: string;
        granularity: string;
        currency: string;
        assumptions: unknown;
      }>(
        `SELECT id,status,version,created_by,title,period_start,period_end,granularity,currency,assumptions
           FROM budgets WHERE id=? AND organization_id=? FOR UPDATE`,
        [params.budgetId, params.organizationId]
      )
    ).rows[0];
    if (!budget) {
      throw new BudgetApprovalCommandError('BUDGET_NOT_FOUND', 404, 'Budget not found');
    }

    const prior = (
      await tx.query<{ request_sha256: string; response_json: BudgetApprovalCommandResult }>(
        `SELECT request_sha256,response_json FROM finance_budget_approval_command_receipts
          WHERE organization_id=? AND budget_id=? AND idempotency_key=?`,
        [params.organizationId, params.budgetId, idempotencyKey]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256) {
        throw new BudgetApprovalCommandError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another approval command'
        );
      }
      return { ...prior.response_json, replay: true };
    }
    if (budget.status !== 'DRAFT') {
      throw new BudgetApprovalCommandError(
        'BUDGET_IMMUTABLE',
        409,
        'Only a DRAFT budget can be approved'
      );
    }
    if (Number(budget.version) !== params.expectedVersion) {
      throw new BudgetApprovalCommandError(
        'BUDGET_VERSION_CONFLICT',
        409,
        'Budget version changed',
        { currentVersion: Number(budget.version) }
      );
    }
    if (!budget.created_by || budget.created_by === params.userId) {
      throw new BudgetApprovalCommandError(
        'SELF_APPROVAL_FORBIDDEN',
        403,
        'Budget creator cannot approve the same budget'
      );
    }

    const lines = (
      await tx.query<{
        id: string;
        line_code: string;
        line_name: string;
        statement_type: string;
        source: string;
        baseline_value: string;
        is_locked: boolean;
        display_order: number;
      }>(
        `SELECT id,line_code,line_name,statement_type,source,baseline_value::text,is_locked,display_order
           FROM budget_lines WHERE budget_id=? ORDER BY display_order,id FOR SHARE`,
        [params.budgetId]
      )
    ).rows;
    if (
      lines.length === 0 ||
      !lines.some(
        (line) =>
          line.line_code.toLowerCase().includes('capex') ||
          line.line_name.toLowerCase().includes('capex') ||
          line.statement_type.toLowerCase() === 'capex'
      )
    ) {
      throw new BudgetApprovalCommandError(
        'BUDGET_NOT_READY',
        409,
        'A governed CAPEX line is required before approval'
      );
    }
    const scenarios = (
      await tx.query<{
        id: string;
        scenario_type: string;
        name: string;
        adjustments: unknown;
        projections: unknown;
        summary_metrics: unknown;
      }>(
        `SELECT id,scenario_type,name,adjustments,projections,summary_metrics
           FROM budget_scenarios WHERE budget_id=? ORDER BY scenario_type,id FOR SHARE`,
        [params.budgetId]
      )
    ).rows;
    if (
      scenarios.length === 0 ||
      scenarios.some((scenario) => !isProjectionReady(scenario.projections))
    ) {
      throw new BudgetApprovalCommandError(
        'BUDGET_NOT_READY',
        409,
        'Every governed scenario must have a current projection before approval'
      );
    }

    const snapshot = {
      budget: {
        id: budget.id,
        title: budget.title,
        periodStart: budget.period_start,
        periodEnd: budget.period_end,
        granularity: budget.granularity,
        currency: budget.currency,
        assumptions: budget.assumptions,
        version: Number(budget.version),
        createdBy: budget.created_by,
      },
      lines,
      scenarios,
    };
    const snapshotSha256 = sha256(snapshot);
    const snapshotId = randomUUID();
    const approvedAt = new Date().toISOString();
    await tx.query(
      `INSERT INTO budget_snapshots(id,budget_id,version,snapshot_data,approved_by,created_at)
       VALUES(?,?,?,?,?,?)`,
      [
        snapshotId,
        params.budgetId,
        params.expectedVersion,
        JSON.stringify(snapshot),
        params.userId,
        approvedAt,
      ]
    );
    const approvedVersion = params.expectedVersion + 1;
    const updated = await tx.query(
      `UPDATE budgets SET status='APPROVED',approved_by=?,approved_at=?,version=?,updated_at=?
        WHERE id=? AND organization_id=? AND status='DRAFT' AND version=?`,
      [
        params.userId,
        approvedAt,
        approvedVersion,
        approvedAt,
        params.budgetId,
        params.organizationId,
        params.expectedVersion,
      ]
    );
    if (updated.rowCount !== 1) {
      throw new BudgetApprovalCommandError(
        'BUDGET_VERSION_CONFLICT',
        409,
        'Budget changed during approval'
      );
    }
    const response: BudgetApprovalCommandResult = {
      budgetId: params.budgetId,
      snapshotId,
      status: 'APPROVED',
      budgetVersion: approvedVersion,
      snapshotSha256,
      approvedBy: params.userId,
      approvedAt,
      replay: false,
    };
    await tx.query(
      `INSERT INTO finance_budget_approval_command_receipts
       (organization_id,budget_id,snapshot_id,idempotency_key,request_sha256,snapshot_sha256,
        expected_budget_version,approved_budget_version,response_json,approved_by,approved_at)
       VALUES(?,?,?,?,?,?,?,?,?::jsonb,?,?)`,
      [
        params.organizationId,
        params.budgetId,
        snapshotId,
        idempotencyKey,
        requestSha256,
        snapshotSha256,
        params.expectedVersion,
        approvedVersion,
        JSON.stringify(response),
        params.userId,
        approvedAt,
      ]
    );
    return response;
  });
}
