/**
 * Case Workspace — Case Artifact Link service (CW-P09, EPIC E10 "Artifacts,
 * evidence and deliverables").
 *
 * Backs the `case_workspace_artifact_links` table added in
 * server/migrations/20260809_case_workspace_artifact_links.sql — the typed
 * late-binding pointer from a Case to a native module artifact
 * (document/decision/initiative/kpi/presentation/etc.), per CW-RT-024's
 * literal CaseArtifactLink schema and CW-RT-025's late-binding/
 * history-preservation rules.
 *
 * This table (and this service) stores NO copy of any artifact's business
 * content — only typed pointers (artifact_type, artifact_id, an opaque
 * caller-supplied artifact_revision/digest) plus link lifecycle state. Per
 * the packet's collision-avoidance mandate, this service only ever SELECTs
 * `case_core` (CW-P01) — it never INSERT/UPDATE/DELETEs it, and never
 * references `case_plan_versions`, `case_workspace_capabilities`,
 * `case_workspace_run_bindings`, `case_workspace_action_proposals`,
 * `case_workspace_waits`, `case_workspace_history_events`,
 * `case_workspace_value_measurements`, Finance or Results.
 *
 * Scope for THIS packet: CaseArtifactLink persistence + link/pin-revision/
 * mark-stale/mark-unavailable/unlink/list service only. CW-RT-024's second
 * named schema, EvidenceRecord (evidenceId, caseId, sourceType, sourceId,
 * sourceRevision, contentDigest, relation, provenanceStatus, rightsStatus,
 * classification, capturedAt, capturedBy), is explicitly OUT of scope — see
 * open_questions #1 below. This service also does NOT build a facts-digest
 * aggregator that reads across multiple artifact types and computes one
 * combined digest for a whole Rezultaty view (that needs knowledge of every
 * module's schema, out of scope) — computeArtifactLinkSetDigest() below is
 * explicitly scoped as a digest over this table's own ACTIVE link rows only.
 *
 * req_id coverage (docs/product/case-workspace/acceptance/
 * FUNCTIONAL_REQUIREMENT_COVERAGE.csv, filter epics contains "E10" AND
 * row_id starts with "CW-"):
 *
 *   linkArtifactToCase          -> CW-RT-024, CW-RT-025, CW-00-016,
 *                                   CW-00-020-INV4, CW-01-OD7, CW-01-015,
 *                                   CW-RT-013, CW-RT-054, CW-RT-063,
 *                                   CW-RT-043, CW-GR-033, CW-01-029,
 *                                   CW-CANON-04, CW-DOD-A5
 *   pinArtifactRevision         -> CW-RT-024, CW-RT-025, CW-RT-043,
 *                                   CW-GR-033, CW-01-026-INV9
 *   markLinkStale               -> CW-01-026-INV9, CW-RT-025, CW-DOD-B5
 *   markLinkArtifactUnavailable -> CW-03-017, CW-RT-025
 *   unlinkArtifactFromCase      -> CW-RT-025, CW-RT-054, CW-GR-033, CW-RT-043
 *   getArtifactLink             -> CW-RT-024
 *   listArtifactLinksForCase    -> CW-RT-024, CW-GR-033, CW-02-031,
 *                                   CW-03-017, CW-01-004
 *   computeArtifactLinkSetDigest -> CW-01-026-INV9, CW-02-031
 *
 * Cross-cutting invariants held by every mutating method here (see the
 * migration file's header for the exact canon citations):
 *   - no method in this file ever issues a SQL DELETE against
 *     case_workspace_artifact_links; unlinkArtifactFromCase() and
 *     markLinkArtifactUnavailable() are both UPDATEs to link_status, and the
 *     row (with its full revision_pin_history) remains queryable forever
 *     (CW-RT-025, CW-03-017);
 *   - artifact_revision is only ever appended-to-history-and-then-advanced
 *     (pinArtifactRevision()), never silently overwritten without trace —
 *     revision_pin_history keeps every prior pinned digest;
 *   - relation is a closed 6-value CHECK enum taken verbatim from
 *     CW-RT-024 — the mechanism that keeps source/fact/assumption/
 *     inference/decision distinguishable at the link level (CW-01-026-INV7);
 *   - is_stale is a first-class, independently queryable boolean column,
 *     set only by an explicit markLinkStale() call and cleared only by an
 *     explicit pinArtifactRevision() call (CW-01-026-INV9);
 *   - every mutating method (pin/mark-stale/mark-unavailable/unlink) uses
 *     the same SELECT ... FOR UPDATE + WHERE version = ? optimistic-
 *     concurrency pattern as caseCoreService.ts, and increments version on
 *     success;
 *   - a partial unique index on (case_id, artifact_type, artifact_id,
 *     relation) WHERE link_status='ACTIVE' prevents duplicate concurrently-
 *     active links for the same tuple while still permitting re-linking
 *     after an unlink (CW-01-029) — this service does not pre-check it, the
 *     same posture as createCase() leaning on case_core's own UNIQUE
 *     constraint as ultimate enforcement;
 *   - computeArtifactLinkSetDigest() never reads any table other than
 *     case_workspace_artifact_links itself — it is not a cross-module facts
 *     aggregator, per explicit task scope;
 *   - artifact_id/artifact_type carry no FK — this service never SELECTs,
 *     joins, or otherwise touches any native module's own artifact table.
 *
 * OPEN QUESTIONS (flagged in the approved design, carried forward here — not
 * resolved by this packet, product/API-owner confirmation needed):
 *   1. EvidenceRecord (CW-RT-024's second schema, with provenanceStatus/
 *      rightsStatus/classification) is out of this packet's scope.
 *      CaseArtifactLink and EvidenceRecord look related (both point at a
 *      case + a source + a revision) but are not the same table. Confirm
 *      whether EvidenceRecord is a distinct future packet or should fold
 *      into an extension of this table before any promotion-gating logic is
 *      built on top of it.
 *   2. markLinkArtifactUnavailable() has no route in CW-GR-033's literal
 *      list (POST artifacts, DELETE artifacts/:linkId, POST evidence/pin,
 *      GET artifacts, POST deliverables, POST deliverables/:id/accept).
 *      Confirm whether it's meant to be system/reconciliation-job-only (no
 *      route) or needs a new route added to CW-GR-033.
 *   3. RegisterDeliverable/AcceptDeliverable (CW-RT-043, CW-GR-033) is not
 *      built here. This packet's relation enum includes DELIVERABLE as a
 *      link kind, but "a generated file is not automatically an accepted
 *      deliverable" (CW-00-016) implies a distinct acceptance/status
 *      concept beyond a link row — confirm whether that's a thin wrapper
 *      over this table (e.g. an "accepted" flag on a DELIVERABLE-relation
 *      link) or a separate table in a follow-up packet.
 *   4. Tenant/membership fail-closed checks (CW-RT-065, CW-DOD-D5/D6) are,
 *      per the established convention across every CW-P01-08 service, not
 *      performed at this service layer — no method here takes an
 *      orgId/membership guard parameter. Flag loudly before any of these
 *      methods are wired into a route.
 *   5. confidence in staleness/unavailability is qualitative (free-text
 *      reason only); no severity/urgency scale is modeled. If downstream UI
 *      needs to prioritize stale links, that ranking is not provided here.
 *   6. dedupe_key idempotency on linkArtifactToCase() is designed
 *      defensively (ON CONFLICT DO NOTHING + re-SELECT) but no route layer
 *      exists yet in this packet to confirm callers will actually supply a
 *      stable key consistently.
 *   7. computeArtifactLinkSetDigest()'s tuple shape (artifactType+
 *      artifactId+relation+artifactRevision, ACTIVE rows only) is a design
 *      choice, not dictated by any single req_id — confirm with product/API
 *      owner whether UNLINKED/UNAVAILABLE rows or the is_stale flag should
 *      also factor into the digest before any caller starts comparing
 *      digests across time to detect "has this Case's evidence set
 *      changed".
 */

