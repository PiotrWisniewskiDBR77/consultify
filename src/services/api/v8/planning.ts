import type { PortfolioInitiative } from '@/types';

import { v8Get, v8Post } from './client';

export interface V8PlanningDecisionEntry {
  decisionId: string;
  title: string;
  role: string;
  status: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  notes?: string | null;
}

export interface V8PlanningDecisionChain {
  chainId: string;
  organizationId: string;
  initiativeId: string;
  chainType: string;
  decisions: V8PlanningDecisionEntry[];
  status: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface V8PlanningDecompositionNode {
  decompositionId: string;
  parentId: string | null;
  wbsLevel: string;
}

export interface V8PlanningWBSCompletenessGap {
  nodeId: string;
  level: string;
  reason: string;
}

export interface V8PlanningWBSCompleteness {
  complete: boolean;
  gaps: V8PlanningWBSCompletenessGap[];
}

export interface V8PlanningInitiativeSnapshot {
  initiativeId: string;
  decompositionTree: V8PlanningDecompositionNode[];
  wbsCompleteness: V8PlanningWBSCompleteness;
  criticalPath: V8PlanningDecompositionNode[];
  crossInitiativeDependencies: Array<Record<string, unknown>>;
  decisionChains: V8PlanningDecisionChain[];
}

export interface V8PlanningPortfolioStats {
  total: number;
  byStatus: Record<string, number>;
  executing: number;
  approved: number;
  review: number;
  blockedCount: number;
  done: number;
  totalBudget: number;
  totalValue: number;
  avgProgress: number;
}

export interface V8PlanningPortfolioRead {
  initiatives: PortfolioInitiative[];
  stats: V8PlanningPortfolioStats;
}

export interface V8PlanningPortfolioFilters {
  projectId?: string;
  programId?: string;
  statuses?: string[];
  status?: string | null;
  priority?: string[];
  search?: string;
}

export interface V8PlanningTaskDependency {
  id: string;
  sourceTaskId?: string;
  taskId: string;
  taskTitle: string;
  taskStatus?: string;
  taskPriority?: string;
  taskIndexCode?: string;
  dependencyType: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays: number;
  notes?: string;
  direction: 'predecessor' | 'successor';
  createdAt?: string;
}

export interface V8PlanningWatcher {
  id: string;
  initiativeId?: string;
  userId: string;
  createdAt?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface V8PlanningStakeholder {
  id: string;
  initiativeId?: string;
  userId?: string;
  externalName?: string;
  externalEmail?: string;
  role?: string;
  raciType?: string;
  influenceLevel?: number;
  interestLevel?: number;
  createdAt?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface V8PlanningGateRoleAssignment {
  id: string;
  initiativeId?: string;
  gateRole: string;
  userId: string;
  assignedBy?: string;
  assignedAt?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  source?: 'explicit' | 'auto';
}

export interface V8PlanningStatusHistoryEntry {
  id: string;
  initiativeId: string;
  fromStatus: string;
  toStatus: string;
  changedBy?: string;
  reason?: string;
  gateType?: string | null;
  createdAt: string;
  changedByFirstName?: string;
  changedByLastName?: string;
  changedByEmail?: string;
}

export interface V8PlanningHistoryEvent {
  id: string;
  initiativeId?: string;
  eventType: string;
  actorId?: string;
  createdAt: string;
  oldValue?: string | null;
  newValue?: string | null;
  notes?: string | null;
}

export interface V8PlanningComment {
  id: string;
  content: string;
  authorId?: string;
  authorName?: string;
  createdAt: string;
  likes: number;
  likedByMe: boolean;
}

export interface V8PlanningResourceItem {
  id: string;
  initiativeId?: string;
  userId?: string;
  name?: string;
  role?: string;
  allocationPercentage?: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
  source?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface V8PlanningGateReadinessCheck {
  currentStatus: string;
  userRoles: string[];
  availableTransitions: Array<{
    targetStatus: string;
    gate: string | null;
    requiredRoles: string[];
    assignedApprovers: Array<{ gateRole: string; userId: string }>;
    canCurrentUserExecute: boolean;
    hasAssignedApprover: boolean;
  }>;
  capabilities?: {
    version: number;
    // A20 (2026-09-05): 'client-fallback' oznacza zdolności wyliczone lokalnie,
    // gdy gate-readiness-check zwraca 404 (rekordy rejestru runtime-v1).
    // Serwer nigdy nie wysyła tej wartości — patrz gateReadinessFallback.ts.
    source: 'backend' | 'client-fallback';
    topBar: {
      canEditPriority: boolean;
      canEditOwner: boolean;
      canEditTargetDate: boolean;
    };
    cards?: {
      canEditCards: boolean;
      reasonCode: string | null;
    };
    reasonCodes?: {
      topBar?: { priority?: string | null; owner?: string | null; targetDate?: string | null };
      cards?: { edit?: string | null };
      ai?: { use?: string | null };
    };
    ctaBar: {
      workflowActions: Array<{ targetStatus: string; gate: string | null }>;
      contextCreateActions: string[];
      canUseAi: boolean;
      aiAllowedSectionKeys?: string[];
    };
  };
  readiness: Array<{
    key: string;
    label: string;
    pass: boolean;
    severity: string;
    suggestedAction?: string;
    suggestedActor?: string;
  }>;
  allBlocking: boolean;
  allWarnings: boolean;
}

export interface V8PlanningKpi {
  id: string;
  initiativeId?: string;
  mappingId?: string | null;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  baselineValue?: number;
  targetValue?: number;
  currentValue?: number;
  latestValue?: number;
  progressPercentage?: number;
  status?: string;
  measurementFrequency?: string;
  trendData?: unknown[];
  isOnTarget?: boolean;
  createdAt?: string;
  updatedAt?: string;
  definitionSource?: 'library' | 'initiative-custom';
  observationPhase?: 'realization' | 'post-implementation' | 'both';
  trackedInRealization?: boolean;
  trackedPostImplementation?: boolean;
  observationStatus?: 'active' | 'paused' | 'completed';
  realizationExpectation?: {
    baselineValue?: number | null;
    targetValue?: number | null;
    measurementFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  };
  postImplementationExpectation?: {
    baselineValue?: number | null;
    targetValue?: number | null;
    measurementFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  };
}

export interface V8PlanningBudgetItem {
  id: string;
  initiativeId?: string;
  category?: string;
  costType?: 'CAPEX' | 'OPEX';
  amount?: number;
  currency?: string;
  description?: string;
  source?: string;
}

export interface V8PlanningToolItem {
  id: string;
  initiativeId?: string;
  name?: string;
  category?: string;
  vendor?: string;
  licenseCost?: number;
  licenseType?: string;
  status?: string;
  notes?: string;
  source?: string;
  costType?: 'CAPEX' | 'OPEX';
}

export interface V8PlanningIntangibleAssetItem {
  id: string;
  initiativeId?: string;
  assetType?: string;
  name?: string;
  provider?: string;
  cost?: number;
  currency?: string;
  validFrom?: string;
  validUntil?: string;
  status?: string;
  beneficiaries?: string;
  notes?: string;
  source?: string;
  costType?: 'CAPEX' | 'OPEX';
}

export interface V8PlanningRaidItem {
  id: string;
  initiativeId?: string;
  type?: 'risk' | 'issue' | 'assumption' | 'dependency';
  title?: string;
  description?: string;
  status?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  probability?: string;
  riskScore?: number;
  scoreCategory?: string;
  ownerId?: string;
  dueDate?: string;
  mitigationPlan?: string;
  responseStrategy?: string;
  mitigationOwnerId?: string;
  mitigationDueDate?: string;
  mitigationStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

const toPlanningQueryString = (filters?: V8PlanningPortfolioFilters): string => {
  const params = new URLSearchParams();
  if (!filters) return '';

  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.programId) params.set('programId', filters.programId);
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.status) params.set('status', filters.status);
  if (filters.priority?.length) {
    filters.priority.forEach((priority) => params.append('priority', priority));
  }
  if (filters.search) params.set('search', filters.search);

  const query = params.toString();
  return query ? `?${query}` : '';
};

export const V8PlanningApi = {
  getPortfolio: (filters?: V8PlanningPortfolioFilters) =>
    v8Get<V8PlanningPortfolioRead>(
      `/planning/initiatives/portfolio${toPlanningQueryString(filters)}`
    ),
  getInitiative: (initiativeId: string) =>
    v8Get<{ initiative: Record<string, unknown> }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}`
    ).then((data) => data.initiative),
  /** Fork an initiative; returns the freshly-created copy (with a new id). */
  forkInitiative: (initiativeId: string) =>
    v8Post<{ initiative: Record<string, unknown> }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/fork`
    ).then((data) => data.initiative),
  getTaskDependencies: (initiativeId: string) =>
    v8Get<{ dependencies: V8PlanningTaskDependency[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/task-dependencies`
    ).then((data) => data.dependencies),
  getWatchers: (initiativeId: string) =>
    v8Get<{ watchers: V8PlanningWatcher[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/watchers`
    ).then((data) => data.watchers),
  getStakeholders: (initiativeId: string) =>
    v8Get<{ stakeholders: V8PlanningStakeholder[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/stakeholders`
    ).then((data) => data.stakeholders),
  getGateRoles: (initiativeId: string) =>
    v8Get<{ roles: V8PlanningGateRoleAssignment[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/gate-roles`
    ).then((data) => data.roles),
  getStatusHistory: (initiativeId: string) =>
    v8Get<{ history: V8PlanningStatusHistoryEntry[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/status-history`
    ).then((data) => data.history),
  getHistory: (initiativeId: string) =>
    v8Get<{ events: V8PlanningHistoryEvent[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/history`
    ).then((data) => data.events),
  getComments: (initiativeId: string) =>
    v8Get<{ comments: V8PlanningComment[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/comments`
    ).then((data) => data.comments),
  getGateReadiness: (initiativeId: string) =>
    v8Get<{ readiness: V8PlanningGateReadinessCheck }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/gate-readiness-check`
    ).then((data) => data.readiness),
  getResources: (initiativeId: string) =>
    v8Get<{ resources: V8PlanningResourceItem[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/resources`
    ).then((data) => data.resources),
  getKpis: (initiativeId: string) =>
    v8Get<{ kpis: V8PlanningKpi[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/kpis`
    ).then((data) => data.kpis),
  getBudgetItems: (initiativeId: string) =>
    v8Get<{ budgetItems: V8PlanningBudgetItem[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/budget-items`
    ).then((data) => data.budgetItems),
  getTools: (initiativeId: string) =>
    v8Get<{ tools: V8PlanningToolItem[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/tools`
    ).then((data) => data.tools),
  getIntangibleAssets: (initiativeId: string) =>
    v8Get<{ intangibleAssets: V8PlanningIntangibleAssetItem[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/intangible-assets`
    ).then((data) => data.intangibleAssets),
  getRaid: (initiativeId: string, limit?: number) =>
    v8Get<{ items: V8PlanningRaidItem[] }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/raid${
        typeof limit === 'number' ? `?limit=${encodeURIComponent(String(limit))}` : ''
      }`
    ).then((data) => data.items),
  getInitiativeSnapshot: (initiativeId: string) =>
    v8Get<V8PlanningInitiativeSnapshot>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/snapshot`
    ),
  getPendingDecisions: () =>
    v8Get<{ pendingDecisionChains: V8PlanningDecisionChain[] }>('/planning/pending-decisions'),
  /** P11 outbound handoff envelope (read-only) */
  getInitiativeHandoff: (
    initiativeId: string,
    kind: 'execution' | 'kpi' | 'calendar' = 'execution'
  ) =>
    v8Get<{ handoff: Record<string, unknown> }>(
      `/planning/initiatives/${encodeURIComponent(initiativeId)}/handoff?kind=${encodeURIComponent(kind)}`
    ).then((r) => r.handoff),
};
