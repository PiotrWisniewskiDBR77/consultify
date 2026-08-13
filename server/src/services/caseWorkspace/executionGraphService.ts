/**
 * Case Workspace — Execution Graph service (CW-P10, EPIC E9 "advanced
 * execution graph").
 *
 * Backs the `case_workspace_gateway_evaluations` and
 * `case_workspace_node_result_acceptances` tables added in
 * server/migrations/20260809_case_workspace_execution_graph.sql. Per the
 * packet's collision-avoidance mandate (docs/product/case-workspace/
 * acceptance/CODEBASE_CONVERGENCE_MAP.csv, area=v8-runtime), this service
 * only ever SELECTs `case_core` (CW-P01) and `case_workspace_run_bindings`
 * (CW-P04) — it never INSERT/UPDATE/DELETEs either, builds no NodeRun logic,
 * retry/compensation, or execution engine (that already exists in
 * `v8_agent_work_graphs`/`v8_agent_branch_tasks`, out of scope), and never
 * references Finance or Results.
 *
 * This packet is NOT an execution engine: it does not decide what a node
 * does, whether a gateway condition is TRUE, or whether independent branches
 * continue after a failure. It only durably records the deterministic
 * gateway/acceptance FACTS a future orchestrator (out of scope) will read and
 * act on.
 *
 * `node_run_id` is stored as opaque unenforced TEXT in both tables —
 * deliberately no FK, same posture as
 * `case_workspace_action_proposals.node_run_id` /
 * `case_workspace_waits.node_run_id`, since no confirmed canonical NodeRun
 * table exists in this codebase to FK against. Both tables key `run_id` as a
 * read-only FK into `case_workspace_run_bindings(run_id)` per this packet's
 * explicit keying instruction (matching CW-P06 waits' convention rather than
 * CW-P05 proposals' direct-to-v8_execution_runs convention).
 *
 * `case_workspace_run_bindings` does not itself carry `project_id` (only
 * `case_id`/`organization_id` — see runBindingService.ts). Both recording
 * methods below therefore do a second, read-only lookup of `case_core` by
 * the resolved binding's `case_id` to denormalize `project_id`, in addition
 * to the `case_id`/`organization_id` already denormalized from the binding
 * itself.
 *
 * req_id coverage (docs/product/case-workspace/acceptance/
 * FUNCTIONAL_REQUIREMENT_COVERAGE.csv, filter epics contains "E9" AND row_id
 * starts with "CW-"):
 *
 *   recordGatewayEvaluation          -> CW-GR-037, CW-GR-009
 *   getGatewayEvaluation             -> CW-GR-037
 *   listGatewayEvaluationsForRun     -> CW-GR-037
 *   listGatewayEvaluationsForCase    -> CW-GR-037
 *   recordNodeResultAcceptance       -> CW-RT-037, CW-GR-009, CW-RT-035
 *   getNodeResultAcceptance          -> CW-RT-037
 *   listNodeResultAcceptancesForRun  -> CW-RT-037, CW-RT-035
 *   listNodeResultAcceptancesForCase -> CW-RT-037
 *
 * DOMAIN EVENTS (docs/product/case-workspace/acceptance/EVENT_TAXONOMY.md):
 * the two recording commands each append exactly one row to
 * `case_workspace_event_outbox` — `node.gateway_evaluated` and
 * `node.result_accepted`, both on aggregate `NODE_RUN`, both with
 * `aggregateVersion = null` (§3: neither ledger has a version column). The
 * `publishEvent()` call is made INSIDE the command's existing
 * `withPgTransaction()` callback, on that same client, so the ledger row and
 * the event commit or roll back together; there is no post-commit publish
 * path. Because both tables key on `node_run_id` (PK) and both commands are
 * therefore idempotent by construction, each event carries a DETERMINISTIC
 * `eventId` derived from that same `node_run_id` — a replayed recording takes
 * the ON CONFLICT branch and publishes nothing, and even a hypothetical
 * double-publish would collapse on the outbox's own `ON CONFLICT (event_id)`.
 * `node.result_accepted` is emitted for every recorded acceptance value
 * (ACCEPTED/PARTIAL/REJECTED/NOT_APPLICABLE) — the taxonomy fixes one literal
 * event_type for this command and lists only `transitionStatus`/
 * `recordApprovalDecision` as state-dependent; the recorded value travels in
 * the summary. The read/list methods emit nothing.
 *
 * Cross-cutting invariants held by this service (see the migration file's
 * header for the exact canon citations):
 *   - gateway_node_type is CHECK-restricted to exactly the DECISION_GATEWAY/
 *     PARALLEL_SPLIT/PARALLEL_JOIN subset of CW-GR-009's literal 12-value
 *     catalog; node_result_acceptances.node_type reuses CW-GR-009's full
 *     catalog verbatim by reference (mirrors action_proposals.effect_class
 *     reusing CapabilityEffectClass by reference);
 *   - join_policy is CHECK-restricted to CW-GR-037's literal ALL|ANY|N_OF_M
 *     enum; join_required_count can only be set when join_policy='N_OF_M'
 *     and join_policy can only be set when gateway_node_type='PARALLEL_JOIN'
 *     — both DB CHECKs, not service-level-only. recordGatewayEvaluation
 *     additionally validates this co-presence in code before hitting the DB
 *     CHECKs, throwing the friendlier
 *     gateway_evaluation_invalid_fields_for_node_type;
 *   - condition_expression/condition_schema_version are DB-CHECK co-required
 *     (both-or-neither) and restricted to DECISION_GATEWAY by the service —
 *     a condition can never be recorded without its versioned schema pin;
 *   - result_acceptance is CHECK-restricted to CW-RT-037's literal
 *     ACCEPTED|PARTIAL|REJECTED|NOT_APPLICABLE enum; node_completion_state is
 *     CHECK-restricted to COMPLETED|SKIPPED, matching "every completed or
 *     skipped node" verbatim;
 *   - skip_authorized_by_graph_condition is DB-CHECK required non-NULL
 *     whenever node_completion_state='SKIPPED'; recordNodeResultAcceptance
 *     hard-throws node_result_acceptance_unauthorized_skip_not_applicable
 *     when result_acceptance='NOT_APPLICABLE' is requested with this flag
 *     explicitly false — the one case CW-RT-037 forbids is a service-level
 *     rejection, not just a stored fact the caller could misuse;
 *   - both tables use node_run_id as PRIMARY KEY (not a synthetic id),
 *     mirroring case_workspace_run_bindings.run_id-as-PK: "one row per
 *     node's evaluation/acceptance" is mechanically enforced by the PK via
 *     `INSERT ... ON CONFLICT (node_run_id) DO NOTHING RETURNING *` (same
 *     convention as capabilityRegistryService.ts's
 *     recordIdempotencyKeyCheck); a repeat recording attempt for the same
 *     node_run_id either idempotently replays (identical input digest and
 *     recorded outcome) or hard-fails as a *_determinism_conflict error —
 *     never a silent overwrite;
 *   - digests are computed via `sha256:<hex>` over a recursively key-sorted
 *     clone of the caller-supplied snapshot object, the same
 *     canonicalize-then-sha256 pattern as
 *     capabilityRegistryService.computeRequestDigest /
 *     casePlanVersionService.computeGraphDigest, copied locally per this
 *     directory's own convention;
 *   - neither table has an updated_at or version/OCC column — both are
 *     structurally append-only/immutable, matching
 *     case_workspace_run_bindings' and case_workspace_history_events' own
 *     "no UPDATE path exists" precedent; no method in this file issues
 *     UPDATE or DELETE against either table;
 *   - CW-RT-035 ("independent branches may continue only when graph policy
 *     says so; global continue-on-error is not the default") is satisfied
 *     by structural absence: neither table has any continue_on_error /
 *     global-policy column of any kind, and this service never computes or
 *     returns a continuation decision. listNodeResultAcceptancesForRun is
 *     the read surface a future orchestrator combines with CasePlanVersion's
 *     own per-node executionPolicy to decide whether independent branches
 *     may continue — this file itself never makes that call;
 *   - no route layer, no history-event emission, and no
 *     Finance/Results/v8_execution_runs/v8_agent_work_graphs/
 *     v8_agent_branch_tasks writes exist anywhere in this file.
 *
 * OPEN QUESTIONS (flagged in the approved design, carried forward here — not
 * resolved by this packet, product/API-owner confirmation needed):
 *   1. Whether node_run_id is globally unique across the whole (unconfirmed)
 *      NodeRun space, or only unique per run_id — this design's
 *      PK=node_run_id (not a composite (run_id, node_run_id) key) inherits
 *      and carries forward, unverified, the same assumption CW-P05/CW-P06
 *      already made by storing node_run_id as plain TEXT alongside run_id
 *      without a composite key.
 *   2. Whether a node can legitimately receive more than one gateway
 *      evaluation or result-acceptance fact over its lifetime (e.g. a
 *      loop-back re-entry reusing the same node_run_id across iterations).
 *      This design assumes node_run_id denotes exactly one execution attempt
 *      and therefore exactly one deterministic evaluation/acceptance ever;
 *      if loop iterations instead reuse the same node_run_id, the
 *      PK=node_run_id + determinism-conflict-on-mismatch design would
 *      incorrectly reject a legitimate second, differently-outcomed
 *      iteration as a conflict rather than a distinct fact. Needs
 *      confirmation once real NodeRun/attempt semantics are settled by a
 *      future packet.
 *   3. CW-RT-037's literal wording only states the SKIPPED->NOT_APPLICABLE
 *      authorization rule; it never says whether a COMPLETED node may
 *      legitimately receive NOT_APPLICABLE too (e.g. an ANNOTATION-type node
 *      that "completes" without doing real work). This design leaves that
 *      combination unconstrained (no CHECK forbids it) — confirm with
 *      product/API-owner whether it should be closed off.
 *   4. CW-GR-037's exact N_OF_M shape (field names/semantics for the
 *      required count and the total branch count) is not specified in canon
 *      beyond the three-way ALL|ANY|N_OF_M enum; join_required_count/
 *      join_branch_total_count and their N<=M CHECK are this design's own
 *      invented names and relationship, not a canon-confirmed schema — same
 *      "invented field name, not literally specified" caveat CW-P02/P03/P05
 *      already flagged for their own opaque columns.
 *   5. Whether recordNodeResultAcceptance's hard rejection of
 *      NOT_APPLICABLE-for-unauthorized-skip is the right failure mode,
 *      versus silently downgrading to REJECTED, or versus this packet not
 *      judging the value at all — canon states the rule but not the
 *      caller-facing contract when it's violated; this design chose
 *      fail-closed (throw), matching capabilityRegistryService.ts's own
 *      idempotency-conflict fail-closed precedent, but that choice is an
 *      inference, not a literal requirement.
 *   6. No route/API layer and no history-event emission
 *      (case_workspace_history_events, CW-P07) are built or assumed by this
 *      packet. Whether a future E9 orchestrator packet should append
 *      GATEWAY_EVALUATED / NODE_RESULT_ACCEPTANCE_RECORDED entries to
 *      case_workspace_history_events's open, non-enum event_type catalog is
 *      left entirely to that later packet.
 *   7. caused_by_gateway_node_run_id is, like
 *      case_workspace_waits.action_proposal_id before it, a packet-added
 *      column beyond CW-RT-037's literal schema — confirm whether product
 *      actually wants this traceability link now, or whether it should wait
 *      for the (out-of-scope) orchestrator packet that would be the only
 *      thing able to populate it reliably. This service does not itself
 *      validate that the referenced gateway evaluation belongs to the same
 *      run_id — an FK violation from the database is the only guard today.
 *   8. Tenant/membership fail-closed checks (CW-RT-065, CW-DOD-D5/D6) are,
 *      per the established convention across every CW-P01-06 service, not
 *      performed at this service layer — no method here takes an
 *      orgId/membership guard parameter. Flag loudly before any of these
 *      methods are wired into a route.
 */

