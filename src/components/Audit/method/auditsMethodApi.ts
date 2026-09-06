/**
 * auditsMethodApi — cienki klient frontendu dla metodycznego kernela Audits
 * (U7, `/api/audits/*`).
 *
 * Typy w tym pliku ŚWIADOMIE duplikują (nie importują) węższy wycinek
 * `server/src/services/audits/types.ts` — implementacja backendu nie wchodzi do bundla
 * frontendu, a to jest dokładnie ten sam wzorzec, którego `auditApi.ts` już
 * używa dla starszego orkiestratora `/api/audit` ("mirrors the backend
 * AuditProgram shape"). Gdy powstanie wspólny manifest kontraktowy FE/BE,
 * podmieniamy import, nie model.
 *
 * Koperta odpowiedzi (kontrakt U7): `{ success: true, data: ... }`.
 * `Api.get`/`Api.post`/… zwracają axios-podobne `{ data }`, gdzie `.data` jest
 * PROXY na surowe ciało JSON (patrz `services/api.ts` → `toAxiosLikeResponse`)
 * — więc `res.data` TO SAMA koperta `{ success, data }`, a właściwa treść to
 * `res.data.data`. `unwrap()` centralizuje to rozpakowanie.
 *
 * Trasy backendu (`server/src/routes/audits/*.routes.ts`) są działającym,
 * kanonicznym kontraktem. Klient celowo odrzuca niepoprawną kopertę zamiast
 * przedstawiać błąd kontraktu jako prawidłowy pusty stan.
 */

import { Api } from '@/services/api';

// ---------------------------------------------------------------------------
// Klasyfikacja i statusy — mirror server/src/services/audits/types.ts
// ---------------------------------------------------------------------------

/**
 * DWIE NIEZALEŻNE OSIE (P0 2026-08-13 — patrz `server/src/services/audits/types.ts`
 * dla pełnego uzasadnienia). `sourceType` = CZYM jest źródło; `verificationStatus`
 * = CZY zostało sprawdzone. Zmiana jednej NIGDY nie zmienia drugiej.
 */
export const AUDIT_SOURCE_TYPES = [
  'INTERNAL_PROCEDURE',
  'INTERNAL_FRAMEWORK',
  'REGULATION',
  'LICENSED_STANDARD',
  'DEMONSTRATION',
  'LEGACY',
] as const;
export type AuditSourceType = (typeof AUDIT_SOURCE_TYPES)[number];

export const AUDIT_VERIFICATION_STATES = [
  'VERIFIED',
  'PENDING_REVIEW',
  'UNVERIFIED',
  'EVIDENCE_MISSING',
] as const;
export type AuditVerificationState = (typeof AUDIT_VERIFICATION_STATES)[number];

/** Typy źródła, którym wolno pokazać w UI słowo „norma" — niezależnie od `verificationStatus`. */
export const NORMATIVE_SOURCE_TYPES: readonly AuditSourceType[] = [
  'LICENSED_STANDARD',
  'REGULATION',
];

export function isNormativeSourceType(value: unknown): boolean {
  return NORMATIVE_SOURCE_TYPES.includes(value as AuditSourceType);
}

/** Czy pakiet wolno przedstawić jako podstawę audytu zgodności — wymaga OBU osi. */
export function isComplianceGrade(sourceType: unknown, verification: unknown): boolean {
  return isNormativeSourceType(sourceType) && verification === 'VERIFIED';
}

/**
 * Stara, jednoosiowa klasyfikacja. Zachowana WYŁĄCZNIE dla odczytu danych
 * sprzed rozdzielenia osi (np. `legacyClassification` z backendu) — nowy kod
 * UI (kolumny, chipy, filtry) używa `sourceType` + `verificationStatus`.
 * @deprecated
 */
export const PACK_CLASSIFICATIONS = [
  'VERIFIED_NORMATIVE',
  'INTERNAL_FRAMEWORK',
  'DEMONSTRATION',
  'LEGACY',
  'EVIDENCE_MISSING',
] as const;
/** @deprecated Użyj `AuditSourceType` + `AuditVerificationState`. */
export type PackClassification = (typeof PACK_CLASSIFICATIONS)[number];

export const PACK_PUBLICATION_STATUSES = ['draft', 'in_review', 'published', 'deprecated'] as const;
export type PackPublicationStatus = (typeof PACK_PUBLICATION_STATUSES)[number];

