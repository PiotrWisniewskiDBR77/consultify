/**
 * FIN-06 — Finance "Statement Pack" → Candidate handoff.
 *
 * Thin typed client for the three endpoints mounted at
 * `/api/finance/candidate-handoff/statement-pack` (NOT under `/api/v8` —
 * this file lives in `services/api/v8/` only by directory convention, the
 * routes themselves are plain `/api/*`, same as its siblings
 * `financeCandidateHandoff.ts` and `financeCandidateHandoffValuation.ts`).
 * Backend contract: `server/src/routes/financeCandidateHandoffStatementPack.routes.ts`
 * + `server/src/services/finance/financeStatementPackCandidateHandoff.ts`
 * (mounted in `Gateway.ts` alongside the other two Finance source-type
 * adapters).
 *
 * Eligibility gate: `pack_readiness_status === 'ready'` — a pack that is
 * `pending`, `recoverable`, or `rejected` resolves `NOT_READY`; a pack that
 * cannot be found resolves `NOT_FOUND`. The `packId` this client sends MUST
 * be a real `financial_statement_packs.id`.
 *
 * Mirrors the ASM-08 / INT-08 / FIN-06 pattern: a read-only PREVIEW that
 * resolves eligibility without persisting anything, and a mutating CONFIRM
 * that is idempotent per (organization, pack) — a retry returns the SAME
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

const BASE = '/finance/candidate-handoff/statement-pack';

/**
 * Mirrors the backend's `FinanceCandidateSourceSnapshot`
 * (`server/src/services/finance/financeCandidateHandoffCore.ts`, landed
 * 2026-08-02): every field is either a real value read verbatim off the
 * statement pack, or the literal string `'unknown'` — the backend NEVER
 * substitutes 0/null for a value the pack doesn't have. Kept as an open
 * record (rather than importing the server type directly) so this client
 * stays tolerant of a field being absent on an older cached response (the
 * source-specific adapter populating these fields may land after this
 * client does).
 */
export interface FinanceStatementPackSourceSnapshot {
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

export interface FinanceStatementPackPreview {
  title: string;
  rationale: string;
  fitScore?: number;
  sourceType: 'finance_statement_pack';
  sourceId: string;
  sourceSnapshot?: FinanceStatementPackSourceSnapshot | null;
}

export type FinanceStatementPackPreviewResult =
  | { eligible: true; preview: FinanceStatementPackPreview }
  | { eligible: false; reason: string };

export interface FinanceStatementPackConfirmResult {
  /** false on an idempotent replay — the pack was already handed off before. */
  created: boolean;
  candidateId: string;
  sourceSnapshot?: FinanceStatementPackSourceSnapshot | null;
}

export interface FinanceStatementPackHandoff {
  id: string;
  organizationId: string;
  sourceType: string;
  sourceId: string;
  candidateId: string;
  createdBy: string | null;
  createdAt: string;
  sourceSnapshot?: FinanceStatementPackSourceSnapshot | null;
}

/**
 * Read-only eligibility + preview check — no lock, no write. Safe to call
 * before showing a confirm step. `packId` must be a
 * `financial_statement_packs.id`.
 */
export async function previewStatementPackCandidateHandoff(
  packId: string
): Promise<FinanceStatementPackPreviewResult> {
  const envelope = await apiGet<{ data: FinanceStatementPackPreviewResult }>(
    `${BASE}/${encodeURIComponent(packId)}/preview`,
    'Failed to preview Initiative candidate handoff'
  );
  return envelope.data;
}

/**
 * Mutating confirm — creates the Candidate (never an Initiative) and the
 * handoff receipt. Idempotent: a retry for the same pack returns `created:
 * false` with the existing `candidateId` instead of duplicating.
 */
export async function confirmStatementPackCandidateHandoff(
  packId: string
): Promise<FinanceStatementPackConfirmResult> {
  const envelope = await apiPost<{ data: FinanceStatementPackConfirmResult }>(
    `${BASE}/${encodeURIComponent(packId)}/confirm`,
    undefined,
    'Failed to confirm Initiative candidate handoff'
  );
  return envelope.data;
}

/**
 * Plain read of the handoff receipt for a pack, if any exists. Returns null
 * (not a thrown error) on the documented 404/`NO_CANDIDATE_HANDOFF` case —
 * that is a normal "not sent yet" state.
 */
export async function getStatementPackCandidateHandoff(
  packId: string
): Promise<FinanceStatementPackHandoff | null> {
  try {
    const envelope = await apiGet<{ data: FinanceStatementPackHandoff }>(
      `${BASE}/${encodeURIComponent(packId)}`,
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
