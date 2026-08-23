/**
 * RN-G2 P3 #23 — OKR Set registry API client.
 *
 * Mirrors `../roi/roiApi.ts` exactly: a HAND-WRITTEN, SMALL client for
 * exactly the endpoints the registry+preview package needs — NOT an
 * attempt to wrap all ~65 `/api/vnext/results/okr*` endpoints
 * (RN_G2_UI_SCOPE.md §G Open Question 4 flags the full-wrapper problem as
 * out of scope for a registry package; Programs/Cycles/Objectives/Key
 * Results/check-ins/alignments/reviews/closing/recognition are packages
 * #24-#29, not this one).
 *
 * Server source of truth for these shapes:
 *  - `server/src/services/resultsVnext/okr/okrSetTypes.ts` (`OkrSet`, `toOkrSet`)
 *  - `server/src/services/resultsVnext/okr/okrSetRepository.ts` (`listOkrSets`, `getOkrSet`)
 *  - `server/src/services/resultsVnext/okr/okrPerspectivesRepository.ts` (`listMyOkrSets`)
 *  - `server/src/routes/resultsVnext/okr.routes.ts` (route wiring, response envelopes)
 * Server DTOs are already camelCase JSON on the wire (`toOkrSet`) — these
 * client types mirror them 1:1, no re-mapping needed.
 *
 * ── ENDPOINT PATHS — CORRECTED vs. the task brief ──────────────────────
 * The task brief names the perspective endpoints `GET .../okr/sets/my` and
 * `GET .../okr/sets/company`. The REAL router
 * (`server/src/routes/resultsVnext/okr.routes.ts` L918 `router.get('/my', ...)`
 * and L886 `router.get('/company', ...)`) mounts them as TOP-LEVEL siblings
 * of `/sets`, not nested under it — i.e. `GET /api/vnext/results/okr/my` and
 * `GET /api/vnext/results/okr/company`, both mounted on the SAME router as
 * `/sets` (`server/src/Gateway.ts` L1211: `app.use('/api/vnext/results/okr',
 * resultsVnextOkrRoutes)`). Verified by reading the router file directly
 * (per CLAUDE.md "Weryfikuj REALNY runtime" rule) — this file uses the real
 * paths, not the brief's assumed ones.
 *
 * ── `GET /sets/:setId` is NOT lazily fetched on row selection ──────────
 * Unlike ROI (NPV/IRR only live on a separate calculation-run resource) and
 * KPI (latest measurement only reachable via a separate endpoint),
 * `getOkrSet`'s own SQL is `SELECT s.*` from `okr_vnext_sets` — BYTE-FOR-
 * BYTE the same column set `listOkrSets`/`listMyOkrSets` already return
 * (confirmed in `okrSetRepository.ts`: both the list and detail queries
 * select the full row, mapped through the same `toOkrSet`). There is no
 * additional field a per-row lazy fetch would surface for THIS package's
 * scope (Objectives/Key Results/check-ins live under their own endpoints,
 * out of scope per RN_G2_UI_SCOPE.md §G #25). Firing a `GET /sets/:setId`
 * on every row click would therefore be a pure N+1 network call for ZERO
 * new data — the opposite of what "NIGDY N+1 na wiersz" asks for. This
 * client still exports `getOkrSet` because it has one genuine use: the
 * `?setId=` deep-link resolve/forbidden-state flow (§D), which needs a
 * single fetch for ONE id that is not necessarily in the currently loaded
 * list page — see `ResultsOkrHub.tsx`'s deep-link effect.
 */
import { API_URL, getHeaders } from '@/services/api';

// ==========================================
// Enums (mirror okrSetTypes.ts CHECK constraints)
// ==========================================

/** Full 10-state lifecycle forward-declared by OKR-E002 (design §4.4).
 * `'not_required'`/`'required'` are reserved with ZERO E002 code path today
 * (`okrSetTypes.ts` L21: "reserved with zero E002 code path (D2)") —
 * included here only so this union stays exhaustive with the server's own
 * CHECK constraint; no command in this backend currently sets a Set to
 * either value. Never collapse two states into one label (ROI precedent,
 * `roiRegistryMappers.ts`). */
