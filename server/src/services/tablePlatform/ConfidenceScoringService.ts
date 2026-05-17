/**
 * Confidence Scoring Service (Block B · EPIC-T9 · Sprint 3)
 *
 * Computes a per-record AI confidence score (0.00 … 1.00) and writes it to
 * `tp_records.confidence_score`. The score is INTENDED as an "AI confidence"
 * signal — NOT a data-quality measure. UI labels reflect this distinction
 * (B-P1).
 *
 * Algorithm (deterministic, idempotent):
 *
 *   base               = 0.30           (prior — every record starts here)
 *   sourceCountBonus   = clamp(activeSourceCount, 0, 3) × 0.10
 *                                       (0 → 0.00, 1 → 0.10, 2 → 0.20, 3+ → 0.30)
 *   sourceContribution = average(non-null confidence_contribution from sources) × 0.20
 *   verificationBonus  = +0.10 if any active source has last_verified_at
 *                        within the last 30 days, otherwise 0
 *   manualVerifiedBonus= +0.10 if validation_status = 'verified', else 0
 *   flaggedPenalty     = -0.20 if validation_status = 'flagged', else 0
 *
 *   confidence_score   = clamp(base + bonuses + contribution + penalty, 0, 1)
 *
 * All weights are exposed via `CONFIDENCE_WEIGHTS` so calibration in S5 is a
 * one-line change. The function is idempotent: rerunning on an unchanged
 * source set yields the same score.
 *
 * Behaviour:
 *   * Reads `featureFlags.ENABLE_RECORD_PROVENANCE` once per call. When the
 *     flag is OFF the function is a NO-OP and returns
 *     `{ recordId, applied: false, reason: 'feature_disabled' }`.
 *   * Errors are caught at the caller boundary (RecordsService write hook).
 *     This service throws on bad input but logs + propagates DB errors.
 *   * Per-recompute audit is INTENTIONALLY omitted (see B-S0-F3). Validation
 *     status flips are audited by `ValidationStatusService` separately.
 */

import { featureFlags } from '../../config/FeatureFlags.js';
import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

// ── Tunable weights ──────────────────────────────────────────────────────────

export const CONFIDENCE_WEIGHTS = {
  /** Prior; every record starts here. */
  base: 0.3,
  /** Bonus per active source (capped at MAX_SOURCE_COUNT_FOR_BONUS). */
  sourceCount: 0.1,
  /** Hard cap on the source-count bonus (3 → max +0.30). */
  maxSourceCountForBonus: 3,
  /** Multiplier on the average `confidence_contribution` of active sources. */
  sourceContributionMultiplier: 0.2,
  /** Bonus when at least one active source was verified within the freshness window. */
  recentVerification: 0.1,
  /** Freshness window for the verification bonus, in milliseconds (30 days). */
  recentVerificationWindowMs: 30 * 24 * 60 * 60 * 1000,
  /** Bonus when `validation_status = 'verified'`. */
  manualVerified: 0.1,
  /** Penalty when `validation_status = 'flagged'`. */
  flaggedPenalty: -0.2,
} as const;

export interface ConfidenceComponents {
  base: number;
  sourceCountBonus: number;
  sourceContribution: number;
  verificationBonus: number;
  manualVerifiedBonus: number;
  flaggedPenalty: number;
}

export type RecomputeOutcome =
  | { recordId: string; applied: false; reason: 'feature_disabled' | 'record_not_found' }
  | {
      recordId: string;
      applied: true;
      previous: number | null;
      next: number;
      components: ConfidenceComponents;
      activeSourceCount: number;
      validationStatus: 'unverified' | 'verified' | 'flagged';
    };

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const SELECT_RECORD_SQL = `
  SELECT
    r.id,
    r.confidence_score,
    r.validation_status
  FROM   tp_records r
  WHERE  r.id = $1
`;

const SELECT_SOURCES_SQL = `
  SELECT
    confidence_contribution,
    last_verified_at
  FROM   tp_record_sources
  WHERE  record_id = $1 AND archived_at IS NULL
`;

const UPDATE_SCORE_SQL = `
  UPDATE tp_records
     SET confidence_score = $1
   WHERE id = $2
     AND (confidence_score IS DISTINCT FROM $1)
`;