/** Mirror `server/src/services/audits/types.ts` — role audytowe (member role programu). */
export const AUDIT_ROLES = [
  'program_owner',
  'lead_auditor',
  'auditor',
  'technical_expert',
  'auditee',
  'evidence_owner',
  'reviewer',
  'action_owner',
  'administrator',
  'viewer',
] as const;
export type AuditRole = (typeof AUDIT_ROLES)[number];

export const AUDIT_LIFECYCLE_STATES = [
  'planning',
  'preparation',
  'fieldwork',
  'evidence_review',
  'findings_review',
  'management_response',
  'approval',
  'remediation',
  'effectiveness_verification',
  'closure',
  'closed',
] as const;
export type AuditLifecycleState = (typeof AUDIT_LIFECYCLE_STATES)[number];

export const AUDIT_REPORT_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'published',
  'superseded',
] as const;
export type AuditReportStatus = (typeof AUDIT_REPORT_STATUSES)[number];

export const AUDIT_PROPOSAL_STATUSES = [
  'draft',
  'sent_to_candidates',
  'registered',
  'deferred',
  'dismissed',
] as const;
export type AuditProposalStatus = (typeof AUDIT_PROPOSAL_STATUSES)[number];

/** Mirror `server/src/services/audits/types.ts` — status cyklu życia ustalenia. */
export const AUDIT_FINDING_STATUSES = [
  'draft',
  'in_review',
  'confirmed',
  'response_pending',
  'remediation_in_progress',
  'verification_pending',
  'closed',
  'risk_accepted',
  'rejected',
] as const;
export type AuditFindingStatus = (typeof AUDIT_FINDING_STATUSES)[number];

/** Mirror `server/src/services/audits/types.ts` — istotność ustalenia. */
export const AUDIT_FINDING_SEVERITIES = [
  'informational',
  'low',
  'medium',
  'high',
  'critical',
] as const;
export type AuditFindingSeverity = (typeof AUDIT_FINDING_SEVERITIES)[number];

/** Mirror `server/src/services/audits/types.ts` — status działania korygującego. */
export const AUDIT_ACTION_STATUSES = [
  'proposed',
  'approved',
  'in_progress',
  'implemented',
  'verified',
  'rejected',
  'cancelled',
  'overdue',
] as const;
export type AuditActionStatus = (typeof AUDIT_ACTION_STATUSES)[number];

/** Mirror `server/src/services/audits/types.ts` — rodzaj działania (korekcja usuwa skutek, działanie korygujące usuwa przyczynę). */
export const AUDIT_ACTION_KINDS = [
  'correction',
  'containment',
  'corrective_action',
  'preventive_action',
] as const;
export type AuditActionKind = (typeof AUDIT_ACTION_KINDS)[number];

// ---------------------------------------------------------------------------
// Library — pakiety audytowe
// ---------------------------------------------------------------------------

export interface AuditPackSummary {
  id: string;
  packKey: string;
  version: number;
  title: string;
  summary: string | null;
  sourceId: string | null;
  sourceTitle: string | null;
  sourceVersion: string | null;
  /** CZYM jest źródło — niezależne od tego, czy je sprawdzono. */
  sourceType: AuditSourceType;
  /** CZY sprawdzono — nie ma prawa zmienić `sourceType`. */
  verificationStatus: AuditVerificationState;
  publicationStatus: PackPublicationStatus;
  requiredRoles: string[];
  criteriaCount: number;
  updatedAt: string;
}

export interface AuditPackCriterionSummary {
  id: string;
  parentId: string | null;
  ordinal: number;
  refCode: string | null;
  nodeKind: string;
  title: string;
  mandatory: boolean;
}

export interface AuditPackDetail extends AuditPackSummary {
  purpose: string | null;
  scope: string | null;
  objectives: string | null;
  auditType: string | null;
  requiredCompetencies: string[];
  findingTaxonomy: Array<{ key: string; label: string; nonConforming: boolean }>;
  rightsStatus: string | null;
  rightsNote: string | null;
  criteria: AuditPackCriterionSummary[];
}

