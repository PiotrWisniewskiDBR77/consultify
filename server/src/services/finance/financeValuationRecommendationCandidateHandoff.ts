/**
 * FIN-06 — Valuation Advisory Recommendation -> canonical Candidate handoff.
 *
 * Thin source-adapter over the shared `financeCandidateHandoffCore.ts`
 * (Phase 1). This module owns ONLY the Valuation-Recommendation-specific
 * `resolveEligibleSource` / `buildCandidateFields` / `lockSourceRow`
 * closures — locking, idempotency, and the transaction contract all live in
 * the shared core (see that file's header comment). Mirrors
 * `server/src/services/interview/interviewCandidateHandoff.ts`'s role as a
 * thin adapter, but wired through the shared core rather than reimplementing
 * the lock/idempotency machinery inline.
 *
 * ELIGIBILITY GATE — what "eligible" means for this source type, and why:
 *
 * A valuation "advisory recommendation" is NOT an independent DB row. It is
 * a plain object living inside `valuations.advisory` (a JSON blob written
 * once by `generateAdvisory()`, see `valuationService.ts`), addressed only
 * by an `id` string (`rec-<10 hex chars>`) generated at advisory-creation
 * time. There is no `valuation_advisory_recommendations` table, and
 * therefore no independent status/acceptance column on the recommendation
 * object itself — `generateAdvisory()` never writes an "accepted" or
 * "selected" flag onto any individual recommendation.
 *
 * The ONLY gate the pre-existing code
 * (`valuationService.ts#convertAdvisoryRecommendationToInitiative`, read in
 * full before writing this file) applies before converting a recommendation
 * is existence: the parent valuation must exist for the org, and the
 * recommendation id must be found inside that valuation's CURRENT advisory
 * JSON. This module reuses exactly that gate — it does not invent a status
 * field that does not exist on the schema.
 *
 * HONEST AMBIGUITY (documented per FIN-06 instructions, not silently
 * papered over): because "existence in the current advisory JSON" is the
 * only gate, this is a weaker signal than a true acceptance/approval flag.
 * Two consequences worth flagging:
 *   1. `generateAdvisory()` requires the valuation to be `APPROVED` at
 *      GENERATION time, but `setBackToDraftIfApproved()` (called from
 *      `updateAssumptions`) can silently flip the valuation back to `DRAFT`
 *      afterwards WITHOUT clearing the now-stale `advisory` JSON. This
 *      module does not re-check `valuations.status` because the pre-existing
 *      function being replaced never did either — adding a new gate here
 *      would be inventing behavior beyond what "reuse the existing check"
 *      calls for. Flagged as a known, pre-existing gap rather than one this
 *      round introduces.
 *   2. Every recommendation surfaced by `generateAdvisory()` is an
 *      algorithmically-produced suggestion (see the hard-coded
 *      `recommendations` array literal in `generateAdvisory()`), not
 *      something a human explicitly "accepts" one-by-one before this point
 *      — the human acceptance step IS the "convert to initiative" click
 *      itself. So "eligible" here really means "this recommendation id is a
 *      real, currently-live recommendation for an org-scoped valuation",
 *      not "a human has separately marked it accepted".
 *
 * LOCKING: recommendations have no row of their own to lock, so this module
 * locks the PARENT `valuations` row that currently contains the matching
 * recommendation id (`SELECT ... FOR UPDATE` by `valuations.id`), exactly
 * the row `convertAdvisoryRecommendationToInitiative` already reads via
 * `getValuation()`. Because the route surface for this adapter takes only a
 * `recommendationId` (no `valuationId` — see
 * `financeCandidateHandoffValuationRecommendation.routes.ts`), locating
 * which valuation currently owns a given recommendation id requires an
 * org-scoped scan of `valuations.advisory` (recommendation ids are
 * UUID-derived and not namespaced by valuation, so this is a linear search,
 * acceptable at current data volumes — the same shape of scan the org
 * already tolerates nowhere else needing an index). Once the owning
 * valuation is found, only THAT single row is locked.
 */
