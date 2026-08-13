/**
 * RN-G5 §G #30 — "Attention" cross-cutting view API client. Wraps the three
 * endpoints §G #30 named as having ZERO consumers anywhere in
 * `src/components/ResultsVNext/`:
 *   - `GET /api/vnext/results/kpi/attention` — `listOrganizationKpiAttention`
 *     (`server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.ts`
 *     L597-624, route at `kpiPerspectives.routes.ts` L240-262)
 *   - `GET /api/vnext/results/okr/attention` — `listOrganizationOkrAttention`
 *     (`server/src/services/resultsVnext/okr/okrAttentionRepository.ts`
 *     L262-274, route at `okr.routes.ts` L2987-2995)
 *   - `GET /api/vnext/results/okr/team-health` — `listOrganizationOkrTeamHealth`
 *     (`server/src/services/resultsVnext/okr/okrPerspectivesRepository.ts`
 *     L190-231, route at `okr.routes.ts` L948-957)
 *
 * -- ★ CONFIRMED SHAPE (read from the server, not assumed —
 * `docs/product/results-vnext/RN_G5_SCOPEGAP_DESIGN.md` §1 has the full
 * trail): NEITHER `kpi/attention` NOR `okr/attention` returns a flat list of
 * "attention items". Both are ORCHESTRATORS over several INDEPENDENT
 * sub-queries, returned as a single object keyed by named bucket, each
 * bucket its OWN array of a DIFFERENT row shape (`OrganizationKpiAttention`
 * has 7 keys: `processCoverage`/`ownerLoad`/`missingOwnership`/
 * `performanceDistribution` (the one non-array bucket — 4 counts, not a
 * list)/`overdueObligations`/`repeatedDeviations`/
 * `ineffectiveCorrectiveActions`; `OrganizationOkrAttention` has 5:
 * `staleCheckins`/`lowConfidenceObjectives`/`openSupportRequests`/
 * `openBlockers`/`escalatedSets`). The kpiApi.ts comment this task brief
 * flagged (`listMyKpis`/`listOrganizationKpiAttention` are "an aggregate-
 * stats view") is correct — verified against `kpiPerspectivesRepository.ts`
 * directly. `okr/team-health` is a THIRD, structurally different aggregate
 * again (2 count-breakdowns + 1 attention-state breakdown + a `sets` list —
 * `OrganizationOkrTeamHealth`), not "attention items" at all.
 *
 * KPI and OKR attention are therefore NOT literally mergeable into one flat
 * table — no shared row shape exists between them (see
 * `ResultsAttentionPage.tsx` header for how this package still builds ONE
 * shared UI pattern despite that, per §G #30's own instruction).
 *
 * Follows the sibling `../kpiApi.ts` convention (`Api.get`, camelCase DTOs
 * mirroring the server's `to*`-free raw JSON 1:1 — these three endpoints
 * return their repository types as-is, no `to*` mapper layer server-side).
 */
import { Api } from '@/services/api';

// ==========================================
// KPI attention — GET /api/vnext/results/kpi/attention
// ==========================================

export interface KpiAttentionProcessCoverageRow {
  primaryProcessId: string | null;
  totalKpis: number;
  activeKpis: number;
}

export interface KpiAttentionOwnerLoadRow {
  ownerUserId: string;
  activeKpiCount: number;
  openDeviationCaseCount: number;
}

export interface KpiAttentionMissingOwnershipRow {
  kpiId: string;
  kpiCode: string;
}

export interface KpiAttentionPerformanceDistribution {
  onTarget: number;
  warning: number;
  critical: number;
  neutralOrMissing: number;
}

export interface KpiAttentionOverdueObligationRow {
  obligationId: string;
  kpiId: string;
  assigneeUserId: string;
  obligationType: string;
  dueAt: string;
}

export interface KpiAttentionRepeatedDeviationRow {
  kpiId: string;
  kpiCode: string;
  caseCountLast180Days: number;
  anySelfReportedRecurrence: boolean;
}

