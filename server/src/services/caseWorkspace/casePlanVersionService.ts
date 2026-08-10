/**
 * Case Workspace — Case Plan Version service (CW-P02, EPIC E2 "Case
 * contract, plan versions and canonical graph").
 *
 * Backs the `case_plan_versions` and `case_plan_view_state` tables added in
 * server/migrations/20260809_case_workspace_case_plan_version.sql. Those
 * tables are keyed by FK to `case_core(case_id)` (packet collision-avoidance
 * mandate — this service only ever SELECTs `case_core`, and only inside a
 * `SELECT ... FOR UPDATE` in createPlanDraft to confirm the case exists and
 * to serialize concurrent draft creation for that case_id; it never
 * INSERT/UPDATE/DELETEs case_core, including its own current_plan_version_id
 * column — see open_questions below) and never references Finance or
 * Results tables/routes.
 *
 * req_id coverage (docs/product/case-workspace/acceptance/
 * FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains "E2"):
 *
 *   createPlanDraft              -> CW-01-010, CW-RT-016, CW-RT-017, CW-RT-043, CW-GR-024
 *   createPlanDraftOnClient        -> same, on a caller-owned transaction client
 *                                     (createPlanDraft is now only the transaction
 *                                     wrapper around it)
 *   updatePlanDraft               -> CW-01-010, CW-GR-025, CW-RT-043, CW-RT-044, CW-RT-061, CW-GR-044
 *   getPlanVersion                 -> CW-RT-016, CW-GR-024
 *   listPlanVersionsForCase        -> CW-RT-016, CW-RT-017
 *   validatePlanVersion            -> CW-GR-012, CW-GR-036, CW-GR-024, CW-GR-047
 *   proposePlanVersion             -> CW-RT-030, CW-RT-031, CW-RT-043, CW-GR-024
 *   requestChangesOnPlanVersion    -> CW-RT-030, CW-RT-031
 *   publishPlanVersion             -> CW-00-020-INV5, CW-01-011, CW-RT-017, CW-RT-029, CW-RT-030,
 *                                      CW-RT-043, CW-GR-024, CW-GR-036, CW-GR-044, CW-CANON-06,
 *                                      CW-DOD-B3, CW-DOD-B4
 *   withdrawPlanVersion            -> CW-RT-030, CW-RT-031
 *   getGraph                       -> CW-GR-024, CW-GR-001
 *   diffPlanVersions               -> CW-RT-017, CW-GR-024, CW-DOD-B3
 *   getViewState                   -> CW-GR-005, CW-GR-024, CW-02-016
 *   putViewState                   -> CW-GR-005, CW-GR-025, CW-GR-045, CW-02-016
 *
 * Cross-cutting invariants held by every mutating method here (see the
 * migration file's header for the exact canon citations):
 *   - a case_plan_versions row is mutable via updatePlanDraft only while
 *     status='DRAFT' (CW-01-010/CW-01-011);
 *   - published (and later) statuses reject semantic mutation
 *     (CW-00-020-INV5/CW-RT-029/CW-GR-025/CW-GR-044);
 *   - at most one PUBLISHED row per case_id at any instant
 *     (CW-00-020-INV6/CW-RT-048/CW-DOD-B4/CW-CANON-06), enforced by both a DB
 *     partial unique index and the service's own supersede logic;
 *   - exactly one semantic_graph column exists; there is nowhere for
 *     Simple/Expert/List to persist a competing process model
 *     (CW-00-020-INV8/CW-GR-001/CW-CANON-05);
 *   - replanning always INSERTs a new row and never UPDATEs a PUBLISHED row
 *     in place (CW-RT-017/CW-RT-030);
 *   - every mutating method uses loadForUpdate + `WHERE ... AND version = ?`
 *     (CW-RT-044/CW-GR-025/CW-RT-061/CW-GR-044), a 0-row UPDATE throws
 *     plan_version_conflict with no partial write;
 *   - view/layout/viewport/collapsed-state changes go only to
 *     case_plan_view_state, a table with no path to semantic_graph or
 *     graph_digest (CW-GR-005/006/025/045).
 *
 * OPEN QUESTIONS (flagged in the approved design, carried forward here — not
 * resolved by this packet, product/API-owner confirmation needed):
 *   1. CW-RT-043 §5's durable command list and CW-GR-024 §7.2's route list
 *      both omit any explicit command/route for IN_REVIEW -> DRAFT ("changes
 *      requested") and PUBLISHED -> WITHDRAWN, even though CW-RT-030/031's
 *      state machine requires both to be reachable. requestChangesOnPlanVersion
 *      and withdrawPlanVersion are implemented here as the evident missing
 *      pieces, named by analogy to Case's own pattern — confirm the intended
 *      command/route names before wiring HTTP endpoints in a later packet.
 *   2. CW-RT-016 names a plan-ordinal field `version`, colliding with the
 *      CW-RT-044/case_core-established meaning of `version` as an
 *      optimistic-concurrency counter. This service keeps `version` as the
 *      OCC counter and calls the ordinal `planNumber` instead — confirm this
 *      naming before it ships in any public API shape.
 *   3. validatePlanVersion() only computes CW-GR-036's LOCAL_STRUCTURAL
 *      checklist subset (reachability/terminal-path/cycle/dangling-edge/
 *      duplicate-id/declared-limits). The EXTERNAL_DEPENDENT remainder
 *      (capability health/deprecation, ACL beyond org, secret resolution,
 *      effect-class-driven idempotency/retry coverage) needs a Capability
 *      Registry table this packet does not create, and is reported as
 *      severity='DEFERRED_EXTERNAL', never silently passing. Callers/tests
 *      must not treat publishPlanVersion() as GR-036-complete until that
 *      registry lands.
 *   4. Whether case_core.current_plan_version_id (an existing CW-P01 column)
 *      should be kept in sync by this service, a separate orchestration
 *      layer, or dropped in favor of callers querying
 *      `case_plan_versions WHERE case_id=? AND status='PUBLISHED'` directly
 *      is unresolved — this packet's mandate forbids writing to case_core at
 *      all, so publishPlanVersion() leaves that column untouched. Flag for
 *      whoever owns the E4 Run-binding packet.
 *   5. Cycle detection in validatePlanVersion() treats ANY cycle among
 *      SEQUENCE/CONDITIONAL edges as UNCONTROLLED_CYCLE because CW-GR-008's
 *      GraphNode schema has no explicit loop-policy/max-iterations field.
 *      Confirm with product whether GR-008 should gain an explicit
 *      loopPolicy field before an intentional bounded loop can be
 *      distinguished from a defect.
 *   6. diffPlanVersions() diffs strictly by nodeId/edgeId/variable-name
 *      equality. Whether the eventual authoring flow (E7/E9, paused at the
 *      W2-V0 gate) actually preserves those ids across a replan for
 *      unchanged steps is an authoring-tool decision this packet cannot
 *      make.
 *   7. CW-GR-013 describes SECRET_REF-backed InputBinding values as a
 *      structured envelope (classification/checksum/redacted preview). This
 *      service stores whatever the caller supplies in `value`/`sourcePath`
 *      verbatim inside semantic_graph and defines no such envelope — likely
 *      belongs with the Capability Registry work.
 *   8. putViewState() is deliberately last-write-wins with no expectedVersion
 *      parameter (layout is presentation data, not coordination-sensitive
 *      content, per CW-GR-005). If concurrent multi-tab/multi-device
 *      view-state edits turn out to matter, this may need an OCC column
 *      added later.
 */

import { createHash, randomUUID } from 'crypto';

import { v4 as uuidv4 } from 'uuid';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';
import { CaseWorkspaceAuthError, requireCaseAccess } from './caseWorkspaceAuthContext.js';
import { publishEvent, redact } from './eventOutboxService.js';

// ---------------------------------------------------------------------------
// Canonical graph shape (CW-GR-008). Loosely typed on purpose — this packet
// persists/validates structure, it does not own the full graph schema.
// ---------------------------------------------------------------------------

