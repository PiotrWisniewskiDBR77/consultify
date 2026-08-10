/**
 * Finance v3 canonical — lineage FRESHNESS PROPAGATION (AP-11 point 9).
 *
 * ===========================================================================
 * WHAT WAS MISSING (why this file exists)
 * ===========================================================================
 * `server/migrations/20260809_finance_v3_b03_lineage_freshness.sql` created the
 * append-only ledger `finance_lineage_freshness_events` and B01 created the
 * `finance_business_versions.freshness / freshness_reason / stale_since`
 * columns — but until this module, NOTHING in `server/src` ever wrote a single
 * row to that ledger and nothing ever set a version to `STALE_SOURCE` as a
 * consequence of an upstream change. The table and the columns were a
 * FANTOM: schema without a runtime. AP-11 point 9 ("zmiana wersji źródłowej
 * oznacza potomków jako nieaktualnych, BEZ automatycznego przeliczania") was
 * therefore trivially unprovable in either direction — nothing marked, and
 * "nothing recomputes" was true only because nothing happened at all.
 *
 * This module is the missing runtime. Its contract, verbatim from
 * `docs/validation/finance-v3/generated/gate-b/WP-B03_lineage_staleness_ADR.md`
 * section 6:
 *
 *   - §6.2  a new Business Version of an ancestor artifact becoming APPROVED
 *           (superseding the previous one) makes the OLD version's children
 *           `STALE_SOURCE` with reason `NEW_SOURCE_VERSION`; an ancestor being
 *           `INVALIDATED` does the same with the higher-severity reason
 *           `SOURCE_INVALIDATED`.
 *   - §6.3  propagation MARKS, it never recomputes. No step of this algorithm
 *           enqueues a compute job, writes a compute snapshot, or produces a
 *           new business version / working revision. See
 *           `recomputeEnqueued` below — it is a literal `false`, asserted by
 *           the integration test against physical row counts, not a comment.
 *   - §6.3  hard depth limit; overflow must be explicit, never silent.
 *   - §6.4  reason severity ordering — a later, WEAKER reason must not hide an
 *           earlier, more serious one; the weaker event is still recorded in
 *           the ledger (full history) while the version row keeps the stronger
 *           reason.
 *   - §6.3  idempotency — replaying the same event does not "refresh" the age
 *           of the staleness (`stale_since` is preserved).
 *
 * ===========================================================================
 * SYNCHRONOUS, IN THE TRIGGERING TRANSACTION — deliberate deviation from
 * ADR §6.3 phase 2
 * ===========================================================================
 * The ADR splits propagation into a synchronous level-1 pass plus an
 * ASYNCHRONOUS level-2+ job on the WP-B04 persisted queue (`compute_jobs`),
 * to keep `approve` fast for very wide graphs.
 *
 * That second phase is NOT implementable as designed today without recreating
 * exactly the defect this work package exists to remove: `computeJobService`
 * has `enqueue()`/`claim()`, but NOTHING in this codebase runs a worker loop
 * that claims and executes jobs — `claim()` has no production caller. An
 * enqueued `LINEAGE_FRESHNESS_PROPAGATION` job would sit in `compute_jobs`
 * forever, and every descendant at depth >= 2 would silently stay `CURRENT`
 * while the ledger claimed the propagation had been "handed off". That is a
 * phantom of the same shape as the one being fixed.
 *
 * So the full descendant closure is walked synchronously inside the caller's
 * transaction. This is defensible on the ADR's own numbers: the graph depth is
 * structurally <= 6 (§2.1 stage ranks) and the work per node is one
 * single-row `UPDATE` plus one `INSERT` on an unindexed-by-write ledger — no
 * compute, no engine call, no external I/O. Atomicity is a bonus the async
 * design could not offer: freshness can never disagree with the approval that
 * caused it, and a rolled-back approve rolls back its propagation too.
 *
 * The escape hatch the ADR was protecting against (a pathologically wide/deep
 * graph blocking `approve`) is retained and made VISIBLE rather than assumed
 * away: `maxDepth` (default `MAX_PROPAGATION_DEPTH` = 20, the ADR's own
 * number) bounds the walk, and hitting it is reported to the caller
 * (`depthLimitReached` / `truncatedAtVersionIds`) AND written to the ledger as
 * `PROPAGATION_DEPTH_LIMIT_EXCEEDED` rows. If Gate E ever measures a real
 * approve latency problem here, THAT is the moment to build the async phase
 * together with the worker that drains it — not before.
 *
 * `withPinnedPostgresTransaction`, never `DbPromise`: same reasoning as
 * `artifactVersionService.ts`'s header — `DbPromise.run` defaults to
 * `fallback: true` and turns a failed write into a success-shaped no-op. Every
 * write below additionally asserts its own `changes`/returned row, so a
 * zero-row `UPDATE` fails loudly instead of reading like a pass.
 */

