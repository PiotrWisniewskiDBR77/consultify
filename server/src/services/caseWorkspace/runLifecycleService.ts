/**
 * Case Workspace — canonical Run lifecycle service (Stream A, "KANONICZNY
 * RUNTIME RUN/NODERUN").
 *
 * Implements docs/product/case-workspace/04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md
 * §3.4 (Run schema, verbatim), §4.4 (Run state machine, verbatim) and §5's
 * durable Run command set (`CreateRun, StartRun, PauseRun, ResumeRun,
 * CancelRun, RetryNode, CompensateAction`) plus the Wait command
 * `ProvideHumanInput` (§5's Wait family) as the Run-facing `ProvideNodeInput`
 * this packet's brief asked for, on top of
 * server/migrations/20260811a_case_workspace_run_lifecycle.sql.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS — THE GAP IT CLOSES
 * ===========================================================================
 * Before this file: nodeRunService.ts owns a complete, correct NodeRun
 * aggregate (§4.5, leases, attempts, timeouts, compensation), and
 * runBindingService.ts proves an exact, immutable (runId, casePlanVersionId)
 * pairing — but NOTHING minted the §3.4 `Run` aggregate itself (status,
 * outcomeStatus, OCC version), NOTHING enforced "StartRun is the one explicit
 * moment a Run may leave CREATED" for STANDARD/TRANSFORMATION, NOTHING
 * created a Run's entry NodeRuns or advanced the graph as nodes completed,
 * and NOTHING bridged a satisfied HUMAN wait back to the WAITING_HUMAN
 * NodeRun it belongs to (verified absent: no caller of
 * nodeRunService.transitionNodeRun exists anywhere outside nodeRunService.ts
 * itself before this file). This file is that missing orchestration layer —
 * "domknij RZECZYWISTY runtime, nie struktury pomocnicze" — not a second
 * execution engine (§6 invariant 3, "one execution has one authoritative V8
 * Run", stays true: exactly one `v8_execution_runs` row still backs every
 * `case_workspace_runs` row, via the pre-existing
 * `case_workspace_run_bindings` FK chain this file always goes through, never
 * around).
 *
 * ===========================================================================
 * THE HARD RULE THIS FILE EXISTS TO ENFORCE
 * ===========================================================================
 * "STANDARD/TRANSFORMATION nie może wystartować przed publikacją planu i
 * JAWNYM startem." Concretely: `createRun` requires an ALREADY-`PUBLISHED`
 * `CasePlanVersion` and creates ZERO NodeRuns — the Run sits in `CREATED`
 * with nothing claimable. Only a SEPARATE, explicit `startRun` call ever
 * creates the entry NodeRuns and moves the Run into `RUNNING`. Nothing in
 * this file auto-chains `createRun` into `startRun`.
 *
 * LIGHT is policy-different by owner decision (frozen decision 6:
 * "low-risk internal work may execute on approval"): its one-click path is
 * `lightOneClickService.startLightOneClick`, which this file calls rather
 * than duplicating (see `startLightRun` below) — never a second LIGHT
 * planning/binding implementation.
 *
 * ===========================================================================
 * WHY A SEPARATE `case_workspace_runs` TABLE, NOT A COLUMN ON THE BINDING
 * ===========================================================================
 * See the migration's own header. Short version: `case_workspace_run_bindings`
 * is immutable by design (no UPDATE path exists in runBindingService.ts) and
 * carries no `version`/OCC column; §4.4's fourteen-value state machine needs
 * both. `case_workspace_runs.run_id` reuses the SAME identity as the binding
 * (and, transitively, the same `v8_execution_runs` row) — it is a lifecycle
 * PROJECTION of that Run, not a second Run.
 *
 * ===========================================================================
 * ONE EVENT PER COMMAND, EVEN WHEN A COMMAND SPANS SEVERAL §4.4 EDGES
 * ===========================================================================
 * `startRun` logically walks CREATED -> VALIDATING -> QUEUED -> RUNNING —
 * three edges — but persists ONE UPDATE (status CREATED -> RUNNING, one
 * `version` bump) and emits ONE `run.started` event. Every edge in that path
 * is still validated via `assertPathAllowed` before anything is written, so
 * an illegal path (say the migration ever added VALIDATING as an entry point
 * with a missing QUEUED edge) fails loudly rather than silently skipping a
 * step. This is the exact "two logical steps, one event" precedent
 * nodeRunService.completeNodeRunAttempt's own header already documents for
 * this codebase, applied one level up.
 *
 * ===========================================================================
 * WHAT THIS FILE IS NOT
 * ===========================================================================
 * Not a gateway/condition evaluator (`executionGraphService.ts` still owns
 * DECISION_GATEWAY/PARALLEL_SPLIT/PARALLEL_JOIN's evaluation FACTS — the
 * `case_workspace_gateway_evaluations` table and its
 * record/get/list functions). `advanceRun` below is the "future orchestrator"
 * that file's own header named: it never re-implements gateway semantics, it
 * either READS an already-recorded evaluation (DECISION_GATEWAY — the branch
 * choice is a business decision this file can never invent) or, for the two
 * gateway types whose own readiness IS the deterministic fact (PARALLEL_SPLIT
 * fan-out is unconditional; PARALLEL_JOIN's default ALL-policy satisfaction is
 * a plain predecessor count, both already computed by this file's normal
 * predecessor-readiness check), records that fact itself through
 * `executionGraphService.recordGatewayEvaluation` — never a second ledger, a
 * duplicated digest/idempotency scheme, or a parallel notion of "the gateway
 * decided". See `advanceRun`'s own header below for the exact per-type rule.
 * Not a capability/worker executor (nodeRunService's lease/claim/attempt primitives
 * remain the only place work is actually claimed and run). Not a second
 * approval system (ActionProposal/ApprovalDecision stay
 * proposalApprovalService.ts's). Not a second Chat/Case model (Case creation
 * stays caseCoreService.ts's / caseIntakeService.ts's).
 *
 * ===========================================================================
 * AUTHORIZATION
 * ===========================================================================
 * Every exported function here takes a human-shaped `actorUserId` and gates
 * through `caseWorkspaceAuthContext.requireCaseAccess` — this file has no
 * scheduler-only, unauthenticated primitive the way nodeRunService's
 * lease/claim layer does, because every command in §5's Run family is
 * explicitly actor-driven (a human, Teresa, or an authenticated system actor
 * standing in for one — e.g. `advanceRun` is expected to be called by a
 * future worker/orchestrator ON BEHALF OF the actor that owns the Run, not
 * anonymously).
 *
 * OPEN QUESTIONS (named, not hidden — this directory's own convention):
 *   1. `advanceRun`'s graph-progression walk follows `SEQUENCE`/`CONDITIONAL`
 *      (or untyped) edges between predecessors and a successor. "Satisfied"
 *      for an edge leaving a DECISION_GATEWAY means "this is the ONE edgeId a
 *      recorded evaluation selected"; for every other edge it means "the
 *      source node SUCCEEDED/SKIPPED". A successor's NodeRun is created once
 *      its predecessor edges are satisfied — EVERY one of them for a
 *      PARALLEL_JOIN node specifically (this packet's ALL-policy AND-join),
 *      but only ANY ONE of them for every other node type. That second half
 *      is deliberate, not an oversight: two DECISION_GATEWAY branches
 *      reconverging on an ordinary node (no explicit join marker) is
 *      standard exclusive-gateway convergence — whichever branch actually
 *      ran continues the flow, and waiting for the branch that was NEVER
 *      selected would mean the Run can never complete. Only PARALLEL_JOIN
 *      demands an explicit AND-join; every other multi-predecessor
 *      convergence is OR by construction. (`latestByNode.has(...)` already
 *      makes node creation one-shot regardless of how many predecessors
 *      eventually succeed, so this is safe even for a plan that never uses
 *      gateways at all — every existing node in this codebase before this
 *      packet had exactly one predecessor, where ALL and ANY are identical.)
 *      A DECISION_GATEWAY node itself is created
 *      READY like any other node once ITS OWN predecessor(s) are satisfied,
 *      then left exactly there — READY, contributing to the Run's `WAITING`
 *      bucket, never `RUNNING`'s "active work" bucket — until a LATER
 *      `advanceRun` call finds `executionGraphService.getGatewayEvaluation`
 *      now returns a fact for that specific nodeRunId; only then is it driven
 *      to SUCCEEDED (via nodeRunService's normal claim/attempt/complete path)
 *      and its selected edge unlocked. No evaluation ever means no guess: the
 *      other, non-selected outgoing edges are simply never satisfied, so
 *      their target nodes are never created. PARALLEL_SPLIT/PARALLEL_JOIN, by
 *      contrast, are resolved by THIS file the moment they are created —
 *      their own readiness (predecessor(s) satisfied) already IS the
 *      deterministic fact, so `advanceRun` records it itself through
 *      `executionGraphService.recordGatewayEvaluation` (SPLIT_ACTIVATED /
 *      JOIN_SATISFIED, ALL-policy only — ANY/N_OF_M are not implemented by
 *      this packet) rather than waiting on an external caller. Only
 *      DECISION_GATEWAY's branch choice is ever "waited on" — that is the one
 *      decision this generic orchestrator can never invent.
 *   2. `advanceRun` never auto-declares a Run `FAILED` — a stuck Run (a
 *      failed predecessor with no further automatic progress and nothing
 *      active/waiting) settles into `BLOCKED` and stays there until a human
 *      either issues `retryNode` (recovery) or the explicit `failRun`
 *      command (deliberate write-off) or `cancelRun`. This mirrors §4.5's
 *      own "`Częściowo zakończone` derives from explicit PARTIAL, never from
 *      warnings or node counts" posture: this file treats permanent business
 *      failure the same way, as something a human/operator states, not
 *      something an algorithm infers from "nothing left to do".
 *   3. `COMPLETED_WITH_WARNINGS` detection in `advanceRun` reads
 *      `executionGraphService.listNodeResultAcceptancesForRun` for any
 *      `PARTIAL` value. That table's own header (CW-RT-037) says a future
 *      orchestrator is expected to be its reader — this is that reader,
 *      first use of the table outside its own service file.
 */