import { createHash } from 'crypto';

import { v4 as uuidv4 } from 'uuid';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** CW-RT-024's literal 6-value relation enum, verbatim. */
export type ArtifactLinkRelation =
  | 'INPUT'
  | 'OUTPUT'
  | 'EVIDENCE'
  | 'DECISION_BASIS'
  | 'DELIVERABLE'
  | 'OUTCOME_MEASUREMENT';

/** Row lifecycle state (see the migration's column comment). */
export type ArtifactLinkStatus = 'ACTIVE' | 'UNLINKED' | 'UNAVAILABLE';

/**
 * Documented catalog of artifact_type values this codebase's native modules
 * are known to use today. NOT a DB CHECK enum (see the migration's column
 * comment) — a future module may introduce a new kind, or a caller may pass
 * an entirely undocumented one, without a migration. Exported for callers
 * that want type-safe access to the known set; linkArtifactToCase() itself
 * only requires artifactType to be a non-blank string.
 */
export const KNOWN_ARTIFACT_TYPES = [
  'decision',
  'initiative',
  'document',
  'kpi',
  'presentation',
  'task',
  'insight',
  'raid',
  'assessment',
  'process_flow',
  'mind_map',
  'whiteboard',
] as const;

export type KnownArtifactType = (typeof KNOWN_ARTIFACT_TYPES)[number];

