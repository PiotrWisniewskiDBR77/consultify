export interface SourceProposalRegistration {
  initiativeId: string;
  expectedVersion: 0;
  clientRequestId: string;
  proposalId: string;
  proposalVersion: number;
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  title: string;
  problem: string;
  proposedOutcome: string | null;
  projectId: string;
  visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
  initiativeOwnerId: string;
}
export async function createExecutionTask(
  caseId: string,
  taskId: string,
  command: Record<string, unknown>
) {
  return executionWorkWrite(
    `/execution-cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(taskId)}`,
    'POST',
    command
  );
}
export async function updateExecutionTask(
  caseId: string,
  taskId: string,
  command: Record<string, unknown>
) {
  return executionWorkWrite(
    `/execution-cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(taskId)}`,
    'PATCH',
    command
  );
}
export async function completeExecutionTask(
  caseId: string,
  taskId: string,
  command: Record<string, unknown>
) {
  return executionWorkWrite(
    `/execution-cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(taskId)}/complete`,
    'POST',
    command
  );
}
export async function createExecutionDecision(
  caseId: string,
  id: string,
  command: Record<string, unknown>
) {
  return executionWorkWrite(
    `/execution-cases/${encodeURIComponent(caseId)}/decisions/${encodeURIComponent(id)}`,
    'POST',
    command
  );
}
export async function requestExecutionDecision(
  caseId: string,
  id: string,
  command: Record<string, unknown>
) {
  return executionWorkWrite(
    `/execution-cases/${encodeURIComponent(caseId)}/decisions/${encodeURIComponent(id)}/request`,
    'POST',
    command
  );
}
export async function decideExecutionDecision(
  caseId: string,
  id: string,
  command: Record<string, unknown>
) {
  return executionWorkWrite(
    `/execution-cases/${encodeURIComponent(caseId)}/decisions/${encodeURIComponent(id)}/decide`,
    'POST',
    command
  );
}
async function executionWorkWrite(path: string, method: string, command: Record<string, unknown>) {
  const response = await fetch(`/api/initiatives/runtime-v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(command),
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function readExecutionWork(caseId: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/execution-cases/${encodeURIComponent(caseId)}/work`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export function createExecutionMilestone(caseId: string, milestoneId: string, command: unknown) {
  return executionWorkWrite(
    `/execution-cases/${encodeURIComponent(caseId)}/milestones/${encodeURIComponent(milestoneId)}`,
    'POST',
    command as Record<string, unknown>
  );
}
export async function readExecutionMilestones(caseId: string) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/execution-cases/${encodeURIComponent(caseId)}/milestones`,
    { credentials: 'include' }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function listMyExecutionWork(signal?: AbortSignal) {
  const response = await fetch('/api/initiatives/runtime-v1/my-work/execution', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function listCapacityScenarioRegister(signal?: AbortSignal) {
  const response = await fetch('/api/initiatives/runtime-v1/capacity-scenarios', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function requestHandoffAcceptance(
  initiativeId: string,
  command: Record<string, unknown>
) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/handoff/requests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function decideHandoffAcceptance(
  initiativeId: string,
  command: Record<string, unknown>
) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/handoff/decisions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function listMyHandoffAcceptances(signal?: AbortSignal) {
  const response = await fetch('/api/initiatives/runtime-v1/my-work/handoff-acceptances', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function listExecutionCases(signal?: AbortSignal) {
  const response = await fetch('/api/initiatives/runtime-v1/execution-cases', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function readExecutionCase(id: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/execution-cases/${encodeURIComponent(id)}`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function readExecutionCaseByInitiative(id: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(id)}/execution-case`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}

export async function requestScheduleDecision(
  initiativeId: string,
  command: Record<string, unknown>
) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/schedule/requests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function decideScheduleDecision(
  initiativeId: string,
  command: Record<string, unknown>
) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/schedule/decisions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function listMyScheduleDecisions(signal?: AbortSignal) {
  const response = await fetch('/api/initiatives/runtime-v1/my-work/schedule-decisions', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function readHandoffPackage(id: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/handoff-packages/${encodeURIComponent(id)}`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}

export type SourceProposalDisposition = 'MERGE' | 'EXTEND' | 'RETURN' | 'DEFER' | 'DISMISS';

export interface SourceProposalDecisionCommand {
  decisionId: string;
  expectedProposalVersion: number;
  clientRequestId: string;
  disposition: SourceProposalDisposition;
  targetInitiativeId: string | null;
  reasonCode: string;
  rationale: string;
  evidenceSnapshot: Record<string, unknown>;
  resolverId: string | null;
  dueAt: string | null;
  reviewTrigger: string | null;
}

export interface RegisteredInitiativeReadModel {
  version: number;
  updatedAt: string;
  initiative: {
    initiativeId: string;
    lifecycleState: string;
    title: string;
    problem?: string;
    proposedOutcome?: string | null;
    projectId: string;
    initiativeOwnerId?: string;
    readiness: 'NOT_EVALUATED';
    source: {
      proposalId: string;
      proposalVersion: number;
      sourceType: string;
      sourceId: string;
      sourceVersion: number;
      freshness?: 'CURRENT' | 'STALE' | 'SOURCE_UNAVAILABLE';
      refreshedAt?: string;
    };
    gateState?: string;
    gateReadiness?: string;
    definitionDecisionId?: string;
    workRefs?: Array<{ findingId: string; taskId: string; decisionId: string }>;
  };
}

export interface PendingDefinitionDecisionReadModel {
  version: number;
  decisionId: string;
  initiativeId: string;
  gate: 'DEFINITION';
  status: 'PENDING';
  requesterId: string;
  authorityId: string;
  dueAt: string;
  requestedAt: string;
  cardVersions: Record<string, number>;
}

export interface PendingAnalysisDecisionReadModel {
  version: number;
  decisionId: string;
  initiativeId: string;
  gate: 'ANALYSIS';
  status: 'PENDING';
  requesterId: string;
  authorityId: string;
  dueAt: string;
  requestedAt: string;
  cardVersions: Record<string, number>;
}

export interface AnalysisReadinessReadModel {
  initiativeId: string;
  initiativeVersion: number;
  lifecycleState: string;
  readiness: 'NOT_READY' | 'CONDITIONALLY_READY' | 'READY' | 'BLOCKED';
  cardVersions: Record<string, number>;
  findings: Array<{
    findingId: string;
    cardKey: string;
    severity: 'BLOCKER' | 'WARNING';
    rule: string;
    evidenceRefs: string[];
    message: string;
  }>;
}

export interface PendingDefinitionRemediationReadModel {
  version: number;
  aggregateType: 'task' | 'decision';
  aggregateId: string;
  initiativeId: string;
  findingId: string;
  workType: 'FINANCE_EVIDENCE' | 'TECHNICAL_OPTION';
  title: string;
  accountableId: string;
  dueAt: string;
  status: 'OPEN' | 'PENDING';
  options: string[];
}

export interface InitiativeCardVersionReadModel {
  cardKey: string;
  cardVersion: number;
  aggregateVersion: number;
  applicability: 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
  completion: 'EMPTY' | 'IN_PROGRESS' | 'COMPLETE';
  quality: 'UNKNOWN' | 'SUFFICIENT' | 'WARNING' | 'BLOCKER';
  freshness: 'CURRENT' | 'STALE' | 'SOURCE_UNAVAILABLE';
  reviewState: 'NOT_REQUESTED' | 'REQUESTED' | 'CHANGES_REQUESTED' | 'ACCEPTED';
  content: Record<string, unknown>;
  evidenceRefs: string[];
  waiverDecisionId: string | null;
  publishedBy: string;
  publishedAt: string;
}

export interface PublishInitiativeCardCommand {
  expectedVersion: number;
  expectedCardVersion: number;
  clientRequestId: string;
  applicability: InitiativeCardVersionReadModel['applicability'];
  completion: InitiativeCardVersionReadModel['completion'];
  quality: InitiativeCardVersionReadModel['quality'];
  freshness: InitiativeCardVersionReadModel['freshness'];
  reviewState: InitiativeCardVersionReadModel['reviewState'];
  content: Record<string, unknown>;
  evidenceRefs: string[];
  waiverDecisionId: string | null;
}

export interface DefinitionReadinessReadModel {
  initiativeId: string;
  initiativeVersion: number;
  lifecycleState: string;
  readiness: 'NOT_READY' | 'CONDITIONALLY_READY' | 'READY' | 'BLOCKED';
  cardVersions: Record<string, number>;
  findings: Array<{
    findingId: string;
    cardKey: string;
    severity: 'BLOCKER' | 'WARNING';
    rule: string;
    evidenceRefs: string[];
    message: string;
  }>;
  sourceStatus?: {
    proposalId: string | null;
    snapshotProposalVersion: number | null;
    currentProposalVersion: number | null;
    snapshotSourceVersion: number | null;
    currentSourceVersion: number | null;
    evidenceState: 'READY' | 'PARTIAL' | 'STALE' | 'UNKNOWN';
    freshness: 'CURRENT' | 'STALE' | 'SOURCE_UNAVAILABLE';
  };
}

export interface InitiativeCapabilitiesReadModel {
  actorId: string;
  canView: true;
  canUpdate: boolean;
  canReview: boolean;
  canSelfApprove: boolean;
}

export interface SourceProposalReadModel {
  id: string;
  title: string;
  problem: string | null;
  proposedOutcome: string | null;
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  proposalVersion: number;
  projectId: string | null;
  initiativeOwnerId: string | null;
  visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
  evidenceState: 'READY' | 'PARTIAL' | 'STALE' | 'UNKNOWN';
  duplicateState: 'CLEAR' | 'POSSIBLE' | 'UNKNOWN';
  provenance: { system: string; recordType: string; capturedAt: string; evidenceRefs: string[] };
  policyRef: { policyId: string; policyVersion: number };
  status: string;
  disposition: 'REGISTER' | 'MERGE' | 'EXTEND' | 'RETURN' | 'DEFER' | 'DISMISS' | null;
  registeredInitiativeId: string | null;
  updatedAt: string;
  policy: {
    policyId: string;
    version: number;
    baseline: 'LITE' | 'STANDARD' | 'COMPLEX';
    strictness: number;
    source: 'PRODUCT' | 'ORGANIZATION' | 'PROJECT' | 'INITIATIVE';
  };
  capabilities: {
    canRegister: boolean;
    canMerge: boolean;
    canExtend: boolean;
    canReturn: boolean;
    canDefer: boolean;
    canDismiss: boolean;
  };
}

export interface SourceProposalSubmission {
  proposalId: string;
  expectedVersion: 0;
  clientRequestId: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  provenance: SourceProposalReadModel['provenance'];
  title: string;
  problem: string;
  proposedOutcome: string | null;
  projectId: string;
  initiativeOwnerId: string;
  visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
}

export async function submitSourceProposal(submission: SourceProposalSubmission) {
  const response = await fetch('/api/initiatives/runtime-v1/source-proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(submission),
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as {
    status: 'APPLIED' | 'REPLAYED';
    aggregateVersion: number;
    proposal: SourceProposalReadModel;
  };
}

export class RuntimeApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorCode(body: unknown): string {
  if (!body || typeof body !== 'object') return 'UNKNOWN_ERROR';
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return 'UNKNOWN_ERROR';
  return String((error as { code?: unknown }).code || 'UNKNOWN_ERROR');
}

export async function registerSourceProposal(
  registration: SourceProposalRegistration,
  signal?: AbortSignal
): Promise<{ status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number; initiativeId: string }> {
  const response = await fetch('/api/initiatives/runtime-v1/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(registration),
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  const result = body as {
    status: 'APPLIED' | 'REPLAYED';
    aggregateVersion: number;
    response: { initiativeId: string };
  };
  return {
    status: result.status,
    aggregateVersion: result.aggregateVersion,
    initiativeId: result.response.initiativeId,
  };
}

export async function readAnalysisReadiness(
  initiativeId: string,
  signal?: AbortSignal
): Promise<AnalysisReadinessReadModel> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/analysis/readiness`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as AnalysisReadinessReadModel;
}

export async function startInitiativeAnalysis(
  initiativeId: string,
  command: { expectedVersion: number; clientRequestId: string }
) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/analysis/start`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as { status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number };
}

export async function requestAnalysisDecision(
  initiativeId: string,
  command: {
    expectedVersion: number;
    clientRequestId: string;
    decisionId: string;
    authorityId: string;
    dueAt: string;
  }
) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/analysis/requests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as { status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number };
}

export async function decideAnalysis(
  initiativeId: string,
  command: {
    expectedVersion: number;
    clientRequestId: string;
    decisionId: string;
    outcome: 'APPROVED' | 'RETURNED';
    rationale: string;
    governanceQuorumRef?: {
      quorumId: string;
      version: number;
      receiptId: string;
    };
  }
) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/analysis/decisions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as { status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number };
}

