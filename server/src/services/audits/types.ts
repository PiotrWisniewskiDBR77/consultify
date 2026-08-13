/**
 * types — kontrakt domeny Audits współdzielony przez wszystkie serwisy modułu.
 *
 * Granica własności: te typy należą do Audits. Nie kopiujemy tu Artifact Core
 * ani typów Assessment/Tools — gdy pojawi się wspólny manifest kontraktowy,
 * podmieniamy adapter, nie model domenowy.
 *
 * Zasada nadrzędna: audyt nie jest ankietą. Dlatego wymaganie, pytanie,
 * oczekiwany dowód, dostarczony dowód, wykonana procedura, próba, wynik testu,
 * notatka audytora, wniosek i decyzja o zgodności są ODDZIELNYMI polami. Zlanie
 * ich w „odpowiedź" jest naruszeniem kontraktu (MOD-AGR-04 §1, §9).
 */

// ---------------------------------------------------------------------------
// Klasyfikacja źródeł i pakietów
// ---------------------------------------------------------------------------

/**
 * Status wiarygodności pakietu/źródła. Widoczny w Library — użytkownik musi
 * odróżnić zweryfikowaną normę od demonstracji. Nie wolno sugerować
 * normatywności bez dowodu.
 */
export const PACK_CLASSIFICATIONS = [
  'VERIFIED_NORMATIVE',
  'INTERNAL_FRAMEWORK',
  'DEMONSTRATION',
  'LEGACY',
  'EVIDENCE_MISSING',
] as const;
export type PackClassification = (typeof PACK_CLASSIFICATIONS)[number];