export interface RevisionPinHistoryEntry {
  revision: string;
  pinnedAt: string;
  pinnedByActorId: string;
  reason: string | null;
}

interface CaseWorkspaceArtifactLinkRow {
  link_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  artifact_type: string;
  artifact_id: string;
  artifact_revision: string | null;
  revision_pin_history: string;
  relation: ArtifactLinkRelation;
  link_status: ArtifactLinkStatus;
  is_stale: boolean;
  stale_marked_at: string | null;
  stale_marked_by_actor_id: string | null;
  stale_reason: string | null;
  unlinked_at: string | null;
  unlinked_by_actor_id: string | null;
  unlink_reason: string | null;
  unavailable_marked_at: string | null;
  unavailable_marked_by_actor_id: string | null;
  unavailable_reason: string | null;
  linked_by_actor_id: string;
  linked_at: string;
  dedupe_key: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CaseArtifactLink {
  linkId: string;
  organizationId: string;
  projectId: string | null;
  caseId: string;
  artifactType: string;
  artifactId: string;
  artifactRevision: string | null;
  revisionPinHistory: RevisionPinHistoryEntry[];
  relation: ArtifactLinkRelation;
  linkStatus: ArtifactLinkStatus;
  isStale: boolean;
  staleMarkedAt: string | null;
  staleMarkedByActorId: string | null;
  staleReason: string | null;
  unlinkedAt: string | null;
  unlinkedByActorId: string | null;
  unlinkReason: string | null;
  unavailableMarkedAt: string | null;
  unavailableMarkedByActorId: string | null;
  unavailableReason: string | null;
  linkedByActorId: string;
  linkedAt: string;
  dedupeKey: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinkArtifactToCaseInput {
  caseId: string;
  artifactType: string;
  artifactId: string;
  artifactRevision?: string | null;
  relation: ArtifactLinkRelation;
  linkedByActorId: string;
  pinReason?: string | null;
  dedupeKey?: string | null;
}

export interface ArtifactLinkActor {
  actorUserId: string;
}

interface CaseCoreRefRow {
  case_id: string;
  organization_id: string;
  project_id: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARTIFACT_LINK_RELATIONS: readonly ArtifactLinkRelation[] = [
  'INPUT',
  'OUTPUT',
  'EVIDENCE',
  'DECISION_BASIS',
  'DELIVERABLE',
  'OUTCOME_MEASUREMENT',
];

const ARTIFACT_LINK_STATUSES: readonly ArtifactLinkStatus[] = ['ACTIVE', 'UNLINKED', 'UNAVAILABLE'];

// ---------------------------------------------------------------------------
// Local helpers (mirrors caseCoreService.ts/caseHistoryService.ts/
// casePlanVersionService.ts/capabilityRegistryService.ts/
// runBindingService.ts/proposalApprovalService.ts/
// waitSubscriptionService.ts's own local helpers — not imported from there,
// each service file in this directory keeps its own copy per that file's
// existing convention).
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

function parseRevisionPinHistory(raw: string): RevisionPinHistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) return parsed as RevisionPinHistoryEntry[];
  } catch {
    // fall through to empty history below
  }
  return [];
}

