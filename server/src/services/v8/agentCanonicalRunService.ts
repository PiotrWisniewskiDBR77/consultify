import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, transaction as dbTransaction } from '../../utils/DbPromise.js';

type ExecutionState =
  | 'drafting'
  | 'planning'
  | 'proposals_ready'
  | 'waiting_for_review'
  | 'approved_for_apply'
  | 'rejected'
  | 'applying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

export type CanonicalRunAliasType = 'wave8_run' | 'agent_plan' | 'schedule' | 'work_graph';

type CanonicalIdentityRow = {
  canonical_run_id: string;
  organization_id: string;
  transformation_case_id: string;
};

const APPLYING_STAGES = new Set([
  'mobilization',
  'execution',
  'delivery',
  'benefits',
  'sustainability',
  'final_outputs',
]);

function desiredState(input: {
  caseStatus: string;
  lifecycleStage: string;
  pendingProposalCount: number;
  finalOutputCount: number;
}): ExecutionState {
  if (input.caseStatus === 'cancelled') return 'cancelled';
  if (input.finalOutputCount > 0) return 'completed';
  if (APPLYING_STAGES.has(input.lifecycleStage)) return 'applying';
  if (input.pendingProposalCount > 0) return 'waiting_for_review';
  if (input.caseStatus === 'plan_proposed') return 'drafting';
  return 'planning';
}

export async function getCanonicalTransformationRun(input: {
  transformationCaseId: string;
  organizationId: string;
}): Promise<any | null> {
  const row = await dbGet(
    `SELECT c.*, r.state AS run_state, r.plan_version AS run_plan_version, r.goal AS run_goal,
            r.updated_at AS run_updated_at, i.lineage_id AS identity_lineage_id
       FROM transformation_cases c
       JOIN v8_execution_runs r ON r.run_id = c.execution_run_id AND r.organization_id = c.organization_id
       LEFT JOIN v8_agent_run_identities i ON i.canonical_run_id = r.run_id AND i.organization_id = r.organization_id
      WHERE c.transformation_case_id = ? AND c.organization_id = ?`,
    [input.transformationCaseId, input.organizationId]
  );
  if (!row) return null;
  const proposals = await dbAll(
    `SELECT proposal_id, lifecycle_stage, proposal_type, status, reviewed_by_user_id, created_at, updated_at
       FROM transformation_stage_proposals WHERE transformation_case_id = ? AND organization_id = ? ORDER BY created_at`,
    [input.transformationCaseId, input.organizationId]
  );
  const [finalOutput, aliases, transitions, audit] = await Promise.all([
    dbGet<{ count: number }>(
      `SELECT COUNT(*) AS count FROM transformation_final_output_runs WHERE transformation_case_id = ? AND organization_id = ? AND status = 'completed'`,
      [input.transformationCaseId, input.organizationId]
    ),
    dbAll(
      `SELECT alias_type, external_id, created_at FROM v8_agent_run_aliases WHERE canonical_run_id = ? AND organization_id = ? ORDER BY created_at`,
      [row.execution_run_id, input.organizationId]
    ),
    dbAll(
      `SELECT transition_id, from_state, to_state, triggered_by, reason, transitioned_at FROM v8_run_state_transitions WHERE run_id = ? ORDER BY transitioned_at`,
      [row.execution_run_id]
    ),
    dbAll(
      `SELECT audit_event_id, event_type, actor_user_id, correlation_id, created_at FROM transformation_case_audit_events WHERE transformation_case_id = ? AND organization_id = ? ORDER BY created_at`,
      [input.transformationCaseId, input.organizationId]
    ),
  ]);
  const projectedState = desiredState({
    caseStatus: row.status,
    lifecycleStage: row.lifecycle_stage,
    pendingProposalCount: proposals.filter((proposal: any) => proposal.status === 'pending_review')
      .length,
    finalOutputCount: Number(finalOutput?.count || 0),
  });
  const timeline = [
    ...transitions.map((item: any) => ({
      type: 'run_transition',
      at: item.transitioned_at,
      ...item,
    })),
    ...audit.map((item: any) => ({ type: 'transformation_event', at: item.created_at, ...item })),
  ].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return {
    canonicalRunId: row.execution_run_id,
    transformationCaseId: row.transformation_case_id,
    lineageId: row.lineage_id,
    identityRegistered: row.identity_lineage_id === row.lineage_id,
    actualState: row.run_state,
    projectedState,
    stateDrift: row.run_state !== projectedState,
    caseStatus: row.status,
    lifecycleStage: row.lifecycle_stage,
    planVersion: Number(row.run_plan_version),
    aliases,
    proposals,
    timeline,
  };
}

/**
 * Durably binds an execution-system identifier to the one canonical run.
 *
 * The pre-read and post-read are deliberate: ON CONFLICT alone could silently
 * accept an alias already owned by another run. We fail closed both before and
 * after the write, while the unique database key makes retries/process restarts
 * idempotent.
 */