import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction, type PinnedTransactionClient } from '../../../database/PostgresDatabase.js';

// ---------------------------------------------------------------------------
// Vocabulary (mirrors the B01 CHECK constraint on finance_business_versions.freshness)
// ---------------------------------------------------------------------------

export type FreshnessState =
  | 'NEVER_COMPUTED'
  | 'CURRENT'
  | 'STALE_SOURCE'
  | 'STALE_ASSUMPTIONS'
  | 'COMPUTE_FAILED';

/** WP-B03 §6.2 reason codes that this propagation algorithm can apply. */
export type FreshnessReasonCode =
  | 'SOURCE_INVALIDATED'
  | 'ASSUMPTION_REGISTRY_CHANGED'
  | 'NEW_SOURCE_VERSION'
  | 'COMPUTE_ERROR';

/** The two states propagation can move a descendant INTO (§6.1/§6.2). */
export type PropagatedFreshnessState = Extract<FreshnessState, 'STALE_SOURCE' | 'STALE_ASSUMPTIONS'>;

/**
 * WP-B03 §6.4 severity ordering:
 * `SOURCE_INVALIDATED` > `ASSUMPTION_REGISTRY_CHANGED` > `NEW_SOURCE_VERSION` > `COMPUTE_ERROR`.
 */
const REASON_PRIORITY: Readonly<Record<FreshnessReasonCode, number>> = {
  SOURCE_INVALIDATED: 40,
  ASSUMPTION_REGISTRY_CHANGED: 30,
  NEW_SOURCE_VERSION: 20,
  COMPUTE_ERROR: 10,
};

/**
 * Priority of whatever is currently stored in `freshness_reason`. That column
 * is free TEXT with no CHECK constraint, and pre-existing rows can legitimately
 * hold something outside this enum (e.g. `exceptionInboxService`'s tests write
 * an arbitrary root-cause string). An unrecognised incumbent reason is treated
 * as the WEAKEST possible value so a real, recognised reason always wins over
 * an opaque one — the alternative (treating unknown as strongest) would let a
 * stray string permanently freeze a version's reason.
 */
export function reasonPriority(reason: string | null | undefined): number {
  if (!reason) return -1;
  const known = REASON_PRIORITY[reason as FreshnessReasonCode];
  return known === undefined ? 0 : known;
}

/** §6.4 — an incoming reason may overwrite the stored one only if it is at least as severe. */
export function reasonOverrides(incoming: FreshnessReasonCode, current: string | null | undefined): boolean {
  return reasonPriority(incoming) >= reasonPriority(current);
}

/** ADR §6.3 step 5 / §10 point 5 — defensive bound, far above the domain's real depth of ~6. */
export const MAX_PROPAGATION_DEPTH = 20;

/**
 * Ledger `reason_code` used for the explicit depth-limit marker rows. Not a
 * `FreshnessReasonCode`: it never lands on `finance_business_versions`, it only
 * records in the append-only ledger that the walk stopped at a node which
 * still had unexplored descendants (requirement 3 — "obsłuż przypadek
 * przekroczenia jawnie, nie po cichu").
 */
export const PROPAGATION_DEPTH_LIMIT_REASON = 'PROPAGATION_DEPTH_LIMIT_EXCEEDED';

// ---------------------------------------------------------------------------
// Params / result
// ---------------------------------------------------------------------------

