/**
 * PMO API Module
 * Enterprise SaaS Architecture - Project Management Office
 * ISO 21500, PMBOK 7, PRINCE2 Compliant
 */

import { API_URL, fetchWithRetry, getHeaders, handleResponse } from './baseClient';

export interface PMOContext {
  projectId: string;
  currentPhase: string;
  gateStatus: 'open' | 'blocked' | 'pending';
  blockingIssues: PMOIssue[];
  healthScore: number;
  lastUpdated: string;
}

export interface PMOIssue {
  id: string;
  type: 'risk' | 'issue' | 'dependency' | 'blocker';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  owner?: string;
  dueDate?: string;
}

export interface PMODomain {
  id: string;
  name: string;
  isoMapping: string;
  pmbokMapping: string;
  prince2Mapping: string;
  description: string;
}

export const PMOApi = {
  // ==========================================
  // PMO CONTEXT
  // ==========================================

  getPMOContext: async (projectId: string): Promise<PMOContext> => {
    const res = await fetch(`${API_URL}/pmo-context/${projectId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch PMO context');
    return res.json();
  },

  getPMOTaskLabels: async (
    projectId: string
  ): Promise<{ taskLabels: Record<string, unknown[]> }> => {
    const res = await fetch(`${API_URL}/pmo-context/${projectId}/task-labels`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch PMO task labels');
    return res.json();
  },

  // ==========================================
  // PMO HEALTH
  // ==========================================

  getPMOHealth: async (projectId: string): Promise<unknown> => {
    const res = await fetch(`${API_URL}/pmo/${projectId}/health`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch PMO health');
    return res.json();
  },

  getPMOSnapshot: async (projectId: string): Promise<unknown> => {
    const res = await fetch(`${API_URL}/pmo/${projectId}/snapshot`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch PMO snapshot');
    return res.json();
  },

  // ==========================================
  // PMO DOMAINS (ISO/PMBOK/PRINCE2 Mapping)
  // ==========================================

  getPMODomains: async (): Promise<PMODomain[]> => {
    const res = await fetch(`${API_URL}/pmo-domains`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch PMO domains');
    return res.json();
  },

  // ==========================================
  // DECISIONS
  // ==========================================

  getDecisions: async (projectId: string): Promise<unknown[]> => {
    const res = await fetch(`${API_URL}/decisions?projectId=${projectId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch decisions');
    return res.json();
  },

  createDecision: async (decision: unknown): Promise<unknown> => {
    const res = await fetch(`${API_URL}/decisions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(decision),
    });
    return handleResponse(res, 'Failed to create decision');
  },

  updateDecision: async (id: string, updates: unknown): Promise<void> => {
    const res = await fetch(`${API_URL}/decisions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update decision');
  },

  // ==========================================
  // STAGE GATES
  // ==========================================

  getStageGates: async (projectId: string): Promise<unknown[]> => {
    const res = await fetch(`${API_URL}/stage-gates?projectId=${projectId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch stage gates');
    return res.json();
  },

  updateStageGate: async (id: string, updates: unknown): Promise<void> => {
    const res = await fetch(`${API_URL}/stage-gates/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update stage gate');
  },

  // ==========================================
  // GOVERNANCE
  // ==========================================

  getGovernanceSettings: async (projectId: string): Promise<unknown> => {
    const res = await fetch(`${API_URL}/governance/${projectId}/settings`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch governance settings');
    return res.json();
  },

  updateGovernanceSettings: async (projectId: string, settings: unknown): Promise<void> => {
    const res = await fetch(`${API_URL}/governance/${projectId}/settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update governance settings');
  },

  // ==========================================
  // RAID LOG (Risks, Assumptions, Issues, Dependencies)
  // ==========================================

  getRAIDLog: async (projectId: string): Promise<unknown[]> => {
    const res = await fetch(`${API_URL}/raid?projectId=${projectId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch RAID log');
    return res.json();
  },

  createRAIDItem: async (item: unknown): Promise<unknown> => {
    const res = await fetch(`${API_URL}/raid`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(item),
    });
    return handleResponse(res, 'Failed to create RAID item');
  },

  updateRAIDItem: async (id: string, updates: unknown): Promise<void> => {
    const res = await fetch(`${API_URL}/raid/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update RAID item');
  },
};