export interface KpiAttentionIneffectiveCorrectiveActionRow {
  caseId: string;
  kpiId: string;
  verificationId: string;
  status: 'ineffective' | 'partially_effective';
}

export interface OrganizationKpiAttentionDto {
  processCoverage: KpiAttentionProcessCoverageRow[];
  ownerLoad: KpiAttentionOwnerLoadRow[];
  missingOwnership: KpiAttentionMissingOwnershipRow[];
  performanceDistribution: KpiAttentionPerformanceDistribution;
  overdueObligations: KpiAttentionOverdueObligationRow[];
  repeatedDeviations: KpiAttentionRepeatedDeviationRow[];
  ineffectiveCorrectiveActions: KpiAttentionIneffectiveCorrectiveActionRow[];
}

export interface ListKpiAttentionParams {
  includeSelf?: boolean;
  recurrenceWindowDays?: number;
}

export async function getOrganizationKpiAttention(
  params: ListKpiAttentionParams = {}
): Promise<OrganizationKpiAttentionDto> {
  const qs = new URLSearchParams();
  if (params.includeSelf !== undefined) qs.set('includeSelf', String(params.includeSelf));
  if (params.recurrenceWindowDays !== undefined) {
    qs.set('recurrenceWindowDays', String(params.recurrenceWindowDays));
  }
  const query = qs.toString();
  const resp = await Api.get(`/vnext/results/kpi/attention${query ? `?${query}` : ''}`);
  return resp?.attention as OrganizationKpiAttentionDto;
}

// ==========================================
// OKR attention — GET /api/vnext/results/okr/attention
// ==========================================

export interface OkrAttentionStaleCheckinSetRow {
  setId: string;
  title: string;
  nextCheckinDueAt: string;
}

export interface OkrAttentionLowConfidenceObjectiveRow {
  keyResultId: string;
  objectiveId: string;
  setId: string;
  title: string;
  confidence: string;
}

export interface OkrAttentionOpenSupportRequestRow {
  requestId: string;
  setId: string;
  objectiveId: string;
  keyResultId: string | null;
  assignedToUserId: string | null;
  status: string;
}

export interface OkrAttentionOpenBlockerRow {
  checkInId: string;
  keyResultId: string;
  objectiveId: string;
  setId: string;
  blocker: string;
}

export interface OkrAttentionEscalatedSetRow {
  setId: string;
  title: string;
  attentionState: string;
}

export interface OrganizationOkrAttentionDto {
  staleCheckins: OkrAttentionStaleCheckinSetRow[];
  lowConfidenceObjectives: OkrAttentionLowConfidenceObjectiveRow[];
  openSupportRequests: OkrAttentionOpenSupportRequestRow[];
  openBlockers: OkrAttentionOpenBlockerRow[];
  escalatedSets: OkrAttentionEscalatedSetRow[];
}

export async function getOrganizationOkrAttention(): Promise<OrganizationOkrAttentionDto> {
  const resp = await Api.get('/vnext/results/okr/attention');
  return resp?.attention as OrganizationOkrAttentionDto;
}

// ==========================================
// OKR team health — GET /api/vnext/results/okr/team-health
// ==========================================

export interface OkrTeamHealthSetSummaryRow {
  setId: string;
  currentVersion: number;
  status: string;
  scopeType: string;
}

export interface OrganizationOkrTeamHealthDto {
  countsByStatus: Array<{ status: string; count: number }>;
  countsByScopeType: Array<{ scopeType: string; count: number }>;
  attentionBreakdown: Array<{ attentionState: string; count: number }>;
  sets: OkrTeamHealthSetSummaryRow[];
}

export async function getOrganizationOkrTeamHealth(): Promise<OrganizationOkrTeamHealthDto> {
  const resp = await Api.get('/vnext/results/okr/team-health');
  return resp?.teamHealth as OrganizationOkrTeamHealthDto;
}