export interface PropagateStalenessParams {
  organizationId: string;
  /**
   * The version whose CHANGE is the trigger. Its DESCENDANTS get marked; the
   * root itself is never touched (a superseded/invalidated version is not
   * "stale", it is superseded/invalidated — a different axis, §7.2).
   */
  rootVersionId: string;
  reasonCode: FreshnessReasonCode;
  /** §6.1 — defaults to `STALE_SOURCE`, the state for both §6.2 source-change triggers. */
  newState?: PropagatedFreshnessState;
  maxDepth?: number;
}

export interface FreshnessPropagationSummary {
  rootVersionId: string;
  reasonCode: FreshnessReasonCode;
  newState: PropagatedFreshnessState;
  /** Distinct descendant versions reached by the walk (root excluded). */
  visited: number;
  /** Descendants whose `freshness`/`freshness_reason` was actually written. */
  marked: number;
  /** §6.4 — descendants left alone because their stored reason is MORE severe (event still logged). */
  reasonSuppressed: number;
  /** Descendants already in exactly this (state, reason) — true idempotent no-op, no event. */
  unchanged: number;
  /** Physical rows inserted into `finance_lineage_freshness_events` by this call. */
  eventsWritten: number;
  depthLimitReached: boolean;
  /** Versions whose own descendants were NOT explored because `maxDepth` was hit. */
  truncatedAtVersionIds: string[];
  /**
   * ADR §6.3 "Świadomie brak auto-recompute", as a machine-checkable fact
   * rather than prose: this algorithm has no code path that enqueues a compute
   * job or writes a compute output. The integration test asserts this AND the
   * physical absence of new `compute_jobs` / `compute_job_outputs` /
   * `finance_compute_snapshots` / `finance_working_revisions` rows.
   */
  recomputeEnqueued: false;
}

interface FreshnessRow {
  business_version_id: string;
  freshness: FreshnessState;
  freshness_reason: string | null;
  stale_since: string | null;
}

interface EdgeToTarget {
  id: string;
  source_version_id: string;
  target_version_id: string;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Mark every descendant of `rootVersionId` as stale, inside an EXISTING pinned
 * transaction. This is the form the lifecycle triggers in
 * `artifactVersionService` use, so the freshness change commits atomically
 * with the approve/invalidate that caused it.
 *
 * Tenant isolation is enforced twice over: every edge read and every version
 * write carries `organization_id = ?` explicitly, AND `finance_lineage_edges`'
 * composite FKs to `finance_business_versions (business_version_id,
 * organization_id)` make a cross-organization edge physically unstorable
 * (B03 §5). The walk therefore cannot leave the organization even if a caller
 * passes a root belonging to another tenant — it simply finds no edges.
 */
export async function propagateStalenessInTransaction(
  tx: PinnedTransactionClient,
  params: PropagateStalenessParams
): Promise<FreshnessPropagationSummary> {
  const newState: PropagatedFreshnessState = params.newState ?? 'STALE_SOURCE';
  const maxDepth = params.maxDepth ?? MAX_PROPAGATION_DEPTH;
  const { organizationId, rootVersionId, reasonCode } = params;

  const summary: FreshnessPropagationSummary = {
    rootVersionId,
    reasonCode,
    newState,
    visited: 0,
    marked: 0,
    reasonSuppressed: 0,
    unchanged: 0,
    eventsWritten: 0,
    depthLimitReached: false,
    truncatedAtVersionIds: [],
    recomputeEnqueued: false,
  };

  // The root is "visited" from the start: it must never be marked by its own
  // propagation, and it must not be re-entered if a diamond leads back toward
  // it (the DB rank trigger makes true cycles impossible, but the guard is
  // free and makes the walk's termination independent of that trigger).
  const visited = new Set<string>([rootVersionId]);
  let frontier: string[] = [rootVersionId];
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    depth += 1;

    const edges = await tx.queryAll<EdgeToTarget>(
      `SELECT id, source_version_id, target_version_id
         FROM finance_lineage_edges
        WHERE organization_id = ? AND source_version_id = ANY(?)
        ORDER BY created_at ASC, id ASC`,
      [organizationId, frontier]
    );

    const nextFrontier: string[] = [];
    for (const edge of edges) {
      if (visited.has(edge.target_version_id)) continue;
      visited.add(edge.target_version_id);
      nextFrontier.push(edge.target_version_id);
      summary.visited += 1;

      await applyToNode(tx, {
        organizationId,
        edge,
        targetVersionId: edge.target_version_id,
        newState,
        reasonCode,
        summary,
      });
    }

    frontier = nextFrontier;
  }

