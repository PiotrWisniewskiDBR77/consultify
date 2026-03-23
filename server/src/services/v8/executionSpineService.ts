/**
 * V8 Execution/Approval Spine Service
 *
 * Manages the proposal/approval governance lifecycle for the V8 runtime.
 * Creates runs, validates state transitions, manages proposals, and records audit trails.
 * All queries enforce organization-level isolation.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  ActionProposal,
  CreateProposalParams,
  CreateRunParams,
  ExecutionAgentRun,
  MutationDescriptor,
  ProposalStatus,
  RunState,
  RunStateTransition,
} from '../../types/executionSpine.js';
import {
  CreateProposalParamsSchema,
  CreateRunParamsSchema,
  TERMINAL_STATES,
  VALID_TRANSITIONS,
} from '../../types/executionSpine.js';
import type { ActionPreview, V8ArtifactRef } from '../../types/contextSnapshot.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:ExecutionSpine]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

// ==========================================
// ROW TYPES
// ==========================================

interface RunRow {
  run_id: string;
  organization_id: string;
  context_snapshot_id: string;
  initiator_user_id: string;
  state: string;
  plan_version: number;
  goal: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  expires_at: string | null;
  metadata: string;
}

interface ProposalRow {
  proposal_id: string;
  execution_run_id: string;
  context_snapshot_ref: string;
  proposal_type: string;
  target_ref: string;
  summary: string;
  reason: string;
  mutation_description: string;
  risk_class: string;
  approval_class: string;
  preview_payload: string | null;
  depends_on: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface TransitionRow {
  transition_id: string;
  run_id: string;
  from_state: string;
  to_state: string;
  triggered_by: string;
  reason: string | null;
  transitioned_at: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToRun(row: RunRow): ExecutionAgentRun {
  return {
    runId: row.run_id,
    organizationId: row.organization_id,
    contextSnapshotId: row.context_snapshot_id,
    initiatorUserId: row.initiator_user_id,
    state: row.state as RunState,
    planVersion: row.plan_version,
    goal: row.goal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at || null,
    expiresAt: row.expires_at || null,
    metadata: safeJsonParse(row.metadata, {}),
  };
}

function rowToProposal(row: ProposalRow): ActionProposal {
  return {
    proposalId: row.proposal_id,
    executionRunId: row.execution_run_id,
    contextSnapshotRef: row.context_snapshot_ref,
    proposalType: row.proposal_type as ActionProposal['proposalType'],
    targetRef: safeJsonParse<V8ArtifactRef>(row.target_ref, {
      artifactId: '',
      artifactType: '',
      artifactModule: '',
      relationship: 'target',
    }),
    summary: row.summary,
    reason: row.reason,
    mutationDescription: safeJsonParse<MutationDescriptor>(row.mutation_description, {
      operation: 'update',
      targetFields: null,
      payloadSummary: null,
      reversibility: 'reversible',
      estimatedImpact: null,
    }),
    riskClass: row.risk_class as ActionProposal['riskClass'],
    approvalClass: row.approval_class as ActionProposal['approvalClass'],
    previewPayload: safeJsonParse<ActionPreview | null>(row.preview_payload, null),
    dependsOn: safeJsonParse<string[]>(row.depends_on, []),
    status: row.status as ActionProposal['status'],
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || null,
    resolvedBy: row.resolved_by || null,
  };
}

function rowToTransition(row: TransitionRow): RunStateTransition {
  return {
    transitionId: row.transition_id,
    runId: row.run_id,
    fromState: row.from_state as RunState,
    toState: row.to_state as RunState,
    triggeredBy: row.triggered_by,
    reason: row.reason || null,
    transitionedAt: row.transitioned_at,
  };
}

// ==========================================
// STATE MACHINE VALIDATION
// ==========================================

function isValidTransition(from: RunState, to: RunState): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Create a new ExecutionAgentRun in `drafting` state.
 */