export const OKR_SET_STATUSES = [
  'not_required',
  'required',
  'draft',
  'submitted',
  'changes_requested',
  'approved',
  'active',
  'review',
  'closed',
  'cancelled',
] as const;
export type OkrSetStatus = (typeof OKR_SET_STATUSES)[number];

export const OKR_SET_SCOPE_TYPES = ['company', 'business_unit', 'team', 'individual'] as const;
export type OkrSetScopeType = (typeof OKR_SET_SCOPE_TYPES)[number];

export const OKR_SET_CONFIDENCE_VALUES = ['high', 'medium', 'low', 'numeric'] as const;
export type OkrSetConfidence = (typeof OKR_SET_CONFIDENCE_VALUES)[number];

export const OKR_SET_ATTENTION_STATES = ['none', 'watch', 'action_required', 'escalated'] as const;
export type OkrSetAttentionState = (typeof OKR_SET_ATTENTION_STATES)[number];

// ==========================================
// DTO (full `OkrSet` shape — list and detail return the SAME columns, see
// header note above; no "list subset vs detail-enriched" split like ROI/KPI)
// ==========================================

export interface OkrSetDto {
  setId: string;
  organizationId: string;
  programId: string;
  cycleId: string;
  scopeType: OkrSetScopeType;
  scopeId: string;
  ownerUserId: string;
  reviewerUserId: string | null;
  title: string;
  status: OkrSetStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  changesRequestedBy: string | null;
  changesRequestedAt: string | null;
  changesRequestedReason: string | null;
  currentVersion: number;
  approvedVersion: number | null;
  latestApprovedSnapshotId: string | null;
  /**
   * `NUMERIC NULL` in Postgres (`server/migrations/20260823_rvn_okr_set.sql`
   * L74) — node-pg returns `numeric` columns as STRING, never a JS number
   * (the exact class of bug MEMORY `co10-money-numeric-2026-08-10` warns
   * about: naive `+` concatenation on this field would silently produce
   * `"0" + "12.5"` style corruption). Always parse with `parseOkrProgress`
   * from `okrRegistryMappers.ts`, never read this field directly as a number.
   */
  overallProgress: string | null;
  overallConfidence: OkrSetConfidence | null;
  attentionState: OkrSetAttentionState;
  lastCheckinAt: string | null;
  nextCheckinDueAt: string | null;
  carriedFromSetId: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

// ==========================================
// Fetch plumbing (same shape as `roiApi.ts`'s `RoiApiError`/`getJson`)
// ==========================================

export class OkrApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'OkrApiError';
    this.status = status;
    this.code = code;
  }
}

async function getJson<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
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
    throw new OkrApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  if (!res.ok) {
    let body: { error?: string; code?: string } = {};
    try {
      body = await res.json();
    } catch {
      // non-JSON error body — fall through with generic message
    }
    throw new OkrApiError(body.error || `Request failed (${res.status})`, res.status, body.code);
  }
  return res.json() as Promise<T>;
}

// ==========================================
// GET /api/vnext/results/okr/sets — listOkrSets ("Organization" perspective,
// every Set visible to the caller under ABAC, no ownership/scope narrowing)
// ==========================================

export interface ListOkrSetsParams {
  cycleId?: string;
  scopeType?: OkrSetScopeType;
  status?: OkrSetStatus;
  attentionState?: OkrSetAttentionState;
  limit?: number;
  offset?: number;
}

export async function listOkrSets(params: ListOkrSetsParams = {}): Promise<OkrSetDto[]> {
  const { RESULTS_VNEXT_SAMPLE_OKR_SETS, shouldUseResultsVNextOwnerSampleData } =
    await import('../resultsVNextOwnerSampleData');
  if (shouldUseResultsVNextOwnerSampleData()) return RESULTS_VNEXT_SAMPLE_OKR_SETS;
  const { sets } = await getJson<{ sets: OkrSetDto[] }>(
    '/vnext/results/okr/sets',
    params as Record<string, string | number | boolean | undefined>
  );
  return sets;
}