export interface GraphInputBinding {
  targetPath?: string;
  required?: boolean;
  sourceNodeId?: string;
  sourcePath?: string;
  value?: unknown;
  [key: string]: unknown;
}

export interface GraphNode {
  nodeId: string;
  type?: string;
  effectClass?: string;
  inputBindings?: GraphInputBinding[];
  outputBindings?: unknown[];
  artifactBindings?: unknown[];
  tags?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GraphEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType?: 'SEQUENCE' | 'CONDITIONAL' | string;
  [key: string]: unknown;
}

export interface GraphVariable {
  name: string;
  [key: string]: unknown;
}

export interface CanonicalGraph {
  schemaVersion?: string;
  graphId?: string;
  entryNodeIds: string[];
  terminalNodeIds: string[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  variables?: GraphVariable[];
  inputSchemaRef?: string | null;
  outputSchemaRef?: string | null;
  limits?: { maxNodes?: number; maxEdges?: number; [key: string]: unknown };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PlanVersionStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'SUPERSEDED' | 'WITHDRAWN';
export type PlanReviewEvent = 'PROPOSED' | 'CHANGES_REQUESTED' | 'PUBLISHED' | 'WITHDRAWN';
export type ViewType = 'SIMPLE' | 'EXPERT' | 'LIST';
export type BlockerSeverity = 'BLOCKING' | 'DEFERRED_EXTERNAL';

export interface CaseActor {
  actorUserId: string;
}

export interface PlanReviewHistoryEntry {
  event: PlanReviewEvent;
  actorId: string;
  at: string;
  reason?: string;
}

interface CasePlanVersionRow {
  case_plan_version_id: string;
  case_id: string;
  plan_number: number;
  source_process_version_id: string | null;
  supersedes_plan_version_id: string | null;
  status: PlanVersionStatus;
  semantic_graph: string;
  graph_digest: string;
  change_reason: string | null;
  review_history: string;
  proposed_at: string | null;
  proposed_by_actor_id: string | null;
  published_at: string | null;
  published_by_actor_id: string | null;
  superseded_at: string | null;
  withdrawn_at: string | null;
  withdrawn_by_actor_id: string | null;
  withdrawal_reason: string | null;
  created_by_actor_id: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CasePlanVersion {
  casePlanVersionId: string;
  caseId: string;
  planNumber: number;
  sourceProcessVersionId: string | null;
  supersedesPlanVersionId: string | null;
  status: PlanVersionStatus;
  semanticGraph: CanonicalGraph;
  graphDigest: string;
  changeReason: string | null;
  reviewHistory: PlanReviewHistoryEntry[];
  proposedAt: string | null;
  proposedByActorId: string | null;
  publishedAt: string | null;
  publishedByActorId: string | null;
  supersededAt: string | null;
  withdrawnAt: string | null;
  withdrawnByActorId: string | null;
  withdrawalReason: string | null;
  createdByActorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface CasePlanViewStateRow {
  case_plan_version_id: string;
  view_type: ViewType;
  view_state: string;
  updated_at: string;
  updated_by_actor_id: string | null;
}

export interface PlanViewState {
  casePlanVersionId: string;
  viewType: ViewType;
  viewState: unknown;
  updatedAt: string;
  updatedByActorId: string | null;
}

export interface PlanValidationBlocker {
  code: string;
  detail: string;
  severity: BlockerSeverity;
}

export interface PlanValidationResult {
  valid: boolean;
  blockers: PlanValidationBlocker[];
}

export interface PlanCollectionDiffItem {
  id: string;
  changedFields: string[];
}

export interface PlanCollectionDiff {
  added: string[];
  removed: string[];
  changed: PlanCollectionDiffItem[];
}

export interface PlanVersionDiff {
  casePlanVersionId: string;
  baselinePlanVersionId: string;
  digestsEqual: boolean;
  nodes: PlanCollectionDiff;
  edges: PlanCollectionDiff;
  variables: PlanCollectionDiff;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAN_STATUSES: readonly PlanVersionStatus[] = [
  'DRAFT',
  'IN_REVIEW',
  'PUBLISHED',
  'SUPERSEDED',
  'WITHDRAWN',
];
const VIEW_TYPES: readonly ViewType[] = ['SIMPLE', 'EXPERT', 'LIST'];

// CW-RT-030/031: DRAFT -> IN_REVIEW -> PUBLISHED -> {SUPERSEDED, WITHDRAWN};
// IN_REVIEW -> DRAFT ("changes requested") also reachable. SUPERSEDED is only
// ever reached via publishPlanVersion()'s supersede side-effect, never a
// standalone caller transition (see ALLOWED_TRANSITIONS below intentionally
// has no entry pointing at SUPERSEDED from a public method).
const ALLOWED_TRANSITIONS: Record<PlanVersionStatus, readonly PlanVersionStatus[]> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['DRAFT', 'PUBLISHED'],
  PUBLISHED: ['WITHDRAWN'],
  SUPERSEDED: [],
  WITHDRAWN: [],
};

// ---------------------------------------------------------------------------
// Local helpers (mirrors caseCoreService.ts's own local helpers — not
// imported from there, each service file in this directory keeps its own
// copy per that file's existing convention).
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

function requireGraph(value: CanonicalGraph | null | undefined, reason: string): CanonicalGraph {
  if (!value || typeof value !== 'object') throw new Error(reason);
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) throw new Error(reason);
  if (!Array.isArray(value.entryNodeIds) || !Array.isArray(value.terminalNodeIds)) {
    throw new Error(reason);
  }
  return value;
}

/**
 * SEC-009 / CW-DOD-D6 enumeration-oracle collapse for every by-id method
 * below (getPlanVersion excepted — see its own inline comment). Every one
 * of these methods loads the case_plan_versions row FIRST (to learn its
 * case_id), and only then checks access via requireCaseAccess — the
 * opposite order from requireCaseAccess(caseId) itself, which resolves
 * organization_id and denial in one place and already collapses
 * "case doesn't exist" and "case exists, actor denied" into one
 * `case_access_denied`. Loading the row first before that check reopens the
 * exact oracle requireCaseAccess exists to close: a planVersionId belonging
 * to another tenant's Case reaches this point and throws
 * `case_access_denied` (a DIFFERENT thrown error, with a different message,
 * than the `plan_version_not_found` a genuinely missing planVersionId
 * throws earlier in the same method), letting an attacker distinguish
 * "exists elsewhere" from "doesn't exist" purely from the error shape.
 *
 * Mirrors caseCoreService.getCase's projectId branch (same collapse, same
 * "only an authorization DENIAL collapses; any other error still
 * propagates" rule) and caseWorkspaceAuthContext.requireCaseAccess's own
 * design note. `getPlanVersion` needs its own copy of this (returning
 * `null` instead of throwing) because it is a `T | null` reader whose
 * missing-row branch already returns `null`, not throws — every other
 * by-id method in this file throws `plan_version_not_found` on a missing
 * row, so a caught CaseWorkspaceAuthError here throws the identical error
 * to match.
 */
async function requireCaseAccessOrPlanVersionNotFound(actorUserId: string, caseId: string): Promise<void> {
  try {
    await requireCaseAccess(actorUserId, caseId);
  } catch (err) {
    if (err instanceof CaseWorkspaceAuthError) throw new Error('plan_version_not_found');
    throw err;
  }
}

function parseReviewHistory(raw: string): PlanReviewHistoryEntry[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) return parsed as PlanReviewHistoryEntry[];
  } catch {
    // fall through to []
  }
  return [];
}

function parseGraph(raw: string): CanonicalGraph {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as CanonicalGraph;
  } catch {
    // fall through
  }
  return { entryNodeIds: [], terminalNodeIds: [], nodes: [], edges: [] };
}