  // Depth limit: report it only if the frontier genuinely has unexplored
  // outgoing edges. A walk that simply ran out of graph is a normal, complete
  // propagation, not a truncation — claiming otherwise would be the same kind
  // of decorative-but-false signal this module exists to remove.
  if (frontier.length > 0) {
    const unexplored = await tx.queryAll<{ source_version_id: string }>(
      `SELECT DISTINCT source_version_id
         FROM finance_lineage_edges
        WHERE organization_id = ? AND source_version_id = ANY(?)`,
      [organizationId, frontier]
    );
    if (unexplored.length > 0) {
      summary.depthLimitReached = true;
      summary.truncatedAtVersionIds = unexplored.map((r) => r.source_version_id).sort();
      for (const versionId of summary.truncatedAtVersionIds) {
        const row = await readVersion(tx, organizationId, versionId);
        await insertEvent(tx, {
          organizationId,
          triggeringEdgeId: null,
          triggeringVersionId: rootVersionId,
          targetVersionId: versionId,
          previousState: row?.freshness ?? null,
          newState: row?.freshness ?? newState,
          reasonCode: PROPAGATION_DEPTH_LIMIT_REASON,
        });
        summary.eventsWritten += 1;
      }
    }
  }

  return summary;
}

async function readVersion(
  tx: PinnedTransactionClient,
  organizationId: string,
  businessVersionId: string
): Promise<FreshnessRow | null> {
  return tx.queryOne<FreshnessRow>(
    `SELECT business_version_id, freshness, freshness_reason, stale_since
       FROM finance_business_versions
      WHERE business_version_id = ? AND organization_id = ?`,
    [businessVersionId, organizationId]
  );
}

