/**
 * workspaceApi — cienki klient frontendu dla Criterion Workspace (ekran, na
 * którym audytor faktycznie wykonuje audyt: jedno kryterium, cały łańcuch
 * `kryterium → ... → zamknięcie`).
 *
 * Kontrakt HTTP źródłowy: `server/src/routes/audits/{criteria,evidence,
 * findings,actions,ai}.routes.ts` + serwisy pod nimi (`criterionService.ts`,
 * `evidenceService.ts`, `findingService.ts`, `correctiveActionService.ts`,
 * `verificationService.ts`, `aiProposalService.ts`) — WSZYSTKIE tylko czytane,
 * nie zmieniane (mandat robotnika W1).
 *
 * Typy w tym pliku ŚWIADOMIE duplikują (nie importują) węższy wycinek
 * `server/src/services/audits/types.ts` — dokładnie ten sam wzorzec, którego
 * `../auditsMethodApi.ts` już używa ("kod serwera nie wchodzi do bundla
 * frontendu"). Koperta odpowiedzi: `{ success: true, data: ... }`, rozpakowana
 * przez `unwrapEnvelope`.
 *
 * ROLE_CAPABILITIES poniżej jest MIRROREM macierzy z
 * `server/src/services/audits/permissions.ts` (`ROLE_CAPABILITIES`), zawężonym
 * do czynności, które ten ekran w ogóle pokazuje. Serwer jest ŹRÓDŁEM PRAWDY —
 * ten mirror steruje WYŁĄCZNIE tym, co UI proponuje jako dostępne (żeby nie
 * pokazywać martwych przycisków); każde wywołanie API i tak jest bramkowane
 * ponownie po stronie serwera. Gdy `permissions.ts` się zmieni, ten plik trzeba
 * ręcznie zsynchronizować — nie ma wspólnego importu (serwer/klient to dwa
 * różne bundle).
 */

import { Api } from '@/services/api';

// ---------------------------------------------------------------------------
// Role i uprawnienia — mirror server/src/services/audits/permissions.ts
// ---------------------------------------------------------------------------

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

export const WORKSPACE_CAPABILITIES = [
  'criterion.assign',
  'criterion.respond_as_auditee',
  'criterion.perform_test',
  'criterion.conclude',
  'evidence_request.create',
  'evidence.submit',
  'evidence.review',
  'finding.draft',
  'finding.update',
  'finding.review',
  'finding.respond_as_management',
  'finding.close',
  'finding.accept_residual_risk',
  'action.propose',
  'action.approve',
  'action.report_implementation',
  'verification.perform',
  'ai.propose',
  'ai.commit',
] as const;
export type WorkspaceCapability = (typeof WORKSPACE_CAPABILITIES)[number];

/** Mirror `ROLE_CAPABILITIES` z `permissions.ts`, zawężony do capability powyżej. */
const ROLE_CAPABILITIES: Record<AuditRole, WorkspaceCapability[]> = {
  program_owner: ['finding.accept_residual_risk', 'ai.propose'],
  lead_auditor: [
    'criterion.assign',
    'criterion.perform_test',
    'criterion.conclude',
    'evidence_request.create',
    'evidence.review',
    'finding.draft',
    'finding.update',
    'finding.review',
    'finding.close',
    'action.approve',
    'verification.perform',
    'ai.propose',
    'ai.commit',
  ],
  auditor: [
    'criterion.perform_test',
    'criterion.conclude',
    'evidence_request.create',
    'evidence.review',
    'finding.draft',
    'finding.update',
    'verification.perform',
    'ai.propose',
    'ai.commit',
  ],
  technical_expert: ['evidence.review', 'finding.draft', 'ai.propose'],
  auditee: [
    'criterion.respond_as_auditee',
    'evidence.submit',
    'finding.respond_as_management',
    'action.propose',
    'action.report_implementation',
    'ai.propose',
  ],
  evidence_owner: ['evidence.submit', 'ai.propose'],
  reviewer: [
    'evidence.review',
    'finding.review',
    'finding.close',
    'action.approve',
    'verification.perform',
  ],
  action_owner: ['action.report_implementation', 'evidence.submit', 'ai.propose'],
  administrator: [],
  viewer: [],
};

export function capabilitiesForRoles(roles: AuditRole[]): Set<WorkspaceCapability> {
  const set = new Set<WorkspaceCapability>();
  for (const role of roles) {
    for (const cap of ROLE_CAPABILITIES[role] ?? []) set.add(cap);
  }
  return set;
}