import { createHash } from 'crypto';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';
import { CaseWorkspaceAuthError, requireCaseAccess } from './caseWorkspaceAuthContext.js';
import { publishEvent, redact } from './eventOutboxService.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CaseGatewayNodeType = 'DECISION_GATEWAY' | 'PARALLEL_SPLIT' | 'PARALLEL_JOIN';
export type CaseGatewayJoinPolicy = 'ALL' | 'ANY' | 'N_OF_M';
export type CaseGatewayOutcomeStatus =
  | 'BRANCH_SELECTED'
  | 'SPLIT_ACTIVATED'
  | 'JOIN_SATISFIED'
  | 'JOIN_PENDING'
  | 'JOIN_UNSATISFIED';

// CW-GR-009's full literal node type catalog, reused verbatim by reference
// (not a duplicated/invented vocabulary) — any node type can complete or be
// skipped, unlike the gateway-shaped subset above.
export type CaseExecutionNodeType =
  | 'START'
  | 'END'
  | 'CAPABILITY'
  | 'HUMAN_TASK'
  | 'APPROVAL'
  | 'TIMER_WAIT'
  | 'EVENT_WAIT'
  | 'DECISION_GATEWAY'
  | 'PARALLEL_SPLIT'
  | 'PARALLEL_JOIN'
  | 'SUBFLOW'
  | 'ANNOTATION';