import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';
import * as caseCoreService from './caseCoreService.js';
import * as casePlanVersionService from './casePlanVersionService.js';
import type { CanonicalGraph } from './casePlanVersionService.js';
import { requireCaseAccess } from './caseWorkspaceAuthContext.js';
import { publishEvent, redact } from './eventOutboxService.js';
import * as executionGraphService from './executionGraphService.js';
import type { CaseGatewayEvaluation } from './executionGraphService.js';
import * as lightOneClickService from './lightOneClickService.js';
import * as nodeRunService from './nodeRunService.js';
import type { NodeRun, NodeRunStatus } from './nodeRunService.js';
import * as runBindingService from './runBindingService.js';
import * as waitSubscriptionService from './waitSubscriptionService.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** §4.4's state machine, verbatim, plus the documented CANCELLED extensions
 *  (see ALLOWED_TRANSITIONS below and the migration's own comment). */
export type RunStatus =
  | 'CREATED'
  | 'VALIDATING'
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'WAITING'
  | 'BLOCKED'
  | 'RETRY_SCHEDULED'
  | 'COMPLETED'
  | 'COMPLETED_WITH_WARNINGS'
  | 'FAILED'
  | 'CANCELLED'
  | 'COMPENSATING'
  | 'COMPENSATED';

/** §4.4 "Technical completion is separate from outcomeStatus", verbatim. */
export type RunOutcomeStatus =
  | 'PENDING_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PARTIALLY_ACCEPTED'
  | 'NOT_APPLICABLE';

interface CaseWorkspaceRunRow {
  run_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  case_plan_version_id: string;
  graph_digest: string;
  status: RunStatus;
  outcome_status: RunOutcomeStatus;
  initiated_by: string;
  correlation_id: string | null;
  idempotency_key: string;
  version: number | string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface Run {
  runId: string;
  organizationId: string;
  projectId: string | null;
  caseId: string;
  casePlanVersionId: string;
  graphDigest: string;
  status: RunStatus;
  outcomeStatus: RunOutcomeStatus;
  initiatedBy: string;
  correlationId: string | null;
  idempotencyKey: string;
  version: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface CreateRunInput {
  caseId: string;
  casePlanVersionId: string;
  idempotencyKey: string;
  initiatedBy?: string;
  correlationId?: string | null;
}

export type StartRunResult =
  | { outcome: 'started'; run: Run; nodeRunIds: string[] }
  | { outcome: 'already_started'; run: Run };

export interface RetryNodeResult {
  run: Run;
  nodeRun: NodeRun;
}

export interface AdvanceRunResult {
  run: Run;
  createdNodeRunIds: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RUN_TABLE = 'case_workspace_runs';
const RUN_AGGREGATE_TYPE = 'RUN';

const NODE_SUCCESS_LIKE: readonly NodeRunStatus[] = ['SUCCEEDED', 'SKIPPED'];
const NODE_FAILED_LIKE: readonly NodeRunStatus[] = ['FAILED_TERMINAL', 'CANCELLED'];
const NODE_ACTIVE_LIKE: readonly NodeRunStatus[] = [
  'PENDING',
  'READY',
  'CLAIMED',
  'RUNNING',
  'RETRY_SCHEDULED',
  'FAILED_RETRYABLE',
];
const NODE_WAITING_LIKE: readonly NodeRunStatus[] = ['WAITING_HUMAN', 'WAITING_TIMER', 'WAITING_EVENT'];

/** NodeRun statuses a CancelRun cascade may still transition to CANCELLED —
 *  nodeRunService's own §4.5 table (mirrored here, not imported, per this
 *  directory's "each service file keeps its own copy" convention). */
const NODE_CANCELLABLE: readonly NodeRunStatus[] = [
  'PENDING',
  'READY',
  'WAITING_HUMAN',
  'WAITING_TIMER',
  'WAITING_EVENT',
  'FAILED_RETRYABLE',
];

/**
 * §4.4's literal arrows, plus explicitly-documented CANCELLED extensions: the
 * doc's own arrow list only shows CANCELLED reachable from the RUNNING
 * family, which would leave a Run stuck in CREATED/VALIDATING/QUEUED/PAUSED/
 * WAITING/BLOCKED/RETRY_SCHEDULED uncancellable — the same class of
 * documented, deliberate extension nodeRunService.ts's own
 * ALLOWED_TRANSITIONS comment makes for NodeRun's CLAIMED -> READY /
 * CLAIMED -> FAILED_TERMINAL.
 */
const ALLOWED_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  CREATED: ['VALIDATING', 'CANCELLED'],
  VALIDATING: ['QUEUED', 'FAILED', 'CANCELLED'],
  QUEUED: ['RUNNING', 'CANCELLED'],
  RUNNING: [
    'PAUSED',
    'WAITING',
    'BLOCKED',
    'RETRY_SCHEDULED',
    'COMPLETED',
    'COMPLETED_WITH_WARNINGS',
    'FAILED',
    'CANCELLED',
    'COMPENSATING',
  ],
  PAUSED: ['RUNNING', 'CANCELLED'],
  WAITING: ['RUNNING', 'CANCELLED'],
  BLOCKED: ['RUNNING', 'FAILED', 'CANCELLED'],
  RETRY_SCHEDULED: ['RUNNING', 'CANCELLED'],
  COMPLETED: [],
  COMPLETED_WITH_WARNINGS: [],
  FAILED: [],
  CANCELLED: ['COMPENSATING'],
  COMPENSATING: ['COMPENSATED', 'FAILED'],
  COMPENSATED: [],
};

// ---------------------------------------------------------------------------
// Local helpers (this directory's own convention: each service file keeps a
// private copy — see nodeRunService.ts / lightOneClickService.ts's identical
// header notes).
// ---------------------------------------------------------------------------

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

/**
 * Deterministic, derived from (caseId, idempotencyKey) — same reasoning as
 * lightOneClickService.stableRunId's own header: mints the SAME v8_execution_
 * runs id on a retried CreateRun for the SAME business intent, so a crash
 * between "v8 run committed" and "case_workspace_runs row committed" leaves
 * no orphan — the next attempt derives the IDENTICAL run_id, finds it via
 * ON CONFLICT DO NOTHING, and proceeds straight to binding/inserting rather
 * than minting yet another orphaned v8_execution_runs row.
 */
function deterministicRunId(caseId: string, idempotencyKey: string): string {
  const hex = createHash('sha256').update(`case-workspace:run-lifecycle:v1:${caseId}:${idempotencyKey}`).digest('hex');
  return `cwrun-${hex.slice(0, 32)}`;
}

function optionalTrimmed(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function mapRow(row: CaseWorkspaceRunRow): Run {
  return {
    runId: row.run_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    caseId: row.case_id,
    casePlanVersionId: row.case_plan_version_id,
    graphDigest: row.graph_digest,
    status: row.status,
    outcomeStatus: row.outcome_status,
    initiatedBy: row.initiated_by,
    correlationId: row.correlation_id,
    idempotencyKey: row.idempotency_key,
    version: Number(row.version),
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

function assertTransitionAllowed(from: RunStatus, to: RunStatus): void {
  if (!(ALLOWED_TRANSITIONS[from] ?? []).includes(to)) {
    throw new Error(`run_lifecycle_status_transition_not_allowed:${from}->${to}`);
  }
}

/** Validates every edge of a multi-hop path WITHOUT persisting the
 *  intermediate states — see the file header's "one event per command". */
function assertPathAllowed(path: readonly RunStatus[]): void {
  for (let i = 0; i < path.length - 1; i += 1) {
    assertTransitionAllowed(path[i], path[i + 1]);
  }
}

async function loadForUpdate(client: PgTransactionClient, runId: string): Promise<CaseWorkspaceRunRow> {
  const result = await client.query<CaseWorkspaceRunRow>(
    `SELECT * FROM ${RUN_TABLE} WHERE run_id = ? FOR UPDATE`,
    [runId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('run_lifecycle_run_not_found');
  return row;
}

function runEventIdentity(row: CaseWorkspaceRunRow): {
  organizationId: string;
  projectId: string | null;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  caseId: string;
  runId: string;
} {
  return {
    organizationId: row.organization_id,
    projectId: row.project_id,
    aggregateType: RUN_AGGREGATE_TYPE,
    aggregateId: row.run_id,
    aggregateVersion: Number(row.version),
    caseId: row.case_id,
    runId: row.run_id,
  };
}

/**
 * Persists ONE physical transition (`fromStatus` is whatever the locked row
 * currently holds; `toStatus` is the final state) after validating the FULL
 * logical `path` against ALLOWED_TRANSITIONS (file header: "one event per
 * command"). OCC-guarded on the caller's already-locked row's version.
 * INTERNAL — every exported command below opens its own `withPgTransaction`
 * and calls this on that transaction's client.
 */
async function transitionRunOnClient(
  client: PgTransactionClient,
  row: CaseWorkspaceRunRow,
  path: readonly RunStatus[],
  eventType: string,
  actorUserId: string,
  options: { startedAt?: boolean; completedAt?: boolean; summary?: Record<string, unknown> } = {}
): Promise<CaseWorkspaceRunRow> {
  if (path[0] !== row.status) {
    throw new Error(`run_lifecycle_status_transition_not_allowed:${row.status}->${path[0]}`);
  }
  assertPathAllowed(path);
  const toStatus = path[path.length - 1];
  const now = new Date().toISOString();

  const updated = await client.query<CaseWorkspaceRunRow>(
    `UPDATE ${RUN_TABLE}
        SET status = ?,
            started_at = CASE WHEN ? THEN ? ELSE started_at END,
            completed_at = CASE WHEN ? THEN ? ELSE completed_at END,
            version = version + 1,
            updated_at = ?
      WHERE run_id = ? AND version = ?
      RETURNING *`,
    [
      toStatus,
      Boolean(options.startedAt),
      now,
      Boolean(options.completedAt),
      now,
      now,
      row.run_id,
      Number(row.version),
    ]
  );
  const updatedRow = updated.rows[0];
  if (!updatedRow) throw new Error('run_lifecycle_version_conflict');

  await publishEvent(client, {
    eventType,
    ...runEventIdentity(updatedRow),
    actorUserId,
    redactedSummary: redact({
      from: row.status,
      to: updatedRow.status,
      path,
      ...(options.summary ?? {}),
    }),
  });

  return updatedRow;
}

// ---------------------------------------------------------------------------
// CreateRun
// ---------------------------------------------------------------------------

/**
 * §5 CreateRun. STANDARD/TRANSFORMATION only — LIGHT must use
 * `startLightRun` (below), which delegates to `lightOneClickService`; see the
 * file header for why this is a hard refusal rather than a silent redirect.
 *
 * Requires an ALREADY-`PUBLISHED` CasePlanVersion (§6 invariant 4) and
 * creates the Run in `CREATED` with ZERO NodeRuns — `startRun` is the only
 * path to RUNNING (file header's hard rule).
 *
 * Idempotent on (caseId, idempotencyKey): a replayed CreateRun for the same
 * business intent returns the existing row unchanged and mints nothing new —
 * same posture as nodeRunService.createNodeRun.
 *
 * Uses the SAME `pg_advisory_xact_lock(hashtext(caseId))` namespace
 * `lightOneClickService.startLightOneClick` already uses (see that file's
 * header for the full reasoning: an advisory lock, not a row lock, held open
 * across calls into other services' own separate connections, so a
 * concurrent CreateRun/LIGHT-one-click for the SAME case serializes instead
 * of racing or deadlocking). A DRAFT Case is activated to ACTIVE as part of
 * this call, mirroring lightOneClickService's own precedent (open_question:
 * not rolled back on a later refusal — Case status transitions are one-way).
 */
export async function createRun(input: CreateRunInput, actorUserId: string): Promise<Run> {
  const caseId = requireNonBlank(input.caseId, 'run_lifecycle_case_id_required');
  const casePlanVersionId = requireNonBlank(
    input.casePlanVersionId,
    'run_lifecycle_case_plan_version_id_required'
  );
  const idempotencyKey = requireNonBlank(input.idempotencyKey, 'run_lifecycle_idempotency_key_required');
  const actor = requireNonBlank(actorUserId, 'run_lifecycle_actor_required');
  const initiatedBy = optionalTrimmed(input.initiatedBy ?? null) ?? actor;
  const correlationId = optionalTrimmed(input.correlationId ?? null);

  await requireCaseAccess(actor, caseId);

  return withPgTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [caseId]);

    const existing = await client.query<CaseWorkspaceRunRow>(
      `SELECT * FROM ${RUN_TABLE} WHERE case_id = ? AND idempotency_key = ?`,
      [caseId, idempotencyKey]
    );
    if (existing.rows[0]) return mapRow(existing.rows[0]);

    const caseRow = await client.query<{
      case_id: string;
      case_profile: string;
      case_status: string;
      organization_id: string;
      project_id: string | null;
    }>(
      `SELECT case_id, case_profile, case_status, organization_id, project_id
         FROM case_core WHERE case_id = ?`,
      [caseId]
    );
    const caseCore = caseRow.rows[0];
    if (!caseCore) throw new Error('run_lifecycle_case_not_found');
    if (caseCore.case_profile === 'LIGHT') {
      throw new Error('run_lifecycle_light_case_requires_one_click');
    }
    if (caseCore.case_status !== 'DRAFT' && caseCore.case_status !== 'ACTIVE') {
      throw new Error('run_lifecycle_case_not_ready');
    }

    const planVersion = await casePlanVersionService.getPlanVersion(casePlanVersionId, actor);
    if (!planVersion || planVersion.caseId !== caseId) {
      throw new Error('run_lifecycle_plan_version_not_found');
    }
    // The hard rule: never a Run against anything but an immutable, approved
    // definition (file header's "hard rule" section; §6 invariant 4).
    if (planVersion.status !== 'PUBLISHED') {
      throw new Error('run_lifecycle_plan_not_published');
    }

    if (caseCore.case_status === 'DRAFT') {
      await caseCoreService.transitionStatus(
        caseId,
        'ACTIVE',
        { actorUserId: actor },
        'Automatyczny start pracy (CreateRun)'
      );
    }

    const runId = deterministicRunId(caseId, idempotencyKey);
    const now = new Date().toISOString();
    // A SEPARATE, self-committing transaction — NOT the outer advisory-lock
    // client — is deliberate, mirroring lightOneClickService.
    // ensureLightExecutionRun exactly: `runBindingService.bindRunToPlanVersion`
    // below opens its OWN connection and SELECTs `v8_execution_runs` under
    // READ COMMITTED, which cannot see a row still sitting uncommitted on the
    // outer client's open transaction. Committing here first is what makes
    // the row visible to that next call at all — writing it on `client`
    // instead (this file's own first draft) reliably produced
    // `run_not_found` from bindRunToPlanVersion, caught by this packet's own
    // pg test suite, never shipped.
    await withPgTransaction(async (v8Client) => {
      await v8Client.query(
        `INSERT INTO v8_execution_runs (
           run_id, organization_id, context_snapshot_id, initiator_user_id,
           state, plan_version, goal, created_at, updated_at, metadata
         ) VALUES (?, ?, ?, ?, 'drafting', 1, ?, ?, ?, ?)
         ON CONFLICT (run_id) DO NOTHING`,
        [
          runId,
          caseCore.organization_id,
          `ctx-${runId}`,
          actor,
          `Run — case ${caseId}`,
          now,
          now,
          JSON.stringify({ source: 'case-workspace-run-lifecycle', caseId, casePlanVersionId }),
        ]
      );
    });

    const binding = await runBindingService.bindRunToPlanVersion({
      runId,
      casePlanVersionId,
      boundByActorId: actor,
    });

    const inserted = await client.query<CaseWorkspaceRunRow>(
      `INSERT INTO ${RUN_TABLE} (
         run_id, organization_id, project_id, case_id, case_plan_version_id,
         graph_digest, status, outcome_status, initiated_by, correlation_id,
         idempotency_key, version, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'CREATED', 'PENDING_REVIEW', ?, ?, ?, 1, ?, ?)
       RETURNING *`,
      [
        binding.runId,
        caseCore.organization_id,
        caseCore.project_id,
        caseId,
        binding.casePlanVersionId,
        binding.graphDigest,
        initiatedBy,
        correlationId,
        idempotencyKey,
        now,
        now,
      ]
    );
    const insertedRow = inserted.rows[0];
    if (!insertedRow) throw new Error('run_lifecycle_insert_failed');

    await publishEvent(client, {
      eventType: 'run.created',
      ...runEventIdentity(insertedRow),
      actorUserId: actor,
      redactedSummary: redact({
        casePlanVersionId: insertedRow.case_plan_version_id,
        graphDigest: insertedRow.graph_digest,
        initiatedBy,
      }),
    });

    return mapRow(insertedRow);
  });
}

// ---------------------------------------------------------------------------
// StartRun
// ---------------------------------------------------------------------------

/**
 * §5 StartRun — the file header's "hard rule" enforcement point. Idempotent:
 * a Run already past CREATED returns `{ outcome: 'already_started' }`
 * unchanged rather than throwing, matching lightOneClickService's own
 * "duplicate dispatch produces one effect" posture (doc 04 §7 acceptance
 * evidence).
 *
 * On a fresh CREATED Run: re-verifies the bound plan is still PUBLISHED with
 * at least one entry node (VALIDATING), mints a READY NodeRun for every
 * `entryNodeIds` entry via nodeRunService.createNodeRun (QUEUED), and lands
 * on RUNNING with `startedAt` stamped — as ONE physical transition/event
 * (file header).
 */
export async function startRun(
  runId: string,
  actorUserId: string,
  options: { correlationId?: string | null } = {}
): Promise<StartRunResult> {
  const id = requireNonBlank(runId, 'run_lifecycle_run_id_required');
  const actor = requireNonBlank(actorUserId, 'run_lifecycle_actor_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actor, row.case_id);

    if (row.status !== 'CREATED') {
      if (row.status === 'CANCELLED' || row.status === 'FAILED') {
        throw new Error(`run_lifecycle_status_transition_not_allowed:${row.status}->RUNNING`);
      }
      return { outcome: 'already_started', run: mapRow(row) };
    }

    const planVersion = await casePlanVersionService.getPlanVersion(row.case_plan_version_id, actor);
    if (!planVersion || planVersion.status !== 'PUBLISHED') {
      throw new Error('run_lifecycle_plan_not_published');
    }
    const graph: CanonicalGraph = planVersion.semanticGraph;
    const entryNodeIds = Array.isArray(graph.entryNodeIds) ? graph.entryNodeIds : [];
    if (entryNodeIds.length === 0) {
      throw new Error('run_lifecycle_start_validation_failed');
    }

    const nodeRunIds: string[] = [];
    for (const nodeId of entryNodeIds) {
      const created = await nodeRunService.createNodeRun(
        {
          caseId: row.case_id,
          runId: row.run_id,
          nodeId,
          nodeVersionRef: `${row.graph_digest}:${nodeId}`,
          idempotencyKey: `run:${row.run_id}:node:${nodeId}`,
          initialStatus: 'READY',
        },
        actor
      );
      nodeRunIds.push(created.nodeRunId);
    }

    const updatedRow = await transitionRunOnClient(
      client,
      row,
      ['CREATED', 'VALIDATING', 'QUEUED', 'RUNNING'],
      'run.started',
      actor,
      { startedAt: true, summary: { entryNodeCount: entryNodeIds.length, nodeRunIds } }
    );

    return { outcome: 'started', run: mapRow(updatedRow), nodeRunIds };
  });
}

// ---------------------------------------------------------------------------
// PauseRun / ResumeRun
// ---------------------------------------------------------------------------

/** §5 PauseRun. RUNNING -> PAUSED. Stops new automatic dispatch —
 *  `advanceRun` below refuses to run while status is not in its active
 *  family (RUNNING/WAITING/BLOCKED/RETRY_SCHEDULED); it never touches
 *  PAUSED. */
export async function pauseRun(runId: string, actorUserId: string, expectedVersion: number): Promise<Run> {
  const id = requireNonBlank(runId, 'run_lifecycle_run_id_required');
  const actor = requireNonBlank(actorUserId, 'run_lifecycle_actor_required');
  if (typeof expectedVersion !== 'number') throw new Error('run_lifecycle_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actor, row.case_id);
    if (Number(row.version) !== expectedVersion) throw new Error('run_lifecycle_version_conflict');
    const updated = await transitionRunOnClient(client, row, ['RUNNING', 'PAUSED'], 'run.paused', actor);
    return mapRow(updated);
  });
}

/** §5 ResumeRun. PAUSED -> RUNNING. */
export async function resumeRun(runId: string, actorUserId: string, expectedVersion: number): Promise<Run> {
  const id = requireNonBlank(runId, 'run_lifecycle_run_id_required');
  const actor = requireNonBlank(actorUserId, 'run_lifecycle_actor_required');
  if (typeof expectedVersion !== 'number') throw new Error('run_lifecycle_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actor, row.case_id);
    if (Number(row.version) !== expectedVersion) throw new Error('run_lifecycle_version_conflict');
    const updated = await transitionRunOnClient(client, row, ['PAUSED', 'RUNNING'], 'run.resumed', actor);
    return mapRow(updated);
  });
}

// ---------------------------------------------------------------------------
// CancelRun
// ---------------------------------------------------------------------------

/**
 * §5 CancelRun. Any pre-terminal status (file header's documented CANCELLED
 * extensions) -> CANCELLED. Cascades: every one of the Run's NodeRuns
 * currently in a cancellable §4.5 status (PENDING/READY/WAITING_HUMAN/
 * WAITING_TIMER/WAITING_EVENT/FAILED_RETRYABLE) is transitioned to CANCELLED too, via
 * nodeRunService.transitionNodeRun — §4.5's own note that RUNNING/CLAIMED are
 * NOT cancellable in place is respected here by construction (they are
 * simply left alone; they must terminate or time out on their own, exactly
 * as nodeRunService.ts's own header explains).
 */
export async function cancelRun(
  runId: string,
  actorUserId: string,
  expectedVersion: number,
  reason?: string
): Promise<Run> {
  const id = requireNonBlank(runId, 'run_lifecycle_run_id_required');
  const actor = requireNonBlank(actorUserId, 'run_lifecycle_actor_required');
  if (typeof expectedVersion !== 'number') throw new Error('run_lifecycle_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actor, row.case_id);
    if (Number(row.version) !== expectedVersion) throw new Error('run_lifecycle_version_conflict');

    const updated = await transitionRunOnClient(client, row, [row.status, 'CANCELLED'], 'run.cancelled', actor, {
      completedAt: true,
      summary: { reason: optionalTrimmed(reason ?? null) },
    });

    const nodeRuns = await nodeRunService.listNodeRunsForRun(row.run_id, actor);
    for (const nodeRun of nodeRuns) {
      if (!NODE_CANCELLABLE.includes(nodeRun.status)) continue;
      await nodeRunService.transitionNodeRun(nodeRun.nodeRunId, 'CANCELLED', nodeRun.version, {
        actorUserId: actor,
      });
    }

    return mapRow(updated);
  });
}

// ---------------------------------------------------------------------------
// RetryNode
// ---------------------------------------------------------------------------

/**
 * §5 RetryNode — a HUMAN-authorized new attempt at a node's business effect,
 * distinct from nodeRunService's own AUTOMATIC FAILED_RETRYABLE ->
 * RETRY_SCHEDULED budget retry. Only legal once the node's latest NodeRun has
 * exhausted its automatic budget (FAILED_TERMINAL) or was CANCELLED — never
 * against a node that is still live or already succeeded (that would fork a
 * second, parallel business effect, exactly what §6 invariant 7 "Retry does
 * not create a second business effect" forbids for the SAME attempt; this
 * mints a NEW, separate, explicitly-authorized NodeRun instead, itself
 * idempotent on `idempotencyKey` so a duplicated RetryNode click is safe).
 *
 * Requires the Run to be in one of its "work can still happen" statuses; a
 * terminal Run (COMPLETED, COMPLETED_WITH_WARNINGS, FAILED, CANCELLED,
 * COMPENSATING or COMPENSATED) refuses. If the Run
 * was WAITING/BLOCKED/RETRY_SCHEDULED, it is brought back to RUNNING as part
 * of this call — the literal §4.4 arrow "WAITING | BLOCKED | RETRY_SCHEDULED
 * -> RUNNING" fired by the fact that there is claimable work again.
 */
export async function retryNode(
  runId: string,
  nodeId: string,
  actorUserId: string,
  options: { idempotencyKey?: string; maxAttempts?: number } = {}
): Promise<RetryNodeResult> {
  const id = requireNonBlank(runId, 'run_lifecycle_run_id_required');
  const node = requireNonBlank(nodeId, 'run_lifecycle_node_id_required');
  const actor = requireNonBlank(actorUserId, 'run_lifecycle_actor_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actor, row.case_id);
    if (!['RUNNING', 'PAUSED', 'WAITING', 'BLOCKED', 'RETRY_SCHEDULED'].includes(row.status)) {
      throw new Error(`run_lifecycle_status_transition_not_allowed:${row.status}->RETRY_NODE`);
    }

    const latest = await nodeRunService.getLatestNodeRunForNode(row.run_id, node, actor);
    if (!latest) throw new Error('run_lifecycle_node_never_ran');
    if (latest.status !== 'FAILED_TERMINAL' && latest.status !== 'CANCELLED') {
      throw new Error('run_lifecycle_node_not_retryable');
    }

    const retryKey = optionalTrimmed(options.idempotencyKey ?? null) ?? `retry-${uuidv4()}`;
    const created = await nodeRunService.createNodeRun(
      {
        caseId: row.case_id,
        runId: row.run_id,
        nodeId: node,
        nodeVersionRef: latest.nodeVersionRef,
        idempotencyKey: `run:${row.run_id}:node:${node}:${retryKey}`,
        maxAttempts: options.maxAttempts,
        initialStatus: 'READY',
      },
      actor
    );

    let finalRow = row;
    if (row.status === 'WAITING' || row.status === 'BLOCKED' || row.status === 'RETRY_SCHEDULED') {
      finalRow = await transitionRunOnClient(client, row, [row.status, 'RUNNING'], 'run.retry_node_resumed', actor, {
        summary: { nodeId: node, nodeRunId: created.nodeRunId },
      });
    }

    return { run: mapRow(finalRow), nodeRun: created };
  });
}