import type { PinnedTransactionClient } from '../../database/PostgresDatabase.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  computeSourceFingerprint,
  confirmFinanceCandidateHandoff,
  emptySourceSnapshot,
  getFinanceCandidateHandoff,
  previewFinanceCandidateHandoff,
  unknownIfMissing,
  type ConfirmFinanceCandidateHandoffResult,
  type FinanceCandidateFields,
  type FinanceCandidatePreviewResult,
  type FinanceCandidateSourceSnapshot,
} from './financeCandidateHandoffCore.js';

const SOURCE_TYPE = 'finance_valuation_recommendation' as const;

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface ValuationRow {
  id: string;
  project_id: string | null;
  advisory: string | null;
  currency: string | null;
  assumptions: string | Record<string, unknown> | null;
  version: number | null;
}

interface AdvisoryRecommendation {
  id: string;
  title?: string;
  mechanism?: string;
  hypothesis?: string;
  /** Real field on a production-generated recommendation (see `generateAdvisory()`
   *  in `valuationService.ts`) — genuinely absent on a hand-built/legacy advisory. */
  risks?: string[];
}

interface ResolvedRecommendation {
  valuationId: string;
  projectId: string | null;
  recommendation: AdvisoryRecommendation;
  /** Real columns off the SAME `valuations` row the recommendation lives in. */
  currency: string | null;
  assumptions: string | Record<string, unknown> | null;
  version: number | null;
}

// Non-generic on purpose: `PinnedTransactionClient.queryAll`/`queryOne` are
// generic with a `T extends QueryResultRow` constraint while
// `queryHelpers.queryAll`/`queryOne` are generic with an unconstrained `T` —
// the two generic signatures are not mutually assignable to a single
// generic alias. Erasing to `unknown` here and casting at each call site
// (below) sidesteps that mismatch; both real implementations are safely
// callable this way since neither depends on the caller's chosen `T` for
// anything but the return type.
type QueryAll = (sql: string, params?: unknown[]) => Promise<unknown[]>;
type QueryOne = (sql: string, params?: unknown[]) => Promise<unknown>;

/**
 * Org-scoped scan across `valuations` for the one whose CURRENT advisory
 * JSON contains a recommendation with this id. Used both by the unlocked
 * preview path and (via a locking variant of `queryAll`) the first phase of
 * `lockSourceRow`.
 */
async function findRecommendationAcrossValuations(
  queryAll: QueryAll,
  organizationId: string,
  recommendationId: string
): Promise<ResolvedRecommendation | null> {
  const rows = (await queryAll(
    `SELECT id, project_id, advisory, currency, assumptions, version FROM valuations
     WHERE organization_id = ? AND advisory IS NOT NULL`,
    [organizationId]
  )) as ValuationRow[];
  for (const row of rows) {
    const advisory = safeJsonParse<{ recommendations?: AdvisoryRecommendation[] } | null>(
      row.advisory,
      null
    );
    const rec = (advisory?.recommendations || []).find((r) => r?.id === recommendationId);
    if (rec) {
      return {
        valuationId: row.id,
        projectId: row.project_id ?? null,
        recommendation: rec,
        currency: row.currency ?? null,
        assumptions: row.assumptions ?? null,
        version: row.version ?? null,
      };
    }
  }
  return null;
}

/**
 * Re-reads ONE already-known valuation row (used after locking it) and
 * re-derives the recommendation from its (now-locked, freshly-read)
 * advisory JSON — the TOCTOU re-check: if the advisory was regenerated
 * between the unlocked lookup and the lock being acquired, the
 * recommendation id may no longer be present.
 */