export async function listMyAnalysisDecisions(
  signal?: AbortSignal
): Promise<PendingAnalysisDecisionReadModel[]> {
  const response = await fetch('/api/initiatives/runtime-v1/my-work/analysis-decisions', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  const decisions = (body as { decisions?: unknown })?.decisions;
  return Array.isArray(decisions) ? (decisions as PendingAnalysisDecisionReadModel[]) : [];
}

export async function writePortfolioScenario(scenarioId: string, command: Record<string, unknown>) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/portfolio-scenarios/${encodeURIComponent(scenarioId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function readPortfolioScenario(scenarioId: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/portfolio-scenarios/${encodeURIComponent(scenarioId)}`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function readPortfolioScenarioHistory(scenarioId: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/portfolio-scenarios/${encodeURIComponent(scenarioId)}/history`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function readPortfolioScenarioDiff(
  scenarioId: string,
  from: number,
  to: number,
  signal?: AbortSignal
) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/portfolio-scenarios/${encodeURIComponent(scenarioId)}/diff?from=${from}&to=${to}`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function requestPortfolioDecision(
  initiativeId: string,
  command: Record<string, unknown>
) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/portfolio/requests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export interface PortfolioDecisionReadModel {
  version: number;
  decision: {
    decisionId: string;
    initiativeId: string;
    status:
      | 'PENDING'
      | 'APPROVED'
      | 'CONDITIONALLY_APPROVED'
      | 'RETURNED'
      | 'DEFERRED'
      | 'REJECTED'
      | 'MERGED';
    scenarioId: string;
    scenarioVersion: number;
    initiativeVersion: number;
    authorityId: string;
    requestedAt: string;
    decidedAt: string | null;
  };
}
export async function readPortfolioDecision(
  initiativeId: string,
  signal?: AbortSignal
): Promise<PortfolioDecisionReadModel> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/portfolio/decision`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as PortfolioDecisionReadModel;
}
export async function decidePortfolioDecision(
  initiativeId: string,
  command: Record<string, unknown>
) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/portfolio/decisions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function listMyPortfolioDecisions(signal?: AbortSignal) {
  const response = await fetch('/api/initiatives/runtime-v1/my-work/portfolio-decisions', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function writePlanScenario(scenarioId: string, command: Record<string, unknown>) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/plan-scenarios/${encodeURIComponent(scenarioId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function listPlanScenarioRegister(signal?: AbortSignal) {
  const response = await fetch('/api/initiatives/runtime-v1/plan-scenarios', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function readPlanScenario(scenarioId: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/plan-scenarios/${encodeURIComponent(scenarioId)}`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function readPlanScenarioHistory(scenarioId: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/plan-scenarios/${encodeURIComponent(scenarioId)}/history`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function readPlanScenarioDiff(
  scenarioId: string,
  from: number,
  to: number,
  signal?: AbortSignal
) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/plan-scenarios/${encodeURIComponent(scenarioId)}/diff?from=${from}&to=${to}`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function listPortfolioScenarioRegister(signal?: AbortSignal) {
  const response = await fetch('/api/initiatives/runtime-v1/portfolio-scenarios', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function writeCapacityScenario(id: string, command: Record<string, unknown>) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/capacity-scenarios/${encodeURIComponent(id)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function readCapacityScenario(id: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/capacity-scenarios/${encodeURIComponent(id)}`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function readCapacityScenarioHistory(id: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/capacity-scenarios/${encodeURIComponent(id)}/history`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function requestResourceCommitment(id: string, command: Record<string, unknown>) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/resource-commitments/${encodeURIComponent(id)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function acceptResourceCommitment(id: string, command: Record<string, unknown>) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/resource-commitments/${encodeURIComponent(id)}/accept`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}
export async function decideResourceCommitment(id: string, command: Record<string, unknown>) {
  const response = await fetch(
    `/api/initiatives/runtime-v1/resource-commitments/${encodeURIComponent(id)}/decisions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}

export async function listSourceProposals(
  signal?: AbortSignal
): Promise<SourceProposalReadModel[]> {
  const response = await fetch('/api/initiatives/runtime-v1/source-proposals', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  const proposals = (body as { proposals?: unknown })?.proposals;
  return Array.isArray(proposals) ? (proposals as SourceProposalReadModel[]) : [];
}

export async function readSourceProposal(
  proposalId: string,
  signal?: AbortSignal
): Promise<SourceProposalReadModel> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/source-proposals/${encodeURIComponent(proposalId)}`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return (body as { proposal: SourceProposalReadModel }).proposal;
}

export async function decideSourceProposal(
  proposalId: string,
  command: SourceProposalDecisionCommand,
  signal?: AbortSignal
): Promise<{ status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number }> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/source-proposals/${encodeURIComponent(proposalId)}/decisions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
      signal,
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  const result = body as { status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number };
  return result;
}

export async function readRegisteredInitiative(
  initiativeId: string,
  signal?: AbortSignal
): Promise<RegisteredInitiativeReadModel> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as RegisteredInitiativeReadModel;
}

export async function amendRegisteredInitiative(
  initiativeId: string,
  command: { expectedVersion: number; clientRequestId: string; title?: string; problem?: string; proposedOutcome?: string | null; initiativeOwnerId?: string }
) {
  const response = await fetch(`/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/metadata`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(command),
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as { status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number; initiative: RegisteredInitiativeReadModel };
}

export async function cancelRegisteredInitiative(initiativeId: string, command: { expectedVersion: number; clientRequestId: string; reason: string }) {
  const response = await fetch(`/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/cancel`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(command),
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as { status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number; initiative: RegisteredInitiativeReadModel };
}

export async function listRegisteredInitiatives(signal?: AbortSignal): Promise<{
  initiatives: RegisteredInitiativeReadModel[];
}> {
  const response = await fetch('/api/initiatives/runtime-v1/initiatives', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as { initiatives: RegisteredInitiativeReadModel[] };
}

export async function readInitiativeCards(
  initiativeId: string,
  signal?: AbortSignal
): Promise<{ initiativeVersion: number; cards: InitiativeCardVersionReadModel[] }> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/cards`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as { initiativeVersion: number; cards: InitiativeCardVersionReadModel[] };
}

export interface InitiativeCardSelectionItem {
  cardKey: string;
  included: boolean;
  position: number;
  requiredness: 'REQUIRED' | 'OPTIONAL';
  waiverDecisionId: string | null;
}

export async function readInitiativeCardSelection(
  initiativeId: string,
  signal?: AbortSignal
): Promise<{
  initiativeVersion: number;
  registryVersion: 1;
  cards: InitiativeCardSelectionItem[];
}> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/card-selection`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as {
    initiativeVersion: number;
    registryVersion: 1;
    cards: InitiativeCardSelectionItem[];
  };
}

export async function configureInitiativeCardSelection(
  initiativeId: string,
  command: {
    expectedVersion: number;
    clientRequestId: string;
    registryVersion: 1;
    cards: InitiativeCardSelectionItem[];
  },
  signal?: AbortSignal
): Promise<{ status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number }> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/card-selection`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
      signal,
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as { status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number };
}

export async function readDefinitionReadiness(
  initiativeId: string,
  signal?: AbortSignal
): Promise<DefinitionReadinessReadModel> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/definition/readiness`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as DefinitionReadinessReadModel;
}

export async function refreshInitiativeSource(
  initiativeId: string,
  command: {
    expectedVersion: number;
    clientRequestId: string;
    expectedProposalVersion: number;
    expectedSourceVersion: number;
  }
): Promise<{ status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number }> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/source-refresh`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as { status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number };
}

export async function readInitiativeCapabilities(
  initiativeId: string,
  signal?: AbortSignal
): Promise<InitiativeCapabilitiesReadModel> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/capabilities`,
    { credentials: 'include', signal }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as InitiativeCapabilitiesReadModel;
}

export async function reviewInitiativeCard(
  initiativeId: string,
  cardKey: string,
  command: {
    expectedVersion: number;
    expectedCardVersion: number;
    clientRequestId: string;
    outcome: 'CHANGES_REQUESTED' | 'ACCEPTED';
    rationale: string;
  },
  signal?: AbortSignal
): Promise<{ status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number; cardVersion: number }> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/cards/${encodeURIComponent(cardKey)}/reviews`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
      signal,
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  const result = body as {
    status: 'APPLIED' | 'REPLAYED';
    aggregateVersion: number;
    response: { cardVersion: number };
  };
  return {
    status: result.status,
    aggregateVersion: result.aggregateVersion,
    cardVersion: result.response.cardVersion,
  };
}

export async function requestDefinitionDecision(
  initiativeId: string,
  command: {
    expectedVersion: number;
    clientRequestId: string;
    decisionId: string;
    authorityId: string;
    dueAt: string;
  }
): Promise<{ status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number }> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/definition/requests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as { status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number };
}

export async function listMyDefinitionDecisions(
  signal?: AbortSignal
): Promise<PendingDefinitionDecisionReadModel[]> {
  const response = await fetch('/api/initiatives/runtime-v1/my-work/definition-decisions', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  const decisions = (body as { decisions?: unknown })?.decisions;
  return Array.isArray(decisions) ? (decisions as PendingDefinitionDecisionReadModel[]) : [];
}

export async function createDefinitionRemediationWork(
  initiativeId: string,
  command: {
    expectedVersion: number;
    clientRequestId: string;
    findingId: string;
    financeTask: {
      taskId: string;
      title: string;
      assigneeId: string;
      dueAt: string;
    };
    technicalDecision: {
      decisionId: string;
      title: string;
      authorityId: string;
      dueAt: string;
      options: string[];
    };
  }
): Promise<{
  status: 'APPLIED' | 'REPLAYED';
  aggregateVersion: number;
  response: { initiativeId: string; findingId: string; taskId: string; decisionId: string };
}> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/definition-remediation`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as {
    status: 'APPLIED' | 'REPLAYED';
    aggregateVersion: number;
    response: { initiativeId: string; findingId: string; taskId: string; decisionId: string };
  };
}

export async function listMyDefinitionRemediation(
  signal?: AbortSignal
): Promise<PendingDefinitionRemediationReadModel[]> {
  const response = await fetch('/api/initiatives/runtime-v1/my-work/definition-remediation', {
    credentials: 'include',
    signal,
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  const items = (body as { items?: unknown })?.items;
  return Array.isArray(items) ? (items as PendingDefinitionRemediationReadModel[]) : [];
}

export async function resolveDefinitionRemediation(
  aggregateType: 'task' | 'decision',
  aggregateId: string,
  command:
    | {
        expectedVersion: number;
        clientRequestId: string;
        workType: 'FINANCE_EVIDENCE';
        evidenceRefs: string[];
      }
    | {
        expectedVersion: number;
        clientRequestId: string;
        workType: 'TECHNICAL_OPTION';
        selectedOption: string;
        rationale: string;
      }
): Promise<{ status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number }> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/my-work/definition-remediation/${aggregateType}/${encodeURIComponent(aggregateId)}/resolve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as { status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number };
}

export async function decideDefinition(
  initiativeId: string,
  command: {
    expectedVersion: number;
    clientRequestId: string;
    decisionId: string;
    outcome: 'APPROVED' | 'RETURNED';
    rationale: string;
    governanceQuorumRef?: {
      quorumId: string;
      version: number;
      receiptId: string;
    };
  }
): Promise<{ status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number }> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/gates/definition/decisions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body as { status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number };
}

export async function publishInitiativeCard(
  initiativeId: string,
  cardKey: string,
  command: PublishInitiativeCardCommand,
  signal?: AbortSignal
): Promise<{ status: 'APPLIED' | 'REPLAYED'; aggregateVersion: number; cardVersion: number }> {
  const response = await fetch(
    `/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/cards/${encodeURIComponent(cardKey)}/publications`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(command),
      signal,
    }
  );
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  const result = body as {
    status: 'APPLIED' | 'REPLAYED';
    aggregateVersion: number;
    response: { cardVersion: number };
  };
  return {
    status: result.status,
    aggregateVersion: result.aggregateVersion,
    cardVersion: result.response.cardVersion,
  };
}

async function allocationRequest(path: string, method: 'POST' | 'GET', command?: unknown) {
  const response = await fetch(`/api/initiatives/runtime-v1${path}`, {
    method,
    headers: command === undefined ? undefined : { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: command === undefined ? undefined : JSON.stringify(command),
  });
  const body = await readJson(response);
  if (!response.ok) throw new RuntimeApiError(response.status, errorCode(body));
  return body;
}

export function proposeOperationalAllocation(
  executionCaseId: string,
  taskId: string,
  allocationId: string,
  command: unknown
) {
  return allocationRequest(
    `/execution-cases/${encodeURIComponent(executionCaseId)}/tasks/${encodeURIComponent(taskId)}/allocations/${encodeURIComponent(allocationId)}`,
    'POST',
    command
  );
}
export function simulateOperationalAllocation(command: unknown) {
  return allocationRequest('/operational-allocations/simulate', 'POST', command);
}
export function transitionOperationalAllocation(allocationId: string, command: unknown) {
  return allocationRequest(
    `/operational-allocations/${encodeURIComponent(allocationId)}/transitions`,
    'POST',
    command
  );
}
export function readOperationalAllocations(executionCaseId: string) {
  return allocationRequest(
    `/execution-cases/${encodeURIComponent(executionCaseId)}/allocations`,
    'GET'
  );
}
export function listMyOperationalAllocations() {
  return allocationRequest('/my-work/operational-allocations', 'GET');
}
export function ingestManagementSignal(command: unknown) {
  return allocationRequest('/management-signals/ingest', 'POST', command);
}
export function draftIntervention(interventionId: string, command: unknown) {
  return allocationRequest(`/interventions/${encodeURIComponent(interventionId)}`, 'POST', command);
}
export function transitionIntervention(interventionId: string, command: unknown) {
  return allocationRequest(
    `/interventions/${encodeURIComponent(interventionId)}/transitions`,
    'POST',
    command
  );
}
export function listManagementSignals() {
  return allocationRequest('/management-signals', 'GET');
}
export function listInterventions() {
  return allocationRequest('/interventions', 'GET');
}
export function createReportRun(reportRunId: string, command: unknown) {
  return allocationRequest(`/report-runs/${encodeURIComponent(reportRunId)}`, 'POST', command);
}
export function transitionReportRun(reportRunId: string, command: unknown) {
  return allocationRequest(
    `/report-runs/${encodeURIComponent(reportRunId)}/transitions`,
    'POST',
    command
  );
}
export function getReportDefinition(definitionId: string) {
  return allocationRequest(`/report-definitions/${encodeURIComponent(definitionId)}`, 'GET');
}
export function createReportDefinition(definitionId: string, command: unknown) {
  return allocationRequest(
    `/report-definitions/${encodeURIComponent(definitionId)}`,
    'POST',
    command
  );
}
export function transitionReportDefinition(definitionId: string, command: unknown) {
  return allocationRequest(
    `/report-definitions/${encodeURIComponent(definitionId)}/transitions`,
    'POST',
    command
  );
}
export function listReportDefinitions() {
  return allocationRequest('/report-definitions', 'GET');
}
export function listReportRuns() {
  return allocationRequest('/report-runs', 'GET');
}
export function requestDeliveryAcceptance(id: string, command: unknown) {
  return allocationRequest(
    `/delivery-acceptances/${encodeURIComponent(id)}/request`,
    'POST',
    command
  );
}
export function decideDeliveryAcceptance(id: string, command: unknown) {
  return allocationRequest(
    `/delivery-acceptances/${encodeURIComponent(id)}/decide`,
    'POST',
    command
  );
}
export function requestResultsAcceptance(id: string, command: unknown) {
  return allocationRequest(
    `/results-acceptances/${encodeURIComponent(id)}/request`,
    'POST',
    command
  );
}
export function decideResultsAcceptance(id: string, command: unknown) {
  return allocationRequest(
    `/results-acceptances/${encodeURIComponent(id)}/decide`,
    'POST',
    command
  );
}
export function listDeliveryAcceptances() {
  return allocationRequest('/delivery-acceptances', 'GET');
}
export function listResultsAcceptances() {
  return allocationRequest('/results-acceptances', 'GET');
}
export function getBenefitsHandoffPack(id: string) {
  return allocationRequest(`/benefits-handoff-packs/${encodeURIComponent(id)}`, 'GET');
}
export function listMyAcceptanceWork() {
  return allocationRequest('/my-work/acceptances', 'GET');
}
export function createEffectivenessCase(id: string, command: unknown) {
  return allocationRequest(`/effectiveness/${encodeURIComponent(id)}`, 'POST', command);
}
export function createFinanceReconciliation(id: string, command: unknown) {
  return allocationRequest(`/finance-reconciliations/${encodeURIComponent(id)}`, 'POST', command);
}
export function getFinanceReconciliation(id: string) {
  return allocationRequest(`/finance-reconciliations/${encodeURIComponent(id)}`, 'GET');
}
export function createResultsKpiObservation(id: string, command: unknown) {
  return allocationRequest(`/results-observations/${encodeURIComponent(id)}`, 'POST', command);
}
export function getResultsKpiObservation(id: string) {
  return allocationRequest(`/results-observations/${encodeURIComponent(id)}`, 'GET');
}
export function listResultsKpiObservations(resultsCaseId?: string) {
  return allocationRequest(
    `/results-observations${resultsCaseId ? `?resultsCaseId=${encodeURIComponent(resultsCaseId)}` : ''}`,
    'GET'
  );
}
export function transitionEffectiveness(id: string, command: unknown) {
  return allocationRequest(`/effectiveness/${encodeURIComponent(id)}/transitions`, 'POST', command);
}
export function closeEffectiveInitiative(id: string, command: unknown) {
  return allocationRequest(`/effectiveness/${encodeURIComponent(id)}/close`, 'POST', command);
}
export function requestClosureCase(id: string, command: unknown) {
  return allocationRequest(`/closures/${encodeURIComponent(id)}/requests`, 'POST', command);
}
export function decideClosureCase(id: string, command: unknown) {
  return allocationRequest(`/closures/${encodeURIComponent(id)}/decisions`, 'POST', command);
}
export function listClosureCases() {
  return allocationRequest('/closures', 'GET');
}
export function getEffectivenessSnapshot(id: string) {
  return allocationRequest(`/effectiveness-snapshots/${encodeURIComponent(id)}`, 'GET');
}
export function archiveClosedInitiative(id: string, command: unknown) {
  return allocationRequest(`/archives/${encodeURIComponent(id)}`, 'POST', command);
}
export function listEffectivenessCases() {
  return allocationRequest('/effectiveness', 'GET');
}
export function getClosureSnapshot(id: string) {
  return allocationRequest(`/closure-snapshots/${encodeURIComponent(id)}`, 'GET');
}
export function listArchiveManifests() {
  return allocationRequest('/archives', 'GET');
}
export function listMyEffectivenessWork() {
  return allocationRequest('/my-work/effectiveness', 'GET');
}
export function createMaterialChange(id: string, command: unknown) {
  return allocationRequest(`/material-changes/${encodeURIComponent(id)}`, 'POST', command);
}
export function transitionMaterialChange(id: string, command: unknown) {
  return allocationRequest(
    `/material-changes/${encodeURIComponent(id)}/transitions`,
    'POST',
    command
  );
}
export function listMaterialChanges() {
  return allocationRequest('/material-changes', 'GET');
}
export function listMyMaterialChangeWork() {
  return allocationRequest('/my-work/material-changes', 'GET');
}
export function createAIAnalysisProposal(id: string, command: unknown) {
  return allocationRequest(`/ai-analysis-proposals/${encodeURIComponent(id)}`, 'POST', command);
}
export function reviewAIAnalysisProposal(id: string, command: unknown) {
  return allocationRequest(
    `/ai-analysis-proposals/${encodeURIComponent(id)}/review`,
    'POST',
    command
  );
}
export function listAIAnalysisProposals() {
  return allocationRequest('/ai-analysis-proposals', 'GET');
}
export function listMyAIAnalysisReviews() {
  return allocationRequest('/my-work/ai-analysis-reviews', 'GET');
}
export function createCapacityOptions(id: string, command: unknown) {
  return allocationRequest(`/capacity-options/${encodeURIComponent(id)}`, 'POST', command);
}
export function selectCapacityOption(id: string, command: unknown) {
  return allocationRequest(`/capacity-options/${encodeURIComponent(id)}/select`, 'POST', command);
}
export function listCapacityOptions() {
  return allocationRequest('/capacity-options', 'GET');
}
export function transitionCanonicalTask(executionCaseId: string, taskId: string, command: unknown) {
  return allocationRequest(
    `/execution-cases/${encodeURIComponent(executionCaseId)}/tasks/${encodeURIComponent(taskId)}/transitions`,
    'POST',
    command
  );
}
export function transitionCanonicalDecision(
  executionCaseId: string,
  decisionId: string,
  command: unknown
) {
  return allocationRequest(
    `/execution-cases/${encodeURIComponent(executionCaseId)}/decisions/${encodeURIComponent(decisionId)}/transitions`,
    'POST',
    command
  );
}
export function submitGateSignoff(initiativeId: string, command: unknown) {
  return allocationRequest(
    `/initiatives/${encodeURIComponent(initiativeId)}/gate-signoffs`,
    'POST',
    command
  );
}

export function getMyGateSignoffs() {
  return allocationRequest('/my-work/gate-signoffs', 'GET');
}
export function listGateQuorums() {
  return allocationRequest('/gate-quorums', 'GET');
}