/** Explicit, deliberate write-off — see file header open_question #2: an
 *  algorithm never infers permanent business failure; a human/operator
 *  states it. BLOCKED or RUNNING -> FAILED. */
export async function failRun(
  runId: string,
  actorUserId: string,
  expectedVersion: number,
  reason: string
): Promise<Run> {
  const id = requireNonBlank(runId, 'run_lifecycle_run_id_required');
  const actor = requireNonBlank(actorUserId, 'run_lifecycle_actor_required');
  const reasonText = requireNonBlank(reason, 'run_lifecycle_fail_reason_required');
  if (typeof expectedVersion !== 'number') throw new Error('run_lifecycle_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actor, row.case_id);
    if (Number(row.version) !== expectedVersion) throw new Error('run_lifecycle_version_conflict');
    const updated = await transitionRunOnClient(client, row, [row.status, 'FAILED'], 'run.failed', actor, {
      completedAt: true,
      summary: { reason: reasonText },
    });
    return mapRow(updated);
  });
}

// ---------------------------------------------------------------------------
// ProvideNodeInput (§5 Wait family's ProvideHumanInput, Run-facing)
// ---------------------------------------------------------------------------

/**
 * Bridges a satisfied HUMAN wait back to the NodeRun parked on it — the
 * connective tissue that did not exist before this file (file header:
 * "NOTHING bridged a satisfied HUMAN wait back to the WAITING_HUMAN
 * NodeRun"). Loads the NodeRun (must be WAITING_HUMAN with a `waitId`),
 * resolves the wait's CURRENT version, calls
 * `waitSubscriptionService.provideHumanInput` (which OCC-guards and emits its
 * own `wait.human_input_provided` event on the wait aggregate), then
 * transitions the NodeRun WAITING_HUMAN -> READY (§4.5's literal arrow) and,
 * if the Run itself is WAITING and no OTHER NodeRun is still waiting,
 * resumes the Run to RUNNING.
 *
 * NOT one atomic transaction across all three writes — `waitSubscriptionService`
 * opens its own connection (this directory's established multi-service
 * posture; see lightOneClickService.ts's header for the same tradeoff and
 * why an advisory lock is not needed here: unlike CreateRun, no CONCURRENT
 * caller races the same nodeRunId/waitId pair under normal operation, and
 * every step here is itself OCC/idempotent-guarded, so a crash between steps
 * leaves the wait SATISFIED and the NodeRun still WAITING_HUMAN — a safely
 * re-driveable state, not a lost update).
 */