const confidenceScoringService = {
  WEIGHTS: CONFIDENCE_WEIGHTS,

  /**
   * Compute a confidence score in memory from the raw inputs without
   * touching the database. Exposed for unit testing the algorithm in
   * isolation and for telemetry replays.
   */
  computeScore(input: {
    activeSourceContributions: Array<number | null>;
    lastVerifiedAtIsoStrings: Array<string | null>;
    validationStatus: 'unverified' | 'verified' | 'flagged';
    nowMs?: number;
  }): { score: number; components: ConfidenceComponents } {
    const w = CONFIDENCE_WEIGHTS;
    const nowMs = input.nowMs ?? Date.now();

    const sourceCount = input.activeSourceContributions.length;
    const cappedCount = Math.min(sourceCount, w.maxSourceCountForBonus);
    const sourceCountBonus = cappedCount * w.sourceCount;

    const numericContribs = input.activeSourceContributions.filter(
      (c): c is number => typeof c === 'number' && Number.isFinite(c)
    );
    const avgContrib =
      numericContribs.length === 0
        ? 0
        : numericContribs.reduce((a, b) => a + b, 0) / numericContribs.length;
    const sourceContribution = avgContrib * w.sourceContributionMultiplier;

    const hasRecent = input.lastVerifiedAtIsoStrings.some((iso) => {
      if (!iso) return false;
      const t = Date.parse(iso);
      return Number.isFinite(t) && nowMs - t <= w.recentVerificationWindowMs;
    });
    const verificationBonus = hasRecent ? w.recentVerification : 0;

    const manualVerifiedBonus = input.validationStatus === 'verified' ? w.manualVerified : 0;
    const flaggedPenalty = input.validationStatus === 'flagged' ? w.flaggedPenalty : 0;

    const components: ConfidenceComponents = {
      base: w.base,
      sourceCountBonus,
      sourceContribution,
      verificationBonus,
      manualVerifiedBonus,
      flaggedPenalty,
    };

    const score = clamp01(
      components.base +
        components.sourceCountBonus +
        components.sourceContribution +
        components.verificationBonus +
        components.manualVerifiedBonus +
        components.flaggedPenalty
    );

    return { score: round2(score), components };
  },

  /**
   * Recompute and persist `confidence_score` for a single record.
   * Returns `{applied: false}` when the feature flag is OFF or when the
   * record does not exist (caller side-effect-free).
   */
  async recompute(recordId: string): Promise<RecomputeOutcome> {
    if (!recordId || typeof recordId !== 'string') {
      throw new Error('recordId is required');
    }
    if (!featureFlags.ENABLE_RECORD_PROVENANCE) {
      return { recordId, applied: false, reason: 'feature_disabled' };
    }

    const db = getDatabase();
    const recordResult = await db.query(SELECT_RECORD_SQL, [recordId]);
    const recordRow = recordResult.rows[0] as
      | {
          id: string;
          confidence_score: number | string | null;
          validation_status: 'unverified' | 'verified' | 'flagged' | null;
        }
      | undefined;
    if (!recordRow) {
      return { recordId, applied: false, reason: 'record_not_found' };
    }

    const sourcesResult = await db.query(SELECT_SOURCES_SQL, [recordId]);
    const rows = sourcesResult.rows as Array<{
      confidence_contribution: number | string | null;
      last_verified_at: Date | string | null;
    }>;

    const activeSourceContributions = rows.map((r) => {
      if (r.confidence_contribution == null) return null;
      const n =
        typeof r.confidence_contribution === 'string'
          ? Number(r.confidence_contribution)
          : (r.confidence_contribution as number);
      return Number.isFinite(n) ? n : null;
    });
    const lastVerifiedAtIsoStrings = rows.map((r) => {
      if (r.last_verified_at == null) return null;
      if (r.last_verified_at instanceof Date) return r.last_verified_at.toISOString();
      return String(r.last_verified_at);
    });

    const validationStatus =
      (recordRow.validation_status as 'unverified' | 'verified' | 'flagged' | null) ?? 'unverified';

    const { score, components } = this.computeScore({
      activeSourceContributions,
      lastVerifiedAtIsoStrings,
      validationStatus,
    });

    const previous =
      recordRow.confidence_score == null
        ? null
        : typeof recordRow.confidence_score === 'string'
          ? Number(recordRow.confidence_score)
          : (recordRow.confidence_score as number);

    if (previous !== null && Math.abs(previous - score) < 1e-9) {
      return {
        recordId,
        applied: true,
        previous,
        next: score,
        components,
        activeSourceCount: rows.length,
        validationStatus,
      };
    }

    await db.query(UPDATE_SCORE_SQL, [score, recordId]);

    return {
      recordId,
      applied: true,
      previous,
      next: score,
      components,
      activeSourceCount: rows.length,
      validationStatus,
    };
  },

  /**
   * Sequential per-record recompute. Intentionally NOT a Promise.all to keep
   * the DB pool sane on bulk imports; callers that need throughput should
   * funnel through `automationService` or the import bypass flag instead
   * (B-T4).
   */
  async recomputeBulk(recordIds: string[]): Promise<RecomputeOutcome[]> {
    const out: RecomputeOutcome[] = [];
    for (const id of recordIds) {
      try {
        out.push(await this.recompute(id));
      } catch (err) {
        logger.warn('[ConfidenceScoringService] recompute failed', {
          recordId: id,
          error: (err as Error).message,
        });
      }
    }
    return out;
  },
};

export type ConfidenceScoringService = typeof confidenceScoringService;
export default confidenceScoringService;
