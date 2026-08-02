/**
 * FIN-06 — Finance "Investment Case" → Candidate handoff.
 *
 * Thin typed client for the three endpoints mounted at
 * `/api/finance/candidate-handoff/investment-case` (NOT under `/api/v8` —
 * this file lives in `services/api/v8/` only by directory convention, the
 * routes themselves are plain `/api/*`, same as its sibling
 * `financeCandidateHandoffValuation.ts`). Backend contract:
 * `server/src/routes/financeCandidateHandoffInvestmentCase.routes.ts` +
 * `server/src/services/finance/financeInvestmentCaseCandidateHandoff.ts`.
 *
 * IMPORTANT — "Investment Case" here is a `financial_models` row (T054
 * — Financial Modeling of Initiatives) that has reached `status =
 * 'approved'`. This is a DIFFERENT thing from the "Investment" tab/kind in
 * FinanceHub (`financial_analyses` rows with `analysis_type =
 * 'investment_case'`) despite the shared English name — confirmed by
 * reading `financeInvestmentCaseCandidateHandoff.ts`'s `resolveEligibleInvestmentCase`,
 * which queries `FROM financial_models WHERE id = ? AND organization_id = ?`
 * and rejects anything with `status !== 'approved'`. The `modelId` path
 * param this client sends MUST be a real `financial_models.id`, not a
 * `financial_analyses.id`.
 *
 * Mirrors the ASM-08 / INT-08 / FIN-06-valuation pattern: a read-only
 * PREVIEW that resolves eligibility without persisting anything, and a
 * mutating CONFIRM that is idempotent per (organization, model) — a retry
 * returns the SAME `candidateId` with `created: false` instead of creating a
 * duplicate Candidate. Neither call ever creates an Initiative directly;
 * FIN-06 bans Finance from doing that. The UI must reflect that a Candidate
 * was created, not an Initiative.
 *
 * Uses `apiGet`/`apiPost` (plain `/api` prefix), NOT `v8Get`/`v8Post` (which
 * prefix `/api/v8` and would 404 against these routes) — and unwraps the
 * `{data: T}` envelope itself, mirroring what `v8Get`/`v8Post` do for actual
 * v8 endpoints.
 */
import { apiGet, apiPost } from '../baseClient';

const BASE = '/finance/candidate-handoff/investment-case';

export interface FinanceInvestmentCasePreview {
  title: string;
  rationale: string;
  fitScore?: number;
  sourceType: 'finance_investment_case';
  sourceId: string;
}

export type FinanceInvestmentCasePreviewResult =
  | { eligible: true; preview: FinanceInvestmentCasePreview }
  | { eligible: false; reason: string };

export interface FinanceInvestmentCaseConfirmResult {
  /** false on an idempotent replay — the model was already handed off before. */
  created: boolean;
  candidateId: string;
}

export interface FinanceInvestmentCaseHandoff {
  id: string;
  organizationId: string;
  sourceType: string;
  sourceId: string;
  candidateId: string;
  createdBy: string | null;
  createdAt: string;
}

/**
 * Read-only eligibility + preview check — no lock, no write. Safe to call
 * before showing a confirm step. `modelId` must be a `financial_models.id`.
 */
export async function previewInvestmentCaseCandidateHandoff(
  modelId: string
): Promise<FinanceInvestmentCasePreviewResult> {
  const envelope = await apiGet<{ data: FinanceInvestmentCasePreviewResult }>(
    `${BASE}/${encodeURIComponent(modelId)}/preview`,
    'Failed to preview Initiative candidate handoff'
  );
  return envelope.data;
}

/**
 * Mutating confirm — creates the Candidate (never an Initiative) and the
 * handoff receipt. Idempotent: a retry for the same model returns `created:
 * false` with the existing `candidateId` instead of duplicating.
 */
export async function confirmInvestmentCaseCandidateHandoff(
  modelId: string
): Promise<FinanceInvestmentCaseConfirmResult> {
  const envelope = await apiPost<{ data: FinanceInvestmentCaseConfirmResult }>(
    `${BASE}/${encodeURIComponent(modelId)}/confirm`,
    undefined,
    'Failed to confirm Initiative candidate handoff'
  );
  return envelope.data;
}

/**
 * Plain read of the handoff receipt for a model, if any exists. Returns null
 * (not a thrown error) on the documented 404/`NO_CANDIDATE_HANDOFF` case —
 * that is a normal "not sent yet" state.
 */
export async function getInvestmentCaseCandidateHandoff(
  modelId: string
): Promise<FinanceInvestmentCaseHandoff | null> {
  try {
    const envelope = await apiGet<{ data: FinanceInvestmentCaseHandoff }>(
      `${BASE}/${encodeURIComponent(modelId)}`,
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
