/**
 * RN-G2 P1 #8 — thin typed fetch wrappers over `Api.get`/`Api.post` for the
 * KPI Scorecards surface (`/api/vnext/results/kpi/scorecards*`, see
 * `server/src/routes/resultsVnext/kpiScorecard.routes.ts`,
 * `server/src/services/resultsVnext/kpi/kpiScorecardTypes.ts` and
 * `kpiScorecardRepository.ts`/`kpiScorecardCommands.ts`).
 *
 * Follows the sibling `../kpiApi.ts` convention (`Api.get`/`Api.post`, not
 * `roiApi.ts`'s hand-rolled `fetch` — this is a KPI-domain package, and the
 * KPI vertical's own precedent is the one to mirror per the task brief) —
 * local DTO shapes MIRROR the server's camelCase JSON output 1:1 (verified
 * by reading `kpiScorecardTypes.ts`'s `toKpiScorecard`/`toKpiScorecardItem`/
 * `toKpiScorecardReviewSnapshot` mappers and the route file's response
 * bodies directly), never imported from the server package.
 *
 * -- CONFIRMED CONTRACT (read from the real router, not assumed):
 *   `POST/GET /` · `GET /:scorecardId` · `GET/POST /:scorecardId/items`
 *   (+`DELETE /:itemId`, `PATCH /reorder`) · `GET /:scorecardId/status` ·
 *   `POST/GET /:scorecardId/review-snapshots` (+`/published`,
 *   `POST /:snapshotId/publish`) · `POST .../activate|suspend|archive`.
 *   Response envelopes verified per-route below (`{scorecards}`, `{scorecard}`,
 *   `{items}`, `{distribution}`, `{snapshots}`, `{snapshot}`).
 *
 * -- CONFIRMED BACKEND GAP: `kpiScorecardRepository.ts` has no single-row
 * `getScorecard` — the route file declares its OWN narrow
 * `loadVisibleScorecard` (visibility-scoped, `resourceType: 'kpi_scorecard'`)
 * for `GET /:scorecardId`. That route returns 404 for BOTH "does not exist"
 * and "exists but visibility-denied" (same non-distinguishing shape
 * `../kpiApi.ts`'s own `getKpi` already documents for the KPI entity route) —
 * `getKpiScorecard` below returns `null` on 404, exactly like `getKpi`.
 *
 * -- CONFIRMED HONEST-VALUE FINDING (RN_G2_UI_SCOPE.md §D 3-way domain,
 * verified by reading `kpiScorecardTypes.ts`'s `ScorecardSnapshotItemFact`):
 * `actualValue: number | null` — there is NO `'not_calculable'` literal
 * anywhere in the KPI/Scorecard backend (grepped
 * `server/src/services/resultsVnext/kpi/`: zero hits; the only
 * `not_calculable` producers in this backend are the OKR engines). This
 * package therefore treats KPI-scorecard numeric facts as the 2-way
 * `number | null` domain honestly — `HonestValueCell` is still used for its
 * `null` → "—" rendering discipline, but the 3-way not_calculable-vs-null
 * visual-distinctness QA axis is N/A for this domain (documented, not
 * fabricated — see the dev-render harness screen header for the same note).
 */
import { Api } from '@/services/api';

import { isNotFoundError } from '../kpiApi';

export { isNotFoundError } from '../kpiApi';

// ==========================================
// ENUMS (mirror the CHECK constraints in `kpiScorecardTypes.ts` /
// `20260812_rvn_kpi_scorecards.sql`, re-declared client-side per this
// package's own convention — see file header)
// ==========================================

export const KPI_SCORECARD_SCOPE_TYPES = [
  'organization',
  'business_unit',
  'team',
  'process',
  'individual',
  'custom',
] as const;
export type KpiScorecardScopeType = (typeof KPI_SCORECARD_SCOPE_TYPES)[number];

export const KPI_SCORECARD_REVIEW_FREQUENCIES = [
  'weekly',
  'monthly',
  'quarterly',
  'annual',
  'custom',
] as const;
export type KpiScorecardReviewFrequency = (typeof KPI_SCORECARD_REVIEW_FREQUENCIES)[number];

/** No `'pending_approval'` — a Scorecard is a curation/membership object, not
 * a governed contract requiring maker-checker (migration's own column
 * comment, quoted in `kpiScorecardTypes.ts`). Never add a 5th state. */
export const KPI_SCORECARD_LIFECYCLE_STATUSES = ['draft', 'active', 'suspended', 'archived'] as const;
export type KpiScorecardLifecycleStatus = (typeof KPI_SCORECARD_LIFECYCLE_STATUSES)[number];