export interface ListPacksParams {
  search?: string;
  status?: PackPublicationStatus | 'all';
  sourceType?: AuditSourceType | 'all';
  verificationStatus?: AuditVerificationState | 'all';
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Processes — programy audytowe
// ---------------------------------------------------------------------------

export interface AuditProgramSummary {
  id: string;
  name: string;
  packId: string;
  packTitle: string | null;
  packVersion: number | null;
  lifecycleState: AuditLifecycleState;
  applicableCriteria: number;
  concludedCriteria: number;
  openFindings: number;
  leadAuditorId: string | null;
  leadAuditorName: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  updatedAt: string;
}

export interface AuditProgramMemberSummary {
  userId: string;
  name: string | null;
  memberRole: string;
}

export interface AuditProgramDetail extends AuditProgramSummary {
  objective: string | null;
  scopeText: string | null;
  projectId: string | null;
  members: AuditProgramMemberSummary[];
}

export interface ListProgramsParams {
  search?: string;
  lifecycleState?: AuditLifecycleState | 'all';
  limit?: number;
  offset?: number;
}

export interface CreateProgramInput {
  packId: string;
  name: string;
  objective?: string;
  scopeText?: string;
  plannedStart?: string;
  plannedEnd?: string;
  projectId?: string;
}

export interface AuditCriterionSummary {
  id: string;
  programId: string;
  parentId: string | null;
  ordinal: number;
  refCode: string | null;
  title: string;
  applicable: boolean;
  conformityStatus: string;
  workStatus: string;
  evidenceCount: number;
  findingCount: number;
  children: AuditCriterionSummary[];
}

export interface AuditProgramLifecycleGate {
  state: AuditLifecycleState;
  blockers: string[];
}

/** Kształt kontraktu — `GET /audits/programs/:id/lifecycle` → `{state, allowed}`. */
export interface AuditProgramLifecycle {
  state: AuditLifecycleState;
  allowed: AuditProgramLifecycleGate[];
}

export interface AuditProgramCoverage {
  applicableCriteria: number;
  concludedCriteria: number;
  insufficientEvidenceCriteria: number;
}

// ---------------------------------------------------------------------------
// Outputs / Reports / Proposals
// ---------------------------------------------------------------------------

export interface AuditOutputSummary {
  id: string;
  programId: string;
  programName: string | null;
  version: number;
  title: string;
  /** Wersja pakietu, na podstawie którego program powstał — realne pole `audit_outputs.pack_version`. */
  packVersion: number | null;
  finalizedBy: string | null;
  finalizedByName: string | null;
  finalizedAt: string;
  /** Id nowszego Outputu, który zastąpił ten wiersz — `null` = aktualny. */
  supersededBy: string | null;
  supersededAt: string | null;
  contentHash: string | null;
}

export interface AuditReportSummary {
  id: string;
  programId: string;
  programName: string | null;
  reportKind: string;
  version: number;
  title: string;
  status: AuditReportStatus;
  language: string | null;
  /** Kto ma być odbiorcą raportu (np. „Zarząd", „Sponsor") — realne pole z `audit_reports.audience`. */
  audience: string | null;
  /** Klasyfikacja poufności (np. „Poufne", „Wewnętrzne") — realne pole z `audit_reports.confidentiality`. */
  confidentiality: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  /**
   * R1 (panel powtórny DEC-117): `GET /audits/reports/:id` (`reportService.mapReportRow`,
   * `server/src/services/audits/types.ts` `AuditReport.payload`) zawsze zwraca ten wiersz —
   * to jest DOKŁADNIE `audit_reports.payload`, zaplombowany `content_hash`em raport, który
   * użytkownik faktycznie zatwierdza (`AuditReportDocument`, kształt z `reportRenderer.ts`).
   * Opcjonalne w typie WYŁĄCZNIE żeby nie łamać istniejących fixture'ów testowych, które
   * budują `AuditReportSummary` ręcznie bez tego pola — w realnej odpowiedzi API jest zawsze.
   */
  payload?: Record<string, unknown>;
}

/** Wynik `POST /audits/reports/:id/conclusion` — wniosek zapisany w warstwie Wniosków. */
export interface AuditConclusionResult {
  conclusionId: string;
  title: string;
  status: string;
  sourceRefs: Array<{ type: string; id: string; title?: string | null; url?: string | null }>;
}

export interface AuditProposalSummary {
  id: string;
  programId: string;
  programName: string | null;
  title: string;
  sourceFindingIds: string[];
  priority: string | null;
  status: AuditProposalStatus;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Koperta list + rozpakowanie
// ---------------------------------------------------------------------------

export interface ListResult<T> {
  items: T[];
  total: number;
}

/** `res.data` to cała koperta `{ success, data }` — właściwa treść jest w `.data`. */
function unwrapEnvelope(res: unknown): unknown {
  const body = (res as { data?: unknown })?.data;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('AUDITS_API_CONTRACT_ERROR: response body is not an envelope');
  }
  const envelope = body as Record<string, unknown>;
  if (envelope.success !== true || !Object.prototype.hasOwnProperty.call(envelope, 'data')) {
    throw new Error('AUDITS_API_CONTRACT_ERROR: expected { success: true, data }');
  }
  return envelope.data;
}

/**
 * Ścisłe wyciągnięcie tablicy. Niepoprawny kształt 200 jest błędem kontraktu,
 * a nie prawidłowym pustym wynikiem.
 */
function toArray<T>(value: unknown, ...keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  throw new Error(
    `AUDITS_API_CONTRACT_ERROR: expected array${keys.length ? ` (${keys.join('|')})` : ''}`
  );
}

function envelopeTotal(res: unknown): number | undefined {
  const body = (res as { data?: unknown })?.data;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const total = (body as Record<string, unknown>).total;
  return typeof total === 'number' ? total : undefined;
}

function toTotal(value: unknown, fallbackLength: number, ...keys: string[]): number {
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof obj[key] === 'number') return obj[key] as number;
    }
  }
  return fallbackLength;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (value === 'all' || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// ---------------------------------------------------------------------------
// Library — pakiety
// ---------------------------------------------------------------------------

export async function listPacks(
  params: ListPacksParams = {}
): Promise<ListResult<AuditPackSummary>> {
  const qs = buildQuery({
    search: params.search,
    status: params.status,
    sourceType: params.sourceType,
    verificationStatus: params.verificationStatus,
    limit: params.limit,
    offset: params.offset,
  });
  const res = await Api.get(`/audits/packs${qs}`);
  const payload = unwrapEnvelope(res);
  const items = toArray<AuditPackSummary>(payload, 'packs', 'items');
  return { items, total: envelopeTotal(res) ?? toTotal(payload, items.length, 'total') };
}

export async function getPack(id: string): Promise<AuditPackDetail | null> {
  const res = await Api.get(`/audits/packs/${encodeURIComponent(id)}`);
  const payload = unwrapEnvelope(res) as Record<string, unknown> | undefined;
  if (!payload) return null;
  const pack = (payload.pack ?? payload) as AuditPackDetail | undefined;
  if (!pack || !pack.id) return null;
  const criteria = toArray<AuditPackCriterionSummary>(payload.criteria, 'criteria');
  return { ...pack, criteria: criteria.length ? criteria : (pack.criteria ?? []) };
}

/** `POST /audits/packs/seed-demo` — tworzy pakiet demonstracyjny (Library, pusty stan). */
export async function seedDemoPack(): Promise<AuditPackSummary | null> {
  const res = await Api.post('/audits/packs/seed-demo', {});
  const payload = unwrapEnvelope(res) as Record<string, unknown> | undefined;
  const pack = (payload?.pack ?? payload) as AuditPackSummary | undefined;
  return pack && pack.id ? pack : null;
}

// ---------------------------------------------------------------------------
// Processes — programy
// ---------------------------------------------------------------------------

/**
 * `listPrograms()` raw rows use the service's counter names
 * (`criteriaTotal`/`criteriaConcluded`/`findingsOpen`), not the UI-facing
 * ones (`applicableCriteria`/`concludedCriteria`/`openFindings`). Map
 * explicitly here — same defensive pattern as `getProgramCoverage()` below —
 * so a server/client contract drift cannot silently render "Postęp" as a
 * bare "/" and "Ustalenia otwarte" as blank (measured defect, see
 * `docs/program/grafika/ROZJAZD_NAZW_POL_20260901.md`).
 */
function mapProgramSummaryRow(raw: Record<string, unknown>): AuditProgramSummary {
  const requiredCount = (key: string): number => {
    const value = raw[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`AUDITS_API_CONTRACT_ERROR: programs[].${key} must be a non-negative number`);
    }
    return value;
  };
  return {
    ...(raw as unknown as AuditProgramSummary),
    applicableCriteria: requiredCount('criteriaTotal'),
    concludedCriteria: requiredCount('criteriaConcluded'),
    openFindings: requiredCount('findingsOpen'),
  };
}

