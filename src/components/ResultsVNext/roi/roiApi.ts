/**
 * RN-G2 P2 — ROI registry API client.
 *
 * Deliberately a HAND-WRITTEN, SMALL client for exactly the endpoints the
 * registry+preview package needs (3 reads) — NOT an attempt to wrap all
 * ~76 `/api/vnext/results/roi*` endpoints (RN_G2_UI_SCOPE.md §G Open
 * Question 4 flags that as a 200+-wrapper problem for a LATER package that
 * builds the full Case tool; the registry does not need it). Follows the
 * same `fetch` + `getHeaders()` + `API_URL` convention every other small
 * feature module in this codebase uses (see `Api.login` in
 * `src/services/api.ts` for the canonical shape) rather than adding to the
 * ~19k-line `Api` object for three endpoints.
 *
 * Server source of truth for these shapes:
 *  - `server/src/services/resultsVnext/roi/roiTypes.ts` (`RoiCase`)
 *  - `server/src/services/resultsVnext/roi/roiEconomicModelTypes.ts` (`RoiCalculationRun`)
 *  - `server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.ts` (`OrganizationRoiBenefitsRealization`)
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
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'RoiApiError';
    this.status = status;
    this.code = code;
  }
}

async function getJson<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
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