export type CaseNodeCompletionState = 'COMPLETED' | 'SKIPPED';
export type CaseNodeResultAcceptanceValue = 'ACCEPTED' | 'PARTIAL' | 'REJECTED' | 'NOT_APPLICABLE';

interface CaseWorkspaceGatewayEvaluationRow {
  node_run_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  run_id: string;
  gateway_node_type: CaseGatewayNodeType;
  join_policy: CaseGatewayJoinPolicy | null;
  join_required_count: number | string | null;
  join_branch_total_count: number | string | null;
  condition_expression: string | null;
  condition_schema_version: string | null;
  evaluation_input_snapshot: string;
  evaluation_input_digest: string;
  outcome_status: CaseGatewayOutcomeStatus;
  outcome_detail: string;
  evaluated_at: string;
  recorded_at: string;
  recorded_by_actor_id: string;
}

export interface CaseGatewayEvaluation {
  nodeRunId: string;
  organizationId: string;
  projectId: string | null;
  caseId: string;
  runId: string;
  gatewayNodeType: CaseGatewayNodeType;
  joinPolicy: CaseGatewayJoinPolicy | null;
  joinRequiredCount: number | null;
  joinBranchTotalCount: number | null;
  conditionExpression: string | null;
  conditionSchemaVersion: string | null;
  evaluationInputSnapshot: unknown;
  evaluationInputDigest: string;
  outcomeStatus: CaseGatewayOutcomeStatus;
  outcomeDetail: unknown;
  evaluatedAt: string;
  recordedAt: string;
  recordedByActorId: string;
}

export interface RecordGatewayEvaluationInput {
  nodeRunId: string;
  runId: string;
  gatewayNodeType: CaseGatewayNodeType;
  joinPolicy?: CaseGatewayJoinPolicy | null;
  joinRequiredCount?: number | null;
  joinBranchTotalCount?: number | null;
  conditionExpression?: string | null;
  conditionSchemaVersion?: string | null;
  evaluationInputSnapshot: unknown;
  outcomeStatus: CaseGatewayOutcomeStatus;
  outcomeDetail?: unknown;
  evaluatedAt: string;
  recordedByActorId: string;
}

interface CaseWorkspaceNodeResultAcceptanceRow {
  node_run_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  run_id: string;
  node_type: CaseExecutionNodeType;
  node_completion_state: CaseNodeCompletionState;
  result_acceptance: CaseNodeResultAcceptanceValue;
  skip_authorized_by_graph_condition: boolean | null;
  skip_condition_ref: string | null;
  caused_by_gateway_node_run_id: string | null;
  acceptance_input_snapshot: string;
  acceptance_input_digest: string;
  occurred_at: string;
  recorded_at: string;
  recorded_by_actor_id: string;
}

export interface CaseNodeResultAcceptance {
  nodeRunId: string;
  organizationId: string;
  projectId: string | null;
  caseId: string;
  runId: string;
  nodeType: CaseExecutionNodeType;
  nodeCompletionState: CaseNodeCompletionState;
  resultAcceptance: CaseNodeResultAcceptanceValue;
  skipAuthorizedByGraphCondition: boolean | null;
  skipConditionRef: string | null;
  causedByGatewayNodeRunId: string | null;
  acceptanceInputSnapshot: unknown;
  acceptanceInputDigest: string;
  occurredAt: string;
  recordedAt: string;
  recordedByActorId: string;
}

export interface RecordNodeResultAcceptanceInput {
  nodeRunId: string;
  runId: string;
  nodeType: CaseExecutionNodeType;
  nodeCompletionState: CaseNodeCompletionState;
  resultAcceptance: CaseNodeResultAcceptanceValue;
  /** Required (as an explicit boolean) whenever nodeCompletionState='SKIPPED'. */
  skipAuthorizedByGraphCondition?: boolean | null;
  skipConditionRef?: string | null;
  causedByGatewayNodeRunId?: string | null;
  acceptanceInputSnapshot: unknown;
  occurredAt: string;
  recordedByActorId: string;
}

interface RunBindingRefRow {
  run_id: string;
  case_id: string;
  organization_id: string;
}

