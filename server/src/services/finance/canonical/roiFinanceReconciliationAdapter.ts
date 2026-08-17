/**
 * Finance v3 canonical — ROI/Finance RECONCILIATION adapter (ROI-E007 Stream C).
 *
 * The Finance-side half of AC-03 ("a reconciliation record, never a silent
 * sync"). Stream B's `roiFinanceLinkAdapter.ts` covers the LINK half of the
 * same seam; this file covers what happens when the two sides of an already
 * pinned link stop agreeing on a NUMBER.
 *
 * HARD RULES this file follows (the reason it exists at all):
 *
 *  1. It NEVER duplicates the canonical SQL. Every write goes through
 *     `roiFinanceReconciliationCommands.openRoiFinanceReconciliation` /
 *     `updateRoiFinanceReconciliationStatus`
 *     (`server/src/services/resultsVnext/roi/`), which own the
 *     `rvn_roi_finance_reconciliations` table
 *     (`server/migrations/20260820_rvn_roi_finance_seam.sql`), its CAS on
 *     `row_version`, and its `rvn_platform_events`/outbox fan-out. This file
 *     contributes decision logic (is this divergence material?) and Finance-
 *     side lookups — not storage.
 *
 *  2. It NEVER writes `roi_realized_values`, `v8_roi_realization_entries` or
 *     `benefit_tracking.actual_*`. Those three stores are physically
 *     append-only for actuals since
 *     `server/migrations/20260809_finance_v3_e007_03_legacy_actual_protection.sql`.
 *     This adapter is the SANCTIONED alternative to overwriting them: the
 *     divergence becomes a row in `rvn_roi_finance_reconciliations`, the
 *     recorded actual stays exactly as it was. There is not a single
 *     INSERT/UPDATE/DELETE against those tables anywhere below — grep it.
 *
 *  3. The two raw reads it does perform (`rvn_roi_cases` by
 *     `(organization_id, initiative_id)`, `rvn_roi_finance_reconciliations`
 *     by its own PK) are documented exceptions, each at its call site, taken
 *     for the same reason Stream B's `getFinanceContextForLink` takes one:
 *     the canonical repository's equivalents
 *     (`roiFinanceLinkRepository.getRoiFinanceReconciliation`) require a
 *     `{userId, organizationId, caseId}` triple for their ABAC visibility
 *     join that these entry points cannot supply — a Finance caller holding
 *     an initiative id or a bare reconciliation id does not yet know the
 *     case id. Both are strictly reads; neither bypasses a write path.
 *
 * MATERIALITY THRESHOLD — final DEC-FIN policy: above 5% opens; exactly 5%
 * remains within tolerance. Callers cannot override the approved boundary.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { listRoiFinanceLinks } from '../../resultsVnext/roi/roiFinanceLinkRepository.js';
import {
  openRoiFinanceReconciliation,
  updateRoiFinanceReconciliationStatus,
} from '../../resultsVnext/roi/roiFinanceReconciliationCommands.js';
import type { CommandAccessContext } from '../../resultsVnext/platform/commandCapabilityGuard.js';
import {
  type RoiFinanceLink,
  type RoiFinanceReconciliation,
  type RoiFinanceReconciliationRow,
  type RoiFinanceReconciliationStatus,
  toRoiFinanceReconciliation,
} from '../../resultsVnext/roi/roiFinanceSeamTypes.js';

// ==========================================
// CONSTANTS
// ==========================================

/**
 * Approved DEC-FIN materiality boundary.
 */
export const FINANCE_RECONCILIATION_MATERIALITY_THRESHOLD_PCT = 5;

/** Terminal decisions a human can record on an open reconciliation. */
export type RoiFinanceReconciliationResolution = Extract<
  RoiFinanceReconciliationStatus,
  'resolved' | 'accepted_divergence'
>;

const DEFAULT_ACTOR_ROLE = 'finance_owner';

// ==========================================
// ERRORS
// ==========================================

export class RoiFinanceReconciliationAdapterError extends Error {
  code: string;
  details: Record<string, unknown>;
  constructor(message: string, code: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'RoiFinanceReconciliationAdapterError';
    this.code = code;
    this.details = details;
  }
}

/** The reconciliation id does not exist (or is not in the asserted org). */
export class ReconciliationNotFoundError extends RoiFinanceReconciliationAdapterError {
  constructor(reconciliationId: string, organizationId?: string) {
    super(
      `rvn_roi_finance_reconciliations row ${reconciliationId} not found` +
        (organizationId ? ` in organization ${organizationId}` : ''),
      'RECONCILIATION_NOT_FOUND',
      { reconciliationId, organizationId: organizationId ?? null }
    );
    this.name = 'ReconciliationNotFoundError';
  }
}

