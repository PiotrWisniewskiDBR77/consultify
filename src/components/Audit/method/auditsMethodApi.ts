/**
 * auditsMethodApi — cienki klient frontendu dla metodycznego kernela Audits
 * (U7, `/api/audits/*`).
 *
 * Typy w tym pliku ŚWIADOMIE duplikują (nie importują) węższy wycinek
 * `server/src/services/audits/types.ts` — kod serwera nie wchodzi do bundla
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
  openFindings: number;
  unresolvedFindings: number;
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
  finalizedBy: string | null;
  finalizedByName: string | null;
  finalizedAt: string;
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
  publishedAt: string | null;
  updatedAt: string;
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
  const items = toArray<AuditProgramSummary>(payload, 'programs', 'items');
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
  const payload = unwrapEnvelope(res) as Partial<AuditProgramCoverage> | undefined;
  if (!payload) return null;
  return {
    applicableCriteria: payload.applicableCriteria ?? 0,
    concludedCriteria: payload.concludedCriteria ?? 0,
    insufficientEvidenceCriteria: payload.insufficientEvidenceCriteria ?? 0,
    openFindings: payload.openFindings ?? 0,
    unresolvedFindings: payload.unresolvedFindings ?? 0,
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

export async function listReports(programId?: string): Promise<ListResult<AuditReportSummary>> {
  const qs = buildQuery({ programId });
  const res = await Api.get(`/audits/reports${qs}`);
  const payload = unwrapEnvelope(res);
  const items = toArray<AuditReportSummary>(payload, 'reports', 'items');
  return { items, total: toTotal(payload, items.length, 'total') };
}

export async function listProposals(programId?: string): Promise<ListResult<AuditProposalSummary>> {
  const qs = buildQuery({ programId });
  const res = await Api.get(`/audits/proposals${qs}`);
  const payload = unwrapEnvelope(res);
  const items = toArray<AuditProposalSummary>(payload, 'proposals', 'items');
  return { items, total: toTotal(payload, items.length, 'total') };
}