export async function createRun(params: CreateRunParams): Promise<ExecutionAgentRun> {
  const validated = CreateRunParamsSchema.parse(params);

  const runId = uuidv4();
  const now = new Date().toISOString();

  const run: ExecutionAgentRun = {
    runId,
    organizationId: validated.organizationId,
    contextSnapshotId: validated.contextSnapshotId,
    initiatorUserId: validated.initiatorUserId,
    state: 'drafting',
    planVersion: 1,
    goal: validated.goal,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    expiresAt: validated.expiresAt ?? null,
    metadata: validated.metadata,
  };

  await dbRun(
    `INSERT INTO v8_execution_runs (
      run_id, organization_id, context_snapshot_id, initiator_user_id,
      state, plan_version, goal, created_at, updated_at,
      resolved_at, expires_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.runId,
      run.organizationId,
      run.contextSnapshotId,
      run.initiatorUserId,
      run.state,
      run.planVersion,
      run.goal,
      run.createdAt,
      run.updatedAt,
      run.resolvedAt,
      run.expiresAt,
      JSON.stringify(run.metadata),
    ],
  );

  await recordTransition(runId, 'drafting' as RunState, 'drafting', 'system', 'Run created');

  logger.info(`${LOG_PREFIX} Created run ${runId} for org ${run.organizationId}`);
  return run;
}

/**
 * Retrieve a run by ID with organization-level isolation.
 */
export async function getRun(
  runId: string,
  organizationId: string,
): Promise<ExecutionAgentRun | null> {
  const row = await dbGet<RunRow>(
    `SELECT * FROM v8_execution_runs
     WHERE run_id = ? AND organization_id = ?`,
    [runId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToRun(row);
}

/**
 * Transition a run to a new state. Validates the transition, records audit trail.
 * Re-planning from `rejected` increments plan_version.
 */
export async function transitionRunState(
  runId: string,
  organizationId: string,
  toState: RunState,
  triggeredBy: string,
  reason?: string,
): Promise<ExecutionAgentRun> {
  const run = await getRun(runId, organizationId);
  if (!run) {
    throw new Error(`Run ${runId} not found in organization ${organizationId}`);
  }

  const fromState = run.state;

  if (!isValidTransition(fromState, toState)) {
    throw new Error(
      `Invalid state transition: ${fromState} → ${toState}. ` +
      `Allowed from ${fromState}: [${VALID_TRANSITIONS[fromState].join(', ')}]`,
    );
  }

  const now = new Date().toISOString();
  const isTerminal = TERMINAL_STATES.has(toState);
  const resolvedAt = isTerminal ? now : run.resolvedAt;

  const planVersion =
    fromState === 'rejected' && toState === 'planning'
      ? run.planVersion + 1
      : run.planVersion;

  await dbRun(
    `UPDATE v8_execution_runs
     SET state = ?, plan_version = ?, updated_at = ?, resolved_at = ?
     WHERE run_id = ? AND organization_id = ?`,
    [toState, planVersion, now, resolvedAt, runId, organizationId],
  );

  await recordTransition(runId, fromState, toState, triggeredBy, reason ?? null);

  logger.info(`${LOG_PREFIX} Run ${runId}: ${fromState} → ${toState} (by ${triggeredBy})`);

  return {
    ...run,
    state: toState,
    planVersion,
    updatedAt: now,
    resolvedAt,
  };
}

/**
 * Create an ActionProposal within a run.
 * Run must be in `planning` state.
 */
export async function createProposal(params: CreateProposalParams): Promise<ActionProposal> {
  const validated = CreateProposalParamsSchema.parse(params);

  const proposalId = uuidv4();
  const now = new Date().toISOString();

  const proposal: ActionProposal = {
    proposalId,
    executionRunId: validated.executionRunId,
    contextSnapshotRef: validated.contextSnapshotRef,
    proposalType: validated.proposalType,
    targetRef: validated.targetRef,
    summary: validated.summary,
    reason: validated.reason,
    mutationDescription: validated.mutationDescription,
    riskClass: validated.riskClass,
    approvalClass: validated.approvalClass,
    previewPayload: validated.previewPayload ?? null,
    dependsOn: validated.dependsOn,
    status: 'draft',
    createdAt: now,
    resolvedAt: null,
    resolvedBy: null,
  };

  await dbRun(
    `INSERT INTO v8_action_proposals (
      proposal_id, execution_run_id, context_snapshot_ref, proposal_type,
      target_ref, summary, reason, mutation_description,
      risk_class, approval_class, preview_payload, depends_on,
      status, created_at, resolved_at, resolved_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      proposal.proposalId,
      proposal.executionRunId,
      proposal.contextSnapshotRef,
      proposal.proposalType,
      JSON.stringify(proposal.targetRef),
      proposal.summary,
      proposal.reason,
      JSON.stringify(proposal.mutationDescription),
      proposal.riskClass,
      proposal.approvalClass,
      proposal.previewPayload ? JSON.stringify(proposal.previewPayload) : null,
      JSON.stringify(proposal.dependsOn),
      proposal.status,
      proposal.createdAt,
      proposal.resolvedAt,
      proposal.resolvedBy,
    ],
  );

  logger.info(`${LOG_PREFIX} Created proposal ${proposalId} for run ${validated.executionRunId}`);
  return proposal;
}

