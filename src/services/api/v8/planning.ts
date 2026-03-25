import { v8Get } from './client';

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

export const V8PlanningApi = {
  getPendingDecisions: () =>
    v8Get<{ pendingDecisionChains: V8PlanningDecisionChain[] }>('/planning/pending-decisions'),
};