async function readRecommendationFromValuation(
  queryOne: QueryOne,
  organizationId: string,
  valuationId: string,
  recommendationId: string
): Promise<ResolvedRecommendation | null> {
  const row = (await queryOne(
    `SELECT id, project_id, advisory, currency, assumptions, version FROM valuations
     WHERE id = ? AND organization_id = ?`,
    [valuationId, organizationId]
  )) as ValuationRow | null;
  if (!row) return null;
  const advisory = safeJsonParse<{ recommendations?: AdvisoryRecommendation[] } | null>(
    row.advisory,
    null
  );
  const rec = (advisory?.recommendations || []).find((r) => r?.id === recommendationId);
  if (!rec) return null;
  return {
    valuationId: row.id,
    projectId: row.project_id ?? null,
    recommendation: rec,
    currency: row.currency ?? null,
    assumptions: row.assumptions ?? null,
    version: row.version ?? null,
  };
}

/**
 * Formats the top-level SCALAR keys of a valuation's `assumptions` JSONB
 * blob (`ValuationAssumptions` in `valuationService.ts`: waccPercent,
 * terminalGrowthPercent, horizonYears, terminalMethod, exitMultiple,
 * netDebt, sharesOutstanding, depth, ...) as real `"key: value"` strings.
 * Nested object fields (`waccBreakdown`, `manualForecast`, `basket`) are
 * skipped — not dropped-and-forgotten data loss, just not flattenable into
 * a single string without this module making formatting choices beyond
 * plain carry-over. Returns `null` (not `[]`) when there are zero scalar
 * keys, matching this column's `NOT NULL DEFAULT '{}'::jsonb` — an empty
 * object here means "not filled in", not "verified zero assumptions".
 */
function formatAssumptions(raw: string | Record<string, unknown> | null): string[] | null {
  if (raw == null) return null;
  let obj: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  } else {
    obj = raw;
  }
  if (!obj || typeof obj !== 'object') return null;
  const lines = Object.entries(obj)
    .filter(([, v]) => v !== null && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'))
    .map(([k, v]) => `${k}: ${v}`);
  return lines.length > 0 ? lines : null;
}

/**
 * Builds the structured, real-values-only `sourceSnapshot` for a resolved
 * valuation advisory recommendation (Codex correction, 2026-08-02 — see
 * `financeCandidateHandoffCore.ts`'s module header). Per this file's own
 * instructions, scoped to what the recommendation object + its parent
 * `valuations` row genuinely contain (confirmed by reading `generateAdvisory()`
 * in full): no npv/irr/roi/payback/capex/opex/scenario field exists on
 * either the recommendation or the valuation row, so those are honestly
 * 'unknown' — this module does NOT equate `results.dcf.enterpriseValue`
 * with "npv", since that would be asserting a characterization of the
 * number this module cannot verify is what a caller means by "NPV".
 */
function buildValuationRecommendationSourceSnapshot(
  data: ResolvedRecommendation
): FinanceCandidateSourceSnapshot {
  const rec = data.recommendation;
  return {
    ...emptySourceSnapshot(),
    currency: unknownIfMissing(data.currency),
    capex: 'unknown',
    opex: 'unknown',
    npv: 'unknown',
    irr: 'unknown',
    roi: 'unknown',
    payback: 'unknown',
    // No scenario/baseline concept stored for a valuation or its recommendations.
    baselineOrScenario: 'unknown',
    assumptions: formatAssumptions(data.assumptions) ?? 'unknown',
    // Real field on a production-generated recommendation; genuinely absent
    // (not merely empty) on some advisory shapes — `undefined` -> 'unknown',
    // a real (possibly empty) array -> carried over as-is.
    risks: Array.isArray(rec.risks) ? rec.risks.map((r) => String(r)) : 'unknown',
    sourceVersion: unknownIfMissing(typeof data.version === 'number' ? String(data.version) : null),
    sourceFingerprint: computeSourceFingerprint({
      recommendationId: rec.id,
      valuationId: data.valuationId,
      title: rec.title,
      mechanism: rec.mechanism,
      hypothesis: rec.hypothesis,
      currency: data.currency,
      version: data.version,
    }),
  };
}

