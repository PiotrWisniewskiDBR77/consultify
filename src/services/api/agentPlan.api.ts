/**
 * Agent Plan API client (HP-4 fundament — "Uruchom agenta z Teresy", tryb Plan).
 *
 * Thin wrapper over `/api/ai/agent-plan/*`
 * (server/src/routes/ai/agent-plan.routes.ts). Server-side delegates fully to
 * `agentPlannerService` (the existing plan→execute→observe kręgosłup) — this
 * client only shapes the HTTP calls, no local execution logic.
 *
 * Fundament note: this module is NOT yet imported anywhere in the app shell —
 * it exists so `AgentPlanPanel` (src/components/AIChat/AgentPlanPanel.tsx) has
 * a real client to call once wired behind `ff_agentPlan`
 * (src/utils/agentPlanFlag.ts). Chat→plan integration is a separate task
 * (concept §2 "Minimalna zmiana w czacie").
 */
import { API_URL, getHeaders, handleResponse } from './baseClient';

export type AgentPlanStatus =
  | 'planning'
  | 'awaiting_approval'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentPlanStepStatus =
  | 'pending'
  | 'awaiting_approval'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface AgentPlanStep {
  id: string;
  stepIndex: number;
  toolName: string;
  toolInput: Record<string, unknown>;
  status: AgentPlanStepStatus;
  result?: unknown;
  errorMessage?: string;
  requiresApproval: boolean;
  durationMs?: number;
}

export interface AgentPlan {
  id: string;
  organizationId: string;
  conversationId?: string;
  userId: string;
  title: string;
  description?: string;
  status: AgentPlanStatus;
  steps: AgentPlanStep[];
  totalSteps: number;
  completedSteps: number;
  currentStepIndex: number;
  resultSummary?: string;
  errorMessage?: string;
  isBackground: boolean;
  createdAt: string;
}

export interface CreateAgentPlanInput {
  title: string;
  description?: string;
  conversationId?: string;
  manifestId?: string;
  steps: Array<{ toolName: string; toolInput: Record<string, unknown> }>;
}

export async function createAgentPlan(
  input: CreateAgentPlanInput
): Promise<{ plan: AgentPlan; dispatch: 'enqueued' | 'unavailable' }> {
  const res = await fetch(`${API_URL}/ai/agent-plan`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(input),
  });
  return handleResponse<{ plan: AgentPlan; dispatch: 'enqueued' | 'unavailable' }>(
    res,
    'Failed to create agent plan'
  );
}

export async function getAgentPlan(planId: string): Promise<{ plan: AgentPlan }> {
  const res = await fetch(`${API_URL}/ai/agent-plan/${encodeURIComponent(planId)}`, {
    headers: getHeaders(),
  });
  return handleResponse<{ plan: AgentPlan }>(res, 'Failed to load agent plan');
}

export async function listAgentPlans(
  options: { mine?: boolean } = {}
): Promise<{ total: number; plans: AgentPlan[] }> {
  const query = options.mine ? '?mine=1' : '';
  const res = await fetch(`${API_URL}/ai/agent-plan${query}`, { headers: getHeaders() });
  return handleResponse<{ total: number; plans: AgentPlan[] }>(res, 'Failed to list agent plans');
}

export async function approveAgentPlanStep(
  planId: string,
  stepIndex: number
): Promise<{ plan: AgentPlan; dispatch: 'enqueued' | 'unavailable' }> {
  const res = await fetch(
    `${API_URL}/ai/agent-plan/${encodeURIComponent(planId)}/approve-step`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ stepIndex }),
    }
  );
  return handleResponse<{ plan: AgentPlan; dispatch: 'enqueued' | 'unavailable' }>(
    res,
    'Failed to approve agent plan step'
  );
}

export async function cancelAgentPlan(planId: string): Promise<{ plan: AgentPlan }> {
  const res = await fetch(`${API_URL}/ai/agent-plan/${encodeURIComponent(planId)}/cancel`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse<{ plan: AgentPlan }>(res, 'Failed to cancel agent plan');
}