function mapRow(row: CaseWorkspaceArtifactLinkRow): CaseArtifactLink {
  return {
    linkId: row.link_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    caseId: row.case_id,
    artifactType: row.artifact_type,
    artifactId: row.artifact_id,
    artifactRevision: row.artifact_revision,
    revisionPinHistory: parseRevisionPinHistory(row.revision_pin_history),
    relation: row.relation,
    linkStatus: row.link_status,
    isStale: Boolean(row.is_stale),
    staleMarkedAt: row.stale_marked_at,
    staleMarkedByActorId: row.stale_marked_by_actor_id,
    staleReason: row.stale_reason,
    unlinkedAt: row.unlinked_at,
    unlinkedByActorId: row.unlinked_by_actor_id,
    unlinkReason: row.unlink_reason,
    unavailableMarkedAt: row.unavailable_marked_at,
    unavailableMarkedByActorId: row.unavailable_marked_by_actor_id,
    unavailableReason: row.unavailable_reason,
    linkedByActorId: row.linked_by_actor_id,
    linkedAt: row.linked_at,
    dedupeKey: row.dedupe_key,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadForUpdate(client: PgTransactionClient, linkId: string): Promise<CaseWorkspaceArtifactLinkRow> {
  const result = await client.query<CaseWorkspaceArtifactLinkRow>(
    `SELECT * FROM case_workspace_artifact_links WHERE link_id = ? FOR UPDATE`,
    [linkId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('artifact_link_not_found');
  return row;
}

function requireActive(row: CaseWorkspaceArtifactLinkRow): void {
  if (row.link_status !== 'ACTIVE') throw new Error('artifact_link_not_active');
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * CW-RT-024 (CaseArtifactLink schema), CW-RT-025 (late binding creates a
 * link, not a copy or ownership transfer), CW-00-016 / CW-00-020-INV4 /
 * CW-01-OD7 / CW-01-015 (artifacts stay owned by their native module; Case
 * only ever references, never forks or copies business truth), CW-RT-013
 * (one Run/one Case-scoped object belongs to exactly one Case — mirrored
 * here for links), CW-RT-054 / CW-RT-063 / CW-CANON-04 / CW-DOD-A5 (artifact
 * links do not change module ownership; late binding shows one module
 * object and one Case link, never a copy), CW-RT-043 (durable command
 * LinkArtifactToCase), CW-GR-033 (POST /api/cases/:caseId/artifacts),
 * CW-01-029 (linked without duplication).
 *
 * Validates caseId/artifactType/artifactId non-blank and relation is one of
 * the 6 literal values. In one transaction: plain SELECT case_core WHERE
 * case_id=? (no lock) for organization_id/project_id + existence check,
 * throws artifact_link_case_not_found if absent (same pattern as
 * recordValueMeasurement in caseHistoryService.ts). INSERTs a new row with
 * link_status='ACTIVE', version=1, linked_by_actor_id/linked_at set; if
 * artifactRevision is supplied, also seeds revision_pin_history with one
 * entry ({revision, pinnedAt: linkedAt, pinnedByActorId: linkedByActorId,
 * reason: pinReason ?? 'linked_with_revision'}) so a revision pinned at
 * link time is captured the same way a later pinArtifactRevision() call
 * would capture it — one history mechanism, not two. Uses the dedupe_key
 * `ON CONFLICT (dedupe_key) DO NOTHING` / re-SELECT idempotent-replay
 * convention. The partial unique index on (case_id, artifact_type,
 * artifact_id, relation) WHERE link_status='ACTIVE' is the ultimate
 * enforcement against duplicate active links for the same tuple
 * (CW-01-029); this method does not pre-check it — a friendlier pre-check
 * could be added but is not required, matching how createCase() leans on
 * its own UNIQUE constraint as ultimate enforcement.
 */
export async function linkArtifactToCase(input: LinkArtifactToCaseInput): Promise<CaseArtifactLink> {
  const caseId = requireNonBlank(input.caseId, 'artifact_link_case_id_required');
  const artifactType = requireNonBlank(input.artifactType, 'artifact_link_artifact_type_required');
  const artifactId = requireNonBlank(input.artifactId, 'artifact_link_artifact_id_required');
  const linkedByActorId = requireNonBlank(input.linkedByActorId, 'artifact_link_linked_by_actor_id_required');
  const relation = requireEnum(input.relation, ARTIFACT_LINK_RELATIONS, 'artifact_link_relation_invalid');
  const artifactRevision = input.artifactRevision ?? null;

  return withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseCoreRefRow>(
      `SELECT case_id, organization_id, project_id FROM case_core WHERE case_id = ?`,
      [caseId]
    );
    const caseRow = caseResult.rows[0];
    if (!caseRow) throw new Error('artifact_link_case_not_found');

    const linkId = `cwlink-${uuidv4()}`;
    const now = new Date().toISOString();
    const dedupeKey = input.dedupeKey ?? null;

    const initialHistory: RevisionPinHistoryEntry[] = artifactRevision
      ? [
          {
            revision: artifactRevision,
            pinnedAt: now,
            pinnedByActorId: linkedByActorId,
            reason: input.pinReason ?? 'linked_with_revision',
          },
        ]
      : [];

    const inserted = await client.query<CaseWorkspaceArtifactLinkRow>(
      `INSERT INTO case_workspace_artifact_links (
         link_id, organization_id, project_id, case_id, artifact_type,
         artifact_id, artifact_revision, revision_pin_history, relation,
         link_status, linked_by_actor_id, linked_at, dedupe_key, version,
         created_at, updated_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, 1, ?, ?
       )
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING *`,
      [
        linkId,
        caseRow.organization_id,
        caseRow.project_id,
        caseId,
        artifactType,
        artifactId,
        artifactRevision,
        JSON.stringify(initialHistory),
        relation,
        linkedByActorId,
        now,
        dedupeKey,
        now,
        now,
      ]
    );

    const row = inserted.rows[0];
    if (row) return mapRow(row);

    // 0 rows only happens when dedupeKey is set and already claimed by a
    // prior insert (NULL dedupe_key values never collide under UNIQUE).
    // Idempotent replay: return the existing row unchanged.
    if (!dedupeKey) throw new Error('artifact_link_insert_failed');
    const existingResult = await client.query<CaseWorkspaceArtifactLinkRow>(
      `SELECT * FROM case_workspace_artifact_links WHERE dedupe_key = ?`,
      [dedupeKey]
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new Error('artifact_link_idempotency_record_not_found');
    return mapRow(existing);
  });
}

/**
 * CW-RT-024, CW-RT-025 (historical decisions retain an immutable
 * revision/digest), CW-RT-043 (durable command
 * PinArtifactRevisionAsEvidence), CW-GR-033 (POST
 * /api/cases/:caseId/evidence/pin), CW-01-026-INV9 (re-pinning is what
 * resolves staleness).
 *
 * loadForUpdate (SELECT ... FOR UPDATE by link_id). Throws
 * artifact_link_not_found if absent; throws artifact_link_not_active if
 * link_status !== 'ACTIVE' (a pin only makes sense against a currently-in-
 * effect link). Appends {revision, pinnedAt: now, pinnedByActorId:
 * actor.actorUserId, reason} to revision_pin_history (prior entries copied
 * forward untouched — append-only), sets artifact_revision=revision, resets
 * is_stale/stale_marked_at/stale_marked_by_actor_id/stale_reason to
 * false/null (re-pinning is what resolves staleness),
 * UPDATE ... WHERE link_id=? AND version=? RETURNING *, throws
 * artifact_link_version_conflict on 0 rows.
 */
export async function pinArtifactRevision(
  linkId: string,
  revision: string,
  actor: ArtifactLinkActor,
  reason?: string | null
): Promise<CaseArtifactLink> {
  const id = requireNonBlank(linkId, 'artifact_link_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'artifact_link_actor_required');
  const nextRevision = requireNonBlank(revision, 'artifact_link_revision_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    requireActive(row);

    const now = new Date().toISOString();
    const history = parseRevisionPinHistory(row.revision_pin_history);
    // Append-only: prior entries are copied forward untouched, only a new
    // entry is added.
    const nextHistory: RevisionPinHistoryEntry[] = [
      ...history,
      { revision: nextRevision, pinnedAt: now, pinnedByActorId: actorUserId, reason: reason ?? null },
    ];

    const updated = await client.query<CaseWorkspaceArtifactLinkRow>(
      `UPDATE case_workspace_artifact_links
          SET artifact_revision = ?, revision_pin_history = ?,
              is_stale = FALSE, stale_marked_at = NULL,
              stale_marked_by_actor_id = NULL, stale_reason = NULL,
              version = version + 1, updated_at = ?
        WHERE link_id = ? AND version = ?
        RETURNING *`,
      [nextRevision, JSON.stringify(nextHistory), now, id, row.version]
    );
    if (!updated.rows[0]) throw new Error('artifact_link_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

/**
 * CW-01-026-INV9 (changed upstream evidence marks downstream work stale),
 * CW-RT-025, CW-DOD-B5 (artifact links read back).
 *
 * loadForUpdate. Throws artifact_link_not_found if absent; throws
 * artifact_link_not_active if link_status !== 'ACTIVE' (an unlinked/
 * unavailable link is no longer in active use downstream, so a fresh
 * staleness flag on it would be meaningless). Sets is_stale=true,
 * stale_marked_at=now, stale_marked_by_actor_id=actor.actorUserId,
 * stale_reason=reason ?? null, increments version. Does NOT touch
 * artifact_revision or revision_pin_history — the immutable pinned digest
 * itself is untouched; only the "is this still current" flag changes. This
 * is the queryable primitive CW-01-026-INV9 asks for: a caller (module-side
 * emitter, reconciliation job, or a future upstream-evidence-changed
 * listener) that learns the source artifact moved past this link's pinned
 * revision calls this to make that fact visible on the Case side, without
 * this service needing any read access into the source module's own
 * revision state.
 */
export async function markLinkStale(
  linkId: string,
  actor: ArtifactLinkActor,
  reason?: string | null
): Promise<CaseArtifactLink> {
  const id = requireNonBlank(linkId, 'artifact_link_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'artifact_link_actor_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    requireActive(row);

    const now = new Date().toISOString();
    const updated = await client.query<CaseWorkspaceArtifactLinkRow>(
      `UPDATE case_workspace_artifact_links
          SET is_stale = TRUE, stale_marked_at = ?, stale_marked_by_actor_id = ?,
              stale_reason = ?, version = version + 1, updated_at = ?
        WHERE link_id = ? AND version = ?
        RETURNING *`,
      [now, actorUserId, reason ?? null, now, id, row.version]
    );
    if (!updated.rows[0]) throw new Error('artifact_link_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

/**
 * CW-03-017 (an unavailable/deleted deliverable source is rendered as
 * unavailable with provenance, not silently removed), CW-RT-025 (unlinking
 * never deletes the artifact).
 *
 * loadForUpdate. Throws artifact_link_not_found if absent; throws
 * artifact_link_not_active if link_status !== 'ACTIVE'. Sets
 * link_status='UNAVAILABLE', unavailable_marked_at=now,
 * unavailable_marked_by_actor_id=actor.actorUserId,
 * unavailable_reason=reason ?? null, increments version. Row is UPDATEd,
 * never DELETEd — the link (and its full revision_pin_history) stays
 * queryable as history, satisfying CW-03-017's "rendered as unavailable
 * with provenance, not silently removed" at the link-row level. Distinct
 * from unlinkArtifactFromCase(): this represents the source going away in
 * its own module (module-detected), not a Case-side decision to stop
 * referencing it.
 */
export async function markLinkArtifactUnavailable(
  linkId: string,
  actor: ArtifactLinkActor,
  reason?: string | null
): Promise<CaseArtifactLink> {
  const id = requireNonBlank(linkId, 'artifact_link_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'artifact_link_actor_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    requireActive(row);

    const now = new Date().toISOString();
    const updated = await client.query<CaseWorkspaceArtifactLinkRow>(
      `UPDATE case_workspace_artifact_links
          SET link_status = 'UNAVAILABLE', unavailable_marked_at = ?,
              unavailable_marked_by_actor_id = ?, unavailable_reason = ?,
              version = version + 1, updated_at = ?
        WHERE link_id = ? AND version = ?
        RETURNING *`,
      [now, actorUserId, reason ?? null, now, id, row.version]
    );
    if (!updated.rows[0]) throw new Error('artifact_link_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

/**
 * CW-RT-025 (late binding creates a link, not a copy or ownership
 * transfer; unlinking never deletes the artifact; historical decisions
 * retain their link even if unlinked later), CW-RT-054 (artifact links do
 * not change module ownership), CW-GR-033 (DELETE
 * /api/cases/:caseId/artifacts/:linkId), CW-RT-043 (durable command
 * UnlinkArtifactFromCase).
 *
 * loadForUpdate. Throws artifact_link_not_found if absent; throws
 * artifact_link_not_active if link_status !== 'ACTIVE'. Sets
 * link_status='UNLINKED', unlinked_at=now,
 * unlinked_by_actor_id=actor.actorUserId, unlink_reason=reason ?? null,
 * increments version. Backs the route DELETE
 * /api/cases/:caseId/artifacts/:linkId (CW-GR-033) — the HTTP verb is
 * DELETE but the SQL operation is UPDATE; no method in this service ever
 * issues a SQL DELETE against this table. Never touches the module's own
 * artifact row (this service has no access to any module's table at all).
 * A later re-link of the same tuple is a fresh linkArtifactToCase() call
 * producing a new link_id; this row remains as immutable history of the
 * earlier link.
 */
export async function unlinkArtifactFromCase(
  linkId: string,
  actor: ArtifactLinkActor,
  reason?: string | null
): Promise<CaseArtifactLink> {
  const id = requireNonBlank(linkId, 'artifact_link_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'artifact_link_actor_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    requireActive(row);

    const now = new Date().toISOString();
    const updated = await client.query<CaseWorkspaceArtifactLinkRow>(
      `UPDATE case_workspace_artifact_links
          SET link_status = 'UNLINKED', unlinked_at = ?,
              unlinked_by_actor_id = ?, unlink_reason = ?,
              version = version + 1, updated_at = ?
        WHERE link_id = ? AND version = ?
        RETURNING *`,
      [now, actorUserId, reason ?? null, now, id, row.version]
    );
    if (!updated.rows[0]) throw new Error('artifact_link_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

/** CW-RT-024. Plain read, no lock, single row by link_id. */
export async function getArtifactLink(linkId: string): Promise<CaseArtifactLink | null> {
  const id = requireNonBlank(linkId, 'artifact_link_id_required');
  const row = await queryOne<CaseWorkspaceArtifactLinkRow>(
    `SELECT * FROM case_workspace_artifact_links WHERE link_id = ?`,
    [id]
  );
  return row ? mapRow(row) : null;
}

/**
 * CW-RT-024, CW-GR-033 (GET /api/cases/:caseId/artifacts), CW-02-031
 * (Rezultaty's required "evidence and lineage" group), CW-03-017 (not
 * silently removed), CW-01-004 (Case exposes references to evidence and
 * native deliverables).
 *
 * Plain read, no lock, WHERE case_id=? plus optional
 * relation/artifactType/linkStatus/isStale filters, ordered by linked_at
 * DESC. Backs GET /api/cases/:caseId/artifacts. Includes UNLINKED/
 * UNAVAILABLE rows unless the caller filters them out explicitly — a
 * Rezultaty-style "lineage" view needs to see the full history, not just
 * what's currently ACTIVE.
 */
export async function listArtifactLinksForCase(
  caseId: string,
  filters?: {
    relation?: ArtifactLinkRelation;
    artifactType?: string;
    linkStatus?: ArtifactLinkStatus;
    isStale?: boolean;
  }
): Promise<CaseArtifactLink[]> {
  const id = requireNonBlank(caseId, 'artifact_link_case_id_required');
  const conditions = ['case_id = ?'];
  const params: unknown[] = [id];

  if (filters?.relation) {
    conditions.push('relation = ?');
    params.push(requireEnum(filters.relation, ARTIFACT_LINK_RELATIONS, 'artifact_link_relation_invalid'));
  }
  if (filters?.artifactType) {
    conditions.push('artifact_type = ?');
    params.push(requireNonBlank(filters.artifactType, 'artifact_link_artifact_type_filter_invalid'));
  }
  if (filters?.linkStatus) {
    conditions.push('link_status = ?');
    params.push(requireEnum(filters.linkStatus, ARTIFACT_LINK_STATUSES, 'artifact_link_status_invalid'));
  }
  if (typeof filters?.isStale === 'boolean') {
    conditions.push('is_stale = ?');
    params.push(filters.isStale);
  }

  const rows = await queryAll<CaseWorkspaceArtifactLinkRow>(
    `SELECT * FROM case_workspace_artifact_links
       WHERE ${conditions.join(' AND ')}
       ORDER BY linked_at DESC`,
    params
  );
  return rows.map(mapRow);
}

export interface ArtifactLinkSetDigest {
  caseId: string;
  digest: string;
  linkCount: number;
  computedAt: string;
}

/**
 * CW-01-026-INV9, CW-02-031. Reads listArtifactLinksForCase(caseId,
 * { linkStatus: 'ACTIVE' }) internally, sorts the results deterministically
 * by (artifactType, artifactId, relation), builds a canonical JSON array of
 * {artifactType, artifactId, relation, artifactRevision} tuples from
 * exactly those sorted rows, and hashes it (`sha256:<hex>`, node:crypto —
 * same digest convention as capabilityRegistryService.computeRequestDigest
 * / casePlanVersionService.computeGraphDigest) into a hex digest string.
 *
 * This is explicitly a digest OVER THIS TABLE'S OWN ACTIVE LINK ROWS — a
 * fingerprint of "which typed pointers, at which pinned revisions, this
 * Case currently holds" — not a facts/content digest computed by reading
 * into Documents, Decisions, KPIs or any other module's own tables (this
 * service has no such access and no such knowledge, per the packet's
 * explicit scope carve-out). Two calls return the same digest iff the
 * ACTIVE link set (tuples + pinned revisions) is unchanged; any pin,
 * unlink, new link, or (implicitly, since is_stale isn't part of the
 * tuple) mark-stale changes it accordingly except pure staleness flips,
 * which are visible via listArtifactLinksForCase()'s isStale filter
 * instead, not via this digest.
 */
export async function computeArtifactLinkSetDigest(caseId: string): Promise<ArtifactLinkSetDigest> {
  const id = requireNonBlank(caseId, 'artifact_link_case_id_required');
  const activeLinks = await listArtifactLinksForCase(id, { linkStatus: 'ACTIVE' });

  const sorted = [...activeLinks].sort((a, b) => {
    if (a.artifactType !== b.artifactType) return a.artifactType < b.artifactType ? -1 : 1;
    if (a.artifactId !== b.artifactId) return a.artifactId < b.artifactId ? -1 : 1;
    if (a.relation !== b.relation) return a.relation < b.relation ? -1 : 1;
    return 0;
  });

  const canonicalTuples = sorted.map((link) => ({
    artifactType: link.artifactType,
    artifactId: link.artifactId,
    relation: link.relation,
    artifactRevision: link.artifactRevision,
  }));

  const json = JSON.stringify(canonicalTuples);
  const digest = `sha256:${createHash('sha256').update(json, 'utf8').digest('hex')}`;

  return {
    caseId: id,
    digest,
    linkCount: sorted.length,
    computedAt: new Date().toISOString(),
  };
}