export const KPI_SCORECARD_ITEM_ROLES = ['primary', 'supporting'] as const;
export type KpiScorecardItemRole = (typeof KPI_SCORECARD_ITEM_ROLES)[number];

export const KPI_SCORECARD_SNAPSHOT_STATUSES = ['draft', 'published', 'superseded'] as const;
export type KpiScorecardSnapshotStatus = (typeof KPI_SCORECARD_SNAPSHOT_STATUSES)[number];

export type KpiScorecardPerformanceStatus = 'on_target' | 'warning' | 'critical' | 'neutral';

// ==========================================
// DTOs (camelCase, mirror the server `to*` mappers)
// ==========================================

export interface KpiScorecardDto {
  scorecardId: string;
  organizationId: string;
  name: string;
  description: string | null;
  scopeType: KpiScorecardScopeType;
  scopeId: string | null;
  ownerUserId: string;
  reviewFrequency: KpiScorecardReviewFrequency;
  lifecycleStatus: KpiScorecardLifecycleStatus;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KpiScorecardItemDto {
  itemId: string;
  scorecardId: string;
  kpiId: string;
  organizationId: string;
  role: KpiScorecardItemRole;
  sortOrder: number;
  displayConfig: Record<string, unknown> | null;
  addedBy: string;
  addedAt: string;
}

/** One frozen KPI fact inside a published review snapshot — the ONLY place
 * in this whole surface that carries a numeric "value" field
 * (`rvn_kpi_scorecard_items` itself "carries NO KPI-fact column", migration's
 * own header comment). `actualValue`/`performanceStatus` are both honestly
 * nullable (no value ever recorded for that KPI at snapshot time) — see file
 * header for the confirmed absence of `'not_calculable'` in this domain. */
export interface ScorecardSnapshotItemFactDto {
  kpiId: string;
  definitionVersionId: string | null;
  itemRole: KpiScorecardItemRole;
  measurementId: string | null;
  actualValue: number | null;
  unit: string | null;
  performanceStatus: KpiScorecardPerformanceStatus | null;
  dataQualityStatus: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface ScorecardStatusCountsDto {
  safe: number;
  warning: number;
  critical: number;
  missing: number;
}

export interface ScorecardSnapshotPayloadDto {
  items: ScorecardSnapshotItemFactDto[];
  statusCounts: ScorecardStatusCountsDto;
}

export interface KpiScorecardReviewSnapshotDto {
  snapshotId: string;
  scorecardId: string;
  organizationId: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  snapshotPayload: ScorecardSnapshotPayloadDto | null;
  status: KpiScorecardSnapshotStatus;
  contentHash: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  supersededBySnapshotId: string | null;
  supersededAt: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** `GET /:scorecardId/status` response shape — "realne źródło stanu karty"
 * per the task brief; rendered as-is, no invented health thresholds/colors. */
export interface ScorecardStatusDistributionDto extends ScorecardStatusCountsDto {
  totalVisible: number;
}

// ==========================================
// listScorecards — GET /api/vnext/results/kpi/scorecards
// ==========================================

export interface ListKpiScorecardsParams {
  lifecycleStatus?: KpiScorecardLifecycleStatus;
  ownerUserId?: string;
  limit?: number;
  offset?: number;
}

export async function listKpiScorecards(
  params: ListKpiScorecardsParams = {}
): Promise<KpiScorecardDto[]> {
  const qs = new URLSearchParams();
  if (params.lifecycleStatus) qs.set('lifecycleStatus', params.lifecycleStatus);
  if (params.ownerUserId) qs.set('ownerUserId', params.ownerUserId);
  qs.set('limit', String(params.limit ?? 200));
  qs.set('offset', String(params.offset ?? 0));
  const resp = await Api.get(`/vnext/results/kpi/scorecards?${qs.toString()}`);
  return (resp?.scorecards ?? []) as KpiScorecardDto[];
}

// ==========================================
// getScorecard — GET /api/vnext/results/kpi/scorecards/:scorecardId
// `null` on 404 (does-not-exist AND visibility-denied collapse to the same
// code — see file header, same non-distinguishing shape as `kpiApi.ts`'s
// `getKpi`).
// ==========================================

export async function getKpiScorecard(scorecardId: string): Promise<KpiScorecardDto | null> {
  try {
    const resp = await Api.get(`/vnext/results/kpi/scorecards/${encodeURIComponent(scorecardId)}`);
    return (resp?.scorecard ?? null) as KpiScorecardDto | null;
  } catch (err) {
    if (isNotFoundError(err)) return null;
    throw err;
  }
}

// ==========================================
// listScorecardItems — GET /api/vnext/results/kpi/scorecards/:scorecardId/items
// ==========================================

export async function listKpiScorecardItems(scorecardId: string): Promise<KpiScorecardItemDto[]> {
  const resp = await Api.get(
    `/vnext/results/kpi/scorecards/${encodeURIComponent(scorecardId)}/items`
  );
  return (resp?.items ?? []) as KpiScorecardItemDto[];
}

// ==========================================
// getScorecardStatusDistribution — GET .../status
// ==========================================

export async function getKpiScorecardStatusDistribution(
  scorecardId: string,
  asOf?: string
): Promise<ScorecardStatusDistributionDto> {
  const qs = asOf ? `?asOf=${encodeURIComponent(asOf)}` : '';
  const resp = await Api.get(
    `/vnext/results/kpi/scorecards/${encodeURIComponent(scorecardId)}/status${qs}`
  );
  return resp?.distribution as ScorecardStatusDistributionDto;
}

// ==========================================
// listReviewSnapshots — GET .../review-snapshots
// ==========================================

export interface ListKpiScorecardReviewSnapshotsParams {
  status?: KpiScorecardSnapshotStatus;
  limit?: number;
  offset?: number;
}

export async function listKpiScorecardReviewSnapshots(
  scorecardId: string,
  params: ListKpiScorecardReviewSnapshotsParams = {}
): Promise<KpiScorecardReviewSnapshotDto[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  qs.set('limit', String(params.limit ?? 100));
  qs.set('offset', String(params.offset ?? 0));
  const resp = await Api.get(
    `/vnext/results/kpi/scorecards/${encodeURIComponent(scorecardId)}/review-snapshots?${qs.toString()}`
  );
  return (resp?.snapshots ?? []) as KpiScorecardReviewSnapshotDto[];
}

// ==========================================
// getPublishedSnapshot — GET .../review-snapshots/published
// `null` on 404 ("no published review snapshot for this scorecard" — a real,
// expected state for any scorecard that has never published one, NOT a
// forbidden/deny case; distinct from `getKpiScorecard`'s 404 handling above,
// which DOES mean forbidden/not-found. Never conflate the two.)
// ==========================================

export async function getPublishedKpiScorecardSnapshot(
  scorecardId: string
): Promise<KpiScorecardReviewSnapshotDto | null> {
  try {
    const resp = await Api.get(
      `/vnext/results/kpi/scorecards/${encodeURIComponent(scorecardId)}/review-snapshots/published`
    );
    return (resp?.snapshot ?? null) as KpiScorecardReviewSnapshotDto | null;
  } catch (err) {
    if (isNotFoundError(err)) return null;
    throw err;
  }
}

// ==========================================
// Lifecycle: activate / suspend / archive — CAS'd (`expectedVersion`), same
// shape as `../kpiApi.ts`'s `postLifecycleAction`. Real server-enforced
// transition rules (read from `kpiScorecardCommands.ts`'s
// `runScorecardLifecycleTransition`, NOT guessed):
//   activate:  fromStatuses = [draft, suspended] → active
//              (requires >=1 member — 409 `NO_MEMBERS` if the scorecard has
//              no items yet; the LIST tab cannot know a row's member count
//              without an N+1 fetch, so it surfaces this via toast on
//              failure, same pattern `../kpiApi.ts`'s own `noApprovedVersionReason`
//              comment documents for KPI activation; the DETAIL page, which
//              already has `items` loaded, CAN and does grey this out
//              honestly with the real reason.)
//   suspend:   fromStatuses = [active] → suspended
//   archive:   fromStatuses = [draft, active, suspended] → archived (terminal)
// ==========================================

export interface KpiScorecardLifecycleActionInput {
  scorecardId: string;
  expectedVersion: number;
  reason?: string | null;
}

async function postScorecardLifecycleAction(
  action: 'activate' | 'suspend' | 'archive',
  input: KpiScorecardLifecycleActionInput
): Promise<KpiScorecardDto> {
  const resp = await Api.post(
    `/vnext/results/kpi/scorecards/${encodeURIComponent(input.scorecardId)}/${action}`,
    { expectedVersion: input.expectedVersion, reason: input.reason ?? null }
  );
  return resp?.scorecard as KpiScorecardDto;
}

export const activateKpiScorecard = (input: KpiScorecardLifecycleActionInput) =>
  postScorecardLifecycleAction('activate', input);
export const suspendKpiScorecard = (input: KpiScorecardLifecycleActionInput) =>
  postScorecardLifecycleAction('suspend', input);
export const archiveKpiScorecard = (input: KpiScorecardLifecycleActionInput) =>
  postScorecardLifecycleAction('archive', input);