export interface WorkspaceProgramMember {
  userId: string;
  name: string | null;
  memberRole: AuditRole;
}

export async function getProgramMembers(programId: string): Promise<WorkspaceProgramMember[]> {
  const res = await Api.get(`/audits/programs/${encodeURIComponent(programId)}/members`);
  const payload = unwrapEnvelope(res);
  return toArray<Record<string, unknown>>(payload, 'members', 'items').map((m) => ({
    userId: String(m.userId ?? m.user_id ?? ''),
    name: (m.name as string | null | undefined) ?? null,
    memberRole: String(m.memberRole ?? m.member_role ?? 'viewer') as AuditRole,
  }));
}

// ---------------------------------------------------------------------------
// Koperta + helpery defensywne — te same jak `../auditsMethodApi.ts`
// ---------------------------------------------------------------------------

function unwrapEnvelope(res: unknown): unknown {
  const body = (res as { data?: unknown })?.data;
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as Record<string, unknown>).data;
  }
  return body;
}

function toArray<T>(value: unknown, ...keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Klasa błędu HTTP zwrócona przez `Api.*` — pozwala odróżnić 403 (brak uprawnień) w UI. */
export interface WorkspaceApiError extends Error {
  status?: number;
}

// ---------------------------------------------------------------------------
// Kryterium — jądro obronności (mirror `AuditProgramCriterion`)
// ---------------------------------------------------------------------------

export const CONFORMITY_STATUSES = [
  'not_tested',
  'conforming',
  'nonconforming',
  'observation',
  'opportunity_for_improvement',
  'not_applicable',
  'evidence_insufficient',
] as const;
export type ConformityStatus = (typeof CONFORMITY_STATUSES)[number];

export const TEST_RESULTS = ['pass', 'fail', 'partial', 'inconclusive'] as const;
export type TestResult = (typeof TEST_RESULTS)[number];

export const CRITERION_WORK_STATUSES = [
  'open',
  'evidence_requested',
  'evidence_received',
  'tested',
  'concluded',
] as const;
export type CriterionWorkStatus = (typeof CRITERION_WORK_STATUSES)[number];

export interface ExpectedEvidenceSpec {
  kind: string;
  description: string;
  mandatory?: boolean;
}

export interface WorkspaceCriterion {
  id: string;
  programId: string;
  organizationId: string;
  refCode: string | null;
  title: string;

  requirementText: string | null;
  sourceReference: string | null;
  auditQuestion: string | null;
  expectedEvidence: ExpectedEvidenceSpec[];
  auditProcedure: string | null;
  samplingGuidance: string | null;

  applicable: boolean;
  notApplicableReason: string | null;

  assignedAuditorId: string | null;
  assignedAuditeeId: string | null;

  auditeeResponse: string | null;
  auditeeRespondedBy: string | null;
  auditeeRespondedAt: string | null;

  procedurePerformed: string | null;
  sampleDescription: string | null;
  testPerformed: string | null;
  testResult: TestResult | null;
  auditorNote: string | null;
  auditorConclusion: string | null;
  conformityStatus: ConformityStatus;
  concludedBy: string | null;
  concludedAt: string | null;

  workStatus: CriterionWorkStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CriterionEvidenceLite {
  id: string;
  evidenceKind: string;
  title: string;
  accepted: boolean | null;
  supportsConformity: boolean | null;
  createdAt: string;
}

export interface CriterionEvidenceRequestLite {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
}

export interface CriterionFindingLite {
  id: string;
  statement: string;
  classification: string;
  severity: string | null;
  status: string;
}

export interface CriterionDetail {
  criterion: WorkspaceCriterion;
  evidence: CriterionEvidenceLite[];
  evidenceRequests: CriterionEvidenceRequestLite[];
  findings: CriterionFindingLite[];
}

export async function getCriterion(id: string): Promise<CriterionDetail | null> {
  const res = await Api.get(`/audits/criteria/${encodeURIComponent(id)}`);
  const payload = unwrapEnvelope(res) as CriterionDetail | undefined;
  return payload && payload.criterion ? payload : null;
}

export async function updateApplicability(
  id: string,
  input: { applicable: boolean; reason?: string | null }
): Promise<WorkspaceCriterion> {
  const res = await Api.patch(`/audits/criteria/${encodeURIComponent(id)}/applicability`, input);
  return unwrapEnvelope(res) as WorkspaceCriterion;
}

export async function assignCriterion(
  id: string,
  input: { auditorId?: string | null; auditeeId?: string | null }
): Promise<WorkspaceCriterion> {
  const res = await Api.patch(`/audits/criteria/${encodeURIComponent(id)}/assign`, input);
  return unwrapEnvelope(res) as WorkspaceCriterion;
}

export async function submitAuditeeResponse(id: string, text: string): Promise<WorkspaceCriterion> {
  const res = await Api.post(`/audits/criteria/${encodeURIComponent(id)}/auditee-response`, { text });
  return unwrapEnvelope(res) as WorkspaceCriterion;
}

export interface RecordTestInput {
  procedurePerformed?: string | null;
  sampleDescription?: string | null;
  testPerformed?: string | null;
  testResult?: TestResult | null;
  auditorNote?: string | null;
}

export async function recordTest(id: string, input: RecordTestInput): Promise<WorkspaceCriterion> {
  const res = await Api.post(`/audits/criteria/${encodeURIComponent(id)}/test`, input);
  return unwrapEnvelope(res) as WorkspaceCriterion;
}

export interface ConcludeCriterionInput {
  auditorConclusion?: string | null;
  conformityStatus: ConformityStatus;
}

export async function concludeCriterion(
  id: string,
  input: ConcludeCriterionInput
): Promise<WorkspaceCriterion> {
  const res = await Api.post(`/audits/criteria/${encodeURIComponent(id)}/conclude`, input);
  return unwrapEnvelope(res) as WorkspaceCriterion;
}

// ---------------------------------------------------------------------------
// Dowody
// ---------------------------------------------------------------------------

export const EVIDENCE_KINDS = [
  'document',
  'interview_answer',
  'interview_statement',
  'observation',
  'system_export',
  'screenshot',
  'note',
  'sample',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_REQUEST_STATUSES = ['open', 'responded', 'fulfilled', 'overdue', 'cancelled'] as const;
export type EvidenceRequestStatus = (typeof EVIDENCE_REQUEST_STATUSES)[number];

export interface WorkspaceEvidence {
  id: string;
  programId: string;
  criterionId: string | null;
  requestId: string | null;
  evidenceKind: EvidenceKind;
  title: string;
  description: string | null;
  externalReference: string | null;
  contentSnapshot: string | null;
  providedBy: string | null;
  providedAt: string | null;
  capturedAt: string;

  sufficiency: 'sufficient' | 'insufficient' | 'unknown' | null;
  reliability: 'reliable' | 'questionable' | 'unknown' | null;
  currencyStatus: 'current' | 'outdated' | 'unknown' | null;
  /** NULL = nieoceniony. FALSE = dowód PRZECZĄCY — nigdy nie chowany. */
  supportsConformity: boolean | null;
  reviewNote: string | null;
  accepted: boolean | null;
  acceptedBy: string | null;
  acceptedAt: string | null;
  rejectionReason: string | null;

  createdAt: string;
  updatedAt: string;
}

export async function listEvidence(params: {
  programId?: string;
  criterionId?: string;
}): Promise<WorkspaceEvidence[]> {
  const qs = buildQuery(params);
  const res = await Api.get(`/audits/evidence${qs}`);
  return toArray<WorkspaceEvidence>(unwrapEnvelope(res), 'evidence', 'items');
}

export interface SubmitEvidenceInput {
  programId: string;
  criterionId?: string | null;
  requestId?: string | null;
  kind: EvidenceKind;
  title: string;
  description?: string | null;
  externalReference?: string | null;
  contentSnapshot?: string | null;
}

export async function submitEvidence(input: SubmitEvidenceInput): Promise<WorkspaceEvidence> {
  const res = await Api.post('/audits/evidence', input);
  return unwrapEnvelope(res) as WorkspaceEvidence;
}

export interface ReviewEvidenceInput {
  sufficiency?: 'sufficient' | 'insufficient' | 'unknown' | null;
  reliability?: 'reliable' | 'questionable' | 'unknown' | null;
  currencyStatus?: 'current' | 'outdated' | 'unknown' | null;
  supportsConformity?: boolean | null;
  accepted?: boolean | null;
  reviewNote?: string | null;
  rejectionReason?: string | null;
}

export async function reviewEvidence(id: string, input: ReviewEvidenceInput): Promise<WorkspaceEvidence> {
  const res = await Api.post(`/audits/evidence/${encodeURIComponent(id)}/review`, input);
  return unwrapEnvelope(res) as WorkspaceEvidence;
}

export interface WorkspaceEvidenceRequest {
  id: string;
  programId: string;
  criterionId: string | null;
  title: string;
  description: string | null;
  status: EvidenceRequestStatus;
  dueDate: string | null;
  requestedFromUserId: string | null;
}

export async function listEvidenceRequests(params: {
  programId?: string;
  criterionId?: string;
}): Promise<WorkspaceEvidenceRequest[]> {
  const qs = buildQuery(params);
  const res = await Api.get(`/audits/evidence/requests${qs}`);
  return toArray<WorkspaceEvidenceRequest>(unwrapEnvelope(res), 'requests', 'items');
}

export interface CreateEvidenceRequestInput {
  programId: string;
  criterionId?: string | null;
  title: string;
  description?: string | null;
  expectedEvidenceKind?: EvidenceKind | null;
  requestedFromUserId?: string | null;
  dueDate?: string | null;
}

export async function createEvidenceRequest(
  input: CreateEvidenceRequestInput
): Promise<WorkspaceEvidenceRequest> {
  const res = await Api.post('/audits/evidence/requests', input);
  return unwrapEnvelope(res) as WorkspaceEvidenceRequest;
}

// ---------------------------------------------------------------------------
// Ustalenia i odpowiedzi właściciela obszaru
// ---------------------------------------------------------------------------

export const FINDING_STATUSES = [
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
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const FINDING_SEVERITIES = ['informational', 'low', 'medium', 'high', 'critical'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export interface WorkspaceFinding {
  id: string;
  programId: string;
  criterionId: string | null;
  referenceCode: string | null;
  statement: string;
  requirementText: string | null;
  conditionText: string | null;
  gapText: string | null;
  objectiveEvidence: string[];
  contradictingEvidence: string[];
  classification: string;
  severity: FindingSeverity | null;
  recommendation: string | null;
  rootCause: string | null;
  rootCauseMethod: string | null;
  rootCauseConfirmed: boolean;
  status: FindingStatus;
  ownerUserId: string | null;
  authorId: string | null;
  reviewedBy: string | null;
  aiProposed: boolean;
  residualRisk: string | null;
  residualRiskNote: string | null;
  closedAt: string | null;
  closureNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export const RESPONSE_POSITIONS = ['accept', 'partially_accept', 'reject', 'request_clarification'] as const;
export type ResponsePosition = (typeof RESPONSE_POSITIONS)[number];

export interface WorkspaceManagementResponse {
  id: string;
  findingId: string;
  position: ResponsePosition;
  statement: string;
  respondedBy: string | null;
  respondedAt: string;
  status: 'draft' | 'submitted' | 'accepted' | 'returned';
}

export const ACTION_KINDS = ['correction', 'containment', 'corrective_action', 'preventive_action'] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export const ACTION_STATUSES = [
  'proposed',
  'approved',
  'in_progress',
  'implemented',
  'verified',
  'rejected',
  'cancelled',
  'overdue',
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export interface WorkspaceCorrectiveAction {
  id: string;
  findingId: string;
  actionKind: ActionKind;
  title: string;
  description: string | null;
  ownerUserId: string | null;
  dueDate: string | null;
  status: ActionStatus;
  approvedBy: string | null;
  implementedAt: string | null;
  implementedBy: string | null;
  createdBy: string | null;
}

export const VERIFICATION_KINDS = ['implementation', 'effectiveness'] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];

export const VERIFICATION_RESULTS = ['effective', 'partially_effective', 'not_effective', 'inconclusive'] as const;
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

export interface WorkspaceVerification {
  id: string;
  correctiveActionId: string | null;
  findingId: string;
  verificationKind: VerificationKind;
  performedAt: string | null;
  performedBy: string | null;
  evidenceId: string | null;
  result: VerificationResult | null;
  note: string | null;
}

export interface WorkspaceFindingDetail extends WorkspaceFinding {
  managementResponses: WorkspaceManagementResponse[];
  correctiveActions: WorkspaceCorrectiveAction[];
  verifications: WorkspaceVerification[];
}

export async function listFindings(params: {
  programId: string;
  criterionId?: string;
}): Promise<{ items: WorkspaceFinding[]; total: number }> {
  const qs = buildQuery(params);
  const res = await Api.get(`/audits/findings${qs}`);
  const payload = unwrapEnvelope(res);
  const items = toArray<WorkspaceFinding>(payload, 'items');
  return { items, total: items.length };
}

export async function getFinding(id: string): Promise<WorkspaceFindingDetail> {
  const res = await Api.get(`/audits/findings/${encodeURIComponent(id)}`);
  return unwrapEnvelope(res) as WorkspaceFindingDetail;
}

export interface CreateFindingInput {
  programId: string;
  criterionId?: string | null;
  statement: string;
  requirementText?: string | null;
  conditionText?: string | null;
  gapText?: string | null;
  classification?: string;
  severity?: FindingSeverity | null;
  recommendation?: string | null;
  objectiveEvidence?: string[];
  contradictingEvidence?: string[];
  ownerUserId?: string | null;
}

export async function createFinding(input: CreateFindingInput): Promise<WorkspaceFinding> {
  const res = await Api.post('/audits/findings', input);
  return unwrapEnvelope(res) as WorkspaceFinding;
}

export interface UpdateFindingInput {
  rootCause?: string | null;
  rootCauseMethod?: string | null;
  rootCauseConfirmed?: boolean;
  ownerUserId?: string | null;
}

export async function updateFinding(id: string, patch: UpdateFindingInput): Promise<WorkspaceFinding> {
  const res = await Api.patch(`/audits/findings/${encodeURIComponent(id)}`, patch);
  return unwrapEnvelope(res) as WorkspaceFinding;
}

export interface ReviewFindingInput {
  decision: 'confirm' | 'send_back' | 'reject';
  note?: string | null;
}

export async function reviewFinding(id: string, input: ReviewFindingInput): Promise<WorkspaceFinding> {
  const res = await Api.post(`/audits/findings/${encodeURIComponent(id)}/review`, input);
  return unwrapEnvelope(res) as WorkspaceFinding;
}

export interface SubmitManagementResponseInput {
  position: ResponsePosition;
  statement: string;
}

export async function submitManagementResponse(
  findingId: string,
  input: SubmitManagementResponseInput
): Promise<WorkspaceManagementResponse> {
  const res = await Api.post(`/audits/findings/${encodeURIComponent(findingId)}/response`, input);
  return unwrapEnvelope(res) as WorkspaceManagementResponse;
}

export async function acceptResidualRisk(id: string, note: string): Promise<WorkspaceFinding> {
  const res = await Api.post(`/audits/findings/${encodeURIComponent(id)}/accept-risk`, { note });
  return unwrapEnvelope(res) as WorkspaceFinding;
}

export async function closeFinding(id: string, note: string): Promise<WorkspaceFinding> {
  const res = await Api.post(`/audits/findings/${encodeURIComponent(id)}/close`, { note });
  return unwrapEnvelope(res) as WorkspaceFinding;
}

// ---------------------------------------------------------------------------
// Działania korygujące i weryfikacja
// ---------------------------------------------------------------------------

export interface ProposeActionInput {
  actionKind: ActionKind;
  title: string;
  description?: string | null;
  ownerUserId?: string | null;
  dueDate?: string | null;
  priority?: string | null;
}

export async function proposeAction(
  findingId: string,
  input: ProposeActionInput
): Promise<WorkspaceCorrectiveAction> {
  const res = await Api.post('/audits/actions', { findingId, ...input });
  return unwrapEnvelope(res) as WorkspaceCorrectiveAction;
}

export async function approveAction(id: string): Promise<WorkspaceCorrectiveAction> {
  const res = await Api.post(`/audits/actions/${encodeURIComponent(id)}/approve`, {});
  return unwrapEnvelope(res) as WorkspaceCorrectiveAction;
}

export async function rejectAction(id: string, reason: string): Promise<WorkspaceCorrectiveAction> {
  const res = await Api.post(`/audits/actions/${encodeURIComponent(id)}/reject`, { reason });
  return unwrapEnvelope(res) as WorkspaceCorrectiveAction;
}

export interface ReportImplementationInput {
  evidenceId?: string | null;
  note?: string | null;
}

export async function reportImplementation(
  id: string,
  input: ReportImplementationInput
): Promise<WorkspaceCorrectiveAction> {
  const res = await Api.post(`/audits/actions/${encodeURIComponent(id)}/implementation`, input);
  return unwrapEnvelope(res) as WorkspaceCorrectiveAction;
}

export interface PlanVerificationInput {
  findingId: string;
  correctiveActionId?: string | null;
  verificationKind: VerificationKind;
  method?: string | null;
  plannedDate?: string | null;
}

export async function planVerification(input: PlanVerificationInput): Promise<WorkspaceVerification> {
  const res = await Api.post('/audits/actions/verifications', input);
  return unwrapEnvelope(res) as WorkspaceVerification;
}

export interface PerformVerificationInput {
  result: VerificationResult;
  note?: string | null;
  evidenceId?: string | null;
}

export async function performVerification(
  id: string,
  input: PerformVerificationInput
): Promise<WorkspaceVerification> {
  const res = await Api.post(`/audits/actions/verifications/${encodeURIComponent(id)}/perform`, input);
  return unwrapEnvelope(res) as WorkspaceVerification;
}

// ---------------------------------------------------------------------------
// Teresa — Intent → Preview → Confirmation → Commit → Settle
// ---------------------------------------------------------------------------

export const AI_INTENTS = [
  'explain_criterion',
  'draft_evidence_request',
  'draft_finding',
  'propose_corrective_options',
] as const;
export type AiIntent = (typeof AI_INTENTS)[number];

export const AI_TARGET_TYPES = ['criterion', 'evidence_request', 'finding', 'corrective_action'] as const;
export type AiTargetType = (typeof AI_TARGET_TYPES)[number];

export const AI_PROPOSAL_STATUSES = ['pending', 'accepted', 'rejected', 'superseded', 'expired'] as const;
export type AiProposalStatus = (typeof AI_PROPOSAL_STATUSES)[number];

export interface WorkspaceAiProposal {
  id: string;
  programId: string;
  targetType: AiTargetType;
  targetId: string | null;
  intent: string;
  proposal: Record<string, unknown>;
  preview: Record<string, unknown>;
  rationale: string | null;
  confidence: number | null;
  sources: Array<Record<string, unknown>>;
  status: AiProposalStatus;
  decidedAt: string | null;
  committedAt: string | null;
}

export interface CreateIntentInput {
  programId: string;
  targetType: AiTargetType;
  targetId?: string | null;
  intent: AiIntent;
  context?: Record<string, unknown>;
}

export async function createIntent(input: CreateIntentInput): Promise<WorkspaceAiProposal> {
  const res = await Api.post('/audits/ai/intent', input);
  return unwrapEnvelope(res) as WorkspaceAiProposal;
}

export async function getAiPreview(id: string): Promise<WorkspaceAiProposal> {
  const res = await Api.get(`/audits/ai/proposals/${encodeURIComponent(id)}/preview`);
  return unwrapEnvelope(res) as WorkspaceAiProposal;
}

export async function decideProposal(
  id: string,
  input: { decision: 'accept' | 'reject'; note?: string | null }
): Promise<WorkspaceAiProposal> {
  const res = await Api.post(`/audits/ai/proposals/${encodeURIComponent(id)}/decide`, input);
  return unwrapEnvelope(res) as WorkspaceAiProposal;
}

export async function commitProposal(id: string): Promise<WorkspaceAiProposal> {
  const res = await Api.post(`/audits/ai/proposals/${encodeURIComponent(id)}/commit`, {});
  return unwrapEnvelope(res) as WorkspaceAiProposal;
}

// ---------------------------------------------------------------------------
// Ścieżka audytowa (audit trail) — U6, `server/src/routes/audits/trail.routes.ts`.
// Realny log zdarzeń domenowych (`audit_domain_events`), nie atrapa: użyty
// przez v2/CriterionWorkspaceV2 dla sekcji „Historia" prawego panelu.
// ---------------------------------------------------------------------------

export interface WorkspaceDomainEvent {
  id: string;
  programId: string | null;
  entityType: string;
  entityId: string | null;
  eventType: string;
  actorId: string | null;
  actorRole: string | null;
  summary: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

/** Pełna historia jednego obiektu (rosnąco chronologicznie) — `GET /trail/history`. */
export async function getEntityHistory(entityType: string, entityId: string): Promise<WorkspaceDomainEvent[]> {
  const res = await Api.get(
    `/audits/trail/history?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
  );
  const payload = unwrapEnvelope(res);
  return toArray<Record<string, unknown>>(payload).map((r) => ({
    id: String(r.id ?? ''),
    programId: (r.programId as string | null | undefined) ?? null,
    entityType: String(r.entityType ?? entityType),
    entityId: (r.entityId as string | null | undefined) ?? entityId,
    eventType: String(r.eventType ?? ''),
    actorId: (r.actorId as string | null | undefined) ?? null,
    actorRole: (r.actorRole as string | null | undefined) ?? null,
    summary: (r.summary as string | null | undefined) ?? null,
    payload: (r.payload as Record<string, unknown> | undefined) ?? {},
    occurredAt: String(r.occurredAt ?? ''),
  }));
}
