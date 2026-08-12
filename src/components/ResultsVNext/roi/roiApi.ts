/**
 * RN-G2 P2/G2-create — ROI registry API client.
 *
 * Deliberately a HAND-WRITTEN, SMALL client for exactly the endpoints the
 * registry+preview+quick-create+lifecycle-transitions package needs — NOT
 * an attempt to wrap all ~76 `/api/vnext/results/roi*` endpoints
 * (RN_G2_UI_SCOPE.md §G Open Question 4 flags that as a 200+-wrapper
 * problem for a LATER package that builds the full Case tool; this
 * package's scope — quick create + 7 named lifecycle transitions — does not
 * need it). Follows the same `fetch` + `getHeaders()` + `API_URL`
 * convention every other small feature module in this codebase uses (see
 * `Api.login` in `src/services/api.ts` for the canonical shape) rather than
 * adding to the ~19k-line `Api` object for a handful of endpoints.
 *
 * Server source of truth for these shapes:
 *  - `server/src/services/resultsVnext/roi/roiTypes.ts` (`RoiCase`)
 *  - `server/src/services/resultsVnext/roi/roiEconomicModelTypes.ts` (`RoiCalculationRun`)
 *  - `server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.ts` (`OrganizationRoiBenefitsRealization`)
 *  - `server/src/validators/resultsVnextRoi.validators.ts` (`CreateRoiCaseSchema`,
 *    `RoiCaseTransitionSchema`, `RejectRoiCaseSchema`,
 *    `RequestChangesOnRoiCaseSchema`, `ReopenApprovedRoiCaseForRevisionSchema`)
 *  - `server/src/validators/resultsVnextRoiForecastActual.validators.ts`
 *    (`RoiCaseCancellationSchema`)
 *  - `server/src/validators/resultsVnextRoiPir.validators.ts` (`CloseRoiCaseSchema`)
 *  - `server/src/routes/resultsVnext/roi.routes.ts` (exact paths/methods for
 *    every write endpoint below — read directly, not guessed)
 * Server DTOs are already camelCase JSON on the wire (`to*` mapper
 * functions) — these client types mirror them 1:1, no re-mapping needed.
 */
import { API_URL, getHeaders } from '@/services/api';

// ==========================================
// Enums (mirror roiTypes.ts / roiEconomicModelTypes.ts CHECK constraints)
// ==========================================

export const ROI_CASE_STATUSES = [
  'not_started',
  'draft',
  'modeling',
  'ready_for_review',
  'submitted_for_approval',
  'changes_requested',
  'approved',
  'rejected',
  'tracking',
  'benefits_realization',
  'post_investment_review_due',
  'post_investment_review',
  'closed',
  'cancelled',
] as const;
export type RoiCaseStatus = (typeof ROI_CASE_STATUSES)[number];

export type RoiCaseGranularity = 'monthly' | 'annual';

export const ROI_IRR_STATUSES = [
  'computed',
  'not_applicable',
  'no_sign_change',
  'not_required_by_policy',
] as const;
export type RoiIrrStatus = (typeof ROI_IRR_STATUSES)[number];

// ==========================================
// DTOs (subset of server fields the registry + preview actually render)
// ==========================================

