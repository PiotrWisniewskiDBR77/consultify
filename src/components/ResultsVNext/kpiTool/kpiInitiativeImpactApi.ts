/**
 * RN-G3 lane (KPI full tool, klasa L) — typed fetch wrappers over
 * `/api/vnext/results/kpi/initiative-impacts*` and
 * `/api/vnext/results/kpi/:kpiId/initiative-impacts`
 * (`server/src/routes/resultsVnext/kpiPerspectives.routes.ts` L266-462).
 *
 * Feeds the KPI Tool's "Initiatives affecting KPI" section (plan
 * `02_KPI_IMPLEMENTATION_PLAN.md` §6.8 item 6). This is the ONLY reverse-
 * relation read endpoint that actually exists for the KPI Tool's context
 * sections — contrast with "Scorecards and contexts" (§6.8 item 7), which
 * has NO reverse `kpi -> scorecards` endpoint anywhere in
 * `kpiScorecard.routes.ts` (grepped: only `GET /:scorecardId/items`,
 * forward scorecard -> items, never kpi -> scorecards) — see
 * `KpiToolPage.tsx`'s own header comment for how that gap is disclosed.
 *
 * -- LIFECYCLE (`kpiInitiativeImpactCommands.ts`, `InitiativeKpiImpactStatus`
 * = proposed | committed | superseded | realized_reviewed | cancelled):
 *   - proposeInitiativeKpiImpact: creates a 'proposed' row, baseline_* stays
 *     NULL (never fabricated — invariant #6, "missing is never inferred as
 *     zero").
 *   - commitInitiativeKpiImpact: requires `currentRow.status !== 'proposed'`
 *     to be false, i.e. only a 'proposed' impact may commit
 *     (`kpiInitiativeImpactCommands.ts:301`). Pins the KPI's CURRENT latest
 *     measurement as the frozen baseline inside the same transaction — if no
 *     measurement exists yet, baseline_* stays NULL (honest, not a 0).
 *   - recordReviewedAttribution: self-review denial FIRST — server rejects
 *     when the caller equals `committed_by`
 *     (`InitiativeKpiImpactSelfApprovalDeniedError`, :460-461); requires
 *     status in ('committed','superseded') (:464).
 *   - supersedeInitiativeKpiImpact: requires status in
 *     ('proposed','committed') (:586); creates a fresh 'proposed' replacement
 *     row in the SAME transaction, never edits history.
 *
 * -- KNOWN GAP: same "no role/actor gate beyond the explicit self-review
 * check" pattern as every other KPI command surface this package touches —
 * verified by reading `kpiInitiativeImpactCommands.ts` in full; the ONLY
 * actor check anywhere is the `committed_by === reviewedBy` denial quoted
 * above. Any org member who can see the KPI can propose/commit/supersede an
 * impact link.
 */
import { Api } from '@/services/api';
import { isNotFoundError } from '../kpiApi';

export const INITIATIVE_KPI_IMPACT_STATUSES = [
  'proposed',
  'committed',
  'superseded',
  'realized_reviewed',
  'cancelled',
] as const;
export type InitiativeKpiImpactStatus = (typeof INITIATIVE_KPI_IMPACT_STATUSES)[number];

export const INITIATIVE_KPI_IMPACT_DIRECTIONS = ['increase', 'decrease'] as const;
export type InitiativeKpiImpactDirection = (typeof INITIATIVE_KPI_IMPACT_DIRECTIONS)[number];

