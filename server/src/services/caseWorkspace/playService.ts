/**
 * Case Workspace — Play (reusable Process) service (CW-P08, EPIC E12
 * "Reusable Plays").
 *
 * Backs the `process_definitions` and `process_versions` tables added in
 * server/migrations/20260809_case_workspace_plays.sql. Both tables are
 * wholly new (no ALTER TABLE on any pre-existing table). This file only ever
 * SELECTs `organization_members` (the isAuthorizedPublisher() check inside
 * shareProcessDefinition) and calls into casePlanVersionService.createPlanDraft
 * as a plain cross-service function call (instantiateProcessVersion) — it
 * never INSERT/UPDATE/DELETEs case_plan_versions, case_core, or any other
 * pre-existing case_workspace_* table, and never references Finance or
 * Results tables/routes.
 *
 * ProcessDefinition/ProcessVersion is structurally almost identical to
 * CasePlanVersion's own draft/propose/publish/withdraw lifecycle
 * (casePlanVersionService.ts, CW-P02) — same DRAFT->IN_REVIEW->PUBLISHED
 * pattern, same immutable-once-published rule, same semantic_graph +
 * graph_digest idea — and this file mirrors that service's conventions
 * (loadForUpdate + `WHERE ... AND version = expectedVersion` OCC, append-only
 * review_history, local per-file helper duplication) closely on purpose. The
 * key structural difference: a CasePlanVersion belongs to exactly one Case; a
 * ProcessVersion (Play) is reusable and belongs to no Case at all until
 * instantiated via instantiateProcessVersion().
 *
 * req_id coverage (docs/product/case-workspace/acceptance/
 * FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains "E12" — 7 rows):
 *
 *   createProcessDefinition         -> CW-00-018, CW-RT-015
 *   getProcessDefinition            -> CW-RT-014, CW-GR-029
 *   listProcessDefinitions          -> CW-GR-029, CW-GR-030
 *   shareProcessDefinition          -> CW-00-018, CW-RT-015, CW-GR-030
 *   createProcessVersionDraft       -> CW-RT-014, CW-RT-015, CW-RT-028, CW-GR-029
 *   updateProcessVersionDraft       -> CW-RT-028, CW-RT-029
 *   getProcessVersion               -> CW-RT-014, CW-GR-029
 *   listProcessVersionsForDefinition -> CW-GR-029, CW-GR-030
 *   proposeProcessVersion           -> CW-RT-028, CW-GR-029
 *   reviewProcessVersion            -> CW-RT-014, CW-GR-030
 *   publishProcessVersion           -> CW-RT-014, CW-RT-028, CW-RT-029, CW-GR-029, CW-GR-030
 *   deprecateProcessVersion         -> CW-RT-028, CW-RT-029
 *   archiveProcessVersion           -> CW-RT-028, CW-RT-029
 *   instantiateProcessVersion       -> CW-RT-014, CW-RT-029
 *
 * DOMAIN EVENTS (docs/product/case-workspace/acceptance/EVENT_TAXONOMY.md):
 * every mutating command below appends exactly one row to
 * `case_workspace_event_outbox`, from INSIDE that command's own
 * `withPgTransaction()` callback, on that callback's own client — so the
 * process_definitions/process_versions write and its event commit or roll
 * back together. There is no post-commit publish path in this file.
 *
 *   createProcessDefinition   -> process.definition.created   (PROCESS_DEFINITION)
 *   shareProcessDefinition    -> process.definition.shared    (PROCESS_DEFINITION)
 *   createProcessVersionDraft -> process.version.draft_created (PROCESS_VERSION)
 *   updateProcessVersionDraft -> process.version.draft_updated (PROCESS_VERSION)
 *   proposeProcessVersion     -> process.definition.submitted (PROCESS_VERSION)
 *   reviewProcessVersion      -> process.version.reviewed     (PROCESS_VERSION)
 *   publishProcessVersion     -> process.definition.published (PROCESS_VERSION)
 *   deprecateProcessVersion   -> process.definition.deprecated (PROCESS_VERSION)
 *   archiveProcessVersion     -> process.version.archived     (PROCESS_VERSION)
 *   instantiateProcessVersion -> process.version.instantiated  NOT EMITTED, see below
 *
 * `aggregateVersion` is always the POST-mutation `version` taken from the
 * write's own `RETURNING` row (never a re-read, which would be a different
 * value under concurrency). `process_versions.version_number` is the SEMANTIC
 * version and belongs in the summary, not in `aggregateVersion` — the two are
 * different counters on the same row (open question #9). `projectId` is
 * always null: a Play is org-scoped and belongs to no Case or project until
 * instantiated. The read methods (getProcessDefinition/listProcessDefinitions/
 * getProcessVersion/listProcessVersionsForDefinition/computeGraphDigest/
 * isAuthorizedPublisher) emit nothing.
 *
 * Three of the event_types above name `process.definition.*` while the
 * aggregate they carry is a `PROCESS_VERSION`. That asymmetry is EVENT_
 * TAXONOMY §5.4's deliberate, flagged decision (§7 of the canon lists those
 * three strings verbatim), not a typo here, and it must not be "fixed" at a
 * call site — it is an owner decision.
 *
 * instantiateProcessVersion — NO EVENT, DELIBERATELY, AND THIS IS A GAP.
 * The taxonomy asks it for `process.version.instantiated` as the play->Case
 * join point. It cannot be honoured atomically from this file: the command
 * writes nothing to process_definitions/process_versions and opens no
 * transaction of its own — the only mutation is inside
 * casePlanVersionService.createPlanDraft's own `withPgTransaction`, which
 * already publishes `case.plan.draft_created` on that client and exposes no
 * way to join it. Publishing here would mean opening a SECOND transaction
 * after that one committed, i.e. exactly the dual-write hole the outbox
 * exists to close (eventOutboxService header, §12 "kill worker … after
 * domain commit before outbox publication") — so nothing is published rather
 * than something unsound. Closing it requires a change in
 * casePlanVersionService.ts (an optional caller-supplied transaction client
 * on createPlanDraft, or a createPlanDraftOnClient(client, input) export) so
 * both events can be written on one client; that file is owned elsewhere.
 *
 * Cross-cutting invariants held by every mutating method here (see the
 * migration file's header for the exact canon citations):
 *   - a process_versions row is semantically mutable via
 *     updateProcessVersionDraft only while status='DRAFT' — identical rule to
 *     case_plan_versions/updatePlanDraft;
 *   - content (semantic_graph, graph_digest, capability_versions, policy_ref,
 *     required_bindings) is frozen the instant a row leaves DRAFT
 *     (IN_REVIEW/PUBLISHED/DEPRECATED/ARCHIVED are all immutable), mirroring
 *     CW-RT-029/CW-00-020-INV5's precedent;
 *   - deliberate divergence from CasePlanVersion: MULTIPLE PUBLISHED
 *     process_versions may coexist for one process_definition_id (no
 *     partial-unique "one PUBLISHED per aggregate" index) — a reusable Play's
 *     older published versions must stay addressable/instantiate-able for
 *     Cases that already reference them; there is no SUPERSEDED state in
 *     CW-RT-028's stated machine;
 *   - publishProcessVersion (IN_REVIEW -> PUBLISHED) requires a prior
 *     review_decision='APPROVED' written by reviewProcessVersion on the SAME
 *     row/version. status='IN_REVIEW' alone is never sufficient to publish —
 *     this is the concrete mechanism for CW-GR-030's explicit warning against
 *     conflating IN_REVIEW with authorization;
 *   - review_decision/reviewed_by_actor_id/reviewed_at are reset to NULL
 *     whenever a row returns to DRAFT via the CHANGES_REQUESTED path, so a
 *     stale approval can never authorize publishing edited content;
 *   - shareProcessDefinition (visibility PRIVATE -> TEAM/ORGANIZATION,
 *     monotonic widening only) requires the actor to pass
 *     isAuthorizedPublisher() (organization_members.role IN ('OWNER','ADMIN')
 *     for the definition's organization_id). Being the definition's own
 *     owner_actor_id is explicitly NOT sufficient by itself — otherwise
 *     CW-00-018's "requires an authorized publisher or review" clause would
 *     be vacuous, since every creator already owns their own private draft;
 *   - shareProcessDefinition additionally requires at least one PUBLISHED
 *     process_version to exist for the definition before visibility may
 *     widen;
 *   - instantiateProcessVersion only accepts status='PUBLISHED' rows
 *     (DRAFT/IN_REVIEW/DEPRECATED/ARCHIVED all rejected) — this is the
 *     mechanism by which CW-RT-029's "deprecation prevents new instantiation,
 *     never deletes history" is enforced: history rows are untouched, only
 *     new instantiation is blocked;
 *   - instantiateProcessVersion does not duplicate casePlanVersionService's
 *     draft-creation logic. It is a plain cross-service call into
 *     casePlanVersionService.createPlanDraft({caseId, sourceProcessVersionId,
 *     semanticGraph, createdByActorId, changeReason}) — createPlanDraft's
 *     existing input type already accepts sourceProcessVersionId and its
 *     INSERT already writes it into case_plan_versions.source_process_version_id,
 *     so this file needs no change to casePlanVersionService.ts or its
 *     migration;
 *   - every mutating method uses loadForUpdate (SELECT ... FOR UPDATE) plus
 *     `WHERE ... AND version = expectedVersion`; a 0-row UPDATE throws a
 *     `*_conflict` error with no partial write — identical OCC convention to
 *     case_plan_versions;
 *   - process_versions_published_at_consistency /
 *     _deprecated_at_consistency / _archived_at_consistency CHECK
 *     constraints mirror case_plan_versions' own *_at consistency
 *     constraints, keeping status<->timestamp agreement a structural
 *     guarantee rather than an application-discipline one;
 *   - this file performs no ALTER TABLE on case_plan_versions, case_core, any
 *     existing case_workspace_* table, or Finance/Results. process_definitions
 *     and process_versions are two wholly new tables; the only touch point
 *     with pre-existing schema is the read-only cross-service call into
 *     casePlanVersionService.createPlanDraft and an internal read of
 *     organization_members for the authorized-publisher check.
 *
 * OPEN QUESTIONS (flagged in the approved design, carried forward here — not
 * resolved by this packet, product/API-owner confirmation needed):
 *   1. No canon-defined "reviewer" or "process owner as authorizer"
 *      role/vocabulary exists anywhere in this codebase —
 *      organization_members.role is only OWNER/ADMIN/MEMBER/CONSULTANT.
 *      CW-RT-015's exact phrase "authorized process owner, administrator or
 *      reviewer" is only partially modeled: isAuthorizedPublisher() checks
 *      org role IN ('OWNER','ADMIN') alone. Confirm the intended
 *      authorization vocabulary (a dedicated process-owner grant? a REVIEWER
 *      org role? per-definition ACL?) with product/API owner before this
 *      ships in a route.
 *   2. Whether shareProcessDefinition should support narrowing (TEAM/
 *      ORGANIZATION back to PRIVATE, or ORGANIZATION down to TEAM) is
 *      unspecified by canon. This file only implements monotonic widening
 *      (PRIVATE -> TEAM/ORGANIZATION, TEAM -> ORGANIZATION).
 *   3. Whether reviewProcessVersion should forbid self-review (actor ===
 *      created_by_actor_id), at least for definitions already at TEAM/
 *      ORGANIZATION visibility, is unspecified. This file allows self-review
 *      uniformly and relies solely on shareProcessDefinition's role gate to
 *      protect shared visibility — meaning a lone authorized-publisher-role
 *      user could author, review, and publish a shared Play version end to
 *      end alone.
 *   4. CW-RT-028's stated state machine (DRAFT -> IN_REVIEW -> PUBLISHED ->
 *      DEPRECATED -> ARCHIVED; IN_REVIEW -> DRAFT) has no SUPERSEDED state,
 *      unlike CasePlanVersion. Whether publishing a new process_version
 *      should automatically deprecate the definition's prior PUBLISHED
 *      version(s), or whether many PUBLISHED versions are meant to coexist
 *      indefinitely (this file's assumption, addressed individually by
 *      version_number per CW-GR-029's GET .../versions/:version route), needs
 *      product confirmation.
 *   5. RESOLVED (coordinator, post-review): instantiateProcessVersion DOES
 *      verify that the target case_id's organization_id matches the
 *      ProcessVersion's owning process_definition's organization_id, via a
 *      read-only SELECT on case_core (throws process_version_case_
 *      organization_mismatch on mismatch). CW-P02's "reservation" only ever
 *      meant casePlanVersionService.ts does not WRITE case_core — every
 *      sibling service (runBindingService, proposalApprovalService,
 *      caseHistoryService's value measurements) already reads case_core
 *      read-only for its own tenant cross-checks; this follows the same
 *      established, safe pattern.
 *   6. capability_versions / policy_ref / required_bindings on
 *      process_versions have no confirmed JSON shape anywhere in
 *      docs/product/case-workspace/*.md beyond CW-RT-014's one-line mention
 *      ("capability versions, policy and required bindings"). Stored as
 *      free-form JSON/TEXT pending a schema — same open posture CW-P03
 *      already flagged for case_workspace_capabilities.metadata.
 *   7. Whether shareProcessDefinition's hard requirement of >=1 PUBLISHED
 *      process_version before widening visibility is correct, or whether
 *      sharing an all-draft/in-review Play is meaningful (e.g. inviting
 *      collaborators to co-author before anything is published), is
 *      unconfirmed with product.
 *   8. No "team" entity/table was found anywhere in this codebase's schema.
 *      TEAM visibility is modeled as a CHECK-allowed enum value plus a
 *      nullable, FK-less team_id column on process_definitions — needs
 *      product/API-owner confirmation of what a "team" resolves to before
 *      TEAM-scoped listing (CW-GR-029's scope=team) can be implemented for
 *      real; until then TEAM-visibility rows are listable/filterable but
 *      team_id has no verified meaning.
 *   9. CW-RT-016's plan_number/version naming-collision precedent (flagged as
 *      unresolved in casePlanVersionService.ts's own open_questions) is
 *      mirrored here as version_number (domain ordinal) vs. version (OCC
 *      counter) on process_versions. Confirm this naming before it ships in
 *      any public API shape, same flag CW-P02 already carries forward — do
 *      not silently resolve it differently between the two tables.
 */