export interface RoiCaseListItem {
  caseId: string;
  organizationId: string;
  initiativeId: string;
  title: string;
  ownerUserId: string;
  status: RoiCaseStatus;
  currency: string;
  granularity: RoiCaseGranularity;
  analysisStart: string | null;
  analysisEnd: string | null;
  nextActionType: string | null;
  nextActionDueAt: string | null;
  nextReviewAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  changesRequestedAt: string | null;
  changesRequestedReason: string | null;
  archivedAt: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoiCalculationRunSummary {
  runId: string;
  caseId: string;
  status: 'completed' | 'failed';
  scenarioId: string | null;
  totalCosts: number | null;
  totalFinancialBenefits: number | null;
  simpleRoi: number | null;
  npv: number | null;
  irrPct: number | null;
  irrStatus: RoiIrrStatus;
  paybackPeriods: number | null;
  discountedPaybackPeriods: number | null;
  benefitCostRatio: number | null;
  warnings: unknown[];
  completedAt: string;
  createdAt: string;
}

export interface RoiOrgBenefitsRealizationRow {
  caseId: string;
  initiativeId: string;
  title: string;
  status: RoiCaseStatus;
  approvedFinancialBenefits: number | null;
  actualFinancialBenefits: number | null;
  benefitsRealizationPct: number | null;
}

export interface RoiOrgBenefitsRealization {
  cases: RoiOrgBenefitsRealizationRow[];
  portfolioTotals: {
    totalApprovedFinancialBenefits: number;
    totalActualFinancialBenefits: number;
    caseCountWithActual: number;
    caseCountTotal: number;
  };
}

// ==========================================
// Fetch plumbing
// ==========================================

export class RoiApiError extends Error {
  status: number;
  code?: string;
  /**
   * Raw error-body fields beyond `error`/`code` — for a 409 `STALE_VERSION`
   * conflict this carries `{currentVersion, expectedVersion}` verbatim
   * (`handleRoiRouteError`, `roi.routes.ts` L349-352: `res.status(409).json({
   * error, code, ...(err.details || {}) })` — the conflict's extra fields
   * are spread top-level, not nested under a `details` key on the wire, but
   * captured here under `details` client-side for a stable shape callers can
   * read regardless of which specific fields a given error code carries).
   */
  details?: Record<string, unknown>;
  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'RoiApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** One fresh v4 UUID per user-initiated write ATTEMPT (create-case form open,
 * or a lifecycle-transition dialog open) — same client convention already
 * used across the app for `idempotencyKey` (e.g. `crypto.randomUUID()` in
 * `RecoveryCardPanel.tsx`, `SpreadsheetArtifactStudio.tsx`). Callers must
 * generate ONCE per attempt and reuse it across retries of that SAME attempt
 * (not regenerate per click) — that is what makes a double-click or a
 * network-retry idempotent instead of creating two cases/two transitions.
 */
export function newRoiIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Exported (not just `listRoiCases` et al. above) so `roiCaseDetailApi.ts`
 * (RN-G2 §G #12-14 — baseline/calculation-policy/assumptions/cost+benefit
 * lines) reuses the SAME fetch/error-mapping plumbing instead of a second,
 * silently-driftable copy — same "one family of files" convention this
 * whole `roi/` folder already follows (`roiRegistryMappers.ts` shared by
 * `roiRegistryPresenters.tsx` + the dev-render harness).
 */
export async function getJson<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const query = params
    ? Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const url = `${API_URL}${path}${query ? `?${query}` : ''}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: getHeaders() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new RoiApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  if (!res.ok) {
    let body: { error?: string; code?: string } = {};
    try {
      body = await res.json();
    } catch {
      // non-JSON error body — fall through with generic message
    }
    throw new RoiApiError(body.error || `Request failed (${res.status})`, res.status, body.code);
  }
  return res.json() as Promise<T>;
}

/** POST/PATCH/PUT/DELETE counterpart of `getJson` — same network-error/
 * HTTP-error mapping, plus captures every non-`error`/`code` body field into
 * `RoiApiError.details` (the 409 `STALE_VERSION` conflict's
 * `currentVersion`/`expectedVersion`, in particular). `DELETE` added for
 * `roiCaseDetailApi.ts`'s assumption/cost-line/benefit-line removal — those
 * three endpoints are `DELETE` requests that carry a JSON body
 * (`{expectedVersion, reason, idempotencyKey}`, `roi.routes.ts` L989-1020 /
 * L1158-1189 / L1335-1366), unlike a "plain" bodyless REST DELETE. Exported
 * for the same reason as `getJson` above. */
export async function mutateJson<T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body: unknown
): Promise<T> {
  const url = `${API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new RoiApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = await res.json();
  } catch {
    // non-JSON body — fall through with a generic message/empty details
  }
  if (!res.ok) {
    const { error, code, ...details } = parsed as { error?: string; code?: string; [k: string]: unknown };
    throw new RoiApiError(
      (typeof error === 'string' && error) || `Request failed (${res.status})`,
      res.status,
      typeof code === 'string' ? code : undefined,
      Object.keys(details).length > 0 ? details : undefined
    );
  }
  return parsed as T;
}

// ==========================================
// GET /api/vnext/results/roi/cases
// ==========================================