interface CaseCoreProjectRefRow {
  case_id: string;
  project_id: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GATEWAY_NODE_TYPES: readonly CaseGatewayNodeType[] = [
  'DECISION_GATEWAY',
  'PARALLEL_SPLIT',
  'PARALLEL_JOIN',
];

const JOIN_POLICIES: readonly CaseGatewayJoinPolicy[] = ['ALL', 'ANY', 'N_OF_M'];

const OUTCOME_STATUSES: readonly CaseGatewayOutcomeStatus[] = [
  'BRANCH_SELECTED',
  'SPLIT_ACTIVATED',
  'JOIN_SATISFIED',
  'JOIN_PENDING',
  'JOIN_UNSATISFIED',
];

// CW-GR-009's full literal catalog, verbatim.
const NODE_TYPES: readonly CaseExecutionNodeType[] = [
  'START',
  'END',
  'CAPABILITY',
  'HUMAN_TASK',
  'APPROVAL',
  'TIMER_WAIT',
  'EVENT_WAIT',
  'DECISION_GATEWAY',
  'PARALLEL_SPLIT',
  'PARALLEL_JOIN',
  'SUBFLOW',
  'ANNOTATION',
];

const NODE_COMPLETION_STATES: readonly CaseNodeCompletionState[] = ['COMPLETED', 'SKIPPED'];

const RESULT_ACCEPTANCE_VALUES: readonly CaseNodeResultAcceptanceValue[] = [
  'ACCEPTED',
  'PARTIAL',
  'REJECTED',
  'NOT_APPLICABLE',
];

// ---------------------------------------------------------------------------
// Local helpers (mirrors caseCoreService.ts/casePlanVersionService.ts/
// capabilityRegistryService.ts/runBindingService.ts/proposalApprovalService.
// ts/waitSubscriptionService.ts's own local helpers — not imported from
// there, each service file in this directory keeps its own copy per that
// file's existing convention).
// ---------------------------------------------------------------------------

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function requireEnum<T extends string>(
  value: T | null | undefined,
  allowed: readonly T[],
  reason: string
): T {
  if (!value || !allowed.includes(value)) throw new Error(reason);
  return value;
}

// Same canonicalize-then-sha256 pattern as
// capabilityRegistryService.computeRequestDigest /
// casePlanVersionService.computeGraphDigest, copied locally per this
// directory's own convention.
function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((item) => sortKeysDeep(item));
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([key, v]) => [key, sortKeysDeep(v)] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const result: Record<string, unknown> = {};
    for (const [key, v] of entries) result[key] = v;
    return result;
  }
  return value;
}

/**
 * `sha256:<hex>` over the canonicalized input snapshot — the
 * determinism/idempotency comparison key on ON CONFLICT for both
 * recordGatewayEvaluation and recordNodeResultAcceptance.
 */
function computeInputDigest(snapshot: unknown): string {
  const canonical = sortKeysDeep(snapshot ?? null);
  const json = JSON.stringify(canonical);
  return `sha256:${createHash('sha256').update(json, 'utf8').digest('hex')}`;
}

/**
 * EVENT_TAXONOMY §1: a `redactedSummary` holds FACTS, not payloads. Free-text
 * and opaque caller strings are bounded here before they ever reach the
 * envelope, so a caller cannot blow past MAX_REDACTED_SUMMARY_BYTES (which
 * would throw and roll back the whole command) by supplying a large string.
 */
function factText(value: string | null | undefined, maxLength = 200): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

/**
 * EVENT_TAXONOMY, `recordGatewayEvaluation`: "Summary: branch taken + rule id,
 * not the evaluated data." outcome_detail is caller-supplied opaque JSON, so
 * only these few identity-shaped keys are lifted out of it — the object itself
 * is never copied into the event (it stays in the row the `payloadRef` points
 * at).
 */
const OUTCOME_DETAIL_FACT_KEYS = [
  'selectedEdgeId',
  'selectedNodeId',
  'selectedBranchId',
  'ruleId',
] as const;

function branchFactsFromOutcomeDetail(detail: unknown): Record<string, string> {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return {};
  const source = detail as Record<string, unknown>;
  const facts: Record<string, string> = {};
  for (const key of OUTCOME_DETAIL_FACT_KEYS) {
    const value = source[key];
    const normalized = typeof value === 'string' ? factText(value) : null;
    if (normalized) facts[key] = normalized;
  }
  return facts;
}