function mapRow(row: CasePlanVersionRow): CasePlanVersion {
  return {
    casePlanVersionId: row.case_plan_version_id,
    caseId: row.case_id,
    planNumber: Number(row.plan_number),
    sourceProcessVersionId: row.source_process_version_id,
    supersedesPlanVersionId: row.supersedes_plan_version_id,
    status: row.status,
    semanticGraph: parseGraph(row.semantic_graph),
    graphDigest: row.graph_digest,
    changeReason: row.change_reason,
    reviewHistory: parseReviewHistory(row.review_history),
    proposedAt: row.proposed_at,
    proposedByActorId: row.proposed_by_actor_id,
    publishedAt: row.published_at,
    publishedByActorId: row.published_by_actor_id,
    supersededAt: row.superseded_at,
    withdrawnAt: row.withdrawn_at,
    withdrawnByActorId: row.withdrawn_by_actor_id,
    withdrawalReason: row.withdrawal_reason,
    createdByActorId: row.created_by_actor_id,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapViewStateRow(row: CasePlanViewStateRow): PlanViewState {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(row.view_state || '{}');
  } catch {
    parsed = {};
  }
  return {
    casePlanVersionId: row.case_plan_version_id,
    viewType: row.view_type,
    viewState: parsed,
    updatedAt: row.updated_at,
    updatedByActorId: row.updated_by_actor_id,
  };
}

// ---------------------------------------------------------------------------
// Semantic digest (see this file's header + the design's
// semantic_digest_algorithm for the full specification). Pure and
// deterministic: same semantic_graph value always yields the same digest
// regardless of object-key insertion order, null-vs-omitted-optional-field
// differences, or nodes[]/edges[]/variables[] array ordering.
// ---------------------------------------------------------------------------

const IDENTITY_FIELD_PRIORITY = ['nodeId', 'edgeId', 'name'] as const;

function findArrayIdentityField(arr: unknown[]): string | null {
  if (arr.length === 0) return null;
  for (const field of IDENTITY_FIELD_PRIORITY) {
    const everyHasField = arr.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        typeof (item as Record<string, unknown>)[field] === 'string'
    );
    if (everyHasField) return field;
  }
  return null;
}

/**
 * canonicalize(value) per the semantic_digest_algorithm: drops
 * null/undefined object keys, sorts object keys, and sorts nodes[]/edges[]/
 * variables[]-shaped arrays (every element sharing one of nodeId/edgeId/name)
 * by that identity field so array position becomes irrelevant. Every other
 * array (inputBindings[], primitives, ...) keeps its original order.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;

  if (Array.isArray(value)) {
    const identityField = findArrayIdentityField(value);
    const items = value.map((item) => item);
    const ordered = identityField
      ? [...items].sort((a, b) => {
          const av = String((a as Record<string, unknown>)[identityField]);
          const bv = String((b as Record<string, unknown>)[identityField]);
          return av < bv ? -1 : av > bv ? 1 : 0;
        })
      : items;
    return ordered.map((item) => canonicalize(item));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, v]) => [key, canonicalize(v)] as const)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const result: Record<string, unknown> = {};
    for (const [key, v] of entries) result[key] = v;
    return result;
  }

  return value;
}

/**
 * `sha256:<hex>` over the canonicalized semantic_graph — see the file header
 * open_question notes and 20260809_case_workspace_case_plan_version.sql.
 * Same node:crypto call already used at server/src/ai/promptRegistry.ts:383
 * and server/src/middleware/apiKeyAuth.middleware.ts:466.
 */
export function computeGraphDigest(graph: CanonicalGraph): string {
  const canonical = canonicalize(graph);
  const json = JSON.stringify(canonical);
  return `sha256:${createHash('sha256').update(json, 'utf8').digest('hex')}`;
}

// ---------------------------------------------------------------------------
// CW-GR-036 LOCAL_STRUCTURAL validation (see open_question #3 above for the
// EXTERNAL_DEPENDENT remainder this packet defers).
// ---------------------------------------------------------------------------

const DEFERRED_EXTERNAL_BLOCKERS: readonly PlanValidationBlocker[] = [
  {
    code: 'CAPABILITY_HEALTH_UNKNOWN',
    detail:
      'Capability health/deprecation status cannot be checked — the Capability Registry (CW-GR section 4) does not exist yet in this codebase.',
    severity: 'DEFERRED_EXTERNAL',
  },
  {
    code: 'ACL_BEYOND_ORG_UNKNOWN',
    detail: 'Access-control checks beyond org scope require the Capability Registry and are not evaluated here.',
    severity: 'DEFERRED_EXTERNAL',
  },
  {
    code: 'SECRET_RESOLUTION_UNKNOWN',
    detail: 'SECRET_REF-backed input binding values are not resolved or validated by this packet.',
    severity: 'DEFERRED_EXTERNAL',
  },
  {
    code: 'RETRY_IDEMPOTENCY_COVERAGE_UNKNOWN',
    detail:
      'Effect-class-driven idempotency/retry/compensation coverage requires the Capability Registry and is not evaluated here.',
    severity: 'DEFERRED_EXTERNAL',
  },
];

/**
 * Pure, read-only computation over an already-parsed CanonicalGraph — no DB
 * access, safe to call both from the public read-only validatePlanVersion()
 * and from inside publishPlanVersion()'s transaction against the row already
 * loaded there.
 */
