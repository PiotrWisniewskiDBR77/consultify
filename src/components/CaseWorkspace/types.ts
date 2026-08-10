/**
 * Zlecenia (Case Workspace) — kształty danych czytane z REALNEGO API
 * `/api/v8/case-workspace/*`.
 *
 * Każdy typ poniżej jest przepisany z serwisu domenowego, który go zwraca
 * (`server/src/services/caseWorkspace/*.ts`) — nie z dokumentacji, bo audyty
 * w tym repo starzeją się w ~3 dni. Źródła:
 *   CaseCoreView               ← caseCoreService.ts
 *   CasePlanVersion / graf     ← casePlanVersionService.ts
 *   CaseActionProposal         ← proposalApprovalService.ts
 *   CaseWait                   ← waitSubscriptionService.ts
 *   ValueMeasurement / historia← caseHistoryService.ts
 *   CaseArtifactLink           ← artifactLinkService.ts
 */

export type CaseProfile = 'LIGHT' | 'STANDARD' | 'TRANSFORMATION' | 'MONITORING';
export type GovernanceTier = 'LIGHTWEIGHT' | 'STANDARD' | 'CONTROLLED';
export type AutonomyPolicy = 'ASK_EACH_ACTION' | 'ASK_MATERIAL_ACTIONS' | 'EXECUTE_APPROVED_PLAN';
export type CaseStatus = 'DRAFT' | 'ACTIVE' | 'BLOCKED' | 'CLOSED' | 'FAILED' | 'CANCELLED';
export type ClosureType =
  | 'DELIVERY_COMPLETED'
  | 'DECISION_COMPLETED'
  | 'IMPLEMENTATION_COMPLETED'
  | 'OUTCOME_VALIDATED'
  | 'COMPLETED_PARTIAL';
export type ClosureAxisStatus = 'NOT_APPLICABLE' | 'PENDING' | 'COMPLETED';
export type OutcomeAxisStatus = 'NOT_APPLICABLE' | 'PENDING' | 'VALIDATED';

export interface CaseCoreView {
  caseId: string;
  projectId: string;
  organizationId: string;
  caseProfile: CaseProfile;
  governanceTier: GovernanceTier;
  autonomyPolicy: AutonomyPolicy;
  autonomyPolicyRef: string | null;
  caseStatus: CaseStatus;
  contractedClosureType: ClosureType;
  deliveryStatus: ClosureAxisStatus;
  decisionStatus: ClosureAxisStatus;
  implementationStatus: ClosureAxisStatus;
  outcomeStatus: OutcomeAxisStatus;
  closureType: ClosureType | null;
  closedAt: string | null;
  closedByActorId: string | null;
  closureEvidenceRef: string | null;
  sponsorUserId: string | null;
  acceptanceCriteriaRef: string | null;
  budgetPolicyRef: string | null;
  currentPlanVersionId: string | null;
  createdByActorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  projectName: string | null;
  projectDescription: string | null;
  projectOwnerId: string | null;
}

export interface GraphNode {
  nodeId: string;
  type?: string;
  effectClass?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GraphEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType?: string;
  type?: string;
  label?: string;
  conditionExpression?: string;
  [key: string]: unknown;
}

export interface CanonicalGraph {
  schemaVersion?: string;
  graphId?: string;
  entryNodeIds: string[];
  terminalNodeIds: string[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  variables?: Array<{ name: string; [key: string]: unknown }>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export type PlanVersionStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'SUPERSEDED' | 'WITHDRAWN';

export interface CasePlanVersion {
  casePlanVersionId: string;
  caseId: string;
  planNumber: number;
  status: PlanVersionStatus;
  semanticGraph: CanonicalGraph;
  graphDigest: string;
  changeReason: string | null;
  publishedAt: string | null;
  createdByActorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanValidationBlocker {
  code: string;
  detail: string;
  severity: 'BLOCKING' | 'DEFERRED_EXTERNAL';
}

export interface PlanValidationResult {
  valid: boolean;
  blockers: PlanValidationBlocker[];
}

export type ActionProposalStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'AUDITED'
  | 'REJECTED'
  | 'REQUESTED_CHANGES'
  | 'REVOKED'
  | 'FAILED';

export interface CaseActionProposal {
  actionProposalId: string;
  caseId: string;
  runId: string;
  nodeRunId: string;
  status: ActionProposalStatus;
  effectClass: string;
  previewRef: string;
  expiresAt: string | null;
  proposerType: 'HUMAN' | 'AGENT' | 'SYSTEM';
  createdByActorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type CaseWaitType = 'HUMAN' | 'TIMER' | 'DOMAIN_EVENT' | 'EXTERNAL_CALLBACK';
export type CaseWaitStatus = 'ACTIVE' | 'SATISFIED' | 'EXPIRED' | 'CANCELLED';

export interface CaseWait {
  waitId: string;
  caseId: string;
  runId: string | null;
  nodeRunId: string | null;
  actionProposalId: string | null;
  waitType: CaseWaitType;
  status: CaseWaitStatus;
  correlationKey: string;
  expectedEventType: string | null;
  dueAt: string | null;
  timeoutAt: string | null;
  satisfiedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type ValueMeasurementStatus =
  | 'UNMEASURED'
  | 'PARTIAL'
  | 'CONFIRMED'
  | 'NOT_ACHIEVED'
  | 'EVIDENCE_MISSING';

export interface ValueMeasurement {
  measurementId: string;
  caseId: string;
  metricKey: string;
  metricName: string;
  baselineValue: number | null;
  baselineUnit: string | null;
  targetValue: number | null;
  targetUnit: string | null;
  actualValue: number | null;
  actualUnit: string | null;
  measurementStatus: ValueMeasurementStatus;
  measurementDate: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  attribution: string;
  nextMeasurementDueAt: string | null;
  evidenceRef: string | null;
  createdAt: string;
}

export type ArtifactLinkRelation =
  | 'INPUT'
  | 'OUTPUT'
  | 'EVIDENCE'
  | 'DECISION_BASIS'
  | 'DELIVERABLE'
  | 'OUTCOME_MEASUREMENT';

export interface CaseArtifactLink {
  linkId: string;
  caseId: string;
  artifactType: string;
  artifactId: string;
  artifactRevision: string | null;
  relation: ArtifactLinkRelation;
  linkStatus: 'ACTIVE' | 'UNLINKED' | 'UNAVAILABLE';
  isStale: boolean;
  staleReason: string | null;
  linkedAt: string;
  updatedAt: string;
}

export interface CaseHistoryEvent {
  eventId: string;
  caseId: string;
  eventType: string;
  actorId: string;
  occurredAt: string;
  summary: string;
  globalSeq: number;
}

/**
 * Jednolity opis nieudanego wywołania API dla warstwy widoku.
 *
 * `kind` rozdziela stany, których właściciel wymaga jawnie: „zablokowany"
 * (403/uprawnienia) NIE jest tym samym co „błąd" (500) ani „nie znaleziono"
 * (404 — enumeration-safe, ten sam ekran dla braku dostępu i braku obiektu).
 */
export type CaseApiFailureKind = 'blocked' | 'notFound' | 'error';

export interface CaseApiFailure {
  kind: CaseApiFailureKind;
  message: string;
  status?: number;
  code?: string;
}
