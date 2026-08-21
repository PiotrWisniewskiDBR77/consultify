import { createHash } from 'node:crypto';

import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';

export interface UnlinkBudgetInitiativeParams {
  organizationId: string;
  userId: string;
  budgetId: string;
  initiativeId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface BudgetInitiativeUnlinkResult {
  budgetId: string;
  initiativeId: string;
  budgetVersion: number;
  removedLinkSnapshot: {
    revenueUplift: string;
    costSavings: string;
    capexRequired: string;
  };
  replay: boolean;
}

export class BudgetInitiativeUnlinkCommandError extends Error {
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

export async function unlinkBudgetInitiativeCommand(
  params: UnlinkBudgetInitiativeParams
): Promise<BudgetInitiativeUnlinkResult> {
  const key = params.idempotencyKey.trim();
  if (!key || key.length > 200)
    throw new BudgetInitiativeUnlinkCommandError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  if (!params.initiativeId.trim())
    throw new BudgetInitiativeUnlinkCommandError(
      'INITIATIVE_ID_REQUIRED',
      400,
      'initiativeId is required'
    );
  if (!Number.isInteger(params.expectedVersion) || params.expectedVersion < 1)
    throw new BudgetInitiativeUnlinkCommandError(
      'INVALID_EXPECTED_VERSION',
      400,
      'expectedVersion must be a positive integer'
    );

  const requestSha256 = hash({
    budgetId: params.budgetId,
    initiativeId: params.initiativeId,
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
    if (String(member?.status || '').toUpperCase() !== 'ACTIVE')
      throw new BudgetInitiativeUnlinkCommandError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    if (!hasFinanceEditRole(member.role))
      throw new BudgetInitiativeUnlinkCommandError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance editor role is required'
      );

    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${params.budgetId}:BUDGET_INITIATIVE_LINK`,
    ]);
    const budget = (
      await tx.query<{ status: string; version: number }>(
        `SELECT status,version FROM budgets
         WHERE id=? AND organization_id=? FOR UPDATE`,
        [params.budgetId, params.organizationId]
      )
    ).rows[0];
    if (!budget)
      throw new BudgetInitiativeUnlinkCommandError('BUDGET_NOT_FOUND', 404, 'Budget not found');

    const prior = (
      await tx.query<{
        request_sha256: string;
        response_json: BudgetInitiativeUnlinkResult;
      }>(
        `SELECT request_sha256,response_json
         FROM finance_budget_initiative_unlink_receipts
         WHERE organization_id=? AND budget_id=? AND idempotency_key=?`,
        [params.organizationId, params.budgetId, key]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256)
        throw new BudgetInitiativeUnlinkCommandError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another unlink command'
        );
      return { ...prior.response_json, replay: true };
    }

    if (budget.status !== 'DRAFT')
      throw new BudgetInitiativeUnlinkCommandError(
        'BUDGET_IMMUTABLE',
        409,
        'Only a DRAFT budget can be edited'
      );
    if (Number(budget.version) !== params.expectedVersion)
      throw new BudgetInitiativeUnlinkCommandError(
        'BUDGET_VERSION_CONFLICT',
        409,
        'Budget version changed',
        { currentVersion: Number(budget.version) }
      );

    const link = (
      await tx.query<{
        revenue_uplift: string;
        cost_savings: string;
        capex_required: string;
      }>(
        `SELECT revenue_uplift::text,cost_savings::text,capex_required::text
         FROM budget_initiative_links
         WHERE budget_id=? AND initiative_id=? AND organization_id=? FOR UPDATE`,
        [params.budgetId, params.initiativeId, params.organizationId]
      )
    ).rows[0];
    if (!link)
      throw new BudgetInitiativeUnlinkCommandError(
        'BUDGET_INITIATIVE_LINK_NOT_FOUND',
        404,
        'Budget initiative link not found'
      );

    const removedLinkSnapshot = {
      revenueUplift: link.revenue_uplift,
      costSavings: link.cost_savings,
      capexRequired: link.capex_required,
    };
    const removed = await tx.query(
      `DELETE FROM budget_initiative_links
       WHERE budget_id=? AND initiative_id=? AND organization_id=?`,
      [params.budgetId, params.initiativeId, params.organizationId]
    );
    if (removed.rowCount !== 1)
      throw new BudgetInitiativeUnlinkCommandError(
        'BUDGET_INITIATIVE_LINK_NOT_FOUND',
        404,
        'Budget initiative link disappeared before unlink commit'
      );

    const applied = params.expectedVersion + 1;
    const updated = await tx.query(
      `UPDATE budgets SET version=?,updated_at=now()
       WHERE id=? AND organization_id=? AND version=? AND status='DRAFT'`,
      [applied, params.budgetId, params.organizationId, params.expectedVersion]
    );
    if (updated.rowCount !== 1)
      throw new BudgetInitiativeUnlinkCommandError(
        'BUDGET_VERSION_CONFLICT',
        409,
        'Budget changed before unlink commit'
      );

    const response: BudgetInitiativeUnlinkResult = {
      budgetId: params.budgetId,
      initiativeId: params.initiativeId,
      budgetVersion: applied,
      removedLinkSnapshot,
      replay: false,
    };
    await tx.query(
      `INSERT INTO finance_budget_initiative_unlink_receipts(
         organization_id,budget_id,initiative_id,idempotency_key,request_sha256,
         expected_budget_version,applied_budget_version,removed_link_snapshot_json,
         response_json,created_by
       ) VALUES(?,?,?,?,?,?,?,?,?::jsonb,?)`,
      [
        params.organizationId,
        params.budgetId,
        params.initiativeId,
        key,
        requestSha256,
        params.expectedVersion,
        applied,
        JSON.stringify(removedLinkSnapshot),
        JSON.stringify(response),
        params.userId,
      ]
    );
    return response;
  });
}
