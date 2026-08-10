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
 *
 * -- RN-G2 §G #7 (2026-08-10): added the four measurement WRITE commands
 * (`recordKpiMeasurement`/`correctKpiMeasurement`/`verifyKpiMeasurement`/
 * `disputeKpiMeasurement`) alongside the pre-existing read-only
 * `listKpiMeasurements`. See each function's own doc comment for the
 * contract details (append-only supersession, no CAS, no role gate — all
 * verified against the real router/commands, not assumed).
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
  /** Raw JSON error body (`services/api.ts`'s `err.data`) — carries `.code`,
   * e.g. `NO_CURRENT_VERSION`/`MEASUREMENT_NOT_FOUND` (kpi.routes.ts's
   * `handleKpiRouteError`). Read this instead of string-matching `.message`. */
  data?: { code?: string; error?: string; details?: Record<string, unknown> };
}

function isHttpError(err: unknown): err is HttpError {
  return err instanceof Error && typeof (err as HttpError).status === 'number';
}

export function isNotFoundError(err: unknown): boolean {
  return isHttpError(err) && err.status === 404;
}

/** `err.data.code` from the server's `handleKpiRouteError` mapping — used by
 * the measurements package to distinguish `NO_CURRENT_VERSION` (409, a real
 * precondition — see `recordMeasurement` route doc) from any other failure,
 * without string-matching `.message`. */
export function httpErrorCode(err: unknown): string | undefined {
  return isHttpError(err) ? err.data?.code : undefined;
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
  offset?: number;
  includeSuperseded?: boolean;
  periodStart?: string;
  periodEnd?: string;
}

/** `GET /api/vnext/results/kpi/:kpiId/measurements` — newest period first.
 * `includeSuperseded` (default `false` server-side, per `ListMeasurementsQuerySchema`
 * / `kpiRepository.ts`'s `listMeasurements` doc comment): `false` returns only
 * "current" rows (latest per period — an original if never corrected/verified/
 * disputed, otherwise the newest superseding row); `true` returns the FULL
 * append-only history, every correction/verify/dispute row included. The RN-G2
 * measurements panel (`./kpiMeasurements/ResultsKpiMeasurementsPanel.tsx`) uses
 * both: `false` for its "Bieżące" tab, `true` for "Pełna historia". */
export async function listKpiMeasurements(
  kpiId: string,
  params: ListKpiMeasurementsParams = {}
): Promise<KpiMeasurementDto[]> {
  const qs = new URLSearchParams();
  qs.set('limit', String(params.limit ?? 1));
  if (params.offset) qs.set('offset', String(params.offset));
  if (params.includeSuperseded) qs.set('includeSuperseded', 'true');
  if (params.periodStart) qs.set('periodStart', params.periodStart);
  if (params.periodEnd) qs.set('periodEnd', params.periodEnd);
  const resp = await Api.get(
    `/vnext/results/kpi/${encodeURIComponent(kpiId)}/measurements?${qs.toString()}`
  );
  return (resp?.measurements ?? []) as KpiMeasurementDto[];
}

// ==========================================
// RN-G2 §G #7 (2026-08-10) — measurement WRITE commands:
// `POST .../measurements` (record) · `POST .../measurements/:id/corrections`
// (correct) · `.../verify` · `.../dispute`. Contracts verified by reading the
// real router (`server/src/routes/resultsVnext/kpi.routes.ts`) and commands
// (`server/src/services/resultsVnext/kpi/kpiMeasurementCommands.ts`) before
// writing this — NOT assumed from the task brief:
//
//  - `performanceStatus` is NEVER sent by the client — the route computes it
//    server-side from the KPI's current definition-version bounds
//    (`evaluatePerformanceStatus`) precisely so a self-reporting client can't
//    fudge it (kpi.routes.ts file header, "DESIGN NOTE"). This module has no
//    field for it on the write side at all.
//  - None of the four commands takes `expectedVersion`/CAS — decyzja #12
//    (kpiMeasurementCommands.ts file header): `rvn_kpi_measurements` is
//    APPEND-ONLY (`REVOKE UPDATE, DELETE` on the table), so `correct`/`verify`/
//    `dispute` each INSERT a NEW row referencing the original via
//    `correctionOfMeasurementId` — NEVER an UPDATE of the original. The
//    response's `original`/`measurement` pair reflects this: `original` is the
//    unchanged prior row, `measurement` is the new superseding row.
//  - NO role/self-check of any kind was found for correct/verify/dispute
//    (grepped `kpiMeasurementCommands.ts` for `actorEffectiveRole`/role
//    checks — none gate these three, unlike `kpiDefinitionCommands.ts`'s
//    `SelfApprovalDeniedError` for definition-version approval). Any org
//    member with API access can verify/dispute/correct any measurement of
//    any KPI they can see. This is a real, current backend gap, not a UI
//    omission — flagged in the task report, not silently hidden by graying
//    out a button this package has no authority to invent a rule for.
// ==========================================