export async function listPrograms(
  params: ListProgramsParams = {}
): Promise<ListResult<AuditProgramSummary>> {
  const qs = buildQuery({
    search: params.search,
    lifecycleState: params.lifecycleState,
    limit: params.limit,
    offset: params.offset,
  });
  const res = await Api.get(`/audits/programs${qs}`);
  const payload = unwrapEnvelope(res);
  const rawItems = toArray<Record<string, unknown>>(payload, 'programs', 'items');
  const items = rawItems.map(mapProgramSummaryRow);
  return { items, total: toTotal(payload, items.length, 'total') };
}

export async function getProgram(id: string): Promise<AuditProgramDetail | null> {
  const res = await Api.get(`/audits/programs/${encodeURIComponent(id)}`);
  const payload = unwrapEnvelope(res) as Record<string, unknown> | undefined;
  const program = (payload?.program ?? payload) as AuditProgramDetail | undefined;
  return program && program.id ? program : null;
}

export async function createProgram(
  input: CreateProgramInput,
  idempotencyKey: string
): Promise<AuditProgramDetail> {
  const res = await Api.post('/audits/programs', input, {
    extraHeaders: { 'Idempotency-Key': idempotencyKey },
  });
  const payload = unwrapEnvelope(res) as Record<string, unknown> | undefined;
  const program = (payload?.program ?? payload) as AuditProgramDetail | undefined;
  if (!program || !program.id) throw new Error('Program creation returned no id');
  return program;
}