export function computeValidationBlockers(graph: CanonicalGraph): PlanValidationBlocker[] {
  const blockers: PlanValidationBlocker[] = [];

  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const entryNodeIds = Array.isArray(graph.entryNodeIds) ? graph.entryNodeIds : [];
  const terminalNodeIds = Array.isArray(graph.terminalNodeIds) ? graph.terminalNodeIds : [];

  // Duplicate node/edge ids.
  const nodeIdCounts = new Map<string, number>();
  for (const n of nodes) nodeIdCounts.set(n.nodeId, (nodeIdCounts.get(n.nodeId) ?? 0) + 1);
  const duplicateNodeIds = [...nodeIdCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id);
  if (duplicateNodeIds.length > 0) {
    blockers.push({
      code: 'DUPLICATE_NODE_ID',
      detail: `Duplicate nodeId(s): ${duplicateNodeIds.join(', ')}`,
      severity: 'BLOCKING',
    });
  }

  const edgeIdCounts = new Map<string, number>();
  for (const e of edges) edgeIdCounts.set(e.edgeId, (edgeIdCounts.get(e.edgeId) ?? 0) + 1);
  const duplicateEdgeIds = [...edgeIdCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id);
  if (duplicateEdgeIds.length > 0) {
    blockers.push({
      code: 'DUPLICATE_EDGE_ID',
      detail: `Duplicate edgeId(s): ${duplicateEdgeIds.join(', ')}`,
      severity: 'BLOCKING',
    });
  }

  const nodeIds = new Set(nodes.map((n) => n.nodeId));

  // Dangling edges (reference a missing node).
  const danglingEdges = edges.filter(
    (e) => !nodeIds.has(e.sourceNodeId) || !nodeIds.has(e.targetNodeId)
  );
  if (danglingEdges.length > 0) {
    blockers.push({
      code: 'DANGLING_EDGE',
      detail: `Edge(s) referencing a missing node: ${danglingEdges.map((e) => e.edgeId).join(', ')}`,
      severity: 'BLOCKING',
    });
  }

  // Forward adjacency (non-dangling edges only) for reachability + cycles.
  const adjacency = new Map<string, string[]>();
  const validEdges = edges.filter((e) => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId));
  for (const e of validEdges) {
    const list = adjacency.get(e.sourceNodeId) ?? [];
    list.push(e.targetNodeId);
    adjacency.set(e.sourceNodeId, list);
  }

  // Reachability from entryNodeIds (BFS).
  const reachable = new Set<string>();
  const queue = [...entryNodeIds].filter((id) => nodeIds.has(id));
  for (const id of queue) reachable.add(id);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  const unreachable = [...nodeIds].filter((id) => !reachable.has(id));
  if (unreachable.length > 0) {
    blockers.push({
      code: 'UNREACHABLE_NODE',
      detail: `Node(s) not reachable from entryNodeIds: ${unreachable.join(', ')}`,
      severity: 'BLOCKING',
    });
  }

  // At least one terminalNodeId must be reachable from the entry set.
  const hasTerminalPath = terminalNodeIds.some((id) => reachable.has(id));
  if (terminalNodeIds.length === 0 || !hasTerminalPath) {
    blockers.push({
      code: 'NO_TERMINAL_PATH',
      detail: 'No path exists from entryNodeIds to any declared terminalNodeId.',
      severity: 'BLOCKING',
    });
  }

  // Cycle detection over SEQUENCE/CONDITIONAL edges (see open_question #5 —
  // no loopPolicy field exists yet to distinguish an intentional bounded
  // loop from a defect, so ANY cycle here is reported as blocking).
  const controlEdges = validEdges.filter((e) => !e.edgeType || e.edgeType === 'SEQUENCE' || e.edgeType === 'CONDITIONAL');
  const controlAdjacency = new Map<string, string[]>();
  for (const e of controlEdges) {
    const list = controlAdjacency.get(e.sourceNodeId) ?? [];
    list.push(e.targetNodeId);
    controlAdjacency.set(e.sourceNodeId, list);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodeIds) color.set(id, WHITE);
  let cycleFound = false;
  const visit = (id: string): void => {
    if (cycleFound) return;
    color.set(id, GRAY);
    for (const next of controlAdjacency.get(id) ?? []) {
      const c = color.get(next);
      if (c === GRAY) {
        cycleFound = true;
        return;
      }
      if (c === WHITE) visit(next);
      if (cycleFound) return;
    }
    color.set(id, BLACK);
  };
  for (const id of nodeIds) {
    if (color.get(id) === WHITE) visit(id);
    if (cycleFound) break;
  }
  if (cycleFound) {
    blockers.push({
      code: 'UNCONTROLLED_CYCLE',
      detail: 'A cycle exists among SEQUENCE/CONDITIONAL edges with no declared loop policy.',
      severity: 'BLOCKING',
    });
  }

  // Required input bindings missing a source or literal value.
  const missingRequiredInputs: string[] = [];
  for (const node of nodes) {
    for (const binding of node.inputBindings ?? []) {
      if (!binding.required) continue;
      const hasSource = Boolean(binding.sourceNodeId) && Boolean(binding.sourcePath);
      const hasValue = binding.value !== undefined && binding.value !== null;
      if (!hasSource && !hasValue) {
        missingRequiredInputs.push(`${node.nodeId}:${binding.targetPath ?? '?'}`);
      }
    }
  }
  if (missingRequiredInputs.length > 0) {
    blockers.push({
      code: 'MISSING_REQUIRED_INPUT',
      detail: `Required input binding(s) missing sourceNodeId/sourcePath/value: ${missingRequiredInputs.join(', ')}`,
      severity: 'BLOCKING',
    });
  }

  // Declared limits vs actual counts.
  const maxNodes = graph.limits?.maxNodes;
  if (typeof maxNodes === 'number' && nodes.length > maxNodes) {
    blockers.push({
      code: 'LIMIT_EXCEEDED',
      detail: `Node count ${nodes.length} exceeds declared limits.maxNodes=${maxNodes}.`,
      severity: 'BLOCKING',
    });
  }
  const maxEdges = graph.limits?.maxEdges;
  if (typeof maxEdges === 'number' && edges.length > maxEdges) {
    blockers.push({
      code: 'LIMIT_EXCEEDED',
      detail: `Edge count ${edges.length} exceeds declared limits.maxEdges=${maxEdges}.`,
      severity: 'BLOCKING',
    });
  }

  // EXTERNAL_DEPENDENT remainder of CW-GR-036 — always reported, never
  // silently marked passing (open_question #3).
  blockers.push(...DEFERRED_EXTERNAL_BLOCKERS);

  return blockers;
}

// ---------------------------------------------------------------------------
// Row loaders
// ---------------------------------------------------------------------------

/** Aggregate name this service owns in the outbox (EVENT_TAXONOMY.md §2/§3). */
const PLAN_VERSION_AGGREGATE_TYPE = 'CASE_PLAN_VERSION';

interface CaseScope {
  organizationId: string;
  projectId: string | null;
}

/**
 * EVENT_TAXONOMY.md §1: `organization_id` on the outbox is NOT NULL, and
 * `case_plan_versions` carries neither organization_id nor project_id — its
 * only tenancy link is case_id. So every event this service publishes resolves
 * its tenancy from `case_core` INSIDE the same transaction, on the same client.
 *
 * This is a plain SELECT (no lock, no write): the packet's collision-avoidance
 * mandate forbids this service from writing to case_core, and reading it here
 * is the same read createPlanDraft already performs. Reading it on the
 * transaction's own client — rather than through the shared pool — is what
 * keeps the tenancy the event records consistent with the mutation it
 * describes, even if another transaction is touching that Case concurrently.
 */