export interface ListRoiCasesParams {
  status?: RoiCaseStatus;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export async function listRoiCases(params: ListRoiCasesParams = {}): Promise<RoiCaseListItem[]> {
  // Cast is safe: every `ListRoiCasesParams` field genuinely IS
  // `string | number | boolean | undefined` — the cast only appeases TS's
  // "interface without an index signature isn't assignable to Record<string, X>"
  // structural rule, it does not change what value flows into `getJson`.
  const { cases } = await getJson<{ cases: RoiCaseListItem[] }>(
    '/vnext/results/roi/cases',
    params as Record<string, string | number | boolean | undefined>
  );
  return cases;
}

// ==========================================
// GET /api/vnext/results/roi/cases/:caseId — RN-G5 (2026-08-12) deep-link
// route (`/results/roi/cases/:roiCaseId`, `RoiCaseToolPage.tsx`). The route
// handler already exists server-side (`roi.routes.ts` "GET
// /cases/:caseId — getRoiCase", `includeArchived: true` — an archived case
// must still resolve by known id, only the LIST default excludes it) but
// had no client wrapper before this package (the registry's own lazy
// per-row fetches only ever needed `listRoiCases`/
// `getLatestRoiCalculationRun`). The 404 branch collapses "does not exist"
// and "cross-tenant" into the SAME response (`getRoiCase`'s repository
// query is itself organization-scoped — a cross-org id simply returns no
// row, `roi.routes.ts` "GET /cases/:caseId" comment) — same shape as
// `kpiApi.ts`'s `getKpi`/`okrApi.ts`'s `getOkrSet`, so callers use the
// identical `NO_VISIBILITY_RECORD` fail-closed default rather than
// inventing a reason the API never actually tells the client (D06/D07).
// ==========================================

export async function getRoiCase(caseId: string): Promise<RoiCaseListItem | null> {
  try {
    const { case: roiCase } = await getJson<{ case: RoiCaseListItem }>(
      `/vnext/results/roi/cases/${encodeURIComponent(caseId)}`
    );
    return roiCase;
  } catch (err) {
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}

// ==========================================
// GET /api/vnext/results/roi/cases/:caseId/calculation-runs
// (registry+preview only ever needs the LATEST completed/failed run — the
// full runs list/compare view is a later package, RN_G2_UI_SCOPE.md §G #15)
// ==========================================

export async function getLatestRoiCalculationRun(caseId: string): Promise<RoiCalculationRunSummary | null> {
  const { runs } = await getJson<{ runs: RoiCalculationRunSummary[] }>(
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/calculation-runs`,
    { limit: 1, offset: 0 }
  );
  // Server orders `ORDER BY created_at DESC` (roiEconomicModelRepository.ts
  // `listCalculationRuns`) — first row IS the latest, not re-sorted here.
  return runs[0] ?? null;
}

// ==========================================
// GET /api/vnext/results/roi/org/benefits-realization
// ==========================================

export async function listOrgRoiBenefitsRealization(): Promise<RoiOrgBenefitsRealization> {
  const { attention } = await getJson<{ attention: RoiOrgBenefitsRealization }>(
    '/vnext/results/roi/org/benefits-realization'
  );
  return attention;
}

// ==========================================
// RN-G5 §G #11 — GET /api/vnext/results/roi/org/pir-outcomes
// (`listOrganizationRoiPirOutcomes`, `roiOrgPerspectiveRepository.ts`
// L277-360, route at `roiPerspectives.routes.ts` L104-116). Response
// envelope key is `outcomes` (verified directly from the route — distinct
// from `listOrgRoiBenefitsRealization`'s `attention` key above, NOT a typo).
// ==========================================

export const ROI_PIR_OUTCOMES = [
  'benefits_fully_realized',
  'benefits_partially_realized',
  'benefits_not_realized',
] as const;
export type RoiPirOutcome = (typeof ROI_PIR_OUTCOMES)[number];

export interface RoiOrgPirOutcomeCaseRow {
  caseId: string;
  initiativeId: string;
  title: string;
  status: RoiCaseStatus;
  /** `null` for a case still mid-review (`status='post_investment_review'`,
   * PIR row still `status='draft'`) — a real, expected state, never
   * defaulted to a fabricated outcome (D08). */
  pirOutcome: RoiPirOutcome | null;
  benefitsRealizationPct: number | null;
  /** `null` while the PIR row is still `draft`. */
  finalizedAt: string | null;
}

export interface RoiOrgPirOutcomes {
  cases: RoiOrgPirOutcomeCaseRow[];
  portfolioTotals: {
    closedCaseCount: number;
    fullyRealizedCount: number;
    partiallyRealizedCount: number;
    notRealizedCount: number;
  };
}

export async function listOrgRoiPirOutcomes(): Promise<RoiOrgPirOutcomes> {
  const { outcomes } = await getJson<{ outcomes: RoiOrgPirOutcomes }>('/vnext/results/roi/org/pir-outcomes');
  return outcomes;
}

// ==========================================
// POST /api/vnext/results/roi/cases — quick create
// (`roi.routes.ts` L439-474, body = `CreateRoiCaseSchema`,
// `resultsVnextRoi.validators.ts` L84-94)
// ==========================================

export interface CreateRoiCaseInput {
  initiativeId: string;
  title: string;
  ownerUserId: string;
  currency: string;
  granularity?: RoiCaseGranularity;
  analysisStart?: string | null;
  analysisEnd?: string | null;
  reason?: string | null;
  idempotencyKey: string;
}

export interface CreateRoiCaseResponse {
  outcome: 'applied' | 'duplicate';
  case: RoiCaseListItem;
  created: boolean;
}

export async function createRoiCase(input: CreateRoiCaseInput): Promise<CreateRoiCaseResponse> {
  return mutateJson<CreateRoiCaseResponse>('POST', '/vnext/results/roi/cases', input);
}

// ==========================================
// Lifecycle transitions (RN_G2_UI_SCOPE.md §G #16 subset — exactly the 7
// endpoints this package is scoped to). Each mirrors its route's exact body
// shape read from `roi.routes.ts`/the validator files cited in the file
// header — no field invented beyond what the server schema declares.
//
// PLUS (RN-G6-C2, found while running the ROI gold flow end-to-end for the
// first time on a real browser/real Postgres): `start-modeling` and
// `ready-for-review` (`roi.routes.ts` L715-716, `mountTransitionRoute`,
// same `RoiCaseTransitionSchema` body shape as `approve`/`start_pir`/
// `close` above) existed server-side with a passing test suite but had ZERO
// frontend callers anywhere in `src/` — a case created via "New ROI case"
// stays in `draft` forever with no UI path to `modeling`, which silently
// blocks calculation runs (`RUNNABLE_STATUSES = ['modeling',
// 'ready_for_review']`, `RoiCaseModelWorkspace.tsx`) and therefore the rest
// of the lifecycle. Added here as the same 9th/10th transition, not a new
// pattern.
// ==========================================

export interface RoiTransitionResult {
  outcome: 'applied' | 'duplicate';
  case: RoiCaseListItem;
}

/** POST .../transitions/start-modeling — `RoiCaseTransitionSchema`
 * (expectedVersion + optional reason), draft → modeling
 * (`roiCaseCommands.ts` `startModeling`, L971-983). */
export async function startModelingRoiCase(
  caseId: string,
  input: { expectedVersion: number; reason?: string | null; idempotencyKey: string }
): Promise<RoiTransitionResult> {
  return mutateJson<RoiTransitionResult>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/transitions/start-modeling`,
    input
  );
}

/** POST .../transitions/ready-for-review — `RoiCaseTransitionSchema`
 * (expectedVersion + optional reason), modeling → ready_for_review, guarded
 * server-side by a successful/fresh calculation run + no unresolved
 * double-counting (`roiCaseCommands.ts` `markReadyForReview`, L985-1003). */
export async function markRoiCaseReadyForReview(
  caseId: string,
  input: { expectedVersion: number; reason?: string | null; idempotencyKey: string }
): Promise<RoiTransitionResult> {
  return mutateJson<RoiTransitionResult>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/transitions/ready-for-review`,
    input
  );
}

/** POST .../transitions/submit-for-approval — same `RoiCaseTransitionSchema`
 * body shape (expectedVersion + optional reason), ready_for_review OR
 * changes_requested → submitted_for_approval, re-checks the SAME
 * fresh-calculation-run/no-unresolved-double-counting guard as
 * `ready-for-review` (`roiCaseApprovalCommands.ts` `submitRoiCaseForApproval`,
 * L203-260). Found alongside `start-modeling`/`ready-for-review` — no
 * frontend caller existed for this endpoint either, which would have left
 * a case stuck at `ready_for_review` forever with no way to reach
 * `submitted_for_approval` (and therefore no way to ever exercise
 * approve/reject/request-changes, all of which require that exact
 * status). */
export async function submitRoiCaseForApprovalCase(
  caseId: string,
  input: { expectedVersion: number; reason?: string | null; idempotencyKey: string }
): Promise<RoiTransitionResult> {
  return mutateJson<RoiTransitionResult>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/transitions/submit-for-approval`,
    input
  );
}

/** POST .../transitions/approve — `RoiCaseTransitionSchema` (expectedVersion
 * + optional reason). Response carries `{case, snapshot}`; only `case`
 * matters to the registry (`roi.routes.ts` L1800-1832). */
export async function approveRoiCase(
  caseId: string,
  input: { expectedVersion: number; reason?: string | null; idempotencyKey: string }
): Promise<RoiTransitionResult> {
  return mutateJson<RoiTransitionResult>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/transitions/approve`,
    input
  );
}

/** POST .../transitions/reject — `RejectRoiCaseSchema`: expectedVersion +
 * REQUIRED `rejectionReason` (`roi.routes.ts` L1836-1867). */
export async function rejectRoiCase(
  caseId: string,
  input: { expectedVersion: number; rejectionReason: string; idempotencyKey: string }
): Promise<RoiTransitionResult> {
  return mutateJson<RoiTransitionResult>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/transitions/reject`,
    input
  );
}

/** POST .../transitions/request-changes — `RequestChangesOnRoiCaseSchema`:
 * expectedVersion + REQUIRED `changeRequestNotes` (`roi.routes.ts`
 * L1871-1902). */
export async function requestChangesOnRoiCase(
  caseId: string,
  input: { expectedVersion: number; changeRequestNotes: string; idempotencyKey: string }
): Promise<RoiTransitionResult> {
  return mutateJson<RoiTransitionResult>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/transitions/request-changes`,
    input
  );
}

/** POST .../transitions/reopen-for-revision —
 * `ReopenApprovedRoiCaseForRevisionSchema`: expectedVersion + REQUIRED
 * `reason` (`roi.routes.ts` L1906-1937). Only valid from `approved` — NOT
 * the same endpoint as `.../transitions/reopen-after-rejection` (from
 * `rejected`), which is out of this package's scope. */
export async function reopenRoiCaseForRevision(
  caseId: string,
  input: { expectedVersion: number; reason: string; idempotencyKey: string }
): Promise<RoiTransitionResult> {
  return mutateJson<RoiTransitionResult>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/transitions/reopen-for-revision`,
    input
  );
}

/** POST .../transitions/cancel — `RoiCaseCancellationSchema`
 * (`resultsVnextRoiForecastActual.validators.ts` L84-86): expectedVersion +
 * REQUIRED `reason` (Decision D8). Only valid from
 * `ROI_TRACKING_ACTIVE_STATUSES` (`roi.routes.ts` L2564-2595). */
export async function cancelRoiCase(
  caseId: string,
  input: { expectedVersion: number; reason: string; idempotencyKey: string }
): Promise<RoiTransitionResult> {
  return mutateJson<RoiTransitionResult>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/transitions/cancel`,
    input
  );
}

/** POST .../transitions/start-pir — `RoiCaseTransitionSchema` (expectedVersion
 * + optional reason). Response carries `{case, pir}`; only `case` matters to
 * the registry (`roi.routes.ts` L2676-2712). */
export async function startPirRoiCase(
  caseId: string,
  input: { expectedVersion: number; reason?: string | null; idempotencyKey: string }
): Promise<RoiTransitionResult> {
  return mutateJson<RoiTransitionResult>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/transitions/start-pir`,
    input
  );
}

/** POST .../transitions/close — `CloseRoiCaseSchema`
 * (`resultsVnextRoiPir.validators.ts` L87-92): expectedVersion + optional
 * `openVarianceWaiverReason` + optional `reason` (`roi.routes.ts`
 * L2838-2861). */
export async function closeRoiCase(
  caseId: string,
  input: {
    expectedVersion: number;
    openVarianceWaiverReason?: string | null;
    reason?: string | null;
    idempotencyKey: string;
  }
): Promise<RoiTransitionResult> {
  return mutateJson<RoiTransitionResult>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/transitions/close`,
    input
  );
}
