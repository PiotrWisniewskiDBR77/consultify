/**
 * RN-G2 P1 — thin typed fetch wrappers over `Api.get`/`Api.post` for the KPI
 * registry surface (`/api/vnext/results/kpi*`, see
 * `server/src/routes/resultsVnext/kpi.routes.ts` and
 * `kpiPerspectives.routes.ts`).
 *
 * Local DTO shapes below MIRROR the server's camelCase JSON output
 * (`server/src/services/resultsVnext/kpi/kpiTypes.ts`'s `toKpiDefinition`/
 * `toKpiMeasurement`) — they are NOT imported from the server package (the
 * client and server are separate TS builds in this repo; every other
 * frontend `*Api.ts`/dev-render mock in this codebase re-declares its own
 * wire-shape types the same way). Keep these in sync by hand if the server
 * DTOs change shape.
 *
 * -- CONFIRMED BACKEND GAP (see RN_G2 P1 report): `GET /kpi` and
 * `GET /kpi/:kpiId` both return the bare `rvn_kpi_definitions` row
 * (`KpiDefinition` — kpiCode/status/owner/timestamps only). There is NO GET
 * endpoint anywhere in `kpi.routes.ts`/`kpiPerspectives.routes.ts` that
 * returns the joined `rvn_kpi_definition_versions` row (name/unit/target
 * geometry/approval status) — only the three WRITE endpoints that mutate a
 * version (`createKpiDraft`, `approveDefinitionVersion`,
 * `rejectDefinitionVersion`) return it, as a side effect of the mutation.
 * `listMyKpis`/`listOrganizationKpiAttention` are an obligations/attention
 * feed and an aggregate-stats view respectively — neither is a KPI-row list.
 * Practical effect: this module cannot honestly resolve a KPI's display
 * *name* (only its `kpiCode`) or its target/current-value fields anywhere
 * except a lazily-fetched latest measurement's `actualValue`.
 */
import { Api } from '@/services/api';

export const KPI_STATUSES = [
  'draft',
  'pending_approval',
  'active',
  'suspended',
  'archived',
] as const;
export type KpiStatus = (typeof KPI_STATUSES)[number];

export const KPI_PERFORMANCE_STATUSES = ['on_target', 'warning', 'critical', 'neutral'] as const;
export type KpiPerformanceStatus = (typeof KPI_PERFORMANCE_STATUSES)[number];

export const KPI_DATA_QUALITY_STATUSES = [
  'unverified',
  'verified',
  'disputed',
  'estimated',
] as const;
export type KpiDataQualityStatus = (typeof KPI_DATA_QUALITY_STATUSES)[number];

/** Wire shape of `rvn_kpi_definitions`, camelCased server-side by `toKpiDefinition`. */
export interface KpiDefinitionDto {
  kpiId: string;
  organizationId: string;
  kpiCode: string;
  status: KpiStatus;
  currentDefinitionVersionId: string | null;
  primaryProcessId: string | null;
  responsePolicyId: string | null;
  ownerUserId: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Wire shape of `rvn_kpi_measurements`, camelCased server-side by `toKpiMeasurement`. */
export interface KpiMeasurementDto {
  measurementId: string;
  kpiId: string;
  definitionVersionId: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  /** `null` = no value was ever recorded for this period — NEVER fabricate 0. */
  actualValue: number | null;
  performanceStatus: KpiPerformanceStatus;
  dataQualityStatus: KpiDataQualityStatus;
  correctionOfMeasurementId: string | null;
  correctionReason: string | null;
  source: string;
  evidenceRefs: unknown[];
  notes: string | null;
  recordedBy: string;
  recordedAt: string;
}

export interface HttpError extends Error {
  status?: number;
}

function isHttpError(err: unknown): err is HttpError {
  return err instanceof Error && typeof (err as HttpError).status === 'number';
}

export function isNotFoundError(err: unknown): boolean {
  return isHttpError(err) && err.status === 404;
}

export interface ListKpisParams {
  status?: KpiStatus;
  limit?: number;
  offset?: number;
}

/** `GET /api/vnext/results/kpi` — the only real registry-list endpoint. */
export async function listKpis(params: ListKpisParams = {}): Promise<KpiDefinitionDto[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  qs.set('limit', String(params.limit ?? 200));
  qs.set('offset', String(params.offset ?? 0));
  const resp = await Api.get(`/vnext/results/kpi?${qs.toString()}`);
  return (resp?.kpis ?? []) as KpiDefinitionDto[];
}

/**
 * `GET /api/vnext/results/kpi/:kpiId` — returns `null` on a 404 (the same
 * HTTP code the backend uses for BOTH "does not exist" and "exists but
 * visibility-denied" — see file header, this route does not distinguish the
 * two, unlike the closed ABAC DENY-reason vocabulary `RN_G1_PLATFORM_DESIGN.md`
 * §B defines for the platform in general).
 */
export async function getKpi(kpiId: string): Promise<KpiDefinitionDto | null> {
  try {
    const resp = await Api.get(`/vnext/results/kpi/${encodeURIComponent(kpiId)}`);
    return (resp?.kpi ?? null) as KpiDefinitionDto | null;
  } catch (err) {
    if (isNotFoundError(err)) return null;
    throw err;
  }
}

export interface ListKpiMeasurementsParams {
  limit?: number;
  includeSuperseded?: boolean;
}

/** `GET /api/vnext/results/kpi/:kpiId/measurements` — newest period first. */
export async function listKpiMeasurements(
  kpiId: string,
  params: ListKpiMeasurementsParams = {}
): Promise<KpiMeasurementDto[]> {
  const qs = new URLSearchParams();
  qs.set('limit', String(params.limit ?? 1));
  if (params.includeSuperseded) qs.set('includeSuperseded', 'true');
  const resp = await Api.get(
    `/vnext/results/kpi/${encodeURIComponent(kpiId)}/measurements?${qs.toString()}`
  );
  return (resp?.measurements ?? []) as KpiMeasurementDto[];
}

export interface KpiLifecycleActionInput {
  kpiId: string;
  expectedVersion: number;
  reason?: string | null;
}

async function postLifecycleAction(
  action: 'activate' | 'suspend' | 'archive',
  input: KpiLifecycleActionInput
): Promise<KpiDefinitionDto> {
  const resp = await Api.post(`/vnext/results/kpi/${encodeURIComponent(input.kpiId)}/${action}`, {
    expectedVersion: input.expectedVersion,
    reason: input.reason ?? null,
  });
  return resp?.kpi as KpiDefinitionDto;
}

/** `POST /:kpiId/activate` — 409 `NO_APPROVED_VERSION` when the KPI has no
 * approved definition version yet (draft/pending_approval rows). */
export const activateKpi = (input: KpiLifecycleActionInput) => postLifecycleAction('activate', input);
export const suspendKpi = (input: KpiLifecycleActionInput) => postLifecycleAction('suspend', input);
export const archiveKpi = (input: KpiLifecycleActionInput) => postLifecycleAction('archive', input);