export async function listProgramCriteria(programId: string): Promise<AuditCriterionSummary[]> {
  const qs = buildQuery({ programId });
  const res = await Api.get(`/audits/criteria${qs}`);
  return toArray<AuditCriterionSummary>(unwrapEnvelope(res), 'criteria', 'items');
}

export async function getProgramLifecycle(id: string): Promise<AuditProgramLifecycle | null> {
  const res = await Api.get(`/audits/programs/${encodeURIComponent(id)}/lifecycle`);
  const payload = unwrapEnvelope(res) as Partial<AuditProgramLifecycle> | undefined;
  if (!payload || !payload.state) return null;
  return { state: payload.state, allowed: Array.isArray(payload.allowed) ? payload.allowed : [] };
}

export async function transitionProgram(
  id: string,
  targetState: AuditLifecycleState,
  reason?: string
): Promise<AuditProgramDetail | null> {
  const res = await Api.post(`/audits/programs/${encodeURIComponent(id)}/transition`, {
    targetState,
    reason,
  });
  const payload = unwrapEnvelope(res) as Record<string, unknown> | undefined;
  const program = (payload?.program ?? payload) as AuditProgramDetail | undefined;
  return program && program.id ? program : null;
}

export async function getProgramCoverage(id: string): Promise<AuditProgramCoverage | null> {
  const res = await Api.get(`/audits/programs/${encodeURIComponent(id)}/coverage`);
  const payload = unwrapEnvelope(res) as Record<string, unknown> | undefined;
  if (!payload) return null;

  const requiredCount = (key: string): number => {
    const value = payload[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`AUDITS_API_CONTRACT_ERROR: coverage.${key} must be a non-negative number`);
    }
    return value;
  };

  return {
    // The criterion service exposes *Total fields. Keep the UI-facing names
    // explicit here so a server/client contract drift cannot silently render
    // valid coverage as 0/0.
    applicableCriteria: requiredCount('applicableTotal'),
    concludedCriteria: requiredCount('concludedTotal'),
    insufficientEvidenceCriteria: requiredCount('evidenceInsufficientTotal'),
  };
}

// ---------------------------------------------------------------------------
// Outputs / Reports / Proposals
// ---------------------------------------------------------------------------

export async function listOutputs(programId?: string): Promise<ListResult<AuditOutputSummary>> {
  const qs = buildQuery({ programId });
  const res = await Api.get(`/audits/outputs${qs}`);
  const payload = unwrapEnvelope(res);
  const items = toArray<AuditOutputSummary>(payload, 'outputs', 'items');
  return { items, total: toTotal(payload, items.length, 'total') };
}

export async function finalizeOutput(
  programId: string,
  title?: string
): Promise<AuditOutputSummary> {
  const res = await Api.post('/audits/outputs/finalize', { programId, title });
  const payload = unwrapEnvelope(res) as AuditOutputSummary | undefined;
  if (!payload?.id) {
    throw new Error('AUDITS_API_CONTRACT_ERROR: finalized Output is missing id');
  }
  return payload;
}

export interface GenerateAuditReportInput {
  programId: string;
  outputId: string;
  reportKind: 'audit_report' | 'remediation_progress';
  title?: string;
  asOfDate?: string;
}