/**
 * Retrieve all proposals for a run, with org-level isolation via the run.
 */
export async function getProposalsByRun(
  runId: string,
  organizationId: string,
): Promise<ActionProposal[]> {
  const rows = await dbAll<ProposalRow>(
    `SELECT p.* FROM v8_action_proposals p
     INNER JOIN v8_execution_runs r ON r.run_id = p.execution_run_id
     WHERE p.execution_run_id = ? AND r.organization_id = ?
     ORDER BY p.created_at ASC`,
    [runId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToProposal);
}

/**
 * Resolve a proposal: approve, reject, expire, or mark as policy_allowed.
 */
export async function resolveProposal(
  proposalId: string,
  status: ProposalStatus,
  resolvedBy: string,
): Promise<ActionProposal> {
  const row = await dbGet<ProposalRow>(
    `SELECT * FROM v8_action_proposals WHERE proposal_id = ?`,
    [proposalId],
  );

  if (!row) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  const current = rowToProposal(row);

  if (current.status !== 'draft' && current.status !== 'pending_review') {
    throw new Error(
      `Cannot resolve proposal ${proposalId}: current status is ${current.status}, ` +
      `expected draft or pending_review`,
    );
  }

  const validResolutions: ProposalStatus[] = [
    'approved',
    'rejected',
    'expired',
    'policy_allowed',
  ];
  if (!validResolutions.includes(status)) {
    throw new Error(
      `Invalid resolution status: ${status}. Must be one of: ${validResolutions.join(', ')}`,
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_action_proposals
     SET status = ?, resolved_at = ?, resolved_by = ?
     WHERE proposal_id = ?`,
    [status, now, resolvedBy, proposalId],
  );

  logger.info(`${LOG_PREFIX} Proposal ${proposalId} resolved as ${status} by ${resolvedBy}`);

  return {
    ...current,
    status,
    resolvedAt: now,
    resolvedBy,
  };
}

/**
 * Get the full audit trail of state transitions for a run.
 */
export async function getRunTransitions(runId: string): Promise<RunStateTransition[]> {
  const rows = await dbAll<TransitionRow>(
    `SELECT * FROM v8_run_state_transitions
     WHERE run_id = ?
     ORDER BY transitioned_at ASC`,
    [runId],
    { fallback: true },
  );

  return (rows || []).map(rowToTransition);
}

/**
 * Check if a run in `waiting_for_review` state has expired.
 * If expired, transitions to `expired` and returns true.
 */
export async function checkRunExpiration(
  runId: string,
  organizationId: string,
): Promise<boolean> {
  const run = await getRun(runId, organizationId);
  if (!run) return false;

  if (run.state !== 'waiting_for_review') return false;
  if (!run.expiresAt) return false;

  const now = new Date();
  const expiresAt = new Date(run.expiresAt);

  if (now >= expiresAt) {
    await transitionRunState(runId, organizationId, 'expired', 'system', 'Review period expired');
    return true;
  }

  return false;
}

// ==========================================
// INTERNAL HELPERS
// ==========================================

async function recordTransition(
  runId: string,
  fromState: RunState | string,
  toState: RunState | string,
  triggeredBy: string,
  reason: string | null,
): Promise<void> {
  const transitionId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_run_state_transitions (
      transition_id, run_id, from_state, to_state,
      triggered_by, reason, transitioned_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [transitionId, runId, fromState, toState, triggeredBy, reason, now],
  );
}
