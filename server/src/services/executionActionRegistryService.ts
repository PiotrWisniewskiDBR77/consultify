import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';

export type ExecutionActionOutcome = 'SUCCEEDED' | 'DENIED' | 'NOT_FOUND' | 'CONFLICT';

export type ExecutionActionPolicy = {
  actionId: string;
  targetType: string;
  destructive: boolean;
  minimumRole: 'MEMBER' | 'ADMIN' | 'OWNER';
  runtimeState: 'IMPLEMENTED' | 'HIDDEN';
  auditRequired: boolean;
};

export async function getExecutionActionPolicy(
  actionId: string
): Promise<ExecutionActionPolicy | null> {
  const row = await dbGet<any>(
    `SELECT action_id,target_type,destructive,minimum_role,runtime_state,audit_required
       FROM execution_action_registry WHERE action_id = ?`,
    [actionId],
    { fallback: false }
  );
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

export async function recordExecutionActionAudit(input: {
  organizationId: string;
  actionId: string;
  targetId: string;
  actorId: string;
  outcome: ExecutionActionOutcome;
  reasonCode?: string | null;
  requestId?: string | null;
}): Promise<void> {
  await dbRun(
    `INSERT INTO execution_action_audit
       (organization_id,action_id,target_id,actor_id,outcome,reason_code,request_id)
     VALUES (?,?,?,?,?,?,?)`,
    [
      input.organizationId,
      input.actionId,
      input.targetId,
      input.actorId,
      input.outcome,
      input.reasonCode ?? null,
      input.requestId ?? null,
    ],
    { fallback: false }
  );
}