export async function generateReport(input: GenerateAuditReportInput): Promise<AuditReportSummary> {
  const res = await Api.post('/audits/reports', input);
  const payload = unwrapEnvelope(res) as AuditReportSummary | undefined;
  if (!payload?.id) {
    throw new Error('AUDITS_API_CONTRACT_ERROR: generated report is missing id');
  }
  return payload;
}

export async function listReports(programId?: string): Promise<ListResult<AuditReportSummary>> {
  const qs = buildQuery({ programId });
  const res = await Api.get(`/audits/reports${qs}`);
  const payload = unwrapEnvelope(res);
  const items = toArray<AuditReportSummary>(payload, 'reports', 'items');
  return { items, total: toTotal(payload, items.length, 'total') };
}

/** `GET /audits/reports/:id` — pojedynczy raport (metadane dla pełnego widoku, `reportService.getReport`). */
export async function getReport(id: string): Promise<AuditReportSummary | null> {
  const res = await Api.get(`/audits/reports/${encodeURIComponent(id)}`);
  const payload = unwrapEnvelope(res) as AuditReportSummary | undefined;
  return payload && payload.id ? payload : null;
}

/**
 * `POST /audits/reports/:id/conclusion` — WNIOSEK z raportu audytu (DEC-417e).
 * Przewód do istniejącej warstwy Wniosków (`conclusions`), nie nowy silnik:
 * serwer czyta zapisany dokument raportu (`auditReportConclusionBridge`) i
 * zapisuje z niego wniosek po rodowodzie `audit_report`.
 */
export async function generateReportConclusion(reportId: string): Promise<AuditConclusionResult> {
  const res = await Api.post(`/audits/reports/${encodeURIComponent(reportId)}/conclusion`, {});
  const payload = unwrapEnvelope(res) as AuditConclusionResult | undefined;
  if (!payload?.conclusionId) {
    throw new Error('AUDITS_API_CONTRACT_ERROR: conclusion response is missing conclusionId');
  }
  return payload;
}

/** `POST /audits/reports/:id/approve` — draft/in_review → approved (real backend gate, `reportService.approveReport`). */
export async function approveReport(id: string): Promise<AuditReportSummary | null> {
  const res = await Api.post(`/audits/reports/${encodeURIComponent(id)}/approve`, {});
  const payload = unwrapEnvelope(res) as AuditReportSummary | undefined;
  return payload && payload.id ? payload : null;
}

/** `POST /audits/reports/:id/publish` — approved → published (real backend gate, `reportService.publishReport`). */
export async function publishReport(id: string): Promise<AuditReportSummary | null> {
  const res = await Api.post(`/audits/reports/${encodeURIComponent(id)}/publish`, {});
  const payload = unwrapEnvelope(res) as AuditReportSummary | undefined;
  return payload && payload.id ? payload : null;
}

export async function listProposals(programId?: string): Promise<ListResult<AuditProposalSummary>> {
  const qs = buildQuery({ programId });
  const res = await Api.get(`/audits/proposals${qs}`);
  const payload = unwrapEnvelope(res);
  const items = toArray<AuditProposalSummary>(payload, 'proposals', 'items');
  return { items, total: toTotal(payload, items.length, 'total') };
}

/** `POST /audits/proposals/:id/register` — draft/deferred/sent_to_candidates → registered (`proposalService.registerAsInitiative`). */
export async function registerProposal(id: string): Promise<AuditProposalSummary | null> {
  const res = await Api.post(`/audits/proposals/${encodeURIComponent(id)}/register`, {});
  const payload = unwrapEnvelope(res) as AuditProposalSummary | undefined;
  return payload && payload.id ? payload : null;
}

/** `POST /audits/proposals/:id/dismiss` — any non-registered status → dismissed (`proposalService.dismissProposal`). */
export async function dismissProposal(
  id: string,
  reason?: string
): Promise<AuditProposalSummary | null> {
  const res = await Api.post(`/audits/proposals/${encodeURIComponent(id)}/dismiss`, { reason });
  const payload = unwrapEnvelope(res) as AuditProposalSummary | undefined;
  return payload && payload.id ? payload : null;
}

/** `POST /audits/proposals/:id/defer` — any non-registered status → deferred (`proposalService.deferProposal`). */
export async function deferProposal(
  id: string,
  reason?: string
): Promise<AuditProposalSummary | null> {
  const res = await Api.post(`/audits/proposals/${encodeURIComponent(id)}/defer`, { reason });
  const payload = unwrapEnvelope(res) as AuditProposalSummary | undefined;
  return payload && payload.id ? payload : null;
}