async function applyToNode(
  tx: PinnedTransactionClient,
  args: {
    organizationId: string;
    edge: EdgeToTarget;
    targetVersionId: string;
    newState: PropagatedFreshnessState;
    reasonCode: FreshnessReasonCode;
    summary: FreshnessPropagationSummary;
  }
): Promise<void> {
  const { organizationId, edge, targetVersionId, newState, reasonCode, summary } = args;

  // FOR UPDATE: two concurrent approvals on two different ancestors of the
  // same descendant must not interleave read-decide-write on that descendant's
  // reason (§6.4 would otherwise be decided against a stale read).
  const current = await tx.queryOne<FreshnessRow>(
    `SELECT business_version_id, freshness, freshness_reason, stale_since
       FROM finance_business_versions
      WHERE business_version_id = ? AND organization_id = ?
      FOR UPDATE`,
    [targetVersionId, organizationId]
  );
  if (!current) {
    // Unreachable while the composite FK on finance_lineage_edges holds: an
    // edge cannot point at a version that does not exist in this organization.
    // Fail loud rather than skip — a missing row here means the FK is gone.
    throw new Error(
      `lineageFreshnessService: edge ${edge.id} targets version ${targetVersionId} which does not exist in organization ${organizationId}`
    );
  }

  // Idempotent no-op (§6.3 step 1): identical state AND identical reason ->
  // no UPDATE at all, so `stale_since` keeps the ORIGINAL age of the
  // staleness, and no ledger row (§6.3 step 2 writes "per faktyczną zmianę").
  if (current.freshness === newState && current.freshness_reason === reasonCode) {
    summary.unchanged += 1;
    return;
  }

  // §6.4 — a weaker reason never overwrites a stronger one, but the attempt is
  // still recorded so the ledger keeps the full history.
  if (!reasonOverrides(reasonCode, current.freshness_reason)) {
    await insertEvent(tx, {
      organizationId,
      triggeringEdgeId: edge.id,
      triggeringVersionId: edge.source_version_id,
      targetVersionId,
      previousState: current.freshness,
      newState: current.freshness, // unchanged on purpose — this row documents a SUPPRESSED transition
      reasonCode,
    });
    summary.reasonSuppressed += 1;
    summary.eventsWritten += 1;
    return;
  }

  // `stale_since` = "how long has this been stale", not "when was it last
  // re-flagged". A node already in a stale state keeps its original timestamp
  // even when the reason ESCALATES (§6.3's idempotency intent applied
  // consistently); only a transition from a non-stale state starts the clock.
  //
  // The CAS counter `version` is deliberately NOT bumped: freshness is an
  // annotation about the content, not the content (§6.1), so an analyst
  // holding `expectedVersion` for an edit must not lose their optimistic lock
  // because someone approved an unrelated upstream artifact. `updated_at` is
  // set by `finance_bv_enforce_immutability()` itself (B01 §6 trigger), which
  // also whitelists exactly these three columns for APPROVED rows — that
  // whitelist is what makes marking an APPROVED descendant legal at all.
  const updated = await tx.queryRun(
    `UPDATE finance_business_versions
        SET freshness = ?,
            freshness_reason = ?,
            stale_since = CASE
              WHEN freshness IN ('STALE_SOURCE', 'STALE_ASSUMPTIONS') AND stale_since IS NOT NULL
                THEN stale_since
              ELSE now()
            END
      WHERE business_version_id = ? AND organization_id = ?`,
    [newState, reasonCode, targetVersionId, organizationId]
  );
  if (updated.changes !== 1) {
    throw new Error(
      `lineageFreshnessService: freshness UPDATE affected ${updated.changes} rows for version ${targetVersionId} (expected exactly 1)`
    );
  }

  await insertEvent(tx, {
    organizationId,
    triggeringEdgeId: edge.id,
    triggeringVersionId: edge.source_version_id,
    targetVersionId,
    previousState: current.freshness,
    newState,
    reasonCode,
  });

  summary.marked += 1;
  summary.eventsWritten += 1;

  // NOTE (§6.3): nothing is enqueued here. No compute job, no snapshot, no new
  // working revision. Marking is the entire effect.
}

async function insertEvent(
  tx: PinnedTransactionClient,
  args: {
    organizationId: string;
    triggeringEdgeId: string | null;
    triggeringVersionId: string;
    targetVersionId: string;
    previousState: string | null;
    newState: string;
    reasonCode: string;
  }
): Promise<void> {
  const row = await tx.queryOne<{ id: string }>(
    `INSERT INTO finance_lineage_freshness_events (
       id, organization_id, triggering_edge_id, triggering_version_id,
       target_version_id, previous_state, new_state, reason_code
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [
      uuidv4(),
      args.organizationId,
      args.triggeringEdgeId,
      args.triggeringVersionId,
      args.targetVersionId,
      args.previousState,
      args.newState,
      args.reasonCode,
    ]
  );
  if (!row) throw new Error('finance_lineage_freshness_events insert returned no row');
}

/**
 * Standalone entry point (opens its own transaction) for callers that are not
 * already inside one — e.g. an assumption-registry change
 * (`ASSUMPTION_REGISTRY_CHANGED`, §6.2 row 3), whose owner lives outside the
 * artifact lifecycle.
 */
export async function propagateStaleness(
  params: PropagateStalenessParams
): Promise<FreshnessPropagationSummary> {
  return withPinnedPostgresTransaction((tx) => propagateStalenessInTransaction(tx, params));
}

export interface FreshnessEventRow {
  id: string;
  organization_id: string;
  triggering_edge_id: string | null;
  triggering_version_id: string | null;
  target_version_id: string;
  previous_state: string | null;
  new_state: string;
  reason_code: string;
  created_at: string;
}

/** Read the propagation ledger for one version (newest first) — OWN-FIN-022 "source changed" evidence. */
export async function listFreshnessEvents(
  organizationId: string,
  targetVersionId: string,
  limit = 100
): Promise<FreshnessEventRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<FreshnessEventRow>(
      `SELECT * FROM finance_lineage_freshness_events
        WHERE organization_id = ? AND target_version_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
      [organizationId, targetVersionId, limit]
    )
  );
}