export async function provideNodeInput(input: {
  nodeRunId: string;
  inputRef: string;
  actorUserId: string;
}): Promise<{ nodeRun: NodeRun; run: Run }> {
  const nodeRunId = requireNonBlank(input.nodeRunId, 'run_lifecycle_node_run_id_required');
  const inputRef = requireNonBlank(input.inputRef, 'run_lifecycle_input_ref_required');
  const actor = requireNonBlank(input.actorUserId, 'run_lifecycle_actor_required');

  const nodeRun = await nodeRunService.getNodeRun(nodeRunId, actor);
  if (!nodeRun) throw new Error('run_lifecycle_node_run_not_found');
  if (nodeRun.status !== 'WAITING_HUMAN') throw new Error('run_lifecycle_node_run_not_waiting_human');
  const waitId = requireNonBlank(nodeRun.waitId, 'run_lifecycle_node_run_missing_wait');

  const wait = await waitSubscriptionService.getWait(waitId, actor);
  if (!wait) throw new Error('run_lifecycle_wait_not_found');

  await waitSubscriptionService.provideHumanInput(waitId, { inputRef, actorUserId: actor }, wait.version);

  const readyNodeRun = await nodeRunService.transitionNodeRun(nodeRunId, 'READY', nodeRun.version, {
    actorUserId: actor,
  });

  const run = await maybeResumeRunFromWaiting(readyNodeRun.runId, actor);
  return { nodeRun: readyNodeRun, run };
}