/**
 * Same field mapping `convertAdvisoryRecommendationToInitiative` currently
 * uses to populate its Initiative (`title` <- `rec.title`; `summary` <-
 * `rec.mechanism || rec.hypothesis`; `hypothesis` <- `rec.hypothesis`),
 * redirected into a single `title`/`rationale` pair (Candidates have no
 * separate hypothesis column) — both source fields are preserved in the
 * rationale text rather than dropping the `hypothesis` field on the floor.
 */
function buildCandidateFields(data: ResolvedRecommendation): FinanceCandidateFields {
  const rec = data.recommendation;
  const title = String(rec.title || 'Valuation improvement initiative');
  const mechanism = String(rec.mechanism || '').trim();
  const hypothesis = String(rec.hypothesis || '').trim();
  const parts = [mechanism, hypothesis].filter((p, idx, arr) => p && arr.indexOf(p) === idx);
  const rationale = parts.length
    ? parts.join(' ')
    : 'Promoted from a valuation advisory recommendation.';
  return { title, rationale, sourceSnapshot: buildValuationRecommendationSourceSnapshot(data) };
}

export async function previewValuationRecommendationCandidate(params: {
  organizationId: string;
  recommendationId: string;
}): Promise<FinanceCandidatePreviewResult> {
  const { organizationId, recommendationId } = params;
  return previewFinanceCandidateHandoff<ResolvedRecommendation>({
    organizationId,
    sourceType: SOURCE_TYPE,
    sourceId: recommendationId,
    resolveEligibleSource: async () => {
      const found = await findRecommendationAcrossValuations(
        queryHelpers.queryAll,
        organizationId,
        recommendationId
      );
      if (!found) return { ok: false, reason: 'NOT_FOUND' };
      return { ok: true, data: found };
    },
    buildCandidateFields,
  });
}

export async function confirmValuationRecommendationCandidateHandoff(params: {
  organizationId: string;
  recommendationId: string;
  createdBy?: string | null;
}): Promise<ConfirmFinanceCandidateHandoffResult> {
  const { organizationId, recommendationId, createdBy } = params;

  // Shared across the two core-supplied closures: `lockSourceRow` runs
  // first (per `financeCandidateHandoffCore.ts`'s confirm flow) and is the
  // only place that receives the pinned tx, so it captures both the tx and
  // the id of the valuation it locked for `resolveEligibleSource` (called
  // with no arguments by the core) to reuse.
  let lockedTx: PinnedTransactionClient | null = null;
  let lockedValuationId: string | null = null;

  return confirmFinanceCandidateHandoff<ResolvedRecommendation>({
    organizationId,
    sourceType: SOURCE_TYPE,
    sourceId: recommendationId,
    createdBy: createdBy ?? null,
    lockSourceRow: async (tx) => {
      lockedTx = tx;
      const found = await findRecommendationAcrossValuations(
        tx.queryAll,
        organizationId,
        recommendationId
      );
      if (!found) {
        lockedValuationId = null;
        return;
      }
      // Lock ONLY the single owning valuation row, not the whole scan set.
      await tx.queryOne(
        `SELECT id FROM valuations WHERE id = ? AND organization_id = ? FOR UPDATE`,
        [found.valuationId, organizationId]
      );
      lockedValuationId = found.valuationId;
    },
    resolveEligibleSource: async () => {
      const tx = lockedTx;
      if (!tx || !lockedValuationId) {
        // Defensive — core always calls lockSourceRow before this closure;
        // a null here means lockSourceRow already determined NOT_FOUND.
        return { ok: false, reason: 'NOT_FOUND' };
      }
      const found = await readRecommendationFromValuation(
        tx.queryOne,
        organizationId,
        lockedValuationId,
        recommendationId
      );
      if (!found) return { ok: false, reason: 'NOT_FOUND' };
      return { ok: true, data: found };
    },
    buildCandidateFields,
  });
}

export async function getValuationRecommendationCandidateHandoff(params: {
  organizationId: string;
  recommendationId: string;
}) {
  return getFinanceCandidateHandoff({
    organizationId: params.organizationId,
    sourceType: SOURCE_TYPE,
    sourceId: params.recommendationId,
  });
}