// ==========================================
// GET /api/vnext/results/okr/my — listMyOkrSets
// Set-level ownership (owner_user_id OR reviewer_user_id) only — NO status/
// scopeType/attentionState filter exists on this route (validated: the real
// `ListMyOkrSetsQuerySchema` in `server/src/validators/resultsVnextOkr.validators.ts`
// only accepts limit/offset; `okr.routes.ts` L926-931 passes nothing else
// through to `listMyOkrSets`) — status-bucket chips on this tab therefore
// filter the already-loaded page CLIENT-SIDE, same as ROI's "All cases" tab.
// ==========================================

export interface ListMyOkrSetsParams {
  limit?: number;
  offset?: number;
}

export async function listMyOkrSets(params: ListMyOkrSetsParams = {}): Promise<OkrSetDto[]> {
  const { RESULTS_VNEXT_SAMPLE_OKR_SETS, shouldUseResultsVNextOwnerSampleData } =
    await import('../resultsVNextOwnerSampleData');
  if (shouldUseResultsVNextOwnerSampleData()) return RESULTS_VNEXT_SAMPLE_OKR_SETS.slice(0, 2);
  const { sets } = await getJson<{ sets: OkrSetDto[] }>(
    '/vnext/results/okr/my',
    params as Record<string, string | number | boolean | undefined>
  );
  return sets;
}

// ==========================================
// GET /api/vnext/results/okr/company — listOkrSets pinned to scopeType='company'
// (F-004-AC-02: "the company view is a projection, not a separate model" —
// same `listOkrSets` repository function as the Organization tab, only the
// `scopeType` filter differs; mirrored here as its own function purely so
// the Hub never has to remember to pass `scopeType: 'company'` itself).
// ==========================================

export interface ListCompanyOkrSetsParams {
  cycleId?: string;
  status?: OkrSetStatus;
  attentionState?: OkrSetAttentionState;
  limit?: number;
  offset?: number;
}

export async function listCompanyOkrSets(
  params: ListCompanyOkrSetsParams = {}
): Promise<OkrSetDto[]> {
  const { RESULTS_VNEXT_SAMPLE_OKR_SETS, shouldUseResultsVNextOwnerSampleData } =
    await import('../resultsVNextOwnerSampleData');
  if (shouldUseResultsVNextOwnerSampleData())
    return RESULTS_VNEXT_SAMPLE_OKR_SETS.filter((set) => set.scopeType === 'company');
  const { sets } = await getJson<{ sets: OkrSetDto[] }>(
    '/vnext/results/okr/company',
    params as Record<string, string | number | boolean | undefined>
  );
  return sets;
}

// ==========================================
// GET /api/vnext/results/okr/sets/:setId — getOkrSet
// Deep-link (`?setId=`) resolve ONLY — see header note. The 404 branch
// collapses "does not exist" and "visibility denied" into the SAME response
// (`okr.routes.ts` L975-978: `if (!set) { res.status(404)... }`, and
// `getOkrSet`'s own visibility-scoped join simply returns no row for a
// denied id) — identical shape to `kpiApi.ts`'s `getKpi`, so this page uses
// the same `NO_VISIBILITY_RECORD` fail-closed default the KPI page already
// established (RN_G1_PLATFORM_DESIGN.md §B) rather than inventing a new
// reason the API never actually tells the client.
// ==========================================

export async function getOkrSet(setId: string): Promise<OkrSetDto | null> {
  const { RESULTS_VNEXT_SAMPLE_OKR_SETS, shouldUseResultsVNextOwnerSampleData } =
    await import('../resultsVNextOwnerSampleData');
  if (shouldUseResultsVNextOwnerSampleData() || setId.startsWith('sample-okr-')) {
    return RESULTS_VNEXT_SAMPLE_OKR_SETS.find((set) => set.setId === setId) ?? null;
  }
  try {
    const { set } = await getJson<{ set: OkrSetDto }>(
      `/vnext/results/okr/sets/${encodeURIComponent(setId)}`
    );
    return set;
  } catch (err) {
    if (err instanceof OkrApiError && err.status === 404) return null;
    throw err;
  }
}