// ==========================================
// MATERIALITY
// ==========================================

export interface MaterialityVerdict {
  /** `|roiValue - financeValue|`. */
  divergenceAbsolute: number;
  /**
   * `divergenceAbsolute / base * 100`, where `base = |roiValue|` when the ROI
   * side is non-zero and `|financeValue|` otherwise. The ROI side is the
   * reference because it is the value the ROI case has already RECORDED —
   * Gate B §7's "5% wartości linii" is 5% of the line as booked, not 5% of
   * whatever Finance now proposes. `null` only when both sides are exactly 0
   * (no line value to take a percentage of, and no divergence either).
   */
  divergencePercent: number | null;
  thresholdPercent: number;
  /** `divergencePercent > thresholdPercent` — a divergence exactly AT the
   * threshold is deliberately NOT material (the threshold is the tolerance
   * band's inclusive edge). */
  material: boolean;
}

/**
 * Pure, side-effect-free. Exported so a caller can ask "would this be
 * material?" (a UI warning, a dry run) without opening anything, and so the
 * rule itself is unit-testable independently of Postgres.
 */
export function assessMateriality(
  roiValue: number,
  financeValue: number,
  thresholdPercent: number = FINANCE_RECONCILIATION_MATERIALITY_THRESHOLD_PCT
): MaterialityVerdict {
  if (!Number.isFinite(roiValue) || !Number.isFinite(financeValue)) {
    throw new RoiFinanceReconciliationAdapterError(
      `assessMateriality requires finite numbers (roiValue=${roiValue}, financeValue=${financeValue})`,
      'INVALID_RECONCILIATION_VALUES',
      { roiValue, financeValue }
    );
  }
  const divergenceAbsolute = Math.abs(roiValue - financeValue);
  const base = Math.abs(roiValue) !== 0 ? Math.abs(roiValue) : Math.abs(financeValue);
  if (base === 0) {
    // Both sides are 0 — identical, nothing to reconcile.
    return { divergenceAbsolute: 0, divergencePercent: null, thresholdPercent, material: false };
  }
  const divergencePercent = (divergenceAbsolute / base) * 100;
  return {
    divergenceAbsolute,
    divergencePercent,
    thresholdPercent,
    material: divergencePercent > thresholdPercent,
  };
}

// ==========================================
// detectAndReconcile
// ==========================================