/** If the Run is WAITING and no NodeRun is still WAITING_*, resumes it to
 *  RUNNING (§4.4's literal "WAITING -> RUNNING" arrow). No-op (returns the
 *  Run unchanged) in every other case — never throws for "nothing to do". */
async function maybeResumeRunFromWaiting(runId: string, actorUserId: string): Promise<Run> {
  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, runId);
    if (row.status !== 'WAITING') return mapRow(row);

    const nodeRuns = await nodeRunService.listNodeRunsForRun(runId, actorUserId);
    const stillWaiting = nodeRuns.some((n) => NODE_WAITING_LIKE.includes(n.status));
    if (stillWaiting) return mapRow(row);

    const updated = await transitionRunOnClient(client, row, ['WAITING', 'RUNNING'], 'run.resumed_from_waiting', actorUserId);
    return mapRow(updated);
  });
}

// ---------------------------------------------------------------------------
// CompensateAction
// ---------------------------------------------------------------------------

/**
 * §5 CompensateAction — required in V1 per doc 04 §4.4's literal arrow
 * "RUNNING | CANCELLED -> COMPENSATING -> COMPENSATED | FAILED" and §5's
 * literal command list ("Run: CreateRun, StartRun, PauseRun, ResumeRun,
 * CancelRun, RetryNode, CompensateAction" — no conditional wording).
 *
 * Starts compensation: RUNNING|CANCELLED -> COMPENSATING, and marks every
 * NodeRun under this Run whose `compensationState` is `REQUIRED` as
 * `IN_PROGRESS` via nodeRunService.recordNodeRunCompensation (the ACTUAL
 * reversal of an external effect is a capability-adapter concern, out of
 * this file's scope — same "records the fact, does not execute it" posture
 * nodeRunService.recordNodeRunCompensation's own doc comment already states).
 * Returns the marked node ids; the caller/worker performs the real
 * compensation and reports back via `recordNodeCompensationOutcome`.
 */
export async function compensateRun(
  runId: string,
  actorUserId: string,
  expectedVersion: number
): Promise<{ run: Run; markedNodeRunIds: string[] }> {
  const id = requireNonBlank(runId, 'run_lifecycle_run_id_required');
  const actor = requireNonBlank(actorUserId, 'run_lifecycle_actor_required');
  if (typeof expectedVersion !== 'number') throw new Error('run_lifecycle_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actor, row.case_id);
    if (Number(row.version) !== expectedVersion) throw new Error('run_lifecycle_version_conflict');

    const updated = await transitionRunOnClient(
      client,
      row,
      [row.status, 'COMPENSATING'],
      'run.compensation_started',
      actor
    );

    const nodeRuns = await nodeRunService.listNodeRunsForRun(row.run_id, actor);
    const markedNodeRunIds: string[] = [];
    for (const nodeRun of nodeRuns) {
      if (nodeRun.compensationState !== 'REQUIRED') continue;
      await nodeRunService.recordNodeRunCompensation(nodeRun.nodeRunId, 'IN_PROGRESS', nodeRun.version, {
        actorUserId: actor,
      });
      markedNodeRunIds.push(nodeRun.nodeRunId);
    }

    return { run: mapRow(updated), markedNodeRunIds };
  });
}

