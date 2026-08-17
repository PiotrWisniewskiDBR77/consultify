import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { type PgTransactionClient, withPgTransaction } from '../utils/queryHelpers.js';

export type ExecutionActionOutcome = 'SUCCEEDED' | 'DENIED' | 'NOT_FOUND' | 'CONFLICT';

export type ExecutionActionPolicy = {
  actionId: string;
  targetType: string;
  destructive: boolean;
  minimumRole: 'MEMBER' | 'ADMIN' | 'OWNER';
  runtimeState: 'IMPLEMENTED' | 'HIDDEN';
  auditRequired: boolean;
};

const ROLE_RANK = { MEMBER: 1, ADMIN: 2, OWNER: 3 } as const;

function classifyOutcome(error: unknown): Exclude<ExecutionActionOutcome, 'SUCCEEDED'> {
  const code = String((error as { code?: unknown })?.code || (error as Error)?.message || '');
  if (/not_found|access_denied/i.test(code)) return 'NOT_FOUND';
  if (/conflict|stale|version|already|invalid_transition/i.test(code)) return 'CONFLICT';
  return 'DENIED';
}

export async function getExecutionActionPolicy(
  actionId: string,
  client?: PgTransactionClient
): Promise<ExecutionActionPolicy | null> {
  const sql = `SELECT action_id,target_type,destructive,minimum_role,runtime_state,audit_required
       FROM execution_action_registry WHERE action_id = ?`;
  const row = client
    ? (await client.query<any>(sql, [actionId])).rows[0] ?? null
    : await dbGet<any>(sql, [actionId], { fallback: false });
  if (!row) return null;
  return {
    actionId: row.action_id,
    targetType: row.target_type,
    destructive: Boolean(row.destructive),
    minimumRole: row.minimum_role,
    runtimeState: row.runtime_state,
    auditRequired: Boolean(row.audit_required),
  };
}

export async function requireImplementedExecutionAction(
  actionId: string
): Promise<ExecutionActionPolicy> {
  const policy = await getExecutionActionPolicy(actionId);
  if (!policy || policy.runtimeState !== 'IMPLEMENTED') {
    throw new Error('execution_action_hidden_or_unregistered');
  }
  return policy;
}

/**
 * Single runtime authority for governed Execution actions. The caller supplies
 * the membership role resolved from the database (never the JWT claim). Every
 * terminal result is appended to the shared action audit.
 */
export async function executeGovernedExecutionAction<T>(input: {
  organizationId: string;
  actionId: string;
  targetId: string;
  actorId: string;
  membershipRole: 'MEMBER' | 'ADMIN' | 'OWNER';
  requestId?: string | null;
  operation: () => Promise<T>;
}): Promise<T> {
  const policy = await getExecutionActionPolicy(input.actionId);
  if (!policy) throw new Error('execution_action_hidden_or_unregistered');
  if (policy.runtimeState !== 'IMPLEMENTED') {
    await recordExecutionActionAudit({
      ...input,
      outcome: 'DENIED',
      reasonCode: 'execution_action_hidden',
    });
    throw new Error('execution_action_hidden_or_unregistered');
  }
  if (ROLE_RANK[input.membershipRole] < ROLE_RANK[policy.minimumRole]) {
    await recordExecutionActionAudit({
      ...input,
      outcome: 'DENIED',
      reasonCode: 'insufficient_org_role',
    });
    const error = new Error('insufficient_org_role') as Error & { code?: string };
    error.code = 'insufficient_org_role';
    throw error;
  }
  try {
    return await withPgTransaction(async (client) => {
      // Re-read policy on the same snapshot/connection immediately before the
      // mutation. Nested domain withPgTransaction calls inherit this client.
      const currentPolicy = await getExecutionActionPolicy(input.actionId, client);
      if (!currentPolicy || currentPolicy.runtimeState !== 'IMPLEMENTED' ||
          ROLE_RANK[input.membershipRole] < ROLE_RANK[currentPolicy.minimumRole]) {
        throw new Error('execution_action_policy_changed');
      }
      const result = await input.operation();
      if (result === false || result == null) {
        await recordExecutionActionAudit({
          ...input, outcome: 'NOT_FOUND', reasonCode: 'action_target_not_found',
        }, client);
        return result;
      }
      await recordExecutionActionAudit({ ...input, outcome: 'SUCCEEDED' }, client);
      return result;
    });
  } catch (error) {
    const outcome = classifyOutcome(error);
    await recordExecutionActionAudit({
      ...input,
      outcome,
      reasonCode: String((error as { code?: unknown })?.code || (error as Error)?.message || outcome),
    });
    throw error;
  }
}

export async function recordExecutionActionAudit(input: {
  organizationId: string;
  actionId: string;
  targetId: string;
  actorId: string;
  outcome: ExecutionActionOutcome;
  reasonCode?: string | null;
  requestId?: string | null;
}, client?: PgTransactionClient): Promise<void> {
  const sql = `INSERT INTO execution_action_audit
       (organization_id,action_id,target_id,actor_id,outcome,reason_code,request_id)
     VALUES (?,?,?,?,?,?,?)`;
  const params = [
      input.organizationId,
      input.actionId,
      input.targetId,
      input.actorId,
      input.outcome,
      input.reasonCode ?? null,
      input.requestId ?? null,
    ];
  if (client) await client.query(sql, params);
  else await dbRun(sql, params, { fallback: false });
}