export interface RecordKpiMeasurementInput {
  /** Omit to record against the KPI's current definition version (server
   * resolves via `getKpi`) — this UI always omits it (no version picker). */
  definitionVersionId?: string;
  periodStart: string;
  periodEnd: string;
  /** `null` is a REAL, valid value here (`RecordMeasurementSchema.actualValue`
   * is `.nullable()`, not `.optional()`) — "this period was measured and
   * genuinely has no value", distinct from never recording the period at
   * all. The record form's "no value" toggle sends `null`, never a
   * fabricated `0`. */
  actualValue: number | null;
  source: string;
  notes?: string | null;
  reason?: string | null;
}

export async function recordKpiMeasurement(
  kpiId: string,
  input: RecordKpiMeasurementInput
): Promise<KpiMeasurementDto> {
  const resp = await Api.post(`/vnext/results/kpi/${encodeURIComponent(kpiId)}/measurements`, {
    definitionVersionId: input.definitionVersionId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    actualValue: input.actualValue,
    source: input.source,
    notes: input.notes ?? null,
    reason: input.reason ?? null,
  });
  return resp?.measurement as KpiMeasurementDto;
}

export interface KpiMeasurementSupersedeResult {
  original: KpiMeasurementDto;
  measurement: KpiMeasurementDto;
}

export interface CorrectKpiMeasurementInput {
  actualValue: number | null;
  correctionReason: string;
}

export async function correctKpiMeasurement(
  kpiId: string,
  measurementId: string,
  input: CorrectKpiMeasurementInput
): Promise<KpiMeasurementSupersedeResult> {
  const resp = await Api.post(
    `/vnext/results/kpi/${encodeURIComponent(kpiId)}/measurements/${encodeURIComponent(measurementId)}/corrections`,
    { actualValue: input.actualValue, correctionReason: input.correctionReason }
  );
  return { original: resp?.original, measurement: resp?.measurement } as KpiMeasurementSupersedeResult;
}

export interface VerifyKpiMeasurementInput {
  notes?: string | null;
}

export async function verifyKpiMeasurement(
  kpiId: string,
  measurementId: string,
  input: VerifyKpiMeasurementInput = {}
): Promise<KpiMeasurementSupersedeResult> {
  const resp = await Api.post(
    `/vnext/results/kpi/${encodeURIComponent(kpiId)}/measurements/${encodeURIComponent(measurementId)}/verify`,
    { notes: input.notes ?? null }
  );
  return { original: resp?.original, measurement: resp?.measurement } as KpiMeasurementSupersedeResult;
}

export interface DisputeKpiMeasurementInput {
  disputeReason: string;
}

export async function disputeKpiMeasurement(
  kpiId: string,
  measurementId: string,
  input: DisputeKpiMeasurementInput
): Promise<KpiMeasurementSupersedeResult> {
  const resp = await Api.post(
    `/vnext/results/kpi/${encodeURIComponent(kpiId)}/measurements/${encodeURIComponent(measurementId)}/dispute`,
    { disputeReason: input.disputeReason }
  );
  return { original: resp?.original, measurement: resp?.measurement } as KpiMeasurementSupersedeResult;
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