export interface InitiativeKpiImpactDto {
  impactId: string;
  organizationId: string;
  kpiId: string;
  initiativeId: string;
  definitionVersionIdAtCommitment: string | null;
  status: InitiativeKpiImpactStatus;
  expectedContributionValue: number | null;
  expectedContributionDirection: InitiativeKpiImpactDirection | null;
  targetCompletionDate: string | null;
  proposedBy: string;
  proposedAt: string;
  baselineMeasurementId: string | null;
  baselineValueAtCommitment: number | null;
  baselinePeriodEnd: string | null;
  committedBy: string | null;
  committedAt: string | null;
  reviewedAttributionValue: number | null;
  reviewedAttributionMeasurementId: string | null;
  reviewRationale: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  supersededByImpactId: string | null;
  supersededAt: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListInitiativeImpactsParams {
  status?: InitiativeKpiImpactStatus;
  limit?: number;
  offset?: number;
}

/** `GET /api/vnext/results/kpi/:kpiId/initiative-impacts`
 * (`kpiPerspectives.routes.ts:439-462`). Returns `[]` (not an error) on a
 * 404 from the underlying visibility-scoped query — mirrors the
 * `listKpis`-style "empty is a valid answer" convention used elsewhere in
 * this domain; a true access-denial to the KPI itself is handled upstream by
 * `getKpi` returning `null` before this is ever called. */
export async function listInitiativeImpactsForKpi(
  kpiId: string,
  params: ListInitiativeImpactsParams = {}
): Promise<InitiativeKpiImpactDto[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  qs.set('limit', String(params.limit ?? 100));
  qs.set('offset', String(params.offset ?? 0));
  try {
    const resp = await Api.get(
      `/vnext/results/kpi/${encodeURIComponent(kpiId)}/initiative-impacts?${qs.toString()}`
    );
    return (resp?.impacts ?? []) as InitiativeKpiImpactDto[];
  } catch (err) {
    if (isNotFoundError(err)) return [];
    throw err;
  }
}

interface ImpactOutcome {
  outcome: string;
  eventId: string | null;
  resultingVersion: number;
  impact: InitiativeKpiImpactDto;
}

export interface ProposeInitiativeKpiImpactInput {
  kpiId: string;
  initiativeId: string;
  expectedContributionValue?: number | null;
  expectedContributionDirection?: InitiativeKpiImpactDirection | null;
  targetCompletionDate?: string | null;
  reason?: string | null;
}

/** `POST /api/vnext/results/kpi/initiative-impacts`. */
export async function proposeInitiativeKpiImpact(
  input: ProposeInitiativeKpiImpactInput
): Promise<ImpactOutcome> {
  const resp = await Api.post('/vnext/results/kpi/initiative-impacts', input);
  return resp as ImpactOutcome;
}

export interface CommitInitiativeKpiImpactInput {
  expectedVersion: number;
  reason?: string | null;
}

/** `POST .../initiative-impacts/:impactId/commit` — proposed -> committed. */
export async function commitInitiativeKpiImpact(
  impactId: string,
  input: CommitInitiativeKpiImpactInput
): Promise<ImpactOutcome> {
  const resp = await Api.post(
    `/vnext/results/kpi/initiative-impacts/${encodeURIComponent(impactId)}/commit`,
    input
  );
  return resp as ImpactOutcome;
}

export interface RecordReviewedAttributionInput {
  expectedVersion: number;
  reviewedAttributionValue: number;
  reviewedAttributionMeasurementId?: string | null;
  reviewRationale: string;
  reason?: string | null;
}

/** `POST .../initiative-impacts/:impactId/review` — committed|superseded ->
 * (status unchanged; records the reviewed attribution fields). Server
 * rejects with a self-approval 403 when the caller is `committedBy`. */
export async function recordReviewedAttribution(
  impactId: string,
  input: RecordReviewedAttributionInput
): Promise<ImpactOutcome> {
  const resp = await Api.post(
    `/vnext/results/kpi/initiative-impacts/${encodeURIComponent(impactId)}/review`,
    input
  );
  return resp as ImpactOutcome;
}

export interface SupersedeInitiativeKpiImpactInput {
  expectedVersion: number;
  replacement: {
    expectedContributionValue?: number | null;
    expectedContributionDirection?: InitiativeKpiImpactDirection | null;
    targetCompletionDate?: string | null;
  };
  reason?: string | null;
}

interface SupersedeOutcome {
  outcome: string;
  eventId: string | null;
  resultingVersion: number;
  superseded: InitiativeKpiImpactDto;
  replacement: InitiativeKpiImpactDto;
}

/** `POST .../initiative-impacts/:impactId/supersede` — proposed|committed ->
 * superseded (this row) + a fresh 'proposed' replacement row. */
export async function supersedeInitiativeKpiImpact(
  impactId: string,
  input: SupersedeInitiativeKpiImpactInput
): Promise<SupersedeOutcome> {
  const resp = await Api.post(
    `/vnext/results/kpi/initiative-impacts/${encodeURIComponent(impactId)}/supersede`,
    input
  );
  return resp as SupersedeOutcome;
}
