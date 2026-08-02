/**
 * FIN-06 — Finance "Valuation Recommendation" → Candidate handoff.
 *
 * Thin typed client for the three endpoints mounted at
 * `/api/finance/candidate-handoff/valuation-recommendation` (NOT under
 * `/api/v8` — this file lives in `services/api/v8/` only by directory
 * convention, the routes themselves are plain `/api/*`). Backend contract:
 * `server/src/services/finance/financeCandidateHandoffCore.ts` (the shared
 * source-type-agnostic preview/confirm/get core FIN-06 landed) plus a
 * valuation-recommendation-specific route adapter that is being built in
 * parallel and is not necessarily present yet in this worktree.
 *
 * Mirrors the ASM-08 / INT-08 pattern: a read-only PREVIEW that resolves
 * eligibility without persisting anything, and a mutating CONFIRM that is
 * idempotent per (organization, recommendation) — a retry returns the SAME
 * `candidateId` with `created: false` instead of creating a duplicate
 * Candidate. Neither call ever creates an Initiative directly; FIN-06 bans
 * Finance from doing that. The UI must reflect that a Candidate was created,
 * not an Initiative.
 *
 * Uses `apiGet`/`apiPost` (plain `/api` prefix), NOT `v8Get`/`v8Post` (which
 * prefix `/api/v8` and would 404 against these routes) — and unwraps the
 * `{data: T}` envelope itself, mirroring what `v8Get`/`v8Post` do for actual
 * v8 endpoints.
 */
import { apiGet, apiPost } from '../baseClient';

const BASE = '/finance/candidate-handoff/valuation-recommendation';

/**
 * Mirrors the backend's `FinanceCandidateSourceSnapshot`
 * (`server/src/services/finance/financeCandidateHandoffCore.ts`, landed
 * 2026-08-02): every field is either a real value read verbatim off the
 * valuation recommendation, or the literal string `'unknown'` — the backend
 * NEVER substitutes 0/null for a value the source doesn't have. Kept as an
 * open record (rather than importing the server type directly) so this
 * client stays tolerant of a field being absent on an older cached response
 * (the source-specific adapter populating these fields may land after this
 * client does).
 */
export interface FinanceValuationRecommendationSourceSnapshot {
  currency?: string | 'unknown';
  capex?: number | 'unknown';
  opex?: number | 'unknown';
  npv?: number | 'unknown';
  irr?: number | 'unknown';
  roi?: number | 'unknown';
  payback?: number | 'unknown';
  baselineOrScenario?: string | 'unknown';
  assumptions?: string[] | 'unknown';
  risks?: string[] | 'unknown';
  sourceVersion?: string | 'unknown';
  sourceFingerprint?: string | 'unknown';
  [key: string]: unknown;
}

export interface FinanceValuationRecommendationPreview {
  title: string;
  rationale: string;
  fitScore?: number;
  sourceType: 'finance_valuation_recommendation';
  sourceId: string;
  sourceSnapshot?: FinanceValuationRecommendationSourceSnapshot | null;
}

export type FinanceValuationRecommendationPreviewResult =
  | { eligible: true; preview: FinanceValuationRecommendationPreview }
  | { eligible: false; reason: string };

export interface FinanceValuationRecommendationConfirmResult {
  /** false on an idempotent replay — the recommendation was already handed off before. */
  created: boolean;
  candidateId: string;
  sourceSnapshot?: FinanceValuationRecommendationSourceSnapshot | null;
}

export interface FinanceValuationRecommendationHandoff {
  id: string;
  organizationId: string;
  sourceType: string;
  sourceId: string;
  candidateId: string;
  createdBy: string | null;
  createdAt: string;
  sourceSnapshot?: FinanceValuationRecommendationSourceSnapshot | null;
}

/**
 * Read-only eligibility + preview check — no lock, no write. Safe to call
 * before showing a confirm step.
 */
export async function previewValuationRecommendationCandidateHandoff(
  recommendationId: string
): Promise<FinanceValuationRecommendationPreviewResult> {
  const envelope = await apiGet<{ data: FinanceValuationRecommendationPreviewResult }>(
    `${BASE}/${encodeURIComponent(recommendationId)}/preview`,
    'Failed to preview Initiative candidate handoff'
  );
  return envelope.data;
}

/**
 * Mutating confirm — creates the Candidate (never an Initiative) and the
 * handoff receipt. Idempotent: a retry for the same recommendation returns
 * `created: false` with the existing `candidateId` instead of duplicating.
 */
export async function confirmValuationRecommendationCandidateHandoff(
  recommendationId: string
): Promise<FinanceValuationRecommendationConfirmResult> {
  const envelope = await apiPost<{ data: FinanceValuationRecommendationConfirmResult }>(
    `${BASE}/${encodeURIComponent(recommendationId)}/confirm`,
    undefined,
    'Failed to confirm Initiative candidate handoff'
  );
  return envelope.data;
}

/**
 * Plain read of the handoff receipt for a recommendation, if any exists.
 * Returns null (not a thrown error) on the documented 404/`NO_CANDIDATE_HANDOFF`
 * case — that is a normal "not sent yet" state.
 */
export async function getValuationRecommendationCandidateHandoff(
  recommendationId: string
): Promise<FinanceValuationRecommendationHandoff | null> {
  try {
    const envelope = await apiGet<{ data: FinanceValuationRecommendationHandoff }>(
      `${BASE}/${encodeURIComponent(recommendationId)}`,
      'Failed to fetch Initiative candidate handoff'
    );
    return envelope.data;
  } catch (error: any) {
    if (error?.status === 404 || error?.data?.code === 'NO_CANDIDATE_HANDOFF') {
      return null;
    }
    throw error;
  }
}