async function loadCaseScope(client: PgTransactionClient, caseId: string): Promise<CaseScope> {
  const result = await client.query<{ organization_id: string; project_id: string | null }>(
    `SELECT organization_id, project_id FROM case_core WHERE case_id = ?`,
    [caseId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('plan_case_not_found');
  return { organizationId: row.organization_id, projectId: row.project_id };
}

/**
 * EVENT_TAXONOMY.md §2: "graph node/edge counts + graph_digest, never the
 * graph". Counts and the digest are facts a projection can act on; the graph
 * itself is content and belongs behind payloadRef (§6.5).
 */
function graphShapeFacts(graph: CanonicalGraph): Record<string, unknown> {
  return {
    nodeCount: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
    edgeCount: Array.isArray(graph.edges) ? graph.edges.length : 0,
    entryNodeCount: Array.isArray(graph.entryNodeIds) ? graph.entryNodeIds.length : 0,
    terminalNodeCount: Array.isArray(graph.terminalNodeIds) ? graph.terminalNodeIds.length : 0,
    variableCount: Array.isArray(graph.variables) ? graph.variables.length : 0,
  };
}

/**
 * The pointer that stands in for the semantic graph in an event (§1
 * `payloadRef`). Identifies the exact row AND the exact digest, so a consumer
 * can fetch the very graph the event describes rather than whatever that row
 * holds by the time it looks.
 */
function graphPayloadRef(planVersionId: string, graphDigest: string): string {
  return `case_plan_versions:${planVersionId}#${graphDigest}`;
}

async function loadForUpdate(client: PgTransactionClient, planVersionId: string): Promise<CasePlanVersionRow> {
  const result = await client.query<CasePlanVersionRow>(
    `SELECT * FROM case_plan_versions WHERE case_plan_version_id = ? FOR UPDATE`,
    [planVersionId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('plan_version_not_found');
  return row;
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

export interface CreatePlanDraftInput {
  caseId: string;
  sourceProcessVersionId?: string | null;
  supersedesPlanVersionId?: string | null;
  semanticGraph: CanonicalGraph;
  changeReason?: string | null;
  createdByActorId: string;
}

/**
 * createPlanDraftOnClient's input: createPlanDraft's input plus the two
 * envelope-identity fields a joining command needs to make its own event and
 * `case.plan.draft_created` one chain (EVENT_TAXONOMY.md §1 `correlationId`,
 * §5 `causationId`). Both optional; omitted, publishEvent resolves the
 * correlation id from the ambient request exactly as it does for every other
 * command in this file.
 */
export interface CreatePlanDraftOnClientInput extends CreatePlanDraftInput {
  correlationId?: string | null;
  causationId?: string | null;
}

/**
 * CW-01-010 (Plan Definition is an editable draft, distinct from the
 * immutable Plan Version), CW-RT-016 (CasePlanVersion aggregate), CW-RT-017
 * (replanning inserts a new row), CW-RT-043, CW-GR-024.
 *
 * Reads (never writes) `case_core` to confirm the Case exists — the
 * `SELECT ... FOR UPDATE` row lock also serializes concurrent draft creation
 * for the same case_id, so two racing createPlanDraft calls compute distinct
 * plan_number values rather than colliding. If supersedesPlanVersionId is
 * given, requires it to name a PUBLISHED plan version of the same Case
 * (replanning is only meaningful against a published baseline).
 *
 * The whole body lives in createPlanDraftOnClient below; this entry point is
 * only "open a transaction and run it". Callers that already hold a
 * transaction call that one directly so their own event commits with this
 * INSERT — see its docblock.
 */
export async function createPlanDraft(input: CreatePlanDraftInput): Promise<CasePlanVersion> {
  return withPgTransaction((client) => createPlanDraftOnClient(client, input));
}

/**
 * The body of createPlanDraft, on a transaction client the CALLER owns.
 *
 * Exists so a command that must emit its own event about this draft can put
 * that event in the SAME transaction as the INSERT and as
 * `case.plan.draft_created` — the concrete case is
 * playService.instantiateProcessVersion, whose taxonomy row
 * (`process.version.instantiated`) is the play->Case join point. Without this
 * entry point the only way to emit it would be a second transaction opened
 * after this one committed: exactly the dual-write hole the outbox exists to
 * close (EVENT_TAXONOMY.md §0 "Opening a second connection for the event …
 * reintroduces exactly the dual-write hole").
 *
 * Identical validation, identical authorization, identical INSERT and
 * identical `case.plan.draft_created` envelope to createPlanDraft — that
 * function is now nothing but `withPgTransaction(client => this(client, input))`,
 * so there is only one copy of this logic to keep correct. The two optional
 * fields (`correlationId`/`causationId`) are absent from every existing
 * caller's input and therefore change nothing for them: publishEvent falls
 * back to the ambient request correlation id exactly as before. A caller that
 * DOES pass them makes its own event and this one provably one chain
 * (EVENT_TAXONOMY.md §1/§5).
 */
export async function createPlanDraftOnClient(
  client: PgTransactionClient,
  input: CreatePlanDraftOnClientInput
): Promise<CasePlanVersion> {
  const caseId = requireNonBlank(input.caseId, 'plan_case_id_required');
  const createdByActorId = requireNonBlank(input.createdByActorId, 'plan_created_by_actor_required');
  const semanticGraph = requireGraph(input.semanticGraph, 'plan_semantic_graph_invalid');

  await requireCaseAccess(createdByActorId, caseId);

  // organization_id/project_id are selected alongside case_id because the
  // outbox event published at the end of this transaction needs them
  // (EVENT_TAXONOMY.md §1) and case_plan_versions carries neither. This is
  // the same single read that already existed — still read-only, still the
  // FOR UPDATE lock that serializes concurrent draft creation.
  const caseResult = await client.query<{
    case_id: string;
    organization_id: string;
    project_id: string | null;
  }>(
    `SELECT case_id, organization_id, project_id FROM case_core WHERE case_id = ? FOR UPDATE`,
    [caseId]
  );
  const caseRow = caseResult.rows[0];
  if (!caseRow) throw new Error('plan_case_not_found');

  let supersedesPlanVersionId: string | null = null;
  if (input.supersedesPlanVersionId) {
    const supersedesResult = await client.query<CasePlanVersionRow>(
      `SELECT * FROM case_plan_versions WHERE case_plan_version_id = ?`,
      [input.supersedesPlanVersionId]
    );
    const target = supersedesResult.rows[0];
    if (!target || target.case_id !== caseId || target.status !== 'PUBLISHED') {
      throw new Error('plan_supersedes_target_invalid');
    }
    supersedesPlanVersionId = target.case_plan_version_id;
  }

  const planNumberResult = await client.query<{ next_plan_number: number }>(
    `SELECT COALESCE(MAX(plan_number), 0) + 1 AS next_plan_number
       FROM case_plan_versions WHERE case_id = ?`,
    [caseId]
  );
  const planNumber = Number(planNumberResult.rows[0]?.next_plan_number ?? 1);

  const graphDigest = computeGraphDigest(semanticGraph);
  const casePlanVersionId = `planv-${uuidv4()}`;
  const now = new Date().toISOString();

  const inserted = await client.query<CasePlanVersionRow>(
    `INSERT INTO case_plan_versions (
       case_plan_version_id, case_id, plan_number, source_process_version_id,
       supersedes_plan_version_id, status, semantic_graph, graph_digest,
       change_reason, review_history, created_by_actor_id, version,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, '[]', ?, 1, ?, ?)
     RETURNING *`,
    [
      casePlanVersionId,
      caseId,
      planNumber,
      input.sourceProcessVersionId ?? null,
      supersedesPlanVersionId,
      JSON.stringify(semanticGraph),
      graphDigest,
      input.changeReason ?? null,
      createdByActorId,
      now,
      now,
    ]
  );
  const insertedRow = inserted.rows[0];
  if (!insertedRow) throw new Error('plan_create_failed');

  // EVENT_TAXONOMY.md §2 `createPlanDraft -> case.plan.draft_created`.
  await publishEvent(client, {
    eventType: 'case.plan.draft_created',
    organizationId: caseRow.organization_id,
    projectId: caseRow.project_id,
    aggregateType: PLAN_VERSION_AGGREGATE_TYPE,
    aggregateId: insertedRow.case_plan_version_id,
    aggregateVersion: Number(insertedRow.version),
    caseId: insertedRow.case_id,
    actorUserId: insertedRow.created_by_actor_id,
    correlationId: input.correlationId ?? undefined,
    causationId: input.causationId ?? undefined,
    payloadRef: graphPayloadRef(insertedRow.case_plan_version_id, insertedRow.graph_digest),
    redactedSummary: redact({
      status: insertedRow.status,
      planNumber: Number(insertedRow.plan_number),
      graphDigest: insertedRow.graph_digest,
      supersedesPlanVersionId: insertedRow.supersedes_plan_version_id,
      sourceProcessVersionId: insertedRow.source_process_version_id,
      ...graphShapeFacts(semanticGraph),
    }),
  });

  return mapRow(insertedRow);
}

/**
 * CW-01-010, CW-GR-025, CW-RT-043, CW-RT-044, CW-RT-061, CW-GR-044.
 *
 * Only DRAFT rows may be semantically mutated. Recomputes graph_digest from
 * the new semanticGraph. `WHERE ... AND version = expectedVersion`; a 0-row
 * UPDATE throws plan_version_conflict with no partial write.
 */
export async function updatePlanDraft(
  planVersionId: string,
  input: { semanticGraph: CanonicalGraph; expectedVersion: number },
  actor: CaseActor
): Promise<CasePlanVersion> {
  const id = requireNonBlank(planVersionId, 'plan_version_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'plan_actor_required');
  const semanticGraph = requireGraph(input.semanticGraph, 'plan_semantic_graph_invalid');
  const expectedVersion = input.expectedVersion;
  if (typeof expectedVersion !== 'number') throw new Error('plan_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccessOrPlanVersionNotFound(actorUserId, row.case_id);
    if (row.status !== 'DRAFT') throw new Error('plan_version_not_editable');

    const graphDigest = computeGraphDigest(semanticGraph);
    const now = new Date().toISOString();

    const updated = await client.query<CasePlanVersionRow>(
      `UPDATE case_plan_versions
          SET semantic_graph = ?, graph_digest = ?, version = version + 1, updated_at = ?
        WHERE case_plan_version_id = ? AND version = ?
        RETURNING *`,
      [JSON.stringify(semanticGraph), graphDigest, now, id, expectedVersion]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('plan_version_conflict');

    // EVENT_TAXONOMY.md §2 `updatePlanDraft -> case.plan.draft_updated`:
    // "new graph_digest + what changed; the graph itself goes in payloadRef".
    // `digestChanged` is the fact that matters — a save that did not alter the
    // graph semantically still bumps `version` but changes nothing downstream.
    const scope = await loadCaseScope(client, updatedRow.case_id);
    await publishEvent(client, {
      eventType: 'case.plan.draft_updated',
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      aggregateType: PLAN_VERSION_AGGREGATE_TYPE,
      aggregateId: updatedRow.case_plan_version_id,
      aggregateVersion: Number(updatedRow.version),
      caseId: updatedRow.case_id,
      actorUserId,
      payloadRef: graphPayloadRef(updatedRow.case_plan_version_id, updatedRow.graph_digest),
      redactedSummary: redact({
        status: updatedRow.status,
        graphDigest: updatedRow.graph_digest,
        previousGraphDigest: row.graph_digest,
        digestChanged: row.graph_digest !== updatedRow.graph_digest,
        ...graphShapeFacts(semanticGraph),
      }),
    });

    return mapRow(updatedRow);
  });
}

/**
 * CW-RT-016, CW-GR-024. Plain read, no lock.
 *
 * SEC-009 / CW-DOD-D6: a planVersionId belonging to another tenant's Case
 * must be indistinguishable from a planVersionId that does not exist at
 * all — both resolve to `null` here. Without this, a cross-tenant id would
 * reach requireCaseAccess and throw `case_access_denied` while a missing id
 * resolves to `null` two lines above, letting a caller learn "this
 * planVersionId exists, just not in your org" purely from whether the call
 * threw. This is the same collapse-to-null caseCoreService.getCase's
 * projectId branch already performs; every other by-id method in this file
 * uses requireCaseAccessOrPlanVersionNotFound instead because it throws
 * rather than returning null on a missing row. Only an authorization DENIAL
 * collapses — any other error (a bad actor id, a DB failure) still
 * propagates.
 */
export async function getPlanVersion(
  planVersionId: string,
  actorUserId: string
): Promise<CasePlanVersion | null> {
  const actor = requireNonBlank(actorUserId, 'plan_actor_required');
  const row = await queryOne<CasePlanVersionRow>(
    `SELECT * FROM case_plan_versions WHERE case_plan_version_id = ?`,
    [requireNonBlank(planVersionId, 'plan_version_id_required')]
  );
  if (!row) return null;
  try {
    await requireCaseAccess(actor, row.case_id);
  } catch (err) {
    if (err instanceof CaseWorkspaceAuthError) return null;
    throw err;
  }
  return mapRow(row);
}

/** CW-RT-016, CW-RT-017. Newest plan_number first. */
export async function listPlanVersionsForCase(
  caseId: string,
  actorUserId: string
): Promise<CasePlanVersion[]> {
  const id = requireNonBlank(caseId, 'plan_case_id_required');
  await requireCaseAccess(requireNonBlank(actorUserId, 'plan_actor_required'), id);
  const rows = await queryAll<CasePlanVersionRow>(
    `SELECT * FROM case_plan_versions WHERE case_id = ? ORDER BY plan_number DESC`,
    [id]
  );
  return rows.map(mapRow);
}

/**
 * CW-GR-012, CW-GR-036, CW-GR-024, CW-GR-047.
 *
 * Read-only. Computes the LOCAL_STRUCTURAL subset of CW-GR-036's
 * publish-blocking checklist over the persisted semantic_graph; the
 * EXTERNAL_DEPENDENT remainder is always reported as severity=
 * 'DEFERRED_EXTERNAL' (see open_question #3), never silently passing.
 */
export async function validatePlanVersion(
  planVersionId: string,
  actorUserId: string
): Promise<PlanValidationResult> {
  const id = requireNonBlank(planVersionId, 'plan_version_id_required');
  const actor = requireNonBlank(actorUserId, 'plan_actor_required');
  const row = await queryOne<CasePlanVersionRow>(
    `SELECT * FROM case_plan_versions WHERE case_plan_version_id = ?`,
    [id]
  );
  if (!row) throw new Error('plan_version_not_found');
  await requireCaseAccessOrPlanVersionNotFound(actor, row.case_id);

  const graph = parseGraph(row.semantic_graph);
  const blockers = computeValidationBlockers(graph);
  const valid = !blockers.some((b) => b.severity === 'BLOCKING');
  return { valid, blockers };
}

/** CW-RT-030, CW-RT-031, CW-RT-043, CW-GR-024. DRAFT -> IN_REVIEW. */
export async function proposePlanVersion(
  planVersionId: string,
  actor: CaseActor,
  expectedVersion: number
): Promise<CasePlanVersion> {
  const id = requireNonBlank(planVersionId, 'plan_version_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'plan_actor_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccessOrPlanVersionNotFound(actorUserId, row.case_id);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes('IN_REVIEW')) {
      throw new Error(`plan_status_transition_not_allowed:${row.status}->IN_REVIEW`);
    }

    const now = new Date().toISOString();
    const nextHistory = [
      ...parseReviewHistory(row.review_history),
      { event: 'PROPOSED' as const, actorId: actorUserId, at: now },
    ];

    const updated = await client.query<CasePlanVersionRow>(
      `UPDATE case_plan_versions
          SET status = 'IN_REVIEW', review_history = ?, proposed_at = ?,
              proposed_by_actor_id = ?, version = version + 1, updated_at = ?
        WHERE case_plan_version_id = ? AND version = ?
        RETURNING *`,
      [JSON.stringify(nextHistory), now, actorUserId, now, id, expectedVersion]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('plan_version_conflict');

    // EVENT_TAXONOMY.md §2 `proposePlanVersion -> case.plan.proposed`,
    // "Summary: validation blocker count". Computed from the persisted graph
    // with the same pure function publishPlanVersion re-runs, split by
    // severity: a reviewer's inbox cares that N BLOCKING items stand between
    // this proposal and publication, and the DEFERRED_EXTERNAL count is
    // reported separately so it can never be mistaken for a passing check
    // (open_question #3).
    const blockers = computeValidationBlockers(parseGraph(updatedRow.semantic_graph));
    const scope = await loadCaseScope(client, updatedRow.case_id);
    await publishEvent(client, {
      eventType: 'case.plan.proposed',
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      aggregateType: PLAN_VERSION_AGGREGATE_TYPE,
      aggregateId: updatedRow.case_plan_version_id,
      aggregateVersion: Number(updatedRow.version),
      caseId: updatedRow.case_id,
      actorUserId,
      payloadRef: graphPayloadRef(updatedRow.case_plan_version_id, updatedRow.graph_digest),
      redactedSummary: redact({
        from: row.status,
        to: updatedRow.status,
        graphDigest: updatedRow.graph_digest,
        blockingBlockerCount: blockers.filter((b) => b.severity === 'BLOCKING').length,
        deferredExternalBlockerCount: blockers.filter((b) => b.severity === 'DEFERRED_EXTERNAL')
          .length,
        blockingBlockerCodes: [
          ...new Set(blockers.filter((b) => b.severity === 'BLOCKING').map((b) => b.code)),
        ],
      }),
    });

    return mapRow(updatedRow);
  });
}

/**
 * CW-RT-030, CW-RT-031. IN_REVIEW -> DRAFT ("changes requested"). Named by
 * analogy to Case's own pattern — no dedicated command/route names this in
 * CW-RT-043/CW-GR-024 (open_question #1).
 */
export async function requestChangesOnPlanVersion(
  planVersionId: string,
  actor: CaseActor,
  reason: string,
  expectedVersion: number
): Promise<CasePlanVersion> {
  const id = requireNonBlank(planVersionId, 'plan_version_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'plan_actor_required');
  const changeReason = requireNonBlank(reason, 'plan_request_changes_reason_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccessOrPlanVersionNotFound(actorUserId, row.case_id);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes('DRAFT')) {
      throw new Error(`plan_status_transition_not_allowed:${row.status}->DRAFT`);
    }

    const now = new Date().toISOString();
    const nextHistory = [
      ...parseReviewHistory(row.review_history),
      { event: 'CHANGES_REQUESTED' as const, actorId: actorUserId, at: now, reason: changeReason },
    ];

    const updated = await client.query<CasePlanVersionRow>(
      `UPDATE case_plan_versions
          SET status = 'DRAFT', review_history = ?, version = version + 1, updated_at = ?
        WHERE case_plan_version_id = ? AND version = ?
        RETURNING *`,
      [JSON.stringify(nextHistory), now, id, expectedVersion]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('plan_version_conflict');

    // EVENT_TAXONOMY.md §2 `requestChangesOnPlanVersion ->
    // case.plan.changes_requested`, "Summary: reviewer + reason".
    const scope = await loadCaseScope(client, updatedRow.case_id);
    await publishEvent(client, {
      eventType: 'case.plan.changes_requested',
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      aggregateType: PLAN_VERSION_AGGREGATE_TYPE,
      aggregateId: updatedRow.case_plan_version_id,
      aggregateVersion: Number(updatedRow.version),
      caseId: updatedRow.case_id,
      actorUserId,
      redactedSummary: redact({
        from: row.status,
        to: updatedRow.status,
        reviewerActorId: actorUserId,
        reason: changeReason,
      }),
    });

    return mapRow(updatedRow);
  });
}

/**
 * CW-00-020-INV5, CW-01-011, CW-RT-017, CW-RT-029, CW-RT-030, CW-RT-043,
 * CW-GR-024, CW-GR-036, CW-GR-044, CW-CANON-06, CW-DOD-B3, CW-DOD-B4.
 *
 * IN_REVIEW -> PUBLISHED. Re-runs the LOCAL_STRUCTURAL validation inside this
 * same transaction and rejects with plan_publish_validation_failed if any
 * BLOCKING blocker remains (see open_question #3 — this does not assert
 * GR-036 completeness, only the local subset this packet can compute). In
 * the same transaction, supersedes the previously PUBLISHED row for the same
 * case_id, if any (there is at most one, per the partial unique index) —
 * this is the sole path by which SUPERSEDED is ever reached. Never writes
 * `case_core` (see open_question #4).
 */
export async function publishPlanVersion(
  planVersionId: string,
  actor: CaseActor,
  expectedVersion: number
): Promise<CasePlanVersion> {
  const id = requireNonBlank(planVersionId, 'plan_version_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'plan_actor_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccessOrPlanVersionNotFound(actorUserId, row.case_id);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes('PUBLISHED')) {
      throw new Error(`plan_status_transition_not_allowed:${row.status}->PUBLISHED`);
    }

    const graph = parseGraph(row.semantic_graph);
    const blockers = computeValidationBlockers(graph);
    const blocking = blockers.filter((b) => b.severity === 'BLOCKING');
    if (blocking.length > 0) {
      throw new Error(`plan_publish_validation_failed:${blocking.map((b) => b.code).join(',')}`);
    }

    const now = new Date().toISOString();

    // Supersede the currently-published row for this Case, if any. Locked
    // via FOR UPDATE so a concurrent publish for the same case_id cannot
    // race this read-modify-write.
    const currentPublished = await client.query<CasePlanVersionRow>(
      `SELECT * FROM case_plan_versions WHERE case_id = ? AND status = 'PUBLISHED' FOR UPDATE`,
      [row.case_id]
    );
    const previouslyPublished = currentPublished.rows[0];
    let supersededRow: CasePlanVersionRow | null = null;
    if (previouslyPublished) {
      const supersedeResult = await client.query<CasePlanVersionRow>(
        `UPDATE case_plan_versions
            SET status = 'SUPERSEDED', superseded_at = ?, version = version + 1, updated_at = ?
          WHERE case_plan_version_id = ? AND version = ?
          RETURNING *`,
        [now, now, previouslyPublished.case_plan_version_id, previouslyPublished.version]
      );
      supersededRow = supersedeResult.rows[0] ?? null;
      if (!supersededRow) throw new Error('plan_version_conflict');
    }

    const nextHistory = [
      ...parseReviewHistory(row.review_history),
      { event: 'PUBLISHED' as const, actorId: actorUserId, at: now },
    ];

    const updated = await client.query<CasePlanVersionRow>(
      `UPDATE case_plan_versions
          SET status = 'PUBLISHED', published_at = ?, published_by_actor_id = ?,
              review_history = ?, version = version + 1, updated_at = ?
        WHERE case_plan_version_id = ? AND version = ?
        RETURNING *`,
      [now, actorUserId, JSON.stringify(nextHistory), now, id, expectedVersion]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('plan_version_conflict');

    const scope = await loadCaseScope(client, updatedRow.case_id);

    // EVENT_TAXONOMY.md §2 `publishPlanVersion -> case.plan.published`, and,
    // when this publish supersedes a previous version, `case.plan.superseded`
    // for the superseded id IN THE SAME TRANSACTION with causationId = this
    // event's id. The publish event id is therefore minted UP FRONT rather
    // than read back from publishEvent's result, because the causation link
    // has to name it and both rows have to be written before COMMIT — one
    // publish can never leave a supersede unexplained, or vice versa.
    const publishedEventId = `cwevt-${randomUUID()}`;
    await publishEvent(client, {
      eventId: publishedEventId,
      eventType: 'case.plan.published',
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      aggregateType: PLAN_VERSION_AGGREGATE_TYPE,
      aggregateId: updatedRow.case_plan_version_id,
      aggregateVersion: Number(updatedRow.version),
      caseId: updatedRow.case_id,
      actorUserId,
      payloadRef: graphPayloadRef(updatedRow.case_plan_version_id, updatedRow.graph_digest),
      redactedSummary: redact({
        from: row.status,
        to: updatedRow.status,
        planNumber: Number(updatedRow.plan_number),
        graphDigest: updatedRow.graph_digest,
        supersededPlanVersionId: supersededRow?.case_plan_version_id ?? null,
        ...graphShapeFacts(graph),
      }),
    });

    if (supersededRow) {
      await publishEvent(client, {
        eventType: 'case.plan.superseded',
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        aggregateType: PLAN_VERSION_AGGREGATE_TYPE,
        aggregateId: supersededRow.case_plan_version_id,
        aggregateVersion: Number(supersededRow.version),
        caseId: supersededRow.case_id,
        actorUserId,
        causationId: publishedEventId,
        redactedSummary: redact({
          from: 'PUBLISHED',
          to: supersededRow.status,
          planNumber: Number(supersededRow.plan_number),
          graphDigest: supersededRow.graph_digest,
          supersededByPlanVersionId: updatedRow.case_plan_version_id,
        }),
      });
    }

    return mapRow(updatedRow);
  });
}

/**
 * CW-RT-030, CW-RT-031. PUBLISHED -> WITHDRAWN. Named by analogy to Case's
 * own pattern — no dedicated command/route names this in CW-RT-043/
 * CW-GR-024 (open_question #1).
 */
export async function withdrawPlanVersion(
  planVersionId: string,
  actor: CaseActor,
  reason: string,
  expectedVersion: number
): Promise<CasePlanVersion> {
  const id = requireNonBlank(planVersionId, 'plan_version_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'plan_actor_required');
  const withdrawalReason = requireNonBlank(reason, 'plan_withdraw_reason_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccessOrPlanVersionNotFound(actorUserId, row.case_id);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes('WITHDRAWN')) {
      throw new Error(`plan_status_transition_not_allowed:${row.status}->WITHDRAWN`);
    }

    const now = new Date().toISOString();
    const nextHistory = [
      ...parseReviewHistory(row.review_history),
      { event: 'WITHDRAWN' as const, actorId: actorUserId, at: now, reason: withdrawalReason },
    ];

    const updated = await client.query<CasePlanVersionRow>(
      `UPDATE case_plan_versions
          SET status = 'WITHDRAWN', withdrawn_at = ?, withdrawn_by_actor_id = ?,
              withdrawal_reason = ?, review_history = ?, version = version + 1, updated_at = ?
        WHERE case_plan_version_id = ? AND version = ?
        RETURNING *`,
      [now, actorUserId, withdrawalReason, JSON.stringify(nextHistory), now, id, expectedVersion]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('plan_version_conflict');

    // EVENT_TAXONOMY.md §2 `withdrawPlanVersion -> case.plan.withdrawn`.
    const scope = await loadCaseScope(client, updatedRow.case_id);
    await publishEvent(client, {
      eventType: 'case.plan.withdrawn',
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      aggregateType: PLAN_VERSION_AGGREGATE_TYPE,
      aggregateId: updatedRow.case_plan_version_id,
      aggregateVersion: Number(updatedRow.version),
      caseId: updatedRow.case_id,
      actorUserId,
      redactedSummary: redact({
        from: row.status,
        to: updatedRow.status,
        planNumber: Number(updatedRow.plan_number),
        graphDigest: updatedRow.graph_digest,
        reason: withdrawalReason,
      }),
    });

    return mapRow(updatedRow);
  });
}

/** CW-GR-024, CW-GR-001. Thin graph-shaped projection over getPlanVersion. */
export async function getGraph(
  planVersionId: string,
  actorUserId: string
): Promise<{ graphId: string; graphDigest: string; semanticGraph: CanonicalGraph } | null> {
  const version = await getPlanVersion(planVersionId, actorUserId);
  if (!version) return null;
  return {
    graphId: version.semanticGraph.graphId ?? version.casePlanVersionId,
    graphDigest: version.graphDigest,
    semanticGraph: version.semanticGraph,
  };
}

function diffCollection<T extends Record<string, unknown>>(
  baseline: T[],
  target: T[],
  idField: keyof T
): PlanCollectionDiff {
  const baselineById = new Map(baseline.map((item) => [String(item[idField]), item]));
  const targetById = new Map(target.map((item) => [String(item[idField]), item]));

  const added = [...targetById.keys()].filter((id) => !baselineById.has(id));
  const removed = [...baselineById.keys()].filter((id) => !targetById.has(id));

  const changed: PlanCollectionDiffItem[] = [];
  for (const [id, baseItem] of baselineById) {
    const targetItem = targetById.get(id);
    if (!targetItem) continue;
    const changedFields = new Set<string>();
    const keys = new Set([...Object.keys(baseItem), ...Object.keys(targetItem)]);
    for (const key of keys) {
      if (key === idField) continue;
      const a = JSON.stringify(baseItem[key as keyof T]);
      const b = JSON.stringify(targetItem[key as keyof T]);
      if (a !== b) changedFields.add(key);
    }
    if (changedFields.size > 0) {
      changed.push({ id, changedFields: [...changedFields] });
    }
  }

  return { added, removed, changed };
}

/**
 * CW-RT-017, CW-GR-024, CW-DOD-B3.
 *
 * Read-only. Resolves the baseline to `options.against`, defaulting to the
 * target row's own `supersedesPlanVersionId`. Both rows must belong to the
 * same Case.
 */
export async function diffPlanVersions(
  caseId: string,
  planVersionId: string,
  options: { against?: string } | undefined,
  actorUserId: string
): Promise<PlanVersionDiff> {
  const id = requireNonBlank(caseId, 'plan_case_id_required');
  const actor = requireNonBlank(actorUserId, 'plan_actor_required');
  await requireCaseAccess(actor, id);
  const target = await getPlanVersion(requireNonBlank(planVersionId, 'plan_version_id_required'), actor);
  if (!target || target.caseId !== id) throw new Error('plan_version_not_found');

  const baselineId = options?.against ?? target.supersedesPlanVersionId;
  if (!baselineId) throw new Error('plan_diff_no_baseline');

  const baseline = await getPlanVersion(baselineId, actor);
  if (!baseline) throw new Error('plan_diff_baseline_not_found');
  if (baseline.caseId !== target.caseId) throw new Error('plan_diff_cross_case_forbidden');

  return {
    casePlanVersionId: target.casePlanVersionId,
    baselinePlanVersionId: baseline.casePlanVersionId,
    digestsEqual: target.graphDigest === baseline.graphDigest,
    nodes: diffCollection(baseline.semanticGraph.nodes ?? [], target.semanticGraph.nodes ?? [], 'nodeId'),
    edges: diffCollection(baseline.semanticGraph.edges ?? [], target.semanticGraph.edges ?? [], 'edgeId'),
    variables: diffCollection(
      baseline.semanticGraph.variables ?? [],
      target.semanticGraph.variables ?? [],
      'name'
    ),
  };
}

/** CW-GR-005, CW-GR-024, CW-02-016. Plain read, no lock. */
export async function getViewState(
  planVersionId: string,
  viewType: ViewType,
  actorUserId: string
): Promise<PlanViewState | null> {
  const id = requireNonBlank(planVersionId, 'plan_version_id_required');
  const type = requireEnum(viewType, VIEW_TYPES, 'plan_view_type_invalid');
  const actor = requireNonBlank(actorUserId, 'plan_actor_required');

  const planRow = await queryOne<{ case_id: string }>(
    `SELECT case_id FROM case_plan_versions WHERE case_plan_version_id = ?`,
    [id]
  );
  if (!planRow) throw new Error('plan_version_not_found');
  await requireCaseAccessOrPlanVersionNotFound(actor, planRow.case_id);

  const row = await queryOne<CasePlanViewStateRow>(
    `SELECT * FROM case_plan_view_state WHERE case_plan_version_id = ? AND view_type = ?`,
    [id, type]
  );
  return row ? mapViewStateRow(row) : null;
}

/**
 * CW-GR-005, CW-GR-025, CW-GR-045, CW-02-016.
 *
 * UPSERTs into case_plan_view_state. Last-write-wins by design (open_question
 * #8) — no expectedVersion parameter, allowed regardless of the owning plan
 * version's status. Never reads or writes semantic_graph/graph_digest.
 */
export async function putViewState(
  planVersionId: string,
  viewType: ViewType,
  viewState: unknown,
  actor: CaseActor
): Promise<PlanViewState> {
  const id = requireNonBlank(planVersionId, 'plan_version_id_required');
  const type = requireEnum(viewType, VIEW_TYPES, 'plan_view_type_invalid');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'plan_actor_required');

  return withPgTransaction(async (client) => {
    const planExists = await client.query<{ case_plan_version_id: string; case_id: string }>(
      `SELECT case_plan_version_id, case_id FROM case_plan_versions WHERE case_plan_version_id = ?`,
      [id]
    );
    const planRow = planExists.rows[0];
    if (!planRow) throw new Error('plan_version_not_found');
    await requireCaseAccessOrPlanVersionNotFound(actorUserId, planRow.case_id);

    const now = new Date().toISOString();
    const upserted = await client.query<CasePlanViewStateRow>(
      `INSERT INTO case_plan_view_state (
         case_plan_version_id, view_type, view_state, updated_at, updated_by_actor_id
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (case_plan_version_id, view_type)
       DO UPDATE SET view_state = EXCLUDED.view_state,
                      updated_at = EXCLUDED.updated_at,
                      updated_by_actor_id = EXCLUDED.updated_by_actor_id
       RETURNING *`,
      [id, type, JSON.stringify(viewState ?? {}), now, actorUserId]
    );
    const upsertedRow = upserted.rows[0];
    if (!upsertedRow) throw new Error('plan_view_state_write_failed');

    // EVENT_TAXONOMY.md §2 `putViewState -> case.plan.view_state_updated`.
    // The aggregate stays the PLAN VERSION even though the row written lives
    // in case_plan_view_state; that table has no `version` column, so
    // aggregateVersion is null (§3) — never the plan version's own counter,
    // which this command does not touch and must not appear to advance.
    //
    // The view state itself (pan/zoom/collapse) is presentation payload, not a
    // fact: it goes behind payloadRef, and only the view type is summarised.
    // §5.8 flags this command as a hot path — if it turns out to fire per
    // interaction rather than per save, it will dominate outbox volume.
    const scope = await loadCaseScope(client, planRow.case_id);
    await publishEvent(client, {
      eventType: 'case.plan.view_state_updated',
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      aggregateType: PLAN_VERSION_AGGREGATE_TYPE,
      aggregateId: upsertedRow.case_plan_version_id,
      aggregateVersion: null,
      caseId: planRow.case_id,
      actorUserId,
      payloadRef: `case_plan_view_state:${upsertedRow.case_plan_version_id}#${upsertedRow.view_type}`,
      redactedSummary: redact({ viewType: upsertedRow.view_type }),
    });

    return mapViewStateRow(upsertedRow);
  });
}