/**
 * The other half of CompensateAction: a worker reports one node's
 * compensation outcome. Once every node this Run ever marked IN_PROGRESS
 * (via `compensateRun` above) has reached a terminal compensation state
 * (COMPLETED or FAILED), the Run itself resolves: all COMPLETED ->
 * COMPENSATED; any FAILED -> FAILED (§4.4's literal "COMPENSATING ->
 * COMPENSATED | FAILED").
 */
export async function recordNodeCompensationOutcome(
  runId: string,
  nodeRunId: string,
  outcome: 'COMPLETED' | 'FAILED',
  actorUserId: string
): Promise<Run> {
  const id = requireNonBlank(runId, 'run_lifecycle_run_id_required');
  const actor = requireNonBlank(actorUserId, 'run_lifecycle_actor_required');
  if (outcome !== 'COMPLETED' && outcome !== 'FAILED') {
    throw new Error('run_lifecycle_compensation_outcome_invalid');
  }

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actor, row.case_id);
    if (row.status !== 'COMPENSATING') {
      throw new Error(`run_lifecycle_status_transition_not_allowed:${row.status}->COMPENSATION_OUTCOME`);
    }

    const target = await nodeRunService.getNodeRun(nodeRunId, actor);
    if (!target || target.runId !== row.run_id) throw new Error('run_lifecycle_node_run_not_found');
    await nodeRunService.recordNodeRunCompensation(nodeRunId, outcome, target.version, { actorUserId: actor });

    const nodeRuns = await nodeRunService.listNodeRunsForRun(row.run_id, actor);
    const unresolved = nodeRuns.some(
      (n) => n.compensationState === 'REQUIRED' || n.compensationState === 'IN_PROGRESS'
    );
    if (unresolved) return mapRow(row);

    const anyFailed = nodeRuns.some((n) => n.compensationState === 'FAILED');
    const finalStatus: RunStatus = anyFailed ? 'FAILED' : 'COMPENSATED';
    const updated = await transitionRunOnClient(
      client,
      row,
      ['COMPENSATING', finalStatus],
      'run.compensation_resolved',
      actor,
      { completedAt: true, summary: { anyFailed } }
    );
    return mapRow(updated);
  });
}

// ---------------------------------------------------------------------------
// AdvanceRun — gateway evaluation helpers (B1 packet: closes the PARTIAL
// "advanceRun does not evaluate gateways"). Kept as free functions, not
// exported, per this directory's "each service file keeps its own local
// helpers" convention.
// ---------------------------------------------------------------------------

/**
 * Drives an already-READY gateway NodeRun through the ONLY path §4.5 allows
 * to a terminal status — READY -> CLAIMED -> RUNNING -> SUCCEEDED — reusing
 * nodeRunService's own lease/attempt primitives, never a second completion
 * path. A gateway's "work" IS the deterministic fact this file already
 * resolved (a recorded DECISION_GATEWAY evaluation, or — for PARALLEL_SPLIT/
 * PARALLEL_JOIN — this file's own mechanical predecessor computation); the
 * claim/attempt round-trip exists only so a gateway NodeRun's lifecycle looks
 * like every other NodeRun's to every other reader of this table
 * (listNodeRunsForRun, the outbox, future UI), not because a worker is
 * dispatched to do anything.
 *
 * Returns `null` (never throws) when a CONCURRENT `advanceRun` already
 * claimed this same nodeRunId first and has not finished yet — the caller
 * folds this back into "not resolved this round" rather than fabricating a
 * result; the next `advanceRun` call (this one retried, or the actual winner
 * finishing) observes the settled SUCCEEDED state once it lands. This is what
 * makes two concurrent `advanceRun` calls converge on ONE effect rather than
 * one of them throwing.
 */
async function resolveGatewayNodeRun(
  nodeRunId: string,
  actorUserId: string
): Promise<NodeRun | null> {
  const claim = await nodeRunService.claimNodeRun(nodeRunId, {
    leaseOwner: `run-lifecycle-gateway-${uuidv4()}`,
    leaseMs: 60_000,
  });
  if (claim.outcome !== 'claimed') {
    const current = await nodeRunService.getNodeRun(nodeRunId, actorUserId);
    return current && current.status === 'SUCCEEDED' ? current : null;
  }
  const attempt = await nodeRunService.startNodeRunAttempt(
    nodeRunId,
    { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 60_000 },
    claim.nodeRun.version
  );
  const completed = await nodeRunService.completeNodeRunAttempt(
    nodeRunId,
    {
      attemptId: attempt.attempt.attemptId,
      leaseOwner: claim.leaseOwner,
      fencingToken: claim.fencingToken,
      outcome: 'SUCCEEDED',
    },
    attempt.nodeRun.version
  );
  return completed.nodeRun;
}

/**
 * CW-GR-037's DECISION_GATEWAY branch selection, read from an ALREADY
 * recorded `case_workspace_gateway_evaluations` row — never computed or
 * guessed here (the file header's "no guessing" rule). Throws loudly on a
 * malformed/inconsistent recorded fact (wrong outcomeStatus, missing
 * `selectedEdgeId`, or a `selectedEdgeId` that is not actually one of this
 * gateway's own outgoing edges) rather than silently stalling the Run forever
 * on bad data — a malformed evaluation is a data bug, not a "not yet decided"
 * state.
 */
function extractSelectedEdgeId(
  evaluation: Pick<CaseGatewayEvaluation, 'outcomeStatus' | 'outcomeDetail'>,
  gatewayNodeId: string,
  graph: CanonicalGraph
): string {
  if (evaluation.outcomeStatus !== 'BRANCH_SELECTED') {
    throw new Error('run_lifecycle_gateway_evaluation_unexpected_outcome');
  }
  const detail = evaluation.outcomeDetail;
  const selectedEdgeId =
    detail && typeof detail === 'object' && !Array.isArray(detail)
      ? (detail as Record<string, unknown>).selectedEdgeId
      : undefined;
  if (typeof selectedEdgeId !== 'string' || !selectedEdgeId.trim()) {
    throw new Error('run_lifecycle_gateway_evaluation_missing_selected_edge');
  }
  const belongsToGateway = (graph.edges ?? []).some(
    (e) => e.edgeId === selectedEdgeId && e.sourceNodeId === gatewayNodeId
  );
  if (!belongsToGateway) {
    throw new Error('run_lifecycle_gateway_evaluation_selected_edge_not_found');
  }
  return selectedEdgeId;
}

// ---------------------------------------------------------------------------
// AdvanceRun — graph progression + Run-status recompute
// ---------------------------------------------------------------------------

/**
 * The orchestration reaction to a NodeRun reaching a terminal state — the
 * loop this program never had (file header). Callers (a worker after
 * `nodeRunService.completeNodeRunAttempt`, or a test asserting a full run)
 * call this once per node completion.
 *
 * Refuses (no-op, returns the Run unchanged) unless the Run is currently in
 * its "work can still happen" family (RUNNING/WAITING/BLOCKED/
 * RETRY_SCHEDULED) — see open_questions #1/#2 for what this function does and
 * does not decide.
 *
 * GATEWAY EVALUATION (this packet's own addition — see open_question #1 for
 * the full per-type rule): a node's incoming edge is "satisfied" once its
 * source SUCCEEDED — EXCEPT an edge leaving a DECISION_GATEWAY, which is only
 * satisfied if it is the ONE edge a recorded evaluation selected. This single
 * rule, applied through the SAME generic predecessor-readiness check every
 * other node already used, is what makes PARALLEL_JOIN's "wait for every
 * incoming branch" fall out for free, with no join-specific readiness logic.
 */