function safeJsonParse(value: string | null | undefined): unknown {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapGatewayEvaluationRow(row: CaseWorkspaceGatewayEvaluationRow): CaseGatewayEvaluation {
  return {
    nodeRunId: row.node_run_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    caseId: row.case_id,
    runId: row.run_id,
    gatewayNodeType: row.gateway_node_type,
    joinPolicy: row.join_policy,
    joinRequiredCount: row.join_required_count === null ? null : Number(row.join_required_count),
    joinBranchTotalCount:
      row.join_branch_total_count === null ? null : Number(row.join_branch_total_count),
    conditionExpression: row.condition_expression,
    conditionSchemaVersion: row.condition_schema_version,
    evaluationInputSnapshot: safeJsonParse(row.evaluation_input_snapshot),
    evaluationInputDigest: row.evaluation_input_digest,
    outcomeStatus: row.outcome_status,
    outcomeDetail: safeJsonParse(row.outcome_detail),
    evaluatedAt: row.evaluated_at,
    recordedAt: row.recorded_at,
    recordedByActorId: row.recorded_by_actor_id,
  };
}

function mapNodeResultAcceptanceRow(
  row: CaseWorkspaceNodeResultAcceptanceRow
): CaseNodeResultAcceptance {
  return {
    nodeRunId: row.node_run_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    caseId: row.case_id,
    runId: row.run_id,
    nodeType: row.node_type,
    nodeCompletionState: row.node_completion_state,
    resultAcceptance: row.result_acceptance,
    skipAuthorizedByGraphCondition: row.skip_authorized_by_graph_condition,
    skipConditionRef: row.skip_condition_ref,
    causedByGatewayNodeRunId: row.caused_by_gateway_node_run_id,
    acceptanceInputSnapshot: safeJsonParse(row.acceptance_input_snapshot),
    acceptanceInputDigest: row.acceptance_input_digest,
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
    recordedByActorId: row.recorded_by_actor_id,
  };
}

// ---------------------------------------------------------------------------
// Shared row loader (both recording methods resolve the same run binding +
// case_core.project_id pair before their own table-specific INSERT).
// ---------------------------------------------------------------------------

async function resolveRunBindingScope(
  client: PgTransactionClient,
  runId: string,
  notFoundReason: string
): Promise<{ runId: string; caseId: string; organizationId: string; projectId: string | null }> {
  const runResult = await client.query<RunBindingRefRow>(
    `SELECT run_id, case_id, organization_id FROM case_workspace_run_bindings WHERE run_id = ?`,
    [runId]
  );
  const runBinding = runResult.rows[0];
  if (!runBinding) throw new Error(notFoundReason);

  const caseResult = await client.query<CaseCoreProjectRefRow>(
    `SELECT case_id, project_id FROM case_core WHERE case_id = ?`,
    [runBinding.case_id]
  );
  const caseRow = caseResult.rows[0];
  if (!caseRow) throw new Error('execution_graph_case_not_found');

  return {
    runId: runBinding.run_id,
    caseId: runBinding.case_id,
    organizationId: runBinding.organization_id,
    projectId: caseRow.project_id,
  };
}

// ---------------------------------------------------------------------------
// Service methods — gateway evaluations
// ---------------------------------------------------------------------------

/**
 * CW-GR-037 (gateway semantics are deterministic; parallel join states
 * ALL|ANY|N_OF_M; a condition is evaluated against a versioned expression
 * schema), CW-GR-009 (gateway-shaped subset of the node type catalog).
 *
 * Resolves case_workspace_run_bindings by runId (throws
 * run_binding_not_found if absent), then case_core by the resolved binding's
 * case_id (throws execution_graph_case_not_found if absent — should never
 * happen given the FK chain, kept as a defensive read-time guard) to
 * denormalize organization_id/case_id/project_id. Validates
 * gateway_node_type-conditional field co-presence in code before hitting the
 * DB CHECKs (join fields only for PARALLEL_JOIN, join_required_count only
 * for join_policy='N_OF_M', condition fields only for DECISION_GATEWAY,
 * both-or-neither for the condition pair) — throws
 * gateway_evaluation_invalid_fields_for_node_type on any violation.
 * Canonicalizes and sha256-hashes evaluationInputSnapshot into
 * evaluation_input_digest (same helper pattern as
 * casePlanVersionService.ts/playService.ts's own digest helpers). Issues
 * `INSERT ... ON CONFLICT (node_run_id) DO NOTHING RETURNING *`; on 0
 * returned rows, re-SELECTs the existing row by node_run_id and compares its
 * evaluation_input_digest/outcome_status/outcome_detail against the newly
 * computed values — identical means idempotent replay (returns the existing
 * row), any difference throws gateway_evaluation_determinism_conflict (no
 * partial write, no silent overwrite, matching
 * capabilityRegistryService.ts's own idempotency-conflict fail-closed
 * precedent).
 */
export async function recordGatewayEvaluation(
  input: RecordGatewayEvaluationInput
): Promise<CaseGatewayEvaluation> {
  const nodeRunId = requireNonBlank(input.nodeRunId, 'gateway_evaluation_node_run_id_required');
  const runId = requireNonBlank(input.runId, 'gateway_evaluation_run_id_required');
  const gatewayNodeType = requireEnum(
    input.gatewayNodeType,
    GATEWAY_NODE_TYPES,
    'gateway_evaluation_node_type_invalid'
  );
  const outcomeStatus = requireEnum(
    input.outcomeStatus,
    OUTCOME_STATUSES,
    'gateway_evaluation_outcome_status_invalid'
  );
  const evaluatedAt = requireNonBlank(input.evaluatedAt, 'gateway_evaluation_evaluated_at_required');
  const recordedByActorId = requireNonBlank(
    input.recordedByActorId,
    'gateway_evaluation_recorded_by_actor_required'
  );

  // Join fields (join_policy/join_required_count/join_branch_total_count)
  // are only meaningful for PARALLEL_JOIN; join_policy is required for
  // PARALLEL_JOIN, join_required_count only meaningful for N_OF_M.
  const hasJoinFields =
    input.joinPolicy != null || input.joinRequiredCount != null || input.joinBranchTotalCount != null;
  if (hasJoinFields && gatewayNodeType !== 'PARALLEL_JOIN') {
    throw new Error('gateway_evaluation_invalid_fields_for_node_type');
  }
  if (gatewayNodeType === 'PARALLEL_JOIN') {
    requireEnum(input.joinPolicy, JOIN_POLICIES, 'gateway_evaluation_invalid_fields_for_node_type');
  }
  if (input.joinRequiredCount != null && input.joinPolicy !== 'N_OF_M') {
    throw new Error('gateway_evaluation_invalid_fields_for_node_type');
  }

  // Condition fields (condition_expression/condition_schema_version) are
  // only meaningful for DECISION_GATEWAY, and are co-required (both-or-
  // neither) whenever either is set.
  const hasConditionFields = input.conditionExpression != null || input.conditionSchemaVersion != null;
  if (hasConditionFields && gatewayNodeType !== 'DECISION_GATEWAY') {
    throw new Error('gateway_evaluation_invalid_fields_for_node_type');
  }
  if ((input.conditionExpression == null) !== (input.conditionSchemaVersion == null)) {
    throw new Error('gateway_evaluation_invalid_fields_for_node_type');
  }

  const evaluationInputDigest = computeInputDigest(input.evaluationInputSnapshot);
  const evaluationInputSnapshotJson = JSON.stringify(input.evaluationInputSnapshot ?? null);
  const outcomeDetailJson = JSON.stringify(input.outcomeDetail ?? {});

  return withPgTransaction(async (client) => {
    const scope = await resolveRunBindingScope(client, runId, 'run_binding_not_found');
    await requireCaseAccess(recordedByActorId, scope.caseId);

    const now = new Date().toISOString();
    const inserted = await client.query<CaseWorkspaceGatewayEvaluationRow>(
      `INSERT INTO case_workspace_gateway_evaluations (
         node_run_id, organization_id, project_id, case_id, run_id,
         gateway_node_type, join_policy, join_required_count,
         join_branch_total_count, condition_expression,
         condition_schema_version, evaluation_input_snapshot,
         evaluation_input_digest, outcome_status, outcome_detail,
         evaluated_at, recorded_at, recorded_by_actor_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (node_run_id) DO NOTHING
       RETURNING *`,
      [
        nodeRunId,
        scope.organizationId,
        scope.projectId,
        scope.caseId,
        scope.runId,
        gatewayNodeType,
        input.joinPolicy ?? null,
        input.joinRequiredCount ?? null,
        input.joinBranchTotalCount ?? null,
        input.conditionExpression ?? null,
        input.conditionSchemaVersion ?? null,
        evaluationInputSnapshotJson,
        evaluationInputDigest,
        outcomeStatus,
        outcomeDetailJson,
        evaluatedAt,
        now,
        recordedByActorId,
      ]
    );

    const insertedRow = inserted.rows[0];
    if (insertedRow) {
      // EVENT_TAXONOMY: `node.gateway_evaluated`, aggregate NODE_RUN. Same
      // transaction, same client as the INSERT above (atomicity), and every
      // identity field is taken from the row that was just written — never
      // from unvalidated input. Emitted only on the branch that actually
      // wrote a row: the ON CONFLICT replay below records no new fact.
      await publishEvent(client, {
        eventId: `cwevt-node-gateway-evaluated-${insertedRow.node_run_id}`,
        eventType: 'node.gateway_evaluated',
        organizationId: insertedRow.organization_id,
        projectId: insertedRow.project_id,
        aggregateType: 'NODE_RUN',
        aggregateId: insertedRow.node_run_id,
        // §3: case_workspace_gateway_evaluations has no version column.
        aggregateVersion: null,
        caseId: insertedRow.case_id,
        runId: insertedRow.run_id,
        nodeRunId: insertedRow.node_run_id,
        actorUserId: insertedRow.recorded_by_actor_id,
        // correlationId is deliberately omitted: publishEvent falls back to
        // RequestStore.getCorrelationId() and only mints one when this runs
        // outside any request scope. causationId is null — this command is
        // not triggered by another event.
        causationId: null,
        redactedSummary: redact({
          gatewayNodeType: insertedRow.gateway_node_type,
          outcomeStatus: insertedRow.outcome_status,
          joinPolicy: insertedRow.join_policy,
          joinRequiredCount:
            insertedRow.join_required_count === null ? null : Number(insertedRow.join_required_count),
          joinBranchTotalCount:
            insertedRow.join_branch_total_count === null
              ? null
              : Number(insertedRow.join_branch_total_count),
          // The versioned expression schema pin (the "rule id"); the
          // expression text and the evaluated data itself stay in the row.
          conditionSchemaVersion: insertedRow.condition_schema_version,
          hasConditionExpression: insertedRow.condition_expression !== null,
          evaluationInputDigest: insertedRow.evaluation_input_digest,
          evaluatedAt: insertedRow.evaluated_at,
          ...branchFactsFromOutcomeDetail(safeJsonParse(insertedRow.outcome_detail)),
        }),
        payloadRef: `case_workspace_gateway_evaluations:${insertedRow.node_run_id}`,
      });
      return mapGatewayEvaluationRow(insertedRow);
    }

    const existingResult = await client.query<CaseWorkspaceGatewayEvaluationRow>(
      `SELECT * FROM case_workspace_gateway_evaluations WHERE node_run_id = ?`,
      [nodeRunId]
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new Error('gateway_evaluation_idempotency_record_not_found');
    if (
      existing.evaluation_input_digest !== evaluationInputDigest ||
      existing.outcome_status !== outcomeStatus ||
      existing.outcome_detail !== outcomeDetailJson
    ) {
      throw new Error('gateway_evaluation_determinism_conflict');
    }
    return mapGatewayEvaluationRow(existing);
  });
}

/** CW-GR-037. Plain read, no lock. Returns null if this node has never had a
 * gateway evaluation recorded. */
export async function getGatewayEvaluation(
  nodeRunId: string,
  actorUserId: string
): Promise<CaseGatewayEvaluation | null> {
  const id = requireNonBlank(nodeRunId, 'gateway_evaluation_node_run_id_required');
  const actor = requireNonBlank(actorUserId, 'gateway_evaluation_actor_required');
  const row = await queryOne<CaseWorkspaceGatewayEvaluationRow>(
    `SELECT * FROM case_workspace_gateway_evaluations WHERE node_run_id = ?`,
    [id]
  );
  if (!row) return null;
  try {
    await requireCaseAccess(actor, row.case_id);
  } catch (err) {
    if (err instanceof CaseWorkspaceAuthError) return null;
    throw err;
  }
  return mapGatewayEvaluationRow(row);
}

/**
 * CW-GR-037. Plain read, no lock, ordered by recorded_at. Enumerates all
 * gateway evaluations recorded under one bound Run, for a future
 * orchestrator/observability caller.
 */
export async function listGatewayEvaluationsForRun(
  runId: string,
  actorUserId: string
): Promise<CaseGatewayEvaluation[]> {
  const id = requireNonBlank(runId, 'gateway_evaluation_run_id_required');
  const actor = requireNonBlank(actorUserId, 'gateway_evaluation_actor_required');
  const bindingRow = await queryOne<{ case_id: string }>(
    `SELECT case_id FROM case_workspace_run_bindings WHERE run_id = ?`,
    [id]
  );
  if (!bindingRow) return [];
  await requireCaseAccess(actor, bindingRow.case_id);
  const rows = await queryAll<CaseWorkspaceGatewayEvaluationRow>(
    `SELECT * FROM case_workspace_gateway_evaluations WHERE run_id = ? ORDER BY recorded_at ASC`,
    [id]
  );
  return rows.map(mapGatewayEvaluationRow);
}

/**
 * CW-GR-037. Plain read, no lock, ordered by recorded_at. Enumerates a
 * Case's gateway evaluations across all its Runs.
 */
export async function listGatewayEvaluationsForCase(
  caseId: string,
  actorUserId: string
): Promise<CaseGatewayEvaluation[]> {
  const id = requireNonBlank(caseId, 'gateway_evaluation_case_id_required');
  await requireCaseAccess(requireNonBlank(actorUserId, 'gateway_evaluation_actor_required'), id);
  const rows = await queryAll<CaseWorkspaceGatewayEvaluationRow>(
    `SELECT * FROM case_workspace_gateway_evaluations WHERE case_id = ? ORDER BY recorded_at ASC`,
    [id]
  );
  return rows.map(mapGatewayEvaluationRow);
}

// ---------------------------------------------------------------------------
// Service methods — node result acceptances
// ---------------------------------------------------------------------------

/**
 * CW-RT-037 (every completed or skipped node has a result acceptance
 * projection ACCEPTED|PARTIAL|REJECTED|NOT_APPLICABLE; SKIPPED maps to
 * NOT_APPLICABLE only when the published graph condition authorizes it),
 * CW-GR-009 (node_type reuses the full catalog by reference), CW-RT-035
 * (this method never computes or persists a continue-on-error/branch-
 * continuation decision — see listNodeResultAcceptancesForRun).
 *
 * Resolves case_workspace_run_bindings by runId (throws
 * run_binding_not_found) and case_core by its case_id (throws
 * execution_graph_case_not_found) to denormalize
 * organization_id/case_id/project_id, same shared lookup as
 * recordGatewayEvaluation. Validates nodeCompletionState='SKIPPED' always
 * carries an explicit boolean skipAuthorizedByGraphCondition — throws
 * node_result_acceptance_skip_authorization_required otherwise. Hard-rejects
 * (throws node_result_acceptance_unauthorized_skip_not_applicable) any
 * attempt to record resultAcceptance='NOT_APPLICABLE' while
 * skipAuthorizedByGraphCondition===false — the literal enforcement of
 * CW-RT-037's "SKIPPED maps to NOT_APPLICABLE only when the published graph
 * condition authorizes it", not merely a stored/descriptive fact.
 * Canonicalizes and sha256-hashes acceptanceInputSnapshot into
 * acceptance_input_digest. Issues `INSERT ... ON CONFLICT (node_run_id) DO
 * NOTHING RETURNING *`; on 0 returned rows, re-SELECTs and compares
 * digest/result_acceptance/node_completion_state against the new call —
 * identical is an idempotent replay (returns existing row), any difference
 * throws node_result_acceptance_determinism_conflict. caused_by_gateway_
 * node_run_id, when supplied, is passed through to the INSERT unvalidated by
 * this service beyond the table's own FK — a non-existent gateway evaluation
 * row surfaces as a plain database FK-violation error, not a named domain
 * error (open_question #7).
 */
export async function recordNodeResultAcceptance(
  input: RecordNodeResultAcceptanceInput
): Promise<CaseNodeResultAcceptance> {
  const nodeRunId = requireNonBlank(input.nodeRunId, 'node_result_acceptance_node_run_id_required');
  const runId = requireNonBlank(input.runId, 'node_result_acceptance_run_id_required');
  const nodeType = requireEnum(input.nodeType, NODE_TYPES, 'node_result_acceptance_node_type_invalid');
  const nodeCompletionState = requireEnum(
    input.nodeCompletionState,
    NODE_COMPLETION_STATES,
    'node_result_acceptance_completion_state_invalid'
  );
  const resultAcceptance = requireEnum(
    input.resultAcceptance,
    RESULT_ACCEPTANCE_VALUES,
    'node_result_acceptance_value_invalid'
  );
  const occurredAt = requireNonBlank(input.occurredAt, 'node_result_acceptance_occurred_at_required');
  const recordedByActorId = requireNonBlank(
    input.recordedByActorId,
    'node_result_acceptance_recorded_by_actor_required'
  );

  if (nodeCompletionState === 'SKIPPED' && typeof input.skipAuthorizedByGraphCondition !== 'boolean') {
    throw new Error('node_result_acceptance_skip_authorization_required');
  }

  if (resultAcceptance === 'NOT_APPLICABLE' && input.skipAuthorizedByGraphCondition === false) {
    throw new Error('node_result_acceptance_unauthorized_skip_not_applicable');
  }

  const acceptanceInputDigest = computeInputDigest(input.acceptanceInputSnapshot);
  const acceptanceInputSnapshotJson = JSON.stringify(input.acceptanceInputSnapshot ?? null);

  return withPgTransaction(async (client) => {
    const scope = await resolveRunBindingScope(client, runId, 'run_binding_not_found');
    await requireCaseAccess(recordedByActorId, scope.caseId);

    const now = new Date().toISOString();
    const inserted = await client.query<CaseWorkspaceNodeResultAcceptanceRow>(
      `INSERT INTO case_workspace_node_result_acceptances (
         node_run_id, organization_id, project_id, case_id, run_id,
         node_type, node_completion_state, result_acceptance,
         skip_authorized_by_graph_condition, skip_condition_ref,
         caused_by_gateway_node_run_id, acceptance_input_snapshot,
         acceptance_input_digest, occurred_at, recorded_at,
         recorded_by_actor_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (node_run_id) DO NOTHING
       RETURNING *`,
      [
        nodeRunId,
        scope.organizationId,
        scope.projectId,
        scope.caseId,
        scope.runId,
        nodeType,
        nodeCompletionState,
        resultAcceptance,
        input.skipAuthorizedByGraphCondition ?? null,
        input.skipConditionRef ?? null,
        input.causedByGatewayNodeRunId ?? null,
        acceptanceInputSnapshotJson,
        acceptanceInputDigest,
        occurredAt,
        now,
        recordedByActorId,
      ]
    );

    const insertedRow = inserted.rows[0];
    if (insertedRow) {
      // EVENT_TAXONOMY: `node.result_accepted`, aggregate NODE_RUN. One
      // literal event_type for this command regardless of the recorded
      // acceptance value (the value itself is a fact in the summary); the
      // result payload is NOT copied — `payloadRef` points at the row.
      await publishEvent(client, {
        eventId: `cwevt-node-result-accepted-${insertedRow.node_run_id}`,
        eventType: 'node.result_accepted',
        organizationId: insertedRow.organization_id,
        projectId: insertedRow.project_id,
        aggregateType: 'NODE_RUN',
        aggregateId: insertedRow.node_run_id,
        // §3: case_workspace_node_result_acceptances has no version column.
        aggregateVersion: null,
        caseId: insertedRow.case_id,
        runId: insertedRow.run_id,
        nodeRunId: insertedRow.node_run_id,
        actorUserId: insertedRow.recorded_by_actor_id,
        causationId: null,
        redactedSummary: redact({
          nodeType: insertedRow.node_type,
          nodeCompletionState: insertedRow.node_completion_state,
          resultAcceptance: insertedRow.result_acceptance,
          skipAuthorizedByGraphCondition: insertedRow.skip_authorized_by_graph_condition,
          skipConditionRef: factText(insertedRow.skip_condition_ref),
          causedByGatewayNodeRunId: insertedRow.caused_by_gateway_node_run_id,
          acceptanceInputDigest: insertedRow.acceptance_input_digest,
          occurredAt: insertedRow.occurred_at,
        }),
        payloadRef: `case_workspace_node_result_acceptances:${insertedRow.node_run_id}`,
      });
      return mapNodeResultAcceptanceRow(insertedRow);
    }

    const existingResult = await client.query<CaseWorkspaceNodeResultAcceptanceRow>(
      `SELECT * FROM case_workspace_node_result_acceptances WHERE node_run_id = ?`,
      [nodeRunId]
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new Error('node_result_acceptance_idempotency_record_not_found');
    if (
      existing.acceptance_input_digest !== acceptanceInputDigest ||
      existing.result_acceptance !== resultAcceptance ||
      existing.node_completion_state !== nodeCompletionState
    ) {
      throw new Error('node_result_acceptance_determinism_conflict');
    }
    return mapNodeResultAcceptanceRow(existing);
  });
}

/** CW-RT-037. Plain read, no lock. Returns null if this node has never had a
 * result acceptance recorded (e.g. still RUNNING/WAITING_*). */
export async function getNodeResultAcceptance(
  nodeRunId: string,
  actorUserId: string
): Promise<CaseNodeResultAcceptance | null> {
  const id = requireNonBlank(nodeRunId, 'node_result_acceptance_node_run_id_required');
  const actor = requireNonBlank(actorUserId, 'node_result_acceptance_actor_required');
  const row = await queryOne<CaseWorkspaceNodeResultAcceptanceRow>(
    `SELECT * FROM case_workspace_node_result_acceptances WHERE node_run_id = ?`,
    [id]
  );
  if (!row) return null;
  try {
    await requireCaseAccess(actor, row.case_id);
  } catch (err) {
    if (err instanceof CaseWorkspaceAuthError) return null;
    throw err;
  }
  return mapNodeResultAcceptanceRow(row);
}

/**
 * CW-RT-037, CW-RT-035. Plain read, no lock, ordered by recorded_at.
 * Enumerates one Run's per-node acceptance facts (optionally
 * status-filtered) — the read surface a future orchestrator combines with
 * CasePlanVersion's own per-node executionPolicy to decide whether
 * independent branches may continue; this method itself never computes or
 * returns a continuation decision.
 */
export async function listNodeResultAcceptancesForRun(
  runId: string,
  filters: { resultAcceptance?: CaseNodeResultAcceptanceValue } | undefined,
  actorUserId: string
): Promise<CaseNodeResultAcceptance[]> {
  const id = requireNonBlank(runId, 'node_result_acceptance_run_id_required');
  const actor = requireNonBlank(actorUserId, 'node_result_acceptance_actor_required');
  const bindingRow = await queryOne<{ case_id: string }>(
    `SELECT case_id FROM case_workspace_run_bindings WHERE run_id = ?`,
    [id]
  );
  if (!bindingRow) return [];
  await requireCaseAccess(actor, bindingRow.case_id);
  const conditions = ['run_id = ?'];
  const params: unknown[] = [id];
  if (filters?.resultAcceptance) {
    conditions.push('result_acceptance = ?');
    params.push(
      requireEnum(
        filters.resultAcceptance,
        RESULT_ACCEPTANCE_VALUES,
        'node_result_acceptance_value_invalid'
      )
    );
  }
  const rows = await queryAll<CaseWorkspaceNodeResultAcceptanceRow>(
    `SELECT * FROM case_workspace_node_result_acceptances
       WHERE ${conditions.join(' AND ')}
       ORDER BY recorded_at ASC`,
    params
  );
  return rows.map(mapNodeResultAcceptanceRow);
}

/**
 * CW-RT-037. Plain read, no lock, ordered by recorded_at. Enumerates a
 * Case's node acceptance facts across all its Runs.
 */
export async function listNodeResultAcceptancesForCase(
  caseId: string,
  actorUserId: string
): Promise<CaseNodeResultAcceptance[]> {
  const id = requireNonBlank(caseId, 'node_result_acceptance_case_id_required');
  await requireCaseAccess(requireNonBlank(actorUserId, 'node_result_acceptance_actor_required'), id);
  const rows = await queryAll<CaseWorkspaceNodeResultAcceptanceRow>(
    `SELECT * FROM case_workspace_node_result_acceptances WHERE case_id = ? ORDER BY recorded_at ASC`,
    [id]
  );
  return rows.map(mapNodeResultAcceptanceRow);
}