export interface DetectAndReconcileParams {
  organizationId: string;
  caseId: string;
  /** `rvn_roi_finance_links.link_id` — the pinned link whose two sides diverged. */
  linkId: string;
  /** The value the ROI case holds (the already-recorded truth). */
  roiValue: number;
  /** The value Finance is asserting. */
  financeValue: number;
  actorId: string;
  divergenceReason?: string | null;
  reconciliationKind?: 'proposal' | 'dispute';
  actorEffectiveRole?: string;
  /** Supply a stable key to make a retried detection idempotent. */
  idempotencyKey?: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export interface DetectAndReconcileResult extends MaterialityVerdict {
  /** False when the divergence is within tolerance — nothing was written. */
  reconciliationOpened: boolean;
  reconciliationId: string | null;
  reconciliation: RoiFinanceReconciliation | null;
}

/**
 * Compare the two sides of a pinned link and, ONLY above the materiality
 * threshold, open a canonical reconciliation carrying both explicit scalars
 * (`roi_value`/`finance_value` — the seam's own columns, not a jsonb blob).
 *
 * Below the threshold this is a no-op that writes nothing at all: no row, no
 * event, no outbox entry. "Within tolerance" is not a fact worth a durable
 * record, and manufacturing one would drown the real divergences.
 *
 * Never touches `roi_realized_values` / `v8_roi_realization_entries` /
 * `benefit_tracking` — see this file's header, rule 2.
 */
export async function detectAndReconcile(
  params: DetectAndReconcileParams
): Promise<DetectAndReconcileResult> {
  const {
    organizationId,
    caseId,
    linkId,
    roiValue,
    financeValue,
    actorId,
    divergenceReason = null,
    reconciliationKind = 'dispute',
    actorEffectiveRole = DEFAULT_ACTOR_ROLE,
    idempotencyKey = `roi-fin-reconcile-${randomUUID()}`,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = params;

  const verdict = assessMateriality(
    roiValue,
    financeValue,
    FINANCE_RECONCILIATION_MATERIALITY_THRESHOLD_PCT
  );

  if (!verdict.material) {
    return {
      ...verdict,
      reconciliationOpened: false,
      reconciliationId: null,
      reconciliation: null,
    };
  }

  // Canonical command: validates that `linkId` really belongs to `caseId`
  // (throws `RoiFinanceLinkNotFoundError` otherwise), inserts with
  // status='open', writes the `roi.finance_reconciliation_opened` event and
  // fans it to the outbox — all in one transaction. This adapter does not
  // re-implement any of that.
  const outcome = await openRoiFinanceReconciliation({
    caseId,
    organizationId,
    financeLinkId: linkId,
    roiValue,
    financeValue,
    reconciliationKind,
    divergenceReason: divergenceReason ?? buildDefaultDivergenceReason(verdict),
    actorUserId: actorId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId,
    reason,
    access,
  });

  return {
    ...verdict,
    reconciliationOpened: true,
    reconciliationId: outcome.result.reconciliationId,
    reconciliation: outcome.result,
  };
}

function buildDefaultDivergenceReason(verdict: MaterialityVerdict): string {
  const pct = verdict.divergencePercent === null ? 'n/a' : verdict.divergencePercent.toFixed(2);
  return (
    `Finance value diverges from the recorded ROI value by ${verdict.divergenceAbsolute} ` +
    `(${pct}%), above the ${verdict.thresholdPercent}% DEC-FIN materiality threshold`
  );
}

// ==========================================
// resolveReconciliationDecision
// ==========================================

export interface ResolveReconciliationOptions {
  access: CommandAccessContext;
  /**
   * Tenant assertion. Strongly recommended: when supplied it is ENFORCED
   * (a reconciliation belonging to another organization reads as not found).
   * When omitted the org is derived from the row itself — acceptable only
   * for server-internal callers that obtained the id from a scoped read.
   */
  organizationId?: string;
  /**
   * CAS. When supplied it is passed straight through to the canonical
   * command, which rejects a stale value with `AtomicWriteConflictError`
   * (`STALE_VERSION`). When omitted the CURRENT `row_version` is read
   * immediately before the update — still a real CAS at the DB level (the
   * canonical command re-reads `FOR UPDATE` and compares), but it is a
   * last-writer-wins convenience, NOT optimistic concurrency. UI callers
   * holding a version from a previous read must pass it.
   */
  expectedVersion?: number;
  actorEffectiveRole?: string;
  idempotencyKey?: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/**
 * Record the human decision that closes a reconciliation — either the
 * divergence was fixed ('resolved') or it was reviewed and knowingly kept
 * ('accepted_divergence'). Both are terminal in the canonical model and both
 * fan `roi.finance_reconciliation_resolved` out to the Finance projection.
 *
 * Thin by design: the wrapper's only real work is turning a bare
 * `reconciliationId` into the `{caseId, organizationId, expectedVersion}`
 * triple the canonical command needs. `resolved_by`/`resolved_at` are set by
 * the canonical command, never by this file.
 */
export async function resolveReconciliationDecision(
  reconciliationId: string,
  resolvedBy: string,
  notes: string | null,
  resolution: RoiFinanceReconciliationResolution,
  options: ResolveReconciliationOptions
): Promise<RoiFinanceReconciliation> {
  if (resolution !== 'resolved' && resolution !== 'accepted_divergence') {
    throw new RoiFinanceReconciliationAdapterError(
      `resolveReconciliationDecision accepts only 'resolved' or 'accepted_divergence' (got '${String(resolution)}')`,
      'INVALID_RECONCILIATION_RESOLUTION',
      { reconciliationId, resolution }
    );
  }

  const current = await readReconciliationByPk(reconciliationId);
  if (!current) throw new ReconciliationNotFoundError(reconciliationId, options.organizationId);
  if (options.organizationId && current.organizationId !== options.organizationId) {
    // Cross-tenant reads must be indistinguishable from "does not exist".
    throw new ReconciliationNotFoundError(reconciliationId, options.organizationId);
  }

  const outcome = await updateRoiFinanceReconciliationStatus({
    reconciliationId,
    caseId: current.caseId,
    organizationId: current.organizationId,
    expectedVersion: options.expectedVersion ?? current.rowVersion,
    status: resolution,
    resolutionNotes: notes,
    actorUserId: resolvedBy,
    actorEffectiveRole: options.actorEffectiveRole ?? DEFAULT_ACTOR_ROLE,
    idempotencyKey: options.idempotencyKey ?? `roi-fin-reconcile-resolve-${randomUUID()}`,
    correlationId: options.correlationId,
    causationId: options.causationId ?? null,
    reason: options.reason ?? null,
    access: options.access,
  });

  return outcome.result;
}

// ==========================================
// Finance-side lookups
// ==========================================

export type ReconciliationTargetMissingReason = 'NO_ACTIVE_ROI_CASE' | 'NO_FINANCE_LINK';

export interface ReconciliationTarget {
  caseId: string;
  linkId: string;
  link: RoiFinanceLink;
}

export interface ResolveReconciliationTargetResult {
  target: ReconciliationTarget | null;
  missingReason: ReconciliationTargetMissingReason | null;
}

export interface FindReconciliationTargetParams {
  organizationId: string;
  /** `initiatives.id` — TEXT, per `rvn_roi_cases.initiative_id`'s own type. */
  initiativeId: string;
  /** Required: the canonical link list is ABAC-scoped to this user. */
  userId: string;
  /** Prefer a link with this purpose; falls back to the oldest link. */
  preferredLinkPurpose?: string;
}

/**
 * "Is there anywhere to record this divergence?" — the question a legacy
 * Finance write path has to answer before it can refuse to overwrite an
 * actual. Returns the ROI case + a usable finance link, or an explicit
 * reason why not (never a bare `null` the caller has to guess about).
 *
 * The link list comes from the canonical repository
 * (`listRoiFinanceLinks`), so ABAC visibility applies: a link on a case the
 * user cannot see reads as `NO_FINANCE_LINK`, which is the correct answer
 * for that caller.
 */
export async function findReconciliationTargetForInitiative(
  params: FindReconciliationTargetParams
): Promise<ResolveReconciliationTargetResult> {
  const { organizationId, initiativeId, userId, preferredLinkPurpose } = params;

  const caseId = await findActiveRoiCaseIdForInitiative(organizationId, initiativeId);
  if (!caseId) return { target: null, missingReason: 'NO_ACTIVE_ROI_CASE' };

  const links = await listRoiFinanceLinks({ userId, organizationId, caseId });
  if (links.length === 0) return { target: null, missingReason: 'NO_FINANCE_LINK' };

  const link =
    (preferredLinkPurpose && links.find((l) => l.linkPurpose === preferredLinkPurpose)) || links[0];
  return { target: { caseId, linkId: link.linkId, link }, missingReason: null };
}

/**
 * DOCUMENTED RAW-READ EXCEPTION (header rule 3). `rvn_roi_cases` has no
 * canonical "by initiative id" reader that a Finance caller can use: the ROI
 * repository's list readers all require a visibility-scoped `userId` AND
 * already-known case ids. The predicate below is copied from the seam's own
 * uniqueness rule — `ux_rvn_roi_cases_one_active_per_initiative`
 * (`server/migrations/20260815_rvn_roi_core.sql`) guarantees AT MOST ONE row
 * matches `status NOT IN ('cancelled','closed')` for an
 * (organization_id, initiative_id) pair, so this cannot silently pick one of
 * several. Archived cases are excluded too (`archived_at` is orthogonal to
 * status, ROI-E001 Decision D4): archiving a case is a statement that it
 * should stop receiving new work.
 *
 * Read-only. No FOR UPDATE, no write, no transaction.
 */
export async function findActiveRoiCaseIdForInitiative(
  organizationId: string,
  initiativeId: string
): Promise<string | null> {
  return withReadClient(async (client) => {
    const result = await client.query<{ case_id: string }>(
      `SELECT case_id
         FROM rvn_roi_cases
        WHERE organization_id = $1
          AND initiative_id = $2
          AND archived_at IS NULL
          AND status NOT IN ('cancelled','closed')
        ORDER BY created_at DESC
        LIMIT 1`,
      [organizationId, initiativeId]
    );
    return result.rows[0]?.case_id ?? null;
  });
}

/**
 * DOCUMENTED RAW-READ EXCEPTION (header rule 3). The canonical single-row
 * reader `roiFinanceLinkRepository.getRoiFinanceReconciliation` needs
 * `{userId, organizationId, caseId, reconciliationId}` for its ABAC join;
 * `resolveReconciliationDecision`'s signature has only the id, and the case
 * id is precisely what this read exists to discover. Read-only, PK lookup.
 */
async function readReconciliationByPk(
  reconciliationId: string
): Promise<RoiFinanceReconciliation | null> {
  return withReadClient(async (client) => {
    const result = await client.query<RoiFinanceReconciliationRow>(
      `SELECT * FROM rvn_roi_finance_reconciliations WHERE reconciliation_id = $1`,
      [reconciliationId]
    );
    const row = result.rows[0];
    return row ? toRoiFinanceReconciliation(row) : null;
  });
}

async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