export async function advanceRun(runId: string, actorUserId: string): Promise<AdvanceRunResult> {
  const id = requireNonBlank(runId, 'run_lifecycle_run_id_required');
  const actor = requireNonBlank(actorUserId, 'run_lifecycle_actor_required');

  const runRow = await queryOne<CaseWorkspaceRunRow>(`SELECT * FROM ${RUN_TABLE} WHERE run_id = ?`, [id]);
  if (!runRow) throw new Error('run_lifecycle_run_not_found');
  await requireCaseAccess(actor, runRow.case_id);
  if (!['RUNNING', 'WAITING', 'BLOCKED', 'RETRY_SCHEDULED'].includes(runRow.status)) {
    return { run: mapRow(runRow), createdNodeRunIds: [] };
  }

  const planVersion = await casePlanVersionService.getPlanVersion(runRow.case_plan_version_id, actor);
  if (!planVersion) throw new Error('run_lifecycle_plan_version_not_found');
  const graph = planVersion.semanticGraph as CanonicalGraph;
  const graphNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const graphEdges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodeTypeById = new Map<string, string>(graphNodes.map((n) => [n.nodeId, String(n.type ?? '')]));

  const nodeRuns = await nodeRunService.listNodeRunsForRun(runRow.run_id, actor);
  const latestByNode = new Map<string, NodeRun>();
  for (const nodeRun of nodeRuns) {
    const current = latestByNode.get(nodeRun.nodeId);
    if (!current || nodeRun.createdAt >= current.createdAt) latestByNode.set(nodeRun.nodeId, nodeRun);
  }

  const successIds = new Set<string>();
  const failedIds = new Set<string>();
  // Which of a DECISION_GATEWAY's several outgoing edges is the satisfied
  // one — the ONLY thing that ever restricts edgeSatisfied() below. Seeded
  // here from every DECISION_GATEWAY already SUCCEEDED by a PAST advanceRun
  // call (its evaluation is re-read, never re-decided), then extended as more
  // resolve during this call.
  const selectedEdgeIdByNode = new Map<string, string>();
  for (const [nodeId, nodeRun] of latestByNode) {
    if (NODE_SUCCESS_LIKE.includes(nodeRun.status)) successIds.add(nodeId);
    else if (NODE_FAILED_LIKE.includes(nodeRun.status)) failedIds.add(nodeId);
    if (nodeTypeById.get(nodeId) === 'DECISION_GATEWAY' && nodeRun.status === 'SUCCEEDED') {
      const evaluation = await executionGraphService.getGatewayEvaluation(nodeRun.nodeRunId, actor);
      if (!evaluation) throw new Error('run_lifecycle_gateway_evaluation_missing_after_success');
      selectedEdgeIdByNode.set(nodeId, extractSelectedEdgeId(evaluation, nodeId, graph));
    }
  }

  // An incoming edge is satisfied once its source SUCCEEDED — EXCEPT an edge
  // leaving a DECISION_GATEWAY, which is satisfied only if it is the ONE edge
  // the recorded evaluation selected. Applying this through the SAME check
  // every node's readiness already uses is what gives PARALLEL_JOIN's
  // "wait for every incoming branch" for free — no join-specific logic.
  function edgeSatisfied(edge: { sourceNodeId: string; edgeId: string }): boolean {
    if (!successIds.has(edge.sourceNodeId)) return false;
    if (nodeTypeById.get(edge.sourceNodeId) === 'DECISION_GATEWAY') {
      return selectedEdgeIdByNode.get(edge.sourceNodeId) === edge.edgeId;
    }
    return true;
  }

  function incomingControlEdges(nodeId: string) {
    return graphEdges.filter(
      (e) =>
        e.targetNodeId === nodeId &&
        (!e.edgeType || e.edgeType === 'SEQUENCE' || e.edgeType === 'CONDITIONAL')
    );
  }

  const createdNodeRunIds: string[] = [];

  // Fixed-point loop: each pass may (a) resolve a READY DECISION_GATEWAY
  // whose evaluation now exists, and (b) create NodeRuns for nodes whose
  // predecessors just became satisfied — immediately auto-resolving
  // PARALLEL_SPLIT/PARALLEL_JOIN nodes in place (their readiness IS the
  // deterministic fact; see this function's own header). Repeats until
  // nothing changes, so a chain of gateways resolves within ONE call
  // regardless of the graph's node array order. Bounded by node count so a
  // malformed/cyclic graph can never spin forever.
  let progressed = true;
  let guard = 0;
  const maxPasses = graphNodes.length + 2;
  while (progressed && guard < maxPasses) {
    progressed = false;
    guard += 1;

    // (a) Resolve DECISION_GATEWAY nodes already created and still READY.
    for (const [nodeId, nodeRun] of [...latestByNode.entries()]) {
      if (nodeTypeById.get(nodeId) !== 'DECISION_GATEWAY' || nodeRun.status !== 'READY') continue;
      const evaluation = await executionGraphService.getGatewayEvaluation(nodeRun.nodeRunId, actor);
      if (!evaluation) continue; // no guessing — stays READY, Run waits (see final classification below).
      const selectedEdgeId = extractSelectedEdgeId(evaluation, nodeId, graph);
      const resolved = await resolveGatewayNodeRun(nodeRun.nodeRunId, actor);
      if (!resolved) continue; // raced by a concurrent advanceRun; the winner's write will show up next pass/call.
      latestByNode.set(nodeId, resolved);
      successIds.add(nodeId);
      selectedEdgeIdByNode.set(nodeId, selectedEdgeId);
      progressed = true;
    }

    // (b) Create NodeRuns for nodes whose predecessors are now satisfied.
    for (const node of graphNodes) {
      if (latestByNode.has(node.nodeId)) continue; // already has a NodeRun
      const incoming = incomingControlEdges(node.nodeId);
      if (incoming.length === 0) continue; // not an entry node (those exist by startRun) and no predecessor — graph anomaly, never fabricated
      // PARALLEL_JOIN is the ONLY node type that requires EVERY incoming
      // branch (this packet's "wait for all" AND-join, join_policy ALL).
      // Every other node — including a plain node where two DECISION_GATEWAY
      // branches reconverge with no explicit join marker — fires once ANY
      // ONE predecessor edge is satisfied (standard exclusive-gateway
      // convergence: whichever branch actually ran continues the flow; there
      // is no such thing as "wait for the branch that was never selected").
      // `latestByNode.has(...)` above already makes this a one-shot creation
      // regardless of how many predecessors eventually succeed.
      const readySatisfied =
        nodeTypeById.get(node.nodeId) === 'PARALLEL_JOIN'
          ? incoming.every(edgeSatisfied)
          : incoming.some(edgeSatisfied);
      if (!readySatisfied) continue;

      const created = await nodeRunService.createNodeRun(
        {
          caseId: runRow.case_id,
          runId: runRow.run_id,
          nodeId: node.nodeId,
          nodeVersionRef: `${runRow.graph_digest}:${node.nodeId}`,
          idempotencyKey: `run:${runRow.run_id}:node:${node.nodeId}`,
          initialStatus: 'READY',
        },
        actor
      );
      createdNodeRunIds.push(created.nodeRunId);
      latestByNode.set(node.nodeId, created);
      progressed = true;

      const gatewayType = nodeTypeById.get(node.nodeId);
      if (gatewayType === 'PARALLEL_SPLIT' || gatewayType === 'PARALLEL_JOIN') {
        // Mechanical, no business judgement: fan-out is unconditional, and
        // this node was only just created because `incoming.every(...)`
        // above already confirmed EVERY incoming branch is satisfied (the
        // join's own "wait for all" rule) — so its own readiness already IS
        // the deterministic fact. Recorded through the existing ledger
        // (never a second one) for the SAME audit trail DECISION_GATEWAY's
        // externally-recorded facts get, then resolved immediately. Contrast
        // DECISION_GATEWAY (phase (a) above), whose branch choice this file
        // can never invent and therefore only ever reads.
        const outgoing = graphEdges.filter((e) => e.sourceNodeId === node.nodeId);
        await executionGraphService.recordGatewayEvaluation({
          nodeRunId: created.nodeRunId,
          runId: runRow.run_id,
          gatewayNodeType: gatewayType,
          ...(gatewayType === 'PARALLEL_JOIN'
            ? { joinPolicy: 'ALL' as const, joinBranchTotalCount: incoming.length }
            : {}),
          evaluationInputSnapshot: {
            nodeId: node.nodeId,
            predecessorNodeIds: incoming.map((e) => e.sourceNodeId).sort(),
          },
          outcomeStatus: gatewayType === 'PARALLEL_SPLIT' ? 'SPLIT_ACTIVATED' : 'JOIN_SATISFIED',
          outcomeDetail: { outgoingEdgeIds: outgoing.map((e) => e.edgeId).sort() },
          evaluatedAt: new Date().toISOString(),
          recordedByActorId: actor,
        });
        const resolved = await resolveGatewayNodeRun(created.nodeRunId, actor);
        if (resolved) {
          latestByNode.set(node.nodeId, resolved);
          successIds.add(node.nodeId);
        }
      }
    }
  }

  // Final Run-status classification. Everything not already in
  // successIds/failedIds is read off its NodeRun's current status, with ONE
  // override: a DECISION_GATEWAY still sitting READY with no recorded
  // evaluation counts as WAITING, never as ordinary "active" work — the "no
  // guessing" rule made visible in the Run's own status, not just in the
  // graph failing to progress past it.
  const activeIds = new Set<string>();
  const waitingIds = new Set<string>();
  for (const [nodeId, nodeRun] of latestByNode) {
    if (successIds.has(nodeId) || failedIds.has(nodeId)) continue;
    if (NODE_WAITING_LIKE.includes(nodeRun.status)) {
      waitingIds.add(nodeId);
    } else if (nodeTypeById.get(nodeId) === 'DECISION_GATEWAY' && nodeRun.status === 'READY') {
      waitingIds.add(nodeId);
    } else if (NODE_ACTIVE_LIKE.includes(nodeRun.status)) {
      activeIds.add(nodeId);
    }
  }

  const terminalNodeIds = Array.isArray(graph.terminalNodeIds) ? graph.terminalNodeIds : [];
  const allTerminalSucceeded = terminalNodeIds.length > 0 && terminalNodeIds.every((tid) => successIds.has(tid));

  let nextStatus: RunStatus = runRow.status;
  if (allTerminalSucceeded) {
    const acceptances = await executionGraphService.listNodeResultAcceptancesForRun(
      runRow.run_id,
      undefined,
      actor
    );
    const anyPartial = acceptances.some((a) => a.resultAcceptance === 'PARTIAL');
    nextStatus = anyPartial ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED';
  } else if (activeIds.size > 0) {
    nextStatus = 'RUNNING';
  } else if (waitingIds.size > 0) {
    nextStatus = 'WAITING';
  } else if (failedIds.size > 0) {
    // Stuck: no automatic progress possible. Never auto-FAILED — see
    // open_question #2. A human calls retryNode/failRun/cancelRun next.
    nextStatus = 'BLOCKED';
  }

  if (nextStatus === runRow.status) return { run: mapRow(runRow), createdNodeRunIds };

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    if (row.status !== runRow.status) {
      // Lost a race against a concurrent transition since the read above —
      // report the CURRENT truth rather than fight it; the next advanceRun
      // call (or the transition that just won) will settle things.
      return { run: mapRow(row), createdNodeRunIds };
    }
    const updated = await transitionRunOnClient(client, row, [row.status, nextStatus], 'run.advanced', actor, {
      completedAt: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'].includes(nextStatus),
      summary: { createdNodeRunIds, successCount: successIds.size, failedCount: failedIds.size },
    });
    return { run: mapRow(updated), createdNodeRunIds };
  });
}

