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
 * -- CONFIRMED BACKEND GAP (see RN_G2 P1 report), PARTIALLY CLOSED by the
 * RN-G6 P0 fix (F1B, `getKpiCurrentDefinitionVersion` below): `GET /kpi` and
 * `GET /kpi/:kpiId` still both return the bare `rvn_kpi_definitions` row
 * (`KpiDefinition` — kpiCode/status/owner/timestamps only) — this module
 * still cannot resolve a KPI's display *name* or target/current-value
 * fields from the LIST/single-row endpoints, only from a lazily-fetched
 * latest measurement's `actualValue` (unchanged). What F1B added is
 * `GET /kpi/:kpiId/version`, which DOES return the joined
 * `rvn_kpi_definition_versions` row (name/unit/target geometry/approval
 * status/CAS `rowVersion`) for a single KPI on demand — see
 * `getKpiCurrentDefinitionVersion` below and
 * `ResultsKpiRegistryPage.tsx`'s "knownVersions" note for why this
 * specifically was P0 (maker-checker was unusable for a second reviewer
 * without it). The three WRITE endpoints that mutate a version
 * (`createKpiDraft`, `approveDefinitionVersion`, `rejectDefinitionVersion`)
 * still also return it as a side effect of the mutation, as before.
 * `listMyKpis`/`listOrganizationKpiAttention` are an obligations/attention
 * feed and an aggregate-stats view respectively — neither is a KPI-row list.
 *
 * -- RN-G2 §G #7 (2026-08-10): added the four measurement WRITE commands
 * (`recordKpiMeasurement`/`correctKpiMeasurement`/`verifyKpiMeasurement`/
 * `disputeKpiMeasurement`) alongside the pre-existing read-only
 * `listKpiMeasurements`. See each function's own doc comment for the
 * contract details (append-only supersession, no CAS, no role gate — all
 * verified against the real router/commands, not assumed).
 *
 * -- RN-G5 (2026-08-12): added the definition-side WRITE commands
 * (`createKpiDraft`/`editKpiDraft`/`submitKpiDefinition`/
 * `approveKpiDefinitionVersion`/`rejectKpiDefinitionVersion`) — until this
 * package, NOTHING in this file (or anywhere in
 * `src/components/ResultsVNext/`) called `POST /kpi`, `PUT /:id/draft`,
 * `POST /:id/submit`, or either `.../definition-versions/:id/(approve|reject)`
 * — verified by grepping this whole tree for `createKpiDraft`/`submitKpi`/
 * `approveDefinitionVersion` before writing this: every prior hit was this
 * file's OWN doc comments, never a call site. It was impossible to create a
 * KPI through the UI at all.
 *
 * Every one of these five, per `kpiDefinitionCommands.ts`
 * (`server/src/services/resultsVnext/kpi/kpiDefinitionCommands.ts`), is CAS'd
 * on the definition VERSION's own `rowVersion` (`expectedVersion` in the
 * request body) — NOT the parent KPI's `rowVersion`. Combined with the
 * "CONFIRMED BACKEND GAP" above (no GET ever returns the version), this means
 * a caller can only safely know the correct `expectedVersion` to send for a
 * version it just created or itself just mutated (the version DTO comes back
 * as part of every one of these five responses) — never for a version loaded
 * cold from a `GET /kpi`/`GET /kpi/:id` list/row alone. `ResultsKpiRegistryPage.tsx`
 * keeps an in-memory `knownVersions` map (populated ONLY from these five
 * functions' own return values) for exactly this reason, and locks
 * edit/submit/approve/reject with an honest reason when a KPI's version isn't
 * in that map — see that file's own header comment for the full design note.
 * This is a real, load-bearing consequence of the backend gap, not a UI
 * choice that could be designed away without a new GET endpoint (out of this
 * package's allowlist — `server/src/services/resultsVnext/**`/
 * `server/src/routes/resultsVnext/**` are the parallel safety track's files).
 *
 * -- RN_G6_P0A (2026-08-12) — added `reviseKpiDefinition`, the fix for the
 * "a rejected KPI is stuck forever" domain-model defect
 * (`docs/product/results-vnext/RN_G6_P0A_KPI_REVISION_CONTRACT.md`). See its
 * own doc comment below.
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

/** Mirrors `kpiTypes.ts`'s `KPI_TARGET_GEOMETRIES` — 'binary' is the
 * zero-event-compliance geometry (`binarySuccessValue`, not the numeric
 * bound columns the other five use). */
export const KPI_TARGET_GEOMETRIES = [
  'threshold_min',
  'threshold_max',
  'range',
  'exact',
  'binary',
  'custom',
] as const;
export type KpiTargetGeometry = (typeof KPI_TARGET_GEOMETRIES)[number];

export const KPI_APPROVAL_STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const;
export type KpiApprovalStatus = (typeof KPI_APPROVAL_STATUSES)[number];

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

/** Wire shape of `rvn_kpi_definition_versions`, camelCased server-side by
 * `toKpiDefinitionVersion` — ONLY ever reachable from the response of one of
 * the five write commands below (see file header "CONFIRMED BACKEND GAP" /
 * RN-G5 note), never from a GET. */
export interface KpiDefinitionVersionDto {
  definitionVersionId: string;
  kpiId: string;
  organizationId: string;
  versionNumber: number;
  name: string;
  description: string | null;
  unit: string | null;
  targetGeometry: KpiTargetGeometry;
  targetValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  warningLow: number | null;
  warningHigh: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  binarySuccessValue: number | null;
  formulaText: string | null;
  approvalStatus: KpiApprovalStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  rowVersion: number;
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

/** `handleKpiRouteError`'s 409 branch (`AtomicWriteConflictError` /
 * `KpiDefinitionValidationError`) — a real CAS/state-transition conflict,
 * distinct from a validation 400 or a not-found 404. */
export function isConflictError(err: unknown): boolean {
  return isHttpError(err) && err.status === 409;
}

/** `handleKpiRouteError`'s 403 branch — `SelfApprovalDeniedError`
 * specifically (`kpiDefinitionCommands.ts`: `submitted_by`/`created_by` ===
 * the approver). No other write endpoint in `kpi.routes.ts` returns 403. */
export function isSelfApprovalDeniedError(err: unknown): boolean {
  return isHttpError(err) && err.status === 403;
}

/** New idempotency key per form OPEN (not per submit) — same convention as
 * `roiApi.ts`'s `newRoiIdempotencyKey`: a retry within the same open (e.g.
 * after a transient network error) reuses it, so a double-send can never
 * create two KPIs / apply the same submit/approve/reject twice. */
export function newKpiIdempotencyKey(): string {
  return crypto.randomUUID();
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

/**
 * `GET /api/vnext/results/kpi/:kpiId/version` (RN-G6 P0 fix — F1B) — the
 * endpoint that closes the "CONFIRMED BACKEND GAP" this file's own header
 * used to describe: until now, `knownVersions` in
 * `ResultsKpiRegistryPage.tsx` could ONLY be populated from a write this
 * same browser tab performed, so a second reviewer who opened a KPI a
 * colleague had just submitted saw Approve/Reject permanently locked — the
 * maker-checker workflow had no working "checker" for anyone but the maker.
 * Same 404-means-either-thing contract as `getKpi` above (D06 generic
 * denial — never distinguishes "doesn't exist" from "exists, not visible").
 */
export async function getKpiCurrentDefinitionVersion(
  kpiId: string
): Promise<KpiDefinitionVersionDto | null> {
  try {
    const resp = await Api.get(`/vnext/results/kpi/${encodeURIComponent(kpiId)}/version`);
    return (resp?.definitionVersion ?? null) as KpiDefinitionVersionDto | null;
  } catch (err) {
    if (isNotFoundError(err)) return null;
    throw err;
  }
}

// ==========================================
// RN-G5 (2026-08-12) — definition-side WRITE commands: create -> edit draft
// -> submit -> approve/reject. Contracts verified by reading the real router
// (`kpi.routes.ts`) and commands (`kpiDefinitionCommands.ts`) before writing
// this — see file header note.
// ==========================================

export interface CreateKpiDraftInput {
  kpiCode: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  targetGeometry: KpiTargetGeometry;
  targetValue?: number | null;
  targetMin?: number | null;
  targetMax?: number | null;
  warningLow?: number | null;
  warningHigh?: number | null;
  criticalLow?: number | null;
  criticalHigh?: number | null;
  binarySuccessValue?: number | null;
  formulaText?: string | null;
  reason?: string | null;
  idempotencyKey: string;
}

export interface CreateKpiDraftResult {
  kpi: KpiDefinitionDto;
  definitionVersion: KpiDefinitionVersionDto;
}

/** `POST /api/vnext/results/kpi` — the ONLY create endpoint (creates the
 * `rvn_kpi_definitions` root row AND its version-1
 * `rvn_kpi_definition_versions` row in one atomic write). `ownerUserId` is
 * deliberately NOT accepted here — the route defaults it to the caller
 * (`ownerUserId ?? createdBy`, `kpi.routes.ts`), and (per this file's header
 * "CONFIRMED BACKEND GAP" note) there is no generally-available "list org
 * members" endpoint a normal member can call to populate a picker for
 * anyone else anyway (same reasoning `RoiCaseCreateModal.tsx` documents for
 * ROI's owner field). */
export async function createKpiDraft(input: CreateKpiDraftInput): Promise<CreateKpiDraftResult> {
  const resp = await Api.post('/vnext/results/kpi', {
    kpiCode: input.kpiCode,
    name: input.name,
    description: input.description ?? null,
    unit: input.unit ?? null,
    targetGeometry: input.targetGeometry,
    targetValue: input.targetValue ?? null,
    targetMin: input.targetMin ?? null,
    targetMax: input.targetMax ?? null,
    warningLow: input.warningLow ?? null,
    warningHigh: input.warningHigh ?? null,
    criticalLow: input.criticalLow ?? null,
    criticalHigh: input.criticalHigh ?? null,
    binarySuccessValue: input.binarySuccessValue ?? null,
    formulaText: input.formulaText ?? null,
    reason: input.reason ?? null,
    idempotencyKey: input.idempotencyKey,
  });
  return { kpi: resp?.kpi as KpiDefinitionDto, definitionVersion: resp?.definitionVersion as KpiDefinitionVersionDto };
}

export interface EditKpiDraftInput {
  /** CAS — the definition version's OWN `rowVersion` (see file header), NOT
   * the parent KPI's. Must come from a `KpiDefinitionVersionDto` this client
   * itself received (create/edit/submit/approve/reject response) — never
   * guessed. */
  expectedVersion: number;
  name?: string;
  description?: string | null;
  unit?: string | null;
  targetGeometry?: KpiTargetGeometry;
  targetValue?: number | null;
  targetMin?: number | null;
  targetMax?: number | null;
  warningLow?: number | null;
  warningHigh?: number | null;
  criticalLow?: number | null;
  criticalHigh?: number | null;
  binarySuccessValue?: number | null;
  formulaText?: string | null;
  reason?: string | null;
  idempotencyKey: string;
}

/** `PUT /api/vnext/results/kpi/:kpiId/draft` — 409 `NOT_A_DRAFT` when the
 * current version's `approvalStatus` isn't `'draft'` (`editDraft`'s own
 * guard, `kpiDefinitionCommands.ts`). */
export async function editKpiDraft(
  kpiId: string,
  input: EditKpiDraftInput
): Promise<KpiDefinitionVersionDto> {
  const resp = await Api.put(`/vnext/results/kpi/${encodeURIComponent(kpiId)}/draft`, {
    expectedVersion: input.expectedVersion,
    name: input.name,
    description: input.description,
    unit: input.unit,
    targetGeometry: input.targetGeometry,
    targetValue: input.targetValue,
    targetMin: input.targetMin,
    targetMax: input.targetMax,
    warningLow: input.warningLow,
    warningHigh: input.warningHigh,
    criticalLow: input.criticalLow,
    criticalHigh: input.criticalHigh,
    binarySuccessValue: input.binarySuccessValue,
    formulaText: input.formulaText,
    reason: input.reason ?? null,
    idempotencyKey: input.idempotencyKey,
  });
  return resp?.definitionVersion as KpiDefinitionVersionDto;
}

export interface SubmitKpiDefinitionInput {
  expectedVersion: number;
  reason?: string | null;
  idempotencyKey: string;
}

/** `POST /api/vnext/results/kpi/:kpiId/submit` — draft -> submitted (version)
 * / draft -> pending_approval (KPI root). 409 `NOT_A_DRAFT` if already
 * submitted/approved/rejected. */
export async function submitKpiDefinition(
  kpiId: string,
  input: SubmitKpiDefinitionInput
): Promise<KpiDefinitionVersionDto> {
  const resp = await Api.post(`/vnext/results/kpi/${encodeURIComponent(kpiId)}/submit`, {
    expectedVersion: input.expectedVersion,
    reason: input.reason ?? null,
    idempotencyKey: input.idempotencyKey,
  });
  return resp?.definitionVersion as KpiDefinitionVersionDto;
}

export interface ApproveKpiDefinitionVersionInput {
  expectedVersion: number;
  reason?: string | null;
  idempotencyKey: string;
}

/** `POST .../definition-versions/:versionId/approve` — submitted -> approved.
 * 403 `SELF_APPROVAL_DENIED` when the caller is the version's own
 * `submittedBy`/`createdBy` (`SelfApprovalDeniedError`,
 * `kpiDefinitionCommands.ts` — checked server-side, first, before any write;
 * this client never tries to pre-guess it). 409 `NOT_SUBMITTED` if the
 * version isn't currently `'submitted'`. */
export async function approveKpiDefinitionVersion(
  kpiId: string,
  versionId: string,
  input: ApproveKpiDefinitionVersionInput
): Promise<KpiDefinitionVersionDto> {
  const resp = await Api.post(
    `/vnext/results/kpi/${encodeURIComponent(kpiId)}/definition-versions/${encodeURIComponent(versionId)}/approve`,
    { expectedVersion: input.expectedVersion, reason: input.reason ?? null, idempotencyKey: input.idempotencyKey }
  );
  return resp?.definitionVersion as KpiDefinitionVersionDto;
}

export interface RejectKpiDefinitionVersionInput {
  expectedVersion: number;
  rejectionReason: string;
  idempotencyKey: string;
}

/** `POST .../definition-versions/:versionId/reject` — submitted -> rejected
 * (version) / pending_approval -> draft (KPI root, so it can be edited and
 * resubmitted). `rejectionReason` is REQUIRED non-empty
 * (`RejectDefinitionVersionSchema.rejectionReason: z.string().min(1)`) — NOT
 * the optional `reason` the other four commands take. */
export async function rejectKpiDefinitionVersion(
  kpiId: string,
  versionId: string,
  input: RejectKpiDefinitionVersionInput
): Promise<KpiDefinitionVersionDto> {
  const resp = await Api.post(
    `/vnext/results/kpi/${encodeURIComponent(kpiId)}/definition-versions/${encodeURIComponent(versionId)}/reject`,
    {
      expectedVersion: input.expectedVersion,
      rejectionReason: input.rejectionReason,
      idempotencyKey: input.idempotencyKey,
    }
  );
  return resp?.definitionVersion as KpiDefinitionVersionDto;
}

export interface ReviseKpiDefinitionInput {
  /** CAS — the REJECTED version's own `rowVersion` (same "must come from a
   * `KpiDefinitionVersionDto` this client itself received" rule as every
   * other CAS field on this page — see `EditKpiDraftInput`'s doc comment). */
  expectedVersion: number;
  reason?: string | null;
  idempotencyKey: string;
}

/**
 * `POST .../definition-versions/:versionId/revise` — RN_G6_P0A. Fixes the
 * "a rejected KPI is permanently stuck" defect
 * (`docs/product/results-vnext/RN_G6_P0A_KPI_REVISION_CONTRACT.md`):
 * `:versionId` must be the REJECTED version; the server creates a NEW draft
 * version (`versionNumber = MAX + 1`) with every substantive field copied
 * from it, and returns that new version — never mutates the rejected one.
 * 409 with a per-status code (`CANNOT_REVISE_APPROVED`/`CANNOT_REVISE_DRAFT`/
 * `CANNOT_REVISE_SUBMITTED`) if the indicated version isn't currently
 * `'rejected'`.
 */
export async function reviseKpiDefinition(
  kpiId: string,
  versionId: string,
  input: ReviseKpiDefinitionInput
): Promise<KpiDefinitionVersionDto> {
  const resp = await Api.post(
    `/vnext/results/kpi/${encodeURIComponent(kpiId)}/definition-versions/${encodeURIComponent(versionId)}/revise`,
    { expectedVersion: input.expectedVersion, reason: input.reason ?? null, idempotencyKey: input.idempotencyKey }
  );
  return resp?.definitionVersion as KpiDefinitionVersionDto;
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
