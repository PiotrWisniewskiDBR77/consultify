import { createHash } from 'node:crypto';

import { createBudget } from '../../budgetingService.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';
import { withPgTransaction } from '../../../utils/queryHelpers.js';

export type BudgetGranularity = 'monthly' | 'quarterly' | 'annual';

export interface RegisterBudgetParams {
  organizationId: string;
  userId: string;
  title: string;
  description?: string;
  projectId?: string;
  periodStart: string;
  periodEnd: string;
  granularity?: BudgetGranularity;
  currency?: string;
  sourceKind: 'manual' | 'tool_session';
  sourceToolSessionId?: string;
  idempotencyKey: string;
}

export interface RegisterBudgetResult {
  budget: Awaited<ReturnType<typeof createBudget>>;
  lineCount: number;
  scenarioCount: number;
  replay: boolean;
}

export class BudgetRegistrationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function isoDate(value: string, field: string): string {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new BudgetRegistrationError('INVALID_BUDGET_PERIOD', 400, `${field} must be YYYY-MM-DD`);
  }
  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new BudgetRegistrationError('INVALID_BUDGET_PERIOD', 400, `${field} is not a valid date`);
  }
  return normalized;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function registerBudget(params: RegisterBudgetParams): Promise<RegisterBudgetResult> {
  const idempotencyKey = params.idempotencyKey.trim();
  const title = params.title.trim();
  const sourceToolSessionId = params.sourceToolSessionId?.trim() || null;
  const periodStart = isoDate(params.periodStart, 'periodStart');
  const periodEnd = isoDate(params.periodEnd, 'periodEnd');
  const granularity = params.granularity ?? 'monthly';
  const currency = (params.currency ?? 'PLN').trim().toUpperCase();
  if (!['manual', 'tool_session'].includes(params.sourceKind))
    throw new BudgetRegistrationError('INVALID_BUDGET_SOURCE', 400, 'sourceKind is invalid');
  if (!idempotencyKey || idempotencyKey.length > 200)
    throw new BudgetRegistrationError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  if (!title || title.length > 300)
    throw new BudgetRegistrationError(
      'INVALID_BUDGET_TITLE',
      400,
      'title must be 1..300 characters'
    );
  if (params.sourceKind === 'tool_session' && !sourceToolSessionId)
    throw new BudgetRegistrationError(
      'SOURCE_SESSION_REQUIRED',
      400,
      'sourceToolSessionId is required'
    );
  if (params.sourceKind === 'manual' && sourceToolSessionId)
    throw new BudgetRegistrationError(
      'INVALID_BUDGET_SOURCE',
      400,
      'Manual source cannot carry a tool session'
    );
  if (periodStart >= periodEnd)
    throw new BudgetRegistrationError(
      'INVALID_BUDGET_PERIOD',
      400,
      'periodStart must precede periodEnd'
    );
  if (!['monthly', 'quarterly', 'annual'].includes(granularity))
    throw new BudgetRegistrationError('INVALID_BUDGET_GRANULARITY', 400, 'granularity is invalid');
  if (!/^[A-Z]{3}$/.test(currency))
    throw new BudgetRegistrationError('INVALID_BUDGET_CURRENCY', 400, 'currency must be ISO-4217');

  const command = {
    title,
    description: params.description?.trim() || null,
    projectId: params.projectId?.trim() || null,
    periodStart,
    periodEnd,
    granularity,
    currency,
    sourceKind: params.sourceKind,
    sourceToolSessionId,
  };
  const requestSha256 = sha256(command);

  return withPgTransaction(async (tx) => {
    const member = (
      await tx.query<{ status: string; role: string }>(
        `SELECT status,role FROM organization_members
          WHERE organization_id=? AND user_id=? FOR UPDATE`,
        [params.organizationId, params.userId]
      )
    ).rows[0];
    if (String(member?.status || '').toUpperCase() !== 'ACTIVE')
      throw new BudgetRegistrationError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active organization membership is required'
      );
    if (!hasFinanceEditRole(member.role))
      throw new BudgetRegistrationError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance editor role is required'
      );

    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${idempotencyKey}:BUDGET_REGISTRATION`,
    ]);
    const prior = (
      await tx.query<{ request_sha256: string; response_json: RegisterBudgetResult }>(
        `SELECT request_sha256,response_json
           FROM finance_budget_registration_receipts
          WHERE organization_id=? AND idempotency_key=?`,
        [params.organizationId, idempotencyKey]
      )
    ).rows[0];
    if (prior) {
      if (prior.request_sha256 !== requestSha256)
        throw new BudgetRegistrationError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Idempotency key is bound to another budget registration'
        );
      return { ...prior.response_json, replay: true };
    }

    if (sourceToolSessionId) {
      const source = (
        await tx.query<{ id: string }>(
          `SELECT id FROM tool_sessions WHERE id=? AND organization_id=? FOR SHARE`,
          [sourceToolSessionId, params.organizationId]
        )
      ).rows[0];
      if (!source)
        throw new BudgetRegistrationError('SOURCE_NOT_FOUND', 404, 'Source session not found');
    }
    if (command.projectId) {
      const project = (
        await tx.query<{ id: string }>(`SELECT id FROM projects WHERE id=? AND organization_id=?`, [
          command.projectId,
          params.organizationId,
        ])
      ).rows[0];
      if (!project)
        throw new BudgetRegistrationError('PROJECT_NOT_FOUND', 404, 'Project not found');
    }

    const budget = await createBudget(
      params.organizationId,
      {
        title: command.title,
        description: command.description ?? undefined,
        projectId: command.projectId ?? undefined,
        periodStart,
        periodEnd,
        granularity,
        currency,
      },
      params.userId
    );
    await tx.query(
      `UPDATE budgets
          SET source_tool_session_id=?,registration_request_sha256=?
        WHERE id=? AND organization_id=?`,
      [sourceToolSessionId, requestSha256, budget.id, params.organizationId]
    );
    const counts = (
      await tx.query<{ line_count: number; scenario_count: number }>(
        `SELECT
           (SELECT count(*)::int FROM budget_lines WHERE budget_id=?) line_count,
           (SELECT count(*)::int FROM budget_scenarios WHERE budget_id=?) scenario_count`,
        [budget.id, budget.id]
      )
    ).rows[0];
    if (Number(counts?.line_count) !== 15 || Number(counts?.scenario_count) !== 3)
      throw new Error('BUDGET_REGISTRATION_INCOMPLETE');
    const response: RegisterBudgetResult = {
      budget,
      lineCount: 15,
      scenarioCount: 3,
      replay: false,
    };
    await tx.query(
      `INSERT INTO finance_budget_registration_receipts
       (organization_id,idempotency_key,request_sha256,budget_id,source_kind,source_tool_session_id,
        response_json,created_by)
       VALUES (?,?,?,?,?,?,?::jsonb,?)`,
      [
        params.organizationId,
        idempotencyKey,
        requestSha256,
        budget.id,
        params.sourceKind,
        sourceToolSessionId,
        JSON.stringify(response),
        params.userId,
      ]
    );
    return response;
  });
}