// ---------------------------------------------------------------------------
// Run outcome (business acceptance, separate from technical status — §4.4)
// ---------------------------------------------------------------------------

/**
 * Sets `outcomeStatus` once the Run has technically completed
 * (COMPLETED/COMPLETED_WITH_WARNINGS/FAILED/CANCELLED) — §4.4: "Technical
 * completion is separate from outcomeStatus". Never inferred automatically
 * (§4.5's own "never from warnings or node counts" posture, applied to the
 * Run level too — see file header open_question #2/#3).
 */
export async function recordRunOutcome(
  runId: string,
  outcomeStatus: RunOutcomeStatus,
  actorUserId: string,
  expectedVersion: number
): Promise<Run> {
  const id = requireNonBlank(runId, 'run_lifecycle_run_id_required');
  const actor = requireNonBlank(actorUserId, 'run_lifecycle_actor_required');
  const OUTCOME_STATUSES: readonly RunOutcomeStatus[] = [
    'PENDING_REVIEW',
    'ACCEPTED',
    'REJECTED',
    'PARTIALLY_ACCEPTED',
    'NOT_APPLICABLE',
  ];
  if (!OUTCOME_STATUSES.includes(outcomeStatus)) throw new Error('run_lifecycle_outcome_status_invalid');
  if (typeof expectedVersion !== 'number') throw new Error('run_lifecycle_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actor, row.case_id);
    if (!['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED', 'COMPENSATED'].includes(row.status)) {
      throw new Error('run_lifecycle_not_technically_complete');
    }
    if (Number(row.version) !== expectedVersion) throw new Error('run_lifecycle_version_conflict');

    const now = new Date().toISOString();
    const updated = await client.query<CaseWorkspaceRunRow>(
      `UPDATE ${RUN_TABLE}
          SET outcome_status = ?, version = version + 1, updated_at = ?
        WHERE run_id = ? AND version = ?
        RETURNING *`,
      [outcomeStatus, now, id, expectedVersion]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('run_lifecycle_version_conflict');

    await publishEvent(client, {
      eventType: 'run.outcome_recorded',
      ...runEventIdentity(updatedRow),
      actorUserId: actor,
      redactedSummary: redact({ from: row.outcome_status, to: outcomeStatus }),
    });

    return mapRow(updatedRow);
  });
}

// ---------------------------------------------------------------------------
// LIGHT bridge — calls lightOneClickService, never duplicates it
// ---------------------------------------------------------------------------

/**
 * LIGHT's "Zatwierdź i rozpocznij" one-click, projected into THIS file's
 * `case_workspace_runs` lifecycle table so a LIGHT Run is visible through the
 * same `getRun`/`listRunsForCase` surface as a STANDARD/TRANSFORMATION one.
 * Delegates the ENTIRE plan-create/publish/bind/NodeRun decision to
 * `lightOneClickService.startLightOneClick` — this function adds NOTHING to
 * that decision, it only mirrors the result. See the file header: "LIGHT is
 * policy-different by owner decision … never a second LIGHT planning/binding
 * implementation."
 *
 * Idempotent by construction: `startLightOneClick` itself is idempotent
 * (`already_started` on replay), and the row insert here is
 * `ON CONFLICT (run_id) DO NOTHING` keyed on that same deterministic
 * `runId`, so a repeated call converges rather than duplicating.
 */
export async function startLightRun(
  caseId: string,
  actorUserId: string,
  correlationId?: string | null
): Promise<
  | { outcome: 'started' | 'already_started'; run: Run }
  | { outcome: 'refused'; reasonCode: string; reasonDetail: string }
> {
  const result = await lightOneClickService.startLightOneClick({
    caseId: requireNonBlank(caseId, 'run_lifecycle_case_id_required'),
    actorUserId: requireNonBlank(actorUserId, 'run_lifecycle_actor_required'),
    correlationId: correlationId ?? null,
  });

  if (result.outcome === 'refused') {
    return { outcome: 'refused', reasonCode: result.reasonCode, reasonDetail: result.reasonDetail };
  }

  return withPgTransaction(async (client) => {
    const existing = await client.query<CaseWorkspaceRunRow>(`SELECT * FROM ${RUN_TABLE} WHERE run_id = ?`, [
      result.runId,
    ]);
    if (existing.rows[0]) {
      return { outcome: 'already_started', run: mapRow(existing.rows[0]) };
    }

    const now = new Date().toISOString();
    const inserted = await client.query<CaseWorkspaceRunRow>(
      `INSERT INTO ${RUN_TABLE} (
         run_id, organization_id, project_id, case_id, case_plan_version_id,
         graph_digest, status, outcome_status, initiated_by, correlation_id,
         idempotency_key, version, created_at, started_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', 'PENDING_REVIEW', ?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT (run_id) DO NOTHING
       RETURNING *`,
      [
        result.runId,
        result.case.organizationId,
        result.case.projectId,
        result.caseId,
        result.planVersion.casePlanVersionId,
        result.planVersion.graphDigest,
        actorUserId,
        correlationId ?? null,
        `light-one-click:${result.runId}`,
        now,
        now,
        now,
      ]
    );
    const insertedRow = inserted.rows[0];
    if (!insertedRow) {
      const race = await client.query<CaseWorkspaceRunRow>(`SELECT * FROM ${RUN_TABLE} WHERE run_id = ?`, [
        result.runId,
      ]);
      const raceRow = race.rows[0];
      if (!raceRow) throw new Error('run_lifecycle_insert_failed');
      return { outcome: 'already_started', run: mapRow(raceRow) };
    }

    await publishEvent(client, {
      eventType: 'run.created',
      ...runEventIdentity(insertedRow),
      actorUserId,
      redactedSummary: redact({
        casePlanVersionId: insertedRow.case_plan_version_id,
        graphDigest: insertedRow.graph_digest,
        source: 'light-one-click',
      }),
    });
    await publishEvent(client, {
      eventType: 'run.started',
      ...runEventIdentity(insertedRow),
      actorUserId,
      redactedSummary: redact({ from: 'CREATED', to: 'RUNNING', source: 'light-one-click' }),
    });

    return { outcome: result.outcome === 'already_started' ? 'already_started' : 'started', run: mapRow(insertedRow) };
  });
}

// ---------------------------------------------------------------------------
// Read-only queries
// ---------------------------------------------------------------------------

export async function getRun(runId: string, actorUserId: string): Promise<Run | null> {
  const id = requireNonBlank(runId, 'run_lifecycle_run_id_required');
  const actor = requireNonBlank(actorUserId, 'run_lifecycle_actor_required');
  const row = await queryOne<CaseWorkspaceRunRow>(`SELECT * FROM ${RUN_TABLE} WHERE run_id = ?`, [id]);
  if (!row) return null;
  await requireCaseAccess(actor, row.case_id);
  return mapRow(row);
}

export async function listRunsForCase(caseId: string, actorUserId: string): Promise<Run[]> {
  const id = requireNonBlank(caseId, 'run_lifecycle_case_id_required');
  await requireCaseAccess(requireNonBlank(actorUserId, 'run_lifecycle_actor_required'), id);
  const rows = await queryAll<CaseWorkspaceRunRow>(
    `SELECT * FROM ${RUN_TABLE} WHERE case_id = ? ORDER BY created_at DESC`,
    [id]
  );
  return rows.map(mapRow);
}