// ---------------------------------------------------------------------------
// Findings — U4 rejestr niezgodności i CAPA (`GET /audits/findings*`)
// ---------------------------------------------------------------------------

export interface AuditFindingSummary {
  id: string;
  programId: string;
  criterionId: string | null;
  referenceCode: string | null;
  statement: string;
  requirementText: string | null;
  conditionText: string | null;
  sourceReference: string | null;
  gapText: string | null;
  objectiveEvidence: string[];
  contradictingEvidence: string[];
  classification: string;
  severity: AuditFindingSeverity | null;
  riskText: string | null;
  impactText: string | null;
  recommendation: string | null;
  rootCause: string | null;
  rootCauseMethod: string | null;
  rootCauseConfirmed: boolean;
  status: AuditFindingStatus;
  ownerUserId: string | null;
  authorId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  sentBackAt: string | null;
  sentBackBy: string | null;
  sendBackReason: string | null;
  residualRisk: string | null;
  residualRiskAcceptedBy: string | null;
  residualRiskAcceptedAt: string | null;
  residualRiskNote: string | null;
  closedAt: string | null;
  closedBy: string | null;
  closureNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListFindingsParams {
  programId: string;
  status?: AuditFindingStatus | 'all';
  classification?: string | 'all';
  severity?: AuditFindingSeverity | 'all';
  ownerUserId?: string;
  criterionId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/** `GET /audits/findings` — WYMAGA `programId` (backend `requireProgramId`, brak globalnego rejestru). */
export async function listFindings(
  params: ListFindingsParams
): Promise<ListResult<AuditFindingSummary>> {
  const qs = buildQuery({
    programId: params.programId,
    status: params.status,
    classification: params.classification,
    severity: params.severity,
    ownerUserId: params.ownerUserId,
    criterionId: params.criterionId,
    search: params.search,
    limit: params.limit,
    offset: params.offset,
  });
  const res = await Api.get(`/audits/findings${qs}`);
  const payload = unwrapEnvelope(res);
  const items = toArray<AuditFindingSummary>(payload, 'items');
  return { items, total: toTotal(payload, items.length, 'total') };
}

/**
 * R3(a) (panel powtórny DEC-117): `getFindingStatistics`/`getSystemicFindings`
 * (dawniej tutaj) usunięte — DEC-2026-08-26-114 zdjął pasek statystyk i pigułkę
 * tematów systemowych z `AuditFindingsTab` na życzenie właściciela (przeniesienie
 * do zakładki Wyniki NIE wykonane, patrz decyzja), więc od tego momentu żaden
 * front nie wołał `GET /audits/findings/statistics` ani `GET /audits/findings/systemic`.
 * Backend (`server/src/routes/audits/findings.routes.ts`, `findingService.ts`)
 * ZOSTAJE nietknięty — trasy nadal istnieją dla przyszłego konsumenta (Wyniki).
 */

/** `POST /audits/findings/:id/review` — decision: confirm/send_back/reject (`findingService.reviewFinding`). */
export async function reviewFinding(
  id: string,
  decision: 'confirm' | 'send_back' | 'reject',
  note?: string
): Promise<AuditFindingSummary | null> {
  const res = await Api.post(`/audits/findings/${encodeURIComponent(id)}/review`, {
    decision,
    note,
  });
  const payload = unwrapEnvelope(res) as AuditFindingSummary | undefined;
  return payload && payload.id ? payload : null;
}

/** `POST /audits/findings/:id/accept-risk` — wymaga notatki uzasadniającej (`findingService.acceptResidualRisk`). */
export async function acceptResidualRisk(
  id: string,
  note: string
): Promise<AuditFindingSummary | null> {
  const res = await Api.post(`/audits/findings/${encodeURIComponent(id)}/accept-risk`, { note });
  const payload = unwrapEnvelope(res) as AuditFindingSummary | undefined;
  return payload && payload.id ? payload : null;
}

/** `POST /audits/findings/:id/close` — bramkowane weryfikacją skuteczności/wdrożenia (`findingService.closeFinding`). */
export async function closeFinding(id: string, note: string): Promise<AuditFindingSummary | null> {
  const res = await Api.post(`/audits/findings/${encodeURIComponent(id)}/close`, { note });
  const payload = unwrapEnvelope(res) as AuditFindingSummary | undefined;
  return payload && payload.id ? payload : null;
}

// ---------------------------------------------------------------------------
// Actions — U4 działania korygujące (tylko odczyt, do kolumny „Termin" i
// preview — kebab zapisu żyje w warsztacie kryterium, poza zakresem rejestru)
// ---------------------------------------------------------------------------

export interface AuditActionSummary {
  id: string;
  findingId: string;
  programId: string;
  actionKind: AuditActionKind;
  title: string;
  ownerUserId: string | null;
  dueDate: string | null;
  status: AuditActionStatus;
}

/** `GET /audits/actions` — filtrowane po `programId` (`correctiveActionService.listActions`). Jedna strona — backend domyślnie ucina do 50 (`context.ts parsePaging`). */
export async function listActions(
  programId: string,
  paging: { limit?: number; offset?: number } = {}
): Promise<ListResult<AuditActionSummary>> {
  const qs = buildQuery({ programId, limit: paging.limit, offset: paging.offset });
  const res = await Api.get(`/audits/actions${qs}`);
  const payload = unwrapEnvelope(res);
  const items = toArray<AuditActionSummary>(payload, 'items');
  return { items, total: toTotal(payload, items.length, 'total') };
}

/**
 * R2(a) (panel powtórny DEC-117): `AuditFindingsTab`'s kolumna „Termin" potrzebuje
 * WSZYSTKICH otwartych działań programu (najbliższy termin per ustalenie) —
 * `listActions()` sama zwraca tylko jedną stronę (50). Backend nie ma endpointu
 * „działania dla listy ustaleń" ani filtra `findingId IN (...)`, wyłącznie
 * pojedynczy `findingId` — więc pobranie działań PER WIDOCZNE ustalenie
 * oznaczałoby do N zapytań HTTP na stronę ustaleń (N = rozmiar strony rejestru).
 * Pojedyncza pętla stronicująca po CAŁYM programie (limit=200/żądanie, backend
 * clamp) jest tańsza przy każdej realistycznej wielkości programu (setki, nie
 * tysiące działań) — i prostsza: jedno miejsce prawdy zamiast N równoległych
 * zapytań z osobną obsługą błędu każde. Twardy sufit 20 stron (4000 działań)
 * na wypadek zepsutego `total`/nieskończonej pętli.
 */
export async function listAllActions(programId: string): Promise<AuditActionSummary[]> {
  const pageSize = 200;
  const maxPages = 20;
  const items: AuditActionSummary[] = [];
  let offset = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await listActions(programId, { limit: pageSize, offset });
    items.push(...result.items);
    if (result.items.length < pageSize || items.length >= result.total) break;
    offset += pageSize;
  }
  return items;
}

// ---------------------------------------------------------------------------
// Evidence — U3 dowody (tylko odczyt, rozwiązywanie tytułów w podglądzie
// ustalenia — `objectiveEvidence`/`contradictingEvidence` niosą same ID)
// ---------------------------------------------------------------------------

export interface AuditEvidenceSummary {
  id: string;
  programId: string;
  criterionId: string | null;
  evidenceKind: string;
  title: string;
}

/** `GET /audits/evidence` — zwraca tablicę WPROST (bez `{items,total}`), `evidenceService.listEvidence`. */
export async function listEvidence(programId: string): Promise<AuditEvidenceSummary[]> {
  const qs = buildQuery({ programId });
  const res = await Api.get(`/audits/evidence${qs}`);
  return toArray<AuditEvidenceSummary>(unwrapEnvelope(res), 'evidence', 'items');
}

// ---------------------------------------------------------------------------
// Report presentation — U5 widok prezentacyjny renderowany live z Outputu
// (`GET /audits/reports/:id/presentation`, `reportService.renderReportPresentation`)
// ---------------------------------------------------------------------------

export type AuditReportDocumentSectionKind = 'text' | 'list' | 'table' | 'keyValue' | 'group';

export interface AuditReportDocumentSection<T = unknown> {
  id: string;
  title: string;
  kind: AuditReportDocumentSectionKind;
  content: T;
}

export interface AuditReportDocument {
  reportKind: 'audit_report' | 'remediation_progress' | 'presentation';
  generatedAt: string | null;
  asOfDate?: string | null;
  sections: AuditReportDocumentSection[];
}

/** `GET /audits/reports/:id/presentation` — render live z Outputu, nic nie zapisuje. */
export async function getReportPresentation(id: string): Promise<AuditReportDocument> {
  const res = await Api.get(`/audits/reports/${encodeURIComponent(id)}/presentation`);
  return unwrapEnvelope(res) as AuditReportDocument;
}