export async function registerCanonicalRunAlias(input: {
  canonicalRunId: string;
  organizationId: string;
  aliasType: CanonicalRunAliasType;
  externalId: string;
}): Promise<{
  canonicalRunId: string;
  aliasType: CanonicalRunAliasType;
  externalId: string;
  created: boolean;
}> {
  if (!input.canonicalRunId.trim()) throw new Error('canonical_run_id_required');
  if (!input.organizationId.trim()) throw new Error('organization_id_required');
  if (!input.externalId.trim()) throw new Error('canonical_run_alias_external_id_required');

  const identity = await dbGet<CanonicalIdentityRow>(
    `SELECT canonical_run_id, organization_id, transformation_case_id
       FROM v8_agent_run_identities
      WHERE canonical_run_id = ? AND organization_id = ?`,
    [input.canonicalRunId, input.organizationId]
  );
  if (!identity) throw new Error('canonical_run_identity_not_found');

  const existing = await dbGet<{ canonical_run_id: string }>(
    `SELECT canonical_run_id FROM v8_agent_run_aliases
      WHERE organization_id = ? AND alias_type = ? AND external_id = ?`,
    [input.organizationId, input.aliasType, input.externalId]
  );
  if (existing && existing.canonical_run_id !== input.canonicalRunId) {
    throw new Error('canonical_run_alias_conflict');
  }
  if (existing) {
    return {
      canonicalRunId: input.canonicalRunId,
      aliasType: input.aliasType,
      externalId: input.externalId,
      created: false,
    };
  }

  const persisted = await dbTransaction([
    {
      sql: `INSERT INTO v8_agent_run_aliases
              (alias_id, canonical_run_id, organization_id, alias_type, external_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(organization_id, alias_type, external_id) DO NOTHING`,
      params: [
        `run-alias-${uuidv4()}`,
        input.canonicalRunId,
        input.organizationId,
        input.aliasType,
        input.externalId,
        new Date().toISOString(),
      ],
    },
  ]);
  if (!persisted.success) throw new Error('canonical_run_alias_write_failed');

  const durable = await dbGet<{ canonical_run_id: string }>(
    `SELECT canonical_run_id FROM v8_agent_run_aliases
      WHERE organization_id = ? AND alias_type = ? AND external_id = ?`,
    [input.organizationId, input.aliasType, input.externalId]
  );
  if (!durable || durable.canonical_run_id !== input.canonicalRunId) {
    throw new Error('canonical_run_alias_conflict');
  }
  return {
    canonicalRunId: input.canonicalRunId,
    aliasType: input.aliasType,
    externalId: input.externalId,
    created: Number(persisted.results[0]?.changes || 0) === 1,
  };
}

export async function resolveCanonicalRunAlias(input: {
  organizationId: string;
  aliasType: CanonicalRunAliasType;
  externalId: string;
}): Promise<{ canonicalRunId: string; transformationCaseId: string } | null> {
  const row = await dbGet<{ canonical_run_id: string; transformation_case_id: string }>(
    `SELECT a.canonical_run_id, i.transformation_case_id
       FROM v8_agent_run_aliases a
       JOIN v8_agent_run_identities i
         ON i.canonical_run_id = a.canonical_run_id
        AND i.organization_id = a.organization_id
      WHERE a.organization_id = ? AND a.alias_type = ? AND a.external_id = ?`,
    [input.organizationId, input.aliasType, input.externalId]
  );
  return row
    ? { canonicalRunId: row.canonical_run_id, transformationCaseId: row.transformation_case_id }
    : null;
}

/**
 * Explicit transition hook for Wave8/planner/work-graph writers. It always
 * re-projects from the authoritative transformation case rather than treating
 * a child agent's local status as the transformation's status.
 */
export async function projectCanonicalRunAfterExternalTransition(input: {
  canonicalRunId: string;
  organizationId: string;
  aliasType: CanonicalRunAliasType;
  externalId: string;
  actorUserId: string;
  reason: string;
}): Promise<any> {
  await registerCanonicalRunAlias(input);
  const identity = await dbGet<CanonicalIdentityRow>(
    `SELECT canonical_run_id, organization_id, transformation_case_id
       FROM v8_agent_run_identities
      WHERE canonical_run_id = ? AND organization_id = ?`,
    [input.canonicalRunId, input.organizationId]
  );
  if (!identity) throw new Error('canonical_run_identity_not_found');
  return reconcileCanonicalTransformationRun({
    transformationCaseId: identity.transformation_case_id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    reason: input.reason,
  });
}

export async function reconcileCanonicalTransformationRun(input: {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  reason: string;
}): Promise<any> {
  if (!input.reason.trim()) throw new Error('run_reconciliation_reason_required');
  const projection = await getCanonicalTransformationRun(input);
  if (!projection) throw new Error('canonical_transformation_run_not_found');
  if (!projection.stateDrift) return { ...projection, reconciled: false };
  if (['completed', 'cancelled'].includes(projection.actualState)) {
    throw new Error('terminal_run_state_cannot_be_reconciled');
  }
  const now = new Date().toISOString();
  const persisted = await dbTransaction([
    {
      sql: `UPDATE v8_execution_runs SET state = ?, updated_at = ?, resolved_at = ? WHERE run_id = ? AND organization_id = ? AND state = ?`,
      params: [
        projection.projectedState,
        now,
        ['completed', 'cancelled', 'failed'].includes(projection.projectedState) ? now : null,
        projection.canonicalRunId,
        input.organizationId,
        projection.actualState,
      ],
    },
    {
      sql: `INSERT INTO v8_run_state_transitions (transition_id, run_id, from_state, to_state, triggered_by, reason, transitioned_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        uuidv4(),
        projection.canonicalRunId,
        projection.actualState,
        projection.projectedState,
        input.actorUserId,
        input.reason.trim(),
        now,
      ],
    },
    {
      sql: `INSERT INTO v8_agent_run_reconciliation_events (reconciliation_id, canonical_run_id, organization_id, transformation_case_id, from_state, to_state, actor_user_id, reason, projection_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        `run-reconcile-${uuidv4()}`,
        projection.canonicalRunId,
        input.organizationId,
        input.transformationCaseId,
        projection.actualState,
        projection.projectedState,
        input.actorUserId,
        input.reason.trim(),
        JSON.stringify(projection),
        now,
      ],
    },
  ]);
  if (!persisted.success || Number(persisted.results[0]?.changes || 0) !== 1)
    throw new Error('run_reconciliation_conflict');
  return { ...(await getCanonicalTransformationRun(input)), reconciled: true };
}