import { createHash } from 'crypto';

import { v4 as uuidv4 } from 'uuid';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';

import { createPlanDraft } from './casePlanVersionService.js';
import type { CanonicalGraph, CasePlanVersion } from './casePlanVersionService.js';
import { publishEvent, redact } from './eventOutboxService.js';
import {
  CaseWorkspaceAuthError,
  requireCaseAccess,
  requireOrgMember,
  requireOrgRole,
} from './caseWorkspaceAuthContext.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ProcessDefinitionVisibility = 'PRIVATE' | 'TEAM' | 'ORGANIZATION';
export type ProcessVersionStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'DEPRECATED' | 'ARCHIVED';
export type ProcessReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED';
export type ProcessReviewEvent =
  | 'PROPOSED'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'DEPRECATED'
  | 'ARCHIVED';

export interface CaseActor {
  actorUserId: string;
}

export interface ProcessReviewHistoryEntry {
  event: ProcessReviewEvent;
  actorId: string;
  at: string;
  reason?: string;
}

interface ProcessDefinitionRow {
  process_definition_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  visibility: ProcessDefinitionVisibility;
  team_id: string | null;
  owner_actor_id: string;
  shared_at: string | null;
  shared_by_actor_id: string | null;
  created_by_actor_id: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ProcessDefinition {
  processDefinitionId: string;
  organizationId: string;
  name: string;
  description: string | null;
  visibility: ProcessDefinitionVisibility;
  teamId: string | null;
  ownerActorId: string;
  sharedAt: string | null;
  sharedByActorId: string | null;
  createdByActorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ProcessVersionRow {
  process_version_id: string;
  process_definition_id: string;
  version_number: number;
  status: ProcessVersionStatus;
  semantic_graph: string;
  graph_digest: string;
  capability_versions: string;
  policy_ref: string | null;
  required_bindings: string;
  change_reason: string | null;
  review_history: string;
  proposed_at: string | null;
  proposed_by_actor_id: string | null;
  reviewed_at: string | null;
  reviewed_by_actor_id: string | null;
  review_decision: ProcessReviewDecision | null;
  published_at: string | null;
  published_by_actor_id: string | null;
  deprecated_at: string | null;
  deprecated_by_actor_id: string | null;
  deprecation_reason: string | null;
  archived_at: string | null;
  archived_by_actor_id: string | null;
  created_by_actor_id: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ProcessVersion {
  processVersionId: string;
  processDefinitionId: string;
  versionNumber: number;
  status: ProcessVersionStatus;
  semanticGraph: CanonicalGraph;
  graphDigest: string;
  capabilityVersions: unknown[];
  policyRef: string | null;
  requiredBindings: unknown[];
  changeReason: string | null;
  reviewHistory: ProcessReviewHistoryEntry[];
  proposedAt: string | null;
  proposedByActorId: string | null;
  reviewedAt: string | null;
  reviewedByActorId: string | null;
  reviewDecision: ProcessReviewDecision | null;
  publishedAt: string | null;
  publishedByActorId: string | null;
  deprecatedAt: string | null;
  deprecatedByActorId: string | null;
  deprecationReason: string | null;
  archivedAt: string | null;
  archivedByActorId: string | null;
  createdByActorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessDefinitionListPage {
  items: ProcessDefinition[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VISIBILITY_VALUES: readonly ProcessDefinitionVisibility[] = ['PRIVATE', 'TEAM', 'ORGANIZATION'];
const VISIBILITY_RANK: Record<ProcessDefinitionVisibility, number> = {
  PRIVATE: 0,
  TEAM: 1,
  ORGANIZATION: 2,
};

const PROCESS_VERSION_STATUSES: readonly ProcessVersionStatus[] = [
  'DRAFT',
  'IN_REVIEW',
  'PUBLISHED',
  'DEPRECATED',
  'ARCHIVED',
];
const REVIEW_DECISIONS: readonly ProcessReviewDecision[] = ['APPROVED', 'CHANGES_REQUESTED'];

// CW-RT-028: DRAFT -> IN_REVIEW -> PUBLISHED -> DEPRECATED -> ARCHIVED;
// IN_REVIEW -> DRAFT ("changes requested") also reachable. Unlike
// case_plan_versions, no SUPERSEDED state — this map deliberately has no
// entry pointing anywhere from ARCHIVED (terminal) and no
// publish-side-effect equivalent to case_plan_versions' supersede.
const ALLOWED_TRANSITIONS: Record<ProcessVersionStatus, readonly ProcessVersionStatus[]> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['DRAFT', 'PUBLISHED'],
  PUBLISHED: ['DEPRECATED'],
  DEPRECATED: ['ARCHIVED'],
  ARCHIVED: [],
};

// organization_members.role vocabulary this codebase actually has (see
// 20260412_organization_switch_log.sql) — OWNER/ADMIN/MEMBER/CONSULTANT.
// isAuthorizedPublisher() only recognizes OWNER/ADMIN (open_question #1).
const AUTHORIZED_PUBLISHER_ROLES: readonly string[] = ['OWNER', 'ADMIN'];

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

// ---------------------------------------------------------------------------
// Local helpers (mirrors caseCoreService.ts/casePlanVersionService.ts/
// capabilityRegistryService.ts's own local helpers — not imported from
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

function requireGraph(value: CanonicalGraph | null | undefined, reason: string): CanonicalGraph {
  if (!value || typeof value !== 'object') throw new Error(reason);
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) throw new Error(reason);
  if (!Array.isArray(value.entryNodeIds) || !Array.isArray(value.terminalNodeIds)) {
    throw new Error(reason);
  }
  return value;
}

/**
 * EVENT_TAXONOMY §1: a `redactedSummary` holds FACTS, not payloads. Change
 * reasons, deprecation reasons and policy refs are caller-supplied opaque
 * strings; they are bounded here before they reach the envelope, so an
 * oversized caller string can never trip MAX_REDACTED_SUMMARY_BYTES and roll
 * the whole command back. Same helper as artifactLinkService.factText.
 */
function factText(value: string | null | undefined, maxLength = 200): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

/**
 * EVENT_TAXONOMY (casePlanVersionService rows: "graph node/edge counts +
 * graph_digest, never the graph"). The same rule holds for a Play's semantic
 * graph: shape facts and the digest go in the summary, the graph itself stays
 * in the row that `payloadRef` points at.
 */
function graphShapeFacts(graph: CanonicalGraph): Record<string, unknown> {
  return {
    graphSchemaVersion: factText((graph as { schemaVersion?: string }).schemaVersion ?? null),
    nodeCount: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
    edgeCount: Array.isArray(graph.edges) ? graph.edges.length : 0,
    entryNodeCount: Array.isArray(graph.entryNodeIds) ? graph.entryNodeIds.length : 0,
    terminalNodeCount: Array.isArray(graph.terminalNodeIds) ? graph.terminalNodeIds.length : 0,
  };
}

function parseReviewHistory(raw: string): ProcessReviewHistoryEntry[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) return parsed as ProcessReviewHistoryEntry[];
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

function parseJsonArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through to []
  }
  return [];
}

function mapDefinitionRow(row: ProcessDefinitionRow): ProcessDefinition {
  return {
    processDefinitionId: row.process_definition_id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    teamId: row.team_id,
    ownerActorId: row.owner_actor_id,
    sharedAt: row.shared_at,
    sharedByActorId: row.shared_by_actor_id,
    createdByActorId: row.created_by_actor_id,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersionRow(row: ProcessVersionRow): ProcessVersion {
  return {
    processVersionId: row.process_version_id,
    processDefinitionId: row.process_definition_id,
    versionNumber: Number(row.version_number),
    status: row.status,
    semanticGraph: parseGraph(row.semantic_graph),
    graphDigest: row.graph_digest,
    capabilityVersions: parseJsonArray(row.capability_versions),
    policyRef: row.policy_ref,
    requiredBindings: parseJsonArray(row.required_bindings),
    changeReason: row.change_reason,
    reviewHistory: parseReviewHistory(row.review_history),
    proposedAt: row.proposed_at,
    proposedByActorId: row.proposed_by_actor_id,
    reviewedAt: row.reviewed_at,
    reviewedByActorId: row.reviewed_by_actor_id,
    reviewDecision: row.review_decision,
    publishedAt: row.published_at,
    publishedByActorId: row.published_by_actor_id,
    deprecatedAt: row.deprecated_at,
    deprecatedByActorId: row.deprecated_by_actor_id,
    deprecationReason: row.deprecation_reason,
    archivedAt: row.archived_at,
    archivedByActorId: row.archived_by_actor_id,
    createdByActorId: row.created_by_actor_id,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Semantic digest — same canonicalize-then-sha256 algorithm as
// casePlanVersionService.computeGraphDigest, copied locally per this
// directory's own convention (see capabilityRegistryService.ts's
// computeRequestDigest for precedent) rather than imported, so this file has
// no runtime dependency on casePlanVersionService.ts beyond the one
// deliberate cross-service call (createPlanDraft, see instantiateProcessVersion).
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
 * `sha256:<hex>` over the canonicalized semantic_graph — identical algorithm
 * to casePlanVersionService.computeGraphDigest (CW-RT-014 "semantic graph
 * digest").
 */
export function computeGraphDigest(graph: CanonicalGraph): string {
  const canonical = canonicalize(graph);
  const json = JSON.stringify(canonical);
  return `sha256:${createHash('sha256').update(json, 'utf8').digest('hex')}`;
}

// ---------------------------------------------------------------------------
// Row loaders
// ---------------------------------------------------------------------------

async function loadDefinitionForUpdate(
  client: PgTransactionClient,
  processDefinitionId: string
): Promise<ProcessDefinitionRow> {
  const result = await client.query<ProcessDefinitionRow>(
    `SELECT * FROM process_definitions WHERE process_definition_id = ? FOR UPDATE`,
    [processDefinitionId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('process_definition_not_found');
  return row;
}

async function loadVersionForUpdate(
  client: PgTransactionClient,
  processVersionId: string
): Promise<ProcessVersionRow> {
  const result = await client.query<ProcessVersionRow>(
    `SELECT * FROM process_versions WHERE process_version_id = ? FOR UPDATE`,
    [processVersionId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('process_version_not_found');
  return row;
}

/**
 * CW-RT-015/CW-00-018/CW-GR-030's "authorized process owner, administrator or
 * reviewer" — only partially modeled (open_question #1): checks
 * organization_members.role IN ('OWNER','ADMIN') for the given org. Being the
 * ProcessDefinition's own owner_actor_id is deliberately NOT checked here —
 * that would make shareProcessDefinition's authorization requirement vacuous
 * (every creator already owns their own private draft).
 */
export async function isAuthorizedPublisher(actorUserId: string, organizationId: string): Promise<boolean> {
  const userId = requireNonBlank(actorUserId, 'process_actor_required');
  const orgId = requireNonBlank(organizationId, 'process_organization_id_required');
  try {
    await requireOrgRole(userId, orgId, 'ADMIN');
    return true;
  } catch (err) {
    if (err instanceof CaseWorkspaceAuthError) return false;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// ProcessDefinition service methods
// ---------------------------------------------------------------------------

/**
 * CW-00-018, CW-RT-015. Inserts a new process_definitions row. `visibility`
 * is unconditionally forced to 'PRIVATE' server-side regardless of any
 * caller input — satisfies CW-00-018's "every user may create private Play
 * drafts" unconditionally, with no way for a caller to skip straight to
 * shared visibility.
 */
export async function createProcessDefinition(input: {
  organizationId: string;
  name: string;
  description?: string | null;
  ownerActorId: string;
  createdByActorId: string;
}): Promise<ProcessDefinition> {
  const organizationId = requireNonBlank(input.organizationId, 'process_definition_organization_id_required');
  const name = requireNonBlank(input.name, 'process_definition_name_required');
  const ownerActorId = requireNonBlank(input.ownerActorId, 'process_definition_owner_actor_required');
  const createdByActorId = requireNonBlank(input.createdByActorId, 'process_definition_created_by_actor_required');

  await requireOrgMember(createdByActorId, organizationId);

  const processDefinitionId = `procdef-${uuidv4()}`;
  const now = new Date().toISOString();

  // The INSERT was a bare queryOne() before the outbox existed. It is wrapped
  // in withPgTransaction now for one reason only: publishEvent must run on the
  // SAME client as the write (EVENT_TAXONOMY §0), and a bare queryOne has no
  // client to share. The SQL, its parameters and its failure mode are
  // unchanged — this is a transaction boundary, not a behaviour change.
  return withPgTransaction(async (client) => {
    const inserted = await client.query<ProcessDefinitionRow>(
      `INSERT INTO process_definitions (
         process_definition_id, organization_id, name, description, visibility,
         owner_actor_id, created_by_actor_id, version, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'PRIVATE', ?, ?, 1, ?, ?)
       RETURNING *`,
      [processDefinitionId, organizationId, name, input.description ?? null, ownerActorId, createdByActorId, now, now]
    );
    const row = inserted.rows[0];
    if (!row) throw new Error('process_definition_insert_failed');

    // EVENT_TAXONOMY: `process.definition.created`, aggregate
    // PROCESS_DEFINITION. Identity comes from the RETURNING row, never from
    // `input` — `visibility` in particular is forced server-side, so the
    // event reports what was actually stored.
    await publishEvent(client, {
      eventType: 'process.definition.created',
      organizationId: row.organization_id,
      // A Play belongs to no project: it is org-scoped and reusable.
      projectId: null,
      aggregateType: 'PROCESS_DEFINITION',
      aggregateId: row.process_definition_id,
      aggregateVersion: Number(row.version),
      caseId: null,
      actorUserId: row.created_by_actor_id,
      // correlationId omitted on purpose — publishEvent takes the ambient
      // RequestStore correlation id. causationId is null: creating a Play is
      // a first-class user command, not a consequence of another event.
      causationId: null,
      redactedSummary: redact({
        name: factText(row.name),
        hasDescription: row.description !== null,
        visibility: row.visibility,
        ownerActorId: row.owner_actor_id,
        teamId: row.team_id,
      }),
      payloadRef: `process_definitions:${row.process_definition_id}`,
    });

    return mapDefinitionRow(row);
  });
}

/** CW-RT-014, CW-GR-029. Plain read, no lock. */
export async function getProcessDefinition(
  processDefinitionId: string,
  actorUserId: string
): Promise<ProcessDefinition | null> {
  const actor = requireNonBlank(actorUserId, 'process_actor_required');
  const row = await queryOne<ProcessDefinitionRow>(
    `SELECT * FROM process_definitions WHERE process_definition_id = ?`,
    [requireNonBlank(processDefinitionId, 'process_definition_id_required')]
  );
  if (!row) return null;
  await requireOrgMember(actor, row.organization_id);
  return mapDefinitionRow(row);
}

/**
 * CW-GR-029, CW-GR-030. Tenant-scoped (organization_id=? mandatory),
 * keyset-cursor-paginated over (created_at DESC, process_definition_id DESC),
 * optional visibility/ownerActorId filter — backs
 * GET /api/process-definitions?scope=&cursor=.
 */
export async function listProcessDefinitions(
  organizationId: string,
  filters: { visibility?: ProcessDefinitionVisibility; ownerActorId?: string } | undefined,
  pagination: { cursor?: string; limit?: number } | undefined,
  actorUserId: string
): Promise<ProcessDefinitionListPage> {
  const orgId = requireNonBlank(organizationId, 'process_definition_organization_id_required');
  await requireOrgMember(requireNonBlank(actorUserId, 'process_actor_required'), orgId);

  const conditions: string[] = ['organization_id = ?'];
  const params: unknown[] = [orgId];

  if (filters?.visibility) {
    conditions.push('visibility = ?');
    params.push(requireEnum(filters.visibility, VISIBILITY_VALUES, 'process_definition_visibility_invalid'));
  }
  if (filters?.ownerActorId) {
    conditions.push('owner_actor_id = ?');
    params.push(requireNonBlank(filters.ownerActorId, 'process_definition_owner_actor_required'));
  }

  const limit = Math.min(Math.max(pagination?.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);

  if (pagination?.cursor) {
    const [cursorCreatedAt, cursorId] = pagination.cursor.split('::');
    if (!cursorCreatedAt || !cursorId) throw new Error('process_definition_cursor_invalid');
    conditions.push('(created_at, process_definition_id) < (?, ?)');
    params.push(cursorCreatedAt, cursorId);
  }

  const rows = await queryAll<ProcessDefinitionRow>(
    `SELECT * FROM process_definitions
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, process_definition_id DESC
       LIMIT ?`,
    [...params, limit + 1]
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? `${last.created_at}::${last.process_definition_id}` : null;

  return { items: page.map(mapDefinitionRow), nextCursor };
}

/**
 * CW-00-018, CW-RT-015, CW-GR-030. loadForUpdate the definition; rejects if
 * targetVisibility is not a strict widening of the current visibility;
 * requires isAuthorizedPublisher(actor, definition.organizationId); requires
 * >=1 PUBLISHED process_version to exist for this definition; sets
 * visibility/shared_at/shared_by_actor_id, bumps OCC version under
 * `WHERE ... AND version = expectedVersion`.
 */
export async function shareProcessDefinition(
  processDefinitionId: string,
  targetVisibility: 'TEAM' | 'ORGANIZATION',
  actor: CaseActor,
  expectedVersion: number
): Promise<ProcessDefinition> {
  const id = requireNonBlank(processDefinitionId, 'process_definition_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'process_actor_required');
  requireEnum(targetVisibility, ['TEAM', 'ORGANIZATION'] as const, 'process_definition_target_visibility_invalid');

  return withPgTransaction(async (client) => {
    const row = await loadDefinitionForUpdate(client, id);

    if (VISIBILITY_RANK[targetVisibility] <= VISIBILITY_RANK[row.visibility]) {
      throw new Error(`process_definition_share_not_a_widening:${row.visibility}->${targetVisibility}`);
    }

    const authorized = await isAuthorizedPublisher(actorUserId, row.organization_id);
    if (!authorized) throw new Error('process_definition_share_not_authorized');

    const publishedResult = await client.query<{ process_version_id: string }>(
      `SELECT process_version_id FROM process_versions
         WHERE process_definition_id = ? AND status = 'PUBLISHED' LIMIT 1`,
      [id]
    );
    if (!publishedResult.rows[0]) throw new Error('process_definition_share_requires_published_version');

    const now = new Date().toISOString();
    const updated = await client.query<ProcessDefinitionRow>(
      `UPDATE process_definitions
          SET visibility = ?, shared_at = ?, shared_by_actor_id = ?, version = version + 1, updated_at = ?
        WHERE process_definition_id = ? AND version = ?
        RETURNING *`,
      [targetVisibility, now, actorUserId, now, id, expectedVersion]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('process_definition_conflict');

    // EVENT_TAXONOMY: `process.definition.shared`, aggregate
    // PROCESS_DEFINITION. Summary = the scope of the share: what the
    // visibility was, what it became, and who widened it.
    await publishEvent(client, {
      eventType: 'process.definition.shared',
      organizationId: updatedRow.organization_id,
      projectId: null,
      aggregateType: 'PROCESS_DEFINITION',
      aggregateId: updatedRow.process_definition_id,
      aggregateVersion: Number(updatedRow.version),
      caseId: null,
      actorUserId,
      causationId: null,
      redactedSummary: redact({
        from: row.visibility,
        to: updatedRow.visibility,
        teamId: updatedRow.team_id,
        sharedByActorId: updatedRow.shared_by_actor_id,
        ownerActorId: updatedRow.owner_actor_id,
      }),
      payloadRef: `process_definitions:${updatedRow.process_definition_id}`,
    });

    return mapDefinitionRow(updatedRow);
  });
}

// ---------------------------------------------------------------------------
// ProcessVersion service methods
// ---------------------------------------------------------------------------

/**
 * CW-RT-014, CW-RT-015, CW-RT-028, CW-GR-029. Confirms the definition exists
 * (SELECT ... FOR UPDATE on process_definitions, same serialization role as
 * createPlanDraft's case_core lock), computes
 * next version_number = MAX(version_number)+1 for that definition, computes
 * graph_digest via the same canonicalize-then-hash algorithm as
 * computeGraphDigest, inserts status='DRAFT'.
 */
export async function createProcessVersionDraft(input: {
  processDefinitionId: string;
  semanticGraph: CanonicalGraph;
  capabilityVersions?: unknown[];
  policyRef?: string | null;
  requiredBindings?: unknown[];
  changeReason?: string | null;
  createdByActorId: string;
}): Promise<ProcessVersion> {
  const processDefinitionId = requireNonBlank(input.processDefinitionId, 'process_version_definition_id_required');
  const createdByActorId = requireNonBlank(input.createdByActorId, 'process_version_created_by_actor_required');
  const semanticGraph = requireGraph(input.semanticGraph, 'process_version_semantic_graph_invalid');

  return withPgTransaction(async (client) => {
    const definitionRow = await loadDefinitionForUpdate(client, processDefinitionId);
    await requireOrgMember(createdByActorId, definitionRow.organization_id);

    const versionNumberResult = await client.query<{ next_version_number: number }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version_number
         FROM process_versions WHERE process_definition_id = ?`,
      [processDefinitionId]
    );
    const versionNumber = Number(versionNumberResult.rows[0]?.next_version_number ?? 1);

    const graphDigest = computeGraphDigest(semanticGraph);
    const processVersionId = `procv-${uuidv4()}`;
    const now = new Date().toISOString();

    const inserted = await client.query<ProcessVersionRow>(
      `INSERT INTO process_versions (
         process_version_id, process_definition_id, version_number, status,
         semantic_graph, graph_digest, capability_versions, policy_ref,
         required_bindings, change_reason, review_history,
         created_by_actor_id, version, created_at, updated_at
       ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, '[]', ?, 1, ?, ?)
       RETURNING *`,
      [
        processVersionId,
        processDefinitionId,
        versionNumber,
        JSON.stringify(semanticGraph),
        graphDigest,
        JSON.stringify(input.capabilityVersions ?? []),
        input.policyRef ?? null,
        JSON.stringify(input.requiredBindings ?? []),
        input.changeReason ?? null,
        createdByActorId,
        now,
        now,
      ]
    );
    const insertedRow = inserted.rows[0];
    if (!insertedRow) throw new Error('process_version_insert_failed');

    // EVENT_TAXONOMY: `process.version.draft_created`, aggregate
    // PROCESS_VERSION. organization_id is the PARENT DEFINITION's (this table
    // has no organization_id of its own); the parent id itself goes in the
    // summary, as the taxonomy requires. Graph shape + digest only — the
    // graph is behind payloadRef.
    await publishEvent(client, {
      eventType: 'process.version.draft_created',
      organizationId: definitionRow.organization_id,
      projectId: null,
      aggregateType: 'PROCESS_VERSION',
      aggregateId: insertedRow.process_version_id,
      // OCC lock counter, post-insert (= 1). NOT version_number, which is the
      // semantic version and is reported in the summary instead.
      aggregateVersion: Number(insertedRow.version),
      caseId: null,
      actorUserId: insertedRow.created_by_actor_id,
      causationId: null,
      redactedSummary: redact({
        processDefinitionId: insertedRow.process_definition_id,
        versionNumber: Number(insertedRow.version_number),
        status: insertedRow.status,
        graphDigest: insertedRow.graph_digest,
        ...graphShapeFacts(semanticGraph),
        capabilityVersionCount: (input.capabilityVersions ?? []).length,
        requiredBindingCount: (input.requiredBindings ?? []).length,
        policyRef: factText(insertedRow.policy_ref),
        changeReason: factText(insertedRow.change_reason),
      }),
      payloadRef: `process_versions:${insertedRow.process_version_id}`,
    });

    return mapVersionRow(insertedRow);
  });
}

/**
 * CW-RT-028, CW-RT-029. loadForUpdate; rejects unless status='DRAFT';
 * recomputes graph_digest; `WHERE ... AND version = expectedVersion`, a
 * 0-row UPDATE throws process_version_conflict.
 */
export async function updateProcessVersionDraft(
  processVersionId: string,
  input: {
    semanticGraph: CanonicalGraph;
    capabilityVersions?: unknown[];
    policyRef?: string | null;
    requiredBindings?: unknown[];
    expectedVersion: number;
  },
  actor: CaseActor
): Promise<ProcessVersion> {
  const id = requireNonBlank(processVersionId, 'process_version_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'process_actor_required');
  const semanticGraph = requireGraph(input.semanticGraph, 'process_version_semantic_graph_invalid');
  const expectedVersion = input.expectedVersion;
  if (typeof expectedVersion !== 'number') throw new Error('process_version_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadVersionForUpdate(client, id);
    const definitionRow = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM process_definitions WHERE process_definition_id = ?`,
      [row.process_definition_id]
    );
    const organizationId = definitionRow.rows[0]?.organization_id;
    if (!organizationId) throw new Error('process_definition_not_found');
    await requireOrgMember(actorUserId, organizationId);
    if (row.status !== 'DRAFT') throw new Error('process_version_not_editable');

    const graphDigest = computeGraphDigest(semanticGraph);
    const now = new Date().toISOString();

    const updated = await client.query<ProcessVersionRow>(
      `UPDATE process_versions
          SET semantic_graph = ?, graph_digest = ?, capability_versions = ?,
              policy_ref = ?, required_bindings = ?, version = version + 1, updated_at = ?
        WHERE process_version_id = ? AND version = ?
        RETURNING *`,
      [
        JSON.stringify(semanticGraph),
        graphDigest,
        JSON.stringify(input.capabilityVersions ?? row.capability_versions ?? '[]'),
        input.policyRef !== undefined ? input.policyRef : row.policy_ref,
        JSON.stringify(input.requiredBindings ?? row.required_bindings ?? '[]'),
        now,
        id,
        expectedVersion,
      ]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('process_version_conflict');

    // EVENT_TAXONOMY: `process.version.draft_updated`, aggregate
    // PROCESS_VERSION. The new digest plus what changed; the graph itself is
    // behind payloadRef. `graphChanged` is the digest comparison, which is
    // exactly the fact a downstream projection needs and cannot recompute
    // from the event alone.
    await publishEvent(client, {
      eventType: 'process.version.draft_updated',
      organizationId,
      projectId: null,
      aggregateType: 'PROCESS_VERSION',
      aggregateId: updatedRow.process_version_id,
      aggregateVersion: Number(updatedRow.version),
      caseId: null,
      actorUserId,
      causationId: null,
      redactedSummary: redact({
        processDefinitionId: updatedRow.process_definition_id,
        versionNumber: Number(updatedRow.version_number),
        status: updatedRow.status,
        graphDigest: updatedRow.graph_digest,
        previousGraphDigest: row.graph_digest,
        graphChanged: updatedRow.graph_digest !== row.graph_digest,
        ...graphShapeFacts(semanticGraph),
        policyRef: factText(updatedRow.policy_ref),
        policyRefChanged: updatedRow.policy_ref !== row.policy_ref,
      }),
      payloadRef: `process_versions:${updatedRow.process_version_id}`,
    });

    return mapVersionRow(updatedRow);
  });
}

/** CW-RT-014, CW-GR-029. Plain read, no lock. */
export async function getProcessVersion(
  processVersionId: string,
  actorUserId: string
): Promise<ProcessVersion | null> {
  const actor = requireNonBlank(actorUserId, 'process_actor_required');
  const row = await queryOne<ProcessVersionRow>(
    `SELECT * FROM process_versions WHERE process_version_id = ?`,
    [requireNonBlank(processVersionId, 'process_version_id_required')]
  );
  if (!row) return null;
  const definitionRow = await queryOne<{ organization_id: string }>(
    `SELECT organization_id FROM process_definitions WHERE process_definition_id = ?`,
    [row.process_definition_id]
  );
  if (!definitionRow) throw new Error('process_definition_not_found');
  await requireOrgMember(actor, definitionRow.organization_id);
  return mapVersionRow(row);
}

/**
 * CW-GR-029, CW-GR-030. Newest version_number first — backs
 * GET /api/process-definitions/:definitionId/versions/:version address
 * space.
 */
export async function listProcessVersionsForDefinition(
  processDefinitionId: string,
  actorUserId: string
): Promise<ProcessVersion[]> {
  const id = requireNonBlank(processDefinitionId, 'process_version_definition_id_required');
  const definition = await getProcessDefinition(id, actorUserId);
  if (!definition) throw new Error('process_definition_not_found');
  const rows = await queryAll<ProcessVersionRow>(
    `SELECT * FROM process_versions WHERE process_definition_id = ? ORDER BY version_number DESC`,
    [id]
  );
  return rows.map(mapVersionRow);
}

/**
 * CW-RT-028, CW-GR-029. DRAFT -> IN_REVIEW via ALLOWED_TRANSITIONS, appends
 * PROPOSED to review_history, OCC-guarded — same shape as
 * casePlanVersionService.proposePlanVersion.
 */
export async function proposeProcessVersion(
  processVersionId: string,
  actor: CaseActor,
  expectedVersion: number
): Promise<ProcessVersion> {
  const id = requireNonBlank(processVersionId, 'process_version_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'process_actor_required');

  return withPgTransaction(async (client) => {
    const row = await loadVersionForUpdate(client, id);
    const definitionRow = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM process_definitions WHERE process_definition_id = ?`,
      [row.process_definition_id]
    );
    const organizationId = definitionRow.rows[0]?.organization_id;
    if (!organizationId) throw new Error('process_definition_not_found');
    await requireOrgMember(actorUserId, organizationId);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes('IN_REVIEW')) {
      throw new Error(`process_version_status_transition_not_allowed:${row.status}->IN_REVIEW`);
    }

    const now = new Date().toISOString();
    const nextHistory = [
      ...parseReviewHistory(row.review_history),
      { event: 'PROPOSED' as const, actorId: actorUserId, at: now },
    ];

    const updated = await client.query<ProcessVersionRow>(
      `UPDATE process_versions
          SET status = 'IN_REVIEW', review_history = ?, proposed_at = ?,
              proposed_by_actor_id = ?, version = version + 1, updated_at = ?
        WHERE process_version_id = ? AND version = ?
        RETURNING *`,
      [JSON.stringify(nextHistory), now, actorUserId, now, id, expectedVersion]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('process_version_conflict');

    // EVENT_TAXONOMY: `process.definition.submitted` on a PROCESS_VERSION
    // aggregate. The name/aggregate asymmetry is §5.4's flagged, deliberate
    // decision (canon §7 lists this string verbatim) — an owner decision, not
    // something to "correct" here.
    await publishEvent(client, {
      eventType: 'process.definition.submitted',
      organizationId,
      projectId: null,
      aggregateType: 'PROCESS_VERSION',
      aggregateId: updatedRow.process_version_id,
      aggregateVersion: Number(updatedRow.version),
      caseId: null,
      actorUserId,
      causationId: null,
      redactedSummary: redact({
        processDefinitionId: updatedRow.process_definition_id,
        versionNumber: Number(updatedRow.version_number),
        from: row.status,
        to: updatedRow.status,
        graphDigest: updatedRow.graph_digest,
        proposedByActorId: updatedRow.proposed_by_actor_id,
        proposedAt: updatedRow.proposed_at,
      }),
      payloadRef: `process_versions:${updatedRow.process_version_id}`,
    });

    return mapVersionRow(updatedRow);
  });
}

/**
 * CW-RT-014, CW-GR-030. loadForUpdate, requires status='IN_REVIEW'.
 * decision='CHANGES_REQUESTED': transitions IN_REVIEW -> DRAFT (same as
 * casePlanVersionService.requestChangesOnPlanVersion), resets
 * reviewed_at/reviewed_by_actor_id/review_decision to NULL, appends
 * CHANGES_REQUESTED to review_history. decision='APPROVED': status stays
 * IN_REVIEW, sets reviewed_at/reviewed_by_actor_id/review_decision=
 * 'APPROVED', appends an APPROVED-flavored entry to review_history. This is
 * the row that records CW-RT-014's "reviewer", and the explicit
 * authorization record publishProcessVersion checks for.
 */
export async function reviewProcessVersion(
  processVersionId: string,
  actor: CaseActor,
  decision: ProcessReviewDecision,
  reason: string | undefined,
  expectedVersion: number
): Promise<ProcessVersion> {
  const id = requireNonBlank(processVersionId, 'process_version_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'process_actor_required');
  requireEnum(decision, REVIEW_DECISIONS, 'process_version_review_decision_invalid');

  return withPgTransaction(async (client) => {
    const row = await loadVersionForUpdate(client, id);
    const definitionRow = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM process_definitions WHERE process_definition_id = ?`,
      [row.process_definition_id]
    );
    const organizationId = definitionRow.rows[0]?.organization_id;
    if (!organizationId) throw new Error('process_definition_not_found');
    await requireOrgMember(actorUserId, organizationId);
    if (row.status !== 'IN_REVIEW') throw new Error('process_version_not_in_review');

    const now = new Date().toISOString();

    if (decision === 'CHANGES_REQUESTED') {
      const changeReason = requireNonBlank(reason, 'process_version_review_reason_required');
      const nextHistory = [
        ...parseReviewHistory(row.review_history),
        { event: 'CHANGES_REQUESTED' as const, actorId: actorUserId, at: now, reason: changeReason },
      ];

      const updated = await client.query<ProcessVersionRow>(
        `UPDATE process_versions
            SET status = 'DRAFT', review_history = ?,
                reviewed_at = NULL, reviewed_by_actor_id = NULL, review_decision = NULL,
                version = version + 1, updated_at = ?
          WHERE process_version_id = ? AND version = ?
          RETURNING *`,
        [JSON.stringify(nextHistory), now, id, expectedVersion]
      );
      const changesRequestedRow = updated.rows[0];
      if (!changesRequestedRow) throw new Error('process_version_conflict');

      // EVENT_TAXONOMY: `process.version.reviewed` — ONE event_type for this
      // command; the decision itself is a fact in the summary, not a second
      // event name (unlike recordApprovalDecision, whose taxonomy row does
      // enumerate per-decision types).
      await publishEvent(client, {
        eventType: 'process.version.reviewed',
        organizationId,
        projectId: null,
        aggregateType: 'PROCESS_VERSION',
        aggregateId: changesRequestedRow.process_version_id,
        aggregateVersion: Number(changesRequestedRow.version),
        caseId: null,
        actorUserId,
        causationId: null,
        redactedSummary: redact({
          processDefinitionId: changesRequestedRow.process_definition_id,
          versionNumber: Number(changesRequestedRow.version_number),
          decision: 'CHANGES_REQUESTED',
          reviewerActorId: actorUserId,
          from: row.status,
          to: changesRequestedRow.status,
          // The CHANGES_REQUESTED path resets any prior approval — that reset
          // is the fact that stops a stale approval authorizing a publish.
          reviewDecisionCleared: changesRequestedRow.review_decision === null,
          reason: factText(changeReason),
          graphDigest: changesRequestedRow.graph_digest,
        }),
        payloadRef: `process_versions:${changesRequestedRow.process_version_id}`,
      });

      return mapVersionRow(changesRequestedRow);
    }

    // decision === 'APPROVED': status stays IN_REVIEW.
    const nextHistory = [
      ...parseReviewHistory(row.review_history),
      { event: 'APPROVED' as const, actorId: actorUserId, at: now, ...(reason ? { reason } : {}) },
    ];

    const updated = await client.query<ProcessVersionRow>(
      `UPDATE process_versions
          SET reviewed_at = ?, reviewed_by_actor_id = ?, review_decision = 'APPROVED',
              review_history = ?, version = version + 1, updated_at = ?
        WHERE process_version_id = ? AND version = ?
        RETURNING *`,
      [now, actorUserId, JSON.stringify(nextHistory), now, id, expectedVersion]
    );
    const approvedRow = updated.rows[0];
    if (!approvedRow) throw new Error('process_version_conflict');

    await publishEvent(client, {
      eventType: 'process.version.reviewed',
      organizationId,
      projectId: null,
      aggregateType: 'PROCESS_VERSION',
      aggregateId: approvedRow.process_version_id,
      aggregateVersion: Number(approvedRow.version),
      caseId: null,
      actorUserId,
      causationId: null,
      redactedSummary: redact({
        processDefinitionId: approvedRow.process_definition_id,
        versionNumber: Number(approvedRow.version_number),
        decision: 'APPROVED',
        reviewerActorId: approvedRow.reviewed_by_actor_id,
        reviewedAt: approvedRow.reviewed_at,
        // Status deliberately does NOT move on approval — it stays IN_REVIEW
        // until publishProcessVersion. Reporting both makes that visible.
        from: row.status,
        to: approvedRow.status,
        reason: factText(reason ?? null),
        graphDigest: approvedRow.graph_digest,
      }),
      payloadRef: `process_versions:${approvedRow.process_version_id}`,
    });

    return mapVersionRow(approvedRow);
  });
}

/**
 * CW-RT-014, CW-RT-028, CW-RT-029, CW-GR-029, CW-GR-030. IN_REVIEW ->
 * PUBLISHED. Requires status='IN_REVIEW' AND review_decision='APPROVED' (else
 * throws process_version_publish_requires_review — status alone is never
 * sufficient, satisfying CW-GR-030's explicit warning). No supersede
 * side-effect (unlike publishPlanVersion) — multiple PUBLISHED rows may
 * coexist per definition by design. Sets published_at/published_by_actor_id
 * once, appends PUBLISHED to review_history.
 */
export async function publishProcessVersion(
  processVersionId: string,
  actor: CaseActor,
  expectedVersion: number
): Promise<ProcessVersion> {
  const id = requireNonBlank(processVersionId, 'process_version_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'process_actor_required');

  return withPgTransaction(async (client) => {
    const row = await loadVersionForUpdate(client, id);
    const definitionRow = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM process_definitions WHERE process_definition_id = ?`,
      [row.process_definition_id]
    );
    const organizationId = definitionRow.rows[0]?.organization_id;
    if (!organizationId) throw new Error('process_definition_not_found');
    await requireOrgMember(actorUserId, organizationId);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes('PUBLISHED')) {
      throw new Error(`process_version_status_transition_not_allowed:${row.status}->PUBLISHED`);
    }
    if (row.review_decision !== 'APPROVED') {
      throw new Error('process_version_publish_requires_review');
    }

    const now = new Date().toISOString();
    const nextHistory = [
      ...parseReviewHistory(row.review_history),
      { event: 'PUBLISHED' as const, actorId: actorUserId, at: now },
    ];

    const updated = await client.query<ProcessVersionRow>(
      `UPDATE process_versions
          SET status = 'PUBLISHED', published_at = ?, published_by_actor_id = ?,
              review_history = ?, version = version + 1, updated_at = ?
        WHERE process_version_id = ? AND version = ?
        RETURNING *`,
      [now, actorUserId, JSON.stringify(nextHistory), now, id, expectedVersion]
    );
    const publishedRow = updated.rows[0];
    if (!publishedRow) throw new Error('process_version_conflict');

    // EVENT_TAXONOMY: `process.definition.published` on a PROCESS_VERSION
    // aggregate (§5.4 asymmetry, flagged there, kept here). Unlike
    // publishPlanVersion there is NO supersede side-effect, so this command
    // emits exactly one event and never a paired `*.superseded`.
    await publishEvent(client, {
      eventType: 'process.definition.published',
      organizationId,
      projectId: null,
      aggregateType: 'PROCESS_VERSION',
      aggregateId: publishedRow.process_version_id,
      aggregateVersion: Number(publishedRow.version),
      caseId: null,
      actorUserId,
      causationId: null,
      redactedSummary: redact({
        processDefinitionId: publishedRow.process_definition_id,
        versionNumber: Number(publishedRow.version_number),
        from: row.status,
        to: publishedRow.status,
        graphDigest: publishedRow.graph_digest,
        publishedByActorId: publishedRow.published_by_actor_id,
        publishedAt: publishedRow.published_at,
        // The prior explicit approval this publish stands on (CW-GR-030:
        // IN_REVIEW alone is never sufficient).
        reviewDecision: publishedRow.review_decision,
        reviewedByActorId: publishedRow.reviewed_by_actor_id,
      }),
      payloadRef: `process_versions:${publishedRow.process_version_id}`,
    });

    return mapVersionRow(publishedRow);
  });
}

/**
 * CW-RT-028, CW-RT-029. PUBLISHED -> DEPRECATED; sets
 * deprecated_at/deprecated_by_actor_id/deprecation_reason; appends
 * DEPRECATED to review_history; row and all history remain untouched
 * otherwise (CW-RT-029 "never deletes historical evidence").
 */
export async function deprecateProcessVersion(
  processVersionId: string,
  actor: CaseActor,
  reason: string,
  expectedVersion: number
): Promise<ProcessVersion> {
  const id = requireNonBlank(processVersionId, 'process_version_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'process_actor_required');
  const deprecationReason = requireNonBlank(reason, 'process_version_deprecate_reason_required');

  return withPgTransaction(async (client) => {
    const row = await loadVersionForUpdate(client, id);
    const definitionRow = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM process_definitions WHERE process_definition_id = ?`,
      [row.process_definition_id]
    );
    const organizationId = definitionRow.rows[0]?.organization_id;
    if (!organizationId) throw new Error('process_definition_not_found');
    await requireOrgMember(actorUserId, organizationId);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes('DEPRECATED')) {
      throw new Error(`process_version_status_transition_not_allowed:${row.status}->DEPRECATED`);
    }

    const now = new Date().toISOString();
    const nextHistory = [
      ...parseReviewHistory(row.review_history),
      { event: 'DEPRECATED' as const, actorId: actorUserId, at: now, reason: deprecationReason },
    ];

    const updated = await client.query<ProcessVersionRow>(
      `UPDATE process_versions
          SET status = 'DEPRECATED', deprecated_at = ?, deprecated_by_actor_id = ?,
              deprecation_reason = ?, review_history = ?, version = version + 1, updated_at = ?
        WHERE process_version_id = ? AND version = ?
        RETURNING *`,
      [now, actorUserId, deprecationReason, JSON.stringify(nextHistory), now, id, expectedVersion]
    );
    const deprecatedRow = updated.rows[0];
    if (!deprecatedRow) throw new Error('process_version_conflict');

    // EVENT_TAXONOMY: `process.definition.deprecated` on a PROCESS_VERSION
    // aggregate (§5.4 asymmetry). This is the fact CW-RT-029 needs
    // observable: new instantiation is blocked from here on, and nothing
    // historical was deleted.
    await publishEvent(client, {
      eventType: 'process.definition.deprecated',
      organizationId,
      projectId: null,
      aggregateType: 'PROCESS_VERSION',
      aggregateId: deprecatedRow.process_version_id,
      aggregateVersion: Number(deprecatedRow.version),
      caseId: null,
      actorUserId,
      causationId: null,
      redactedSummary: redact({
        processDefinitionId: deprecatedRow.process_definition_id,
        versionNumber: Number(deprecatedRow.version_number),
        from: row.status,
        to: deprecatedRow.status,
        graphDigest: deprecatedRow.graph_digest,
        deprecatedByActorId: deprecatedRow.deprecated_by_actor_id,
        deprecatedAt: deprecatedRow.deprecated_at,
        reason: factText(deprecatedRow.deprecation_reason),
        blocksNewInstantiation: true,
      }),
      payloadRef: `process_versions:${deprecatedRow.process_version_id}`,
    });

    return mapVersionRow(deprecatedRow);
  });
}

/**
 * CW-RT-028, CW-RT-029. DEPRECATED -> ARCHIVED; sets
 * archived_at/archived_by_actor_id; appends ARCHIVED to review_history.
 */
export async function archiveProcessVersion(
  processVersionId: string,
  actor: CaseActor,
  expectedVersion: number
): Promise<ProcessVersion> {
  const id = requireNonBlank(processVersionId, 'process_version_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'process_actor_required');

  return withPgTransaction(async (client) => {
    const row = await loadVersionForUpdate(client, id);
    const definitionRow = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM process_definitions WHERE process_definition_id = ?`,
      [row.process_definition_id]
    );
    const organizationId = definitionRow.rows[0]?.organization_id;
    if (!organizationId) throw new Error('process_definition_not_found');
    await requireOrgMember(actorUserId, organizationId);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes('ARCHIVED')) {
      throw new Error(`process_version_status_transition_not_allowed:${row.status}->ARCHIVED`);
    }

    const now = new Date().toISOString();
    const nextHistory = [
      ...parseReviewHistory(row.review_history),
      { event: 'ARCHIVED' as const, actorId: actorUserId, at: now },
    ];

    const updated = await client.query<ProcessVersionRow>(
      `UPDATE process_versions
          SET status = 'ARCHIVED', archived_at = ?, archived_by_actor_id = ?,
              review_history = ?, version = version + 1, updated_at = ?
        WHERE process_version_id = ? AND version = ?
        RETURNING *`,
      [now, actorUserId, JSON.stringify(nextHistory), now, id, expectedVersion]
    );
    const archivedRow = updated.rows[0];
    if (!archivedRow) throw new Error('process_version_conflict');

    // EVENT_TAXONOMY: `process.version.archived`, aggregate PROCESS_VERSION.
    await publishEvent(client, {
      eventType: 'process.version.archived',
      organizationId,
      projectId: null,
      aggregateType: 'PROCESS_VERSION',
      aggregateId: archivedRow.process_version_id,
      aggregateVersion: Number(archivedRow.version),
      caseId: null,
      actorUserId,
      causationId: null,
      redactedSummary: redact({
        processDefinitionId: archivedRow.process_definition_id,
        versionNumber: Number(archivedRow.version_number),
        from: row.status,
        to: archivedRow.status,
        graphDigest: archivedRow.graph_digest,
        archivedByActorId: archivedRow.archived_by_actor_id,
        archivedAt: archivedRow.archived_at,
      }),
      payloadRef: `process_versions:${archivedRow.process_version_id}`,
    });

    return mapVersionRow(archivedRow);
  });
}

/**
 * CW-RT-014, CW-RT-029. getProcessVersion(processVersionId); throws
 * process_version_not_publishable unless status='PUBLISHED'. Calls
 * casePlanVersionService.createPlanDraft({ caseId, sourceProcessVersionId,
 * semanticGraph, changeReason, createdByActorId }) as a plain cross-service
 * async call (not inside a shared transaction, not duplicating
 * createPlanDraft's own case_core-exists check or plan_number computation)
 * and returns its result verbatim. Does not write to process_versions or
 * process_definitions at all (see open_question #5 for the cross-tenant
 * isolation gap this does not close).
 */
export async function instantiateProcessVersion(
  processVersionId: string,
  caseId: string,
  actor: CaseActor,
  options?: { changeReason?: string | null }
): Promise<CasePlanVersion> {
  const id = requireNonBlank(processVersionId, 'process_version_id_required');
  const targetCaseId = requireNonBlank(caseId, 'process_version_instantiate_case_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'process_actor_required');

  const version = await getProcessVersion(id, actorUserId);
  if (!version) throw new Error('process_version_not_found');
  if (version.status !== 'PUBLISHED') throw new Error('process_version_not_publishable');

  const definition = await queryOne<{ organization_id: string }>(
    `SELECT organization_id FROM process_definitions WHERE process_definition_id = ?`,
    [version.processDefinitionId]
  );
  if (!definition) throw new Error('process_definition_not_found');
  const caseRow = await queryOne<{ organization_id: string }>(
    `SELECT organization_id FROM case_core WHERE case_id = ?`,
    [targetCaseId]
  );
  if (!caseRow) throw new Error('case_not_found');
  if (caseRow.organization_id !== definition.organization_id) {
    throw new Error('process_version_case_organization_mismatch');
  }

  await requireCaseAccess(actorUserId, targetCaseId);

  // EVENT_TAXONOMY asks this command for `process.version.instantiated`
  // (aggregate PROCESS_VERSION, caseId set, the new case_plan_version_id in
  // the summary) and it is NOT emitted. This is a known, deliberate gap, not
  // an oversight: this function writes nothing itself and holds no
  // transaction — the sole mutation happens inside createPlanDraft's own
  // withPgTransaction, which already publishes `case.plan.draft_created` on
  // its client and offers no way to join it. Emitting from here would require
  // a second transaction opened after that one committed, which is precisely
  // the dual-write hole the outbox exists to close, so nothing is emitted
  // rather than something unsound. The fix is a caller-supplied transaction
  // client on casePlanVersionService.createPlanDraft (or a
  // createPlanDraftOnClient(client, input) export) so both events land on one
  // client; that file is owned elsewhere and is not changed by this packet.
  return createPlanDraft({
    caseId: targetCaseId,
    sourceProcessVersionId: version.processVersionId,
    semanticGraph: version.semanticGraph,
    changeReason: options?.changeReason ?? `Instantiated from Play version ${version.processVersionId}`,
    createdByActorId: actorUserId,
  });
}
