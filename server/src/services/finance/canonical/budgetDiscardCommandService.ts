import { createHash } from 'node:crypto';

import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';
import { withPgTransaction } from '../../../utils/queryHelpers.js';

export interface DiscardBudgetParams {
  organizationId: string;
  userId: string;
  budgetId: string;
  expectedVersion: number;
  idempotencyKey: string;
  reason: string;
}
export interface BudgetDiscardResult {
  budgetId: string;
  status: 'ARCHIVED';
  budgetVersion: number;
  archivedBy: string;
  archivedAt: string;
  replay: boolean;
}
export class BudgetDiscardCommandError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function discardBudgetCommand(
  params: DiscardBudgetParams
): Promise<BudgetDiscardResult> {
  const key = params.idempotencyKey.trim();
  const reason = params.reason.trim();
  if (!key || key.length > 200)
    throw new BudgetDiscardCommandError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  if (!reason || reason.length > 500)
    throw new BudgetDiscardCommandError('INVALID_REASON', 400, 'reason must be 1..500 characters');
  if (!Number.isInteger(params.expectedVersion) || params.expectedVersion < 1)
    throw new BudgetDiscardCommandError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );
  const requestSha256 = hash({
    budgetId: params.budgetId,
    expectedVersion: params.expectedVersion,
    reason,
  });
  return withPgTransaction(async (tx) => {
    const membership = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [params.organizationId, params.userId]
      )
    ).rows[0];
    if (String(membership?.status || '').toUpperCase() !== 'ACTIVE')
      throw new BudgetDiscardCommandError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    if (!hasFinanceEditRole(membership.role))
      throw new BudgetDiscardCommandError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance edit role is required'
      );
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${params.budgetId}:BUDGET_DISCARD_COMMAND`,
    ]);
    const budget = (
      await tx.query<{ id: string; status: string; version: number }>(
        `SELECT id,status,version FROM budgets WHERE id=? AND organization_id=? FOR UPDATE`,
        [params.budgetId, params.organizationId]
      )
    ).rows[0];
    if (!budget) throw new BudgetDiscardCommandError('BUDGET_NOT_FOUND', 404, 'Budget not found');
    const prior = (
      await tx.query<{ request_sha256: string; response_json: BudgetDiscardResult }>(
        `SELECT request_sha256,response_json FROM finance_budget_discard_command_receipts WHERE organization_id=? AND budget_id=? AND idempotency_key=?`,
        [params.organizationId, params.budgetId, key]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256)
        throw new BudgetDiscardCommandError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another discard command'
        );
      return { ...prior.response_json, replay: true };
    }
    if (budget.status === 'APPROVED')
      throw new BudgetDiscardCommandError(
        'APPROVED_BUDGET_ARCHIVE_FORBIDDEN',
        409,
        'Approved budget cannot be discarded'
      );
    if (budget.status !== 'DRAFT')
      throw new BudgetDiscardCommandError(
        'BUDGET_IMMUTABLE',
        409,
        'Only a DRAFT budget can be discarded'
      );
    if (Number(budget.version) !== params.expectedVersion)
      throw new BudgetDiscardCommandError(
        'BUDGET_VERSION_CONFLICT',
        409,
        'Budget version changed',
        { currentVersion: Number(budget.version) }
      );
    const archivedAt = new Date().toISOString();
    const archivedVersion = params.expectedVersion + 1;
    const result: BudgetDiscardResult = {
      budgetId: params.budgetId,
      status: 'ARCHIVED',
      budgetVersion: archivedVersion,
      archivedBy: params.userId,
      archivedAt,
      replay: false,
    };
    const updated = await tx.query(
      `UPDATE budgets SET status='ARCHIVED',version=?,updated_at=? WHERE id=? AND organization_id=? AND status='DRAFT' AND version=?`,
      [archivedVersion, archivedAt, params.budgetId, params.organizationId, params.expectedVersion]
    );
    if (updated.rowCount !== 1)
      throw new BudgetDiscardCommandError(
        'BUDGET_VERSION_CONFLICT',
        409,
        'Budget changed before discard'
      );
    await tx.query(
      `INSERT INTO finance_budget_discard_command_receipts (organization_id,budget_id,idempotency_key,request_sha256,expected_budget_version,archived_budget_version,reason,response_json,archived_by,archived_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        params.organizationId,
        params.budgetId,
        key,
        requestSha256,
        params.expectedVersion,
        archivedVersion,
        reason,
        JSON.stringify(result),
        params.userId,
        archivedAt,
      ]
    );
    return result;
  });
}