export const RIGHTS_STATUSES = [
  'licensed',
  'owned_internal',
  'public_reference',
  'not_verified',
  'not_permitted',
] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const SOURCE_KINDS = [
  'normative_standard',
  'internal_procedure',
  'checklist',
  'regulation',
  'demonstration',
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const PUBLICATION_STATUSES = ['draft', 'in_review', 'published', 'deprecated'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export interface AuditNormSource {
  id: string;
  organizationId: string | null;
  sourceKey: string;
  title: string;
  publisher: string | null;
  sourceVersion: string | null;
  sourceKind: SourceKind;
  rightsStatus: RightsStatus;
  rightsNote: string | null;
  licenseReference: string | null;
  sourceUri: string | null;
  materialId: string | null;
  materialVersion: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  verificationStatus: PackClassification;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationNote: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Audit Pack
// ---------------------------------------------------------------------------

/**
 * Taksonomia ustaleń jest KONFIGUROWALNA per pakiet. Kernel nie narzuca jednej
 * listy, bo `major/minor` ma sens prawny tylko tam, gdzie definiuje je konkretna
 * metodyka. Pakiet deklaruje własne pozycje; walidator sprawdza spójność.
 */
export interface FindingTaxonomyEntry {
  key: string;
  label: string;
  /** Czy pozycja oznacza brak spełnienia wymagania (wpływa na wnioski i raport). */
  nonConforming: boolean;
  /** Czy pozycja wymaga działania korygującego przed zamknięciem. */
  requiresCorrectiveAction: boolean;
  description?: string;
  defaultSeverity?: FindingSeverity | null;
}

export const FINDING_SEVERITIES = [
  'informational',
  'low',
  'medium',
  'high',
  'critical',
] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export interface SeverityRule {
  key: string;
  label: string;
  /** Opis warunku, przy którym reguła podpowiada tę istotność. */
  when: string;
  severity: FindingSeverity;
}

export interface PackDecisionRules {
  /** Czy zamknięcie ustalenia wymaga innej osoby niż właściciel działania. */
  requireIndependentVerification?: boolean;
  /** Czy audytowany może zatwierdzić własną zgodność (zawsze false w kernelu). */
  allowAuditeeSelfApproval?: false;
  /** Czy akceptacja ryzyka rezydualnego wymaga wskazanej roli. */
  riskAcceptanceRoles?: AuditRole[];
  /** Czy pakiet zamraża komplet pytań (np. porównywalność między cyklami). */
  frozenQuestionSet?: boolean;
  [key: string]: unknown;
}

export interface AuditPack {
  id: string;
  organizationId: string | null;
  packKey: string;
  version: number;
  title: string;
  summary: string | null;
  purpose: string | null;
  sourceId: string | null;
  sourceVersion: string | null;
  classification: PackClassification;
  publicationStatus: PublicationStatus;
  scope: string | null;
  objectives: string | null;
  auditType: string | null;
  requiredRoles: AuditRole[];
  requiredCompetencies: string[];
  workflow: Record<string, unknown>;
  findingTaxonomy: FindingTaxonomyEntry[];
  severityRules: SeverityRule[];
  decisionRules: PackDecisionRules;
  samplingGuidance: string | null;
  outputSchema: Record<string, unknown>;
  reportSchema: Record<string, unknown>;
  correctiveActionSchema: Record<string, unknown>;
  verificationSchema: Record<string, unknown>;
  estimatedDurationDays: number | null;
  recurrenceDefault: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  provenance: Record<string, unknown>;
  expertApprovedBy: string | null;
  expertApprovedAt: string | null;
  expertApprovalNote: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  deprecatedAt: string | null;
  supersedesPackId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CRITERION_NODE_KINDS = ['domain', 'clause', 'control', 'criterion'] as const;
export type CriterionNodeKind = (typeof CRITERION_NODE_KINDS)[number];

export interface ExpectedEvidenceSpec {
  kind: EvidenceKind;
  description: string;
  mandatory?: boolean;
}

export interface AuditPackCriterion {
  id: string;
  packId: string;
  parentId: string | null;
  ordinal: number;
  refCode: string | null;
  nodeKind: CriterionNodeKind;
  title: string;
  /** WŁASNE sformułowanie wymagania — nie kopia treści normy objętej prawami. */
  requirementText: string | null;
  /** Wskazanie miejsca w źródle (np. „ISO 19011:2018, 6.4.7"). */
  sourceReference: string | null;
  auditQuestion: string | null;
  expectedEvidence: ExpectedEvidenceSpec[];
  auditProcedure: string | null;
  samplingGuidance: string | null;
  applicabilityRule: Record<string, unknown>;
  mandatory: boolean;
  weight: number | null;
  suggestedOwnerRole: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Program (powierzchnia Processes)
// ---------------------------------------------------------------------------

/**
 * Lifecycle audytu. Kolejność jest wiążąca — przejścia sprawdza serwis, a nie
 * UI. `closed` jest osiągalne wyłącznie po rozstrzygnięciu wszystkich ustaleń
 * albo jawnym zaakceptowaniu ryzyka rezydualnego.
 */
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

export interface AuditProgramMember {
  id: string;
  programId: string;
  organizationId: string;
  userId: string;
  memberRole: AuditRole;
  scopeNote: string | null;
  independenceDeclared: boolean;
  conflictNote: string | null;
  competenceNote: string | null;
  assignedBy: string | null;
  assignedAt: string;
  removedAt: string | null;
}

// ---------------------------------------------------------------------------
// Kryterium w programie — jądro obronności
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

export const CRITERION_WORK_STATUSES = [
  'open',
  'evidence_requested',
  'evidence_received',
  'tested',
  'concluded',
] as const;
export type CriterionWorkStatus = (typeof CRITERION_WORK_STATUSES)[number];

export const TEST_RESULTS = ['pass', 'fail', 'partial', 'inconclusive'] as const;
export type TestResult = (typeof TEST_RESULTS)[number];

export interface AuditProgramCriterion {
  id: string;
  programId: string;
  organizationId: string;
  packCriterionId: string | null;
  parentId: string | null;
  ordinal: number;
  refCode: string | null;
  nodeKind: CriterionNodeKind;
  title: string;

  requirementText: string | null;
  sourceReference: string | null;
  auditQuestion: string | null;
  expectedEvidence: ExpectedEvidenceSpec[];
  auditProcedure: string | null;
  samplingGuidance: string | null;
  mandatory: boolean;
  weight: number | null;

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

export const EVIDENCE_REQUEST_STATUSES = [
  'open',
  'responded',
  'fulfilled',
  'overdue',
  'cancelled',
] as const;
export type EvidenceRequestStatus = (typeof EVIDENCE_REQUEST_STATUSES)[number];

export interface AuditEvidenceRequest {
  id: string;
  programId: string;
  organizationId: string;
  criterionId: string | null;
  title: string;
  description: string | null;
  expectedEvidenceKind: EvidenceKind | null;
  requestedFromUserId: string | null;
  requestedBy: string | null;
  requestedAt: string;
  dueDate: string | null;
  status: EvidenceRequestStatus;
  taskId: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvidence {
  id: string;
  programId: string;
  organizationId: string;
  criterionId: string | null;
  requestId: string | null;
  evidenceKind: EvidenceKind;
  title: string;
  description: string | null;

  materialId: string | null;
  /** Konkretna wersja materiału — późniejsza zmiana pliku nie zmienia podstawy. */
  materialVersion: string | null;
  interviewAssignmentId: string | null;
  externalReference: string | null;
  contentSnapshot: string | null;
  contentHash: string | null;
  sourceSystem: string | null;

  providedBy: string | null;
  providedAt: string | null;
  capturedBy: string | null;
  capturedAt: string;
  periodFrom: string | null;
  periodTo: string | null;

  sufficiency: 'sufficient' | 'insufficient' | 'unknown' | null;
  reliability: 'reliable' | 'questionable' | 'unknown' | null;
  currencyStatus: 'current' | 'outdated' | 'unknown' | null;
  /** NULL = nieoceniony. FALSE = dowód PRZECZĄCY — nie wolno go ukryć. */
  supportsConformity: boolean | null;
  reviewNote: string | null;
  accepted: boolean | null;
  acceptedBy: string | null;
  acceptedAt: string | null;
  rejectionReason: string | null;

  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Ustalenia, odpowiedzi, działania, weryfikacja
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

export interface AuditFinding {
  id: string;
  programId: string;
  organizationId: string;
  criterionId: string | null;
  referenceCode: string | null;

  statement: string;
  requirementText: string | null;
  conditionText: string | null;
  sourceReference: string | null;
  gapText: string | null;
  objectiveEvidence: string[];
  contradictingEvidence: string[];

  /** Klucz z taksonomii pakietu — kernel nie narzuca jednej listy. */
  classification: string;
  severity: FindingSeverity | null;
  riskText: string | null;
  impactText: string | null;
  recommendation: string | null;

  rootCause: string | null;
  rootCauseMethod: string | null;
  rootCauseConfirmed: boolean;

  status: FindingStatus;
  ownerUserId: string | null;
  authorId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  sentBackAt: string | null;
  sentBackBy: string | null;
  sendBackReason: string | null;

  aiProposed: boolean;
  aiRationale: string | null;
  aiConfidence: number | null;

  residualRisk: string | null;
  residualRiskAcceptedBy: string | null;
  residualRiskAcceptedAt: string | null;
  residualRiskNote: string | null;

  recurringFromFindingId: string | null;
  closedAt: string | null;
  closedBy: string | null;
  closureDecision: 'closed_verified' | 'risk_accepted' | 'withdrawn' | null;
  closureNote: string | null;

  createdAt: string;
  updatedAt: string;
}

export const RESPONSE_POSITIONS = [
  'accept',
  'partially_accept',
  'reject',
  'request_clarification',
] as const;
export type ResponsePosition = (typeof RESPONSE_POSITIONS)[number];

export interface AuditManagementResponse {
  id: string;
  findingId: string;
  programId: string;
  organizationId: string;
  position: ResponsePosition;
  statement: string;
  respondedBy: string | null;
  respondedAt: string;
  status: 'draft' | 'submitted' | 'accepted' | 'returned';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Rozróżnienie rodzajów działania jest wymagane: korekcja usuwa skutek,
 * działanie korygujące usuwa przyczynę. Zamknięcie ustalenia na samej korekcji
 * jest zamiataniem problemu.
 */
export const ACTION_KINDS = [
  'correction',
  'containment',
  'corrective_action',
  'preventive_action',
] as const;
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

export interface AuditCorrectiveAction {
  id: string;
  findingId: string;
  programId: string;
  organizationId: string;
  actionKind: ActionKind;
  title: string;
  description: string | null;
  ownerUserId: string | null;
  dueDate: string | null;
  priority: string | null;
  status: ActionStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  taskId: string | null;
  initiativeId: string | null;
  proposalId: string | null;
  implementationEvidenceId: string | null;
  implementedAt: string | null;
  implementedBy: string | null;
  implementationNote: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const VERIFICATION_KINDS = ['implementation', 'effectiveness'] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];

export const VERIFICATION_RESULTS = [
  'effective',
  'partially_effective',
  'not_effective',
  'inconclusive',
] as const;
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

export interface AuditVerification {
  id: string;
  correctiveActionId: string | null;
  findingId: string;
  programId: string;
  organizationId: string;
  verificationKind: VerificationKind;
  method: string | null;
  plannedDate: string | null;
  performedAt: string | null;
  performedBy: string | null;
  evidenceId: string | null;
  result: VerificationResult | null;
  note: string | null;
  independenceOk: boolean | null;
  independenceNote: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Output, Report, Initiative Proposal
// ---------------------------------------------------------------------------

export interface AuditOutput {
  id: string;
  programId: string;
  organizationId: string;
  version: number;
  title: string;
  payload: Record<string, unknown>;
  contentHash: string | null;
  packId: string | null;
  packVersion: number | null;
  finalizedBy: string | null;
  finalizedAt: string;
  supersededBy: string | null;
  supersededAt: string | null;
  provenance: Record<string, unknown>;
  createdAt: string;
}

export const REPORT_KINDS = ['audit_report', 'remediation_progress'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'published',
  'superseded',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface AuditReport {
  id: string;
  programId: string;
  organizationId: string;
  outputId: string | null;
  version: number;
  reportKind: ReportKind;
  title: string;
  status: ReportStatus;
  payload: Record<string, unknown>;
  contentHash: string | null;
  templateKey: string | null;
  language: string | null;
  audience: string | null;
  confidentiality: string | null;
  materialId: string | null;
  generatedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  supersededBy: string | null;
  snapshotDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const PROPOSAL_STATUSES = [
  'draft',
  'sent_to_candidates',
  'registered',
  'deferred',
  'dismissed',
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export interface AuditInitiativeProposal {
  id: string;
  programId: string;
  organizationId: string;
  title: string;
  problemStatement: string | null;
  systemicCause: string | null;
  intendedOutcome: string | null;
  scope: string | null;
  priority: string | null;
  proposedOwnerId: string | null;
  timeframe: string | null;
  dependencies: string | null;
  successMeasures: string[];
  sourceFindingIds: string[];
  verificationLink: string | null;
  confidence: number | null;
  status: ProposalStatus;
  registeredInitiativeId: string | null;
  registeredAt: string | null;
  feedbackNote: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Teresa — Intent → Preview → Confirmation → Commit → Settle
// ---------------------------------------------------------------------------

export const AI_TARGET_TYPES = [
  'criterion',
  'evidence_request',
  'finding',
  'corrective_action',
  'report_section',
  'note',
] as const;
export type AiTargetType = (typeof AI_TARGET_TYPES)[number];

export const AI_PROPOSAL_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'superseded',
  'expired',
] as const;
export type AiProposalStatus = (typeof AI_PROPOSAL_STATUSES)[number];

export interface AuditAiProposal {
  id: string;
  programId: string;
  organizationId: string;
  targetType: AiTargetType;
  targetId: string | null;
  intent: string;
  proposal: Record<string, unknown>;
  /** Dokładnie ten fragment, który zobaczył człowiek przed potwierdzeniem. */
  preview: Record<string, unknown>;
  rationale: string | null;
  confidence: number | null;
  sources: Array<Record<string, unknown>>;
  status: AiProposalStatus;
  createdBy: string | null;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  committedAt: string | null;
}

/**
 * Operacje, których Teresa nie może wykonać nawet z potwierdzeniem — bo
 * wymagają formalnej odpowiedzialności człowieka pełniącego rolę audytową.
 */
export const AI_FORBIDDEN_OPERATIONS = [
  'confirm_conformity',
  'issue_final_finding',
  'change_severity_without_review',
  'close_finding',
  'approve_effectiveness',
  'publish_report',
  'accept_residual_risk',
] as const;
export type AiForbiddenOperation = (typeof AI_FORBIDDEN_OPERATIONS)[number];

// ---------------------------------------------------------------------------
// Kontekst wywołania
// ---------------------------------------------------------------------------

export interface AuditActor {
  userId: string;
  organizationId: string;
  /** Role platformowe (admin/user/superadmin) — nie mylić z rolami audytowymi. */
  platformRole?: string;
}
