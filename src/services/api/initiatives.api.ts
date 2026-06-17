/**
 * Initiatives API Module
 * Enterprise SaaS Architecture - Strategic Initiative Management
 */

import { API_URL, getHeaders, handleResponse } from './baseClient';

export interface Initiative {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'draft' | 'planning' | 'active' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  roi?: number;
  strategicAlignment?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  category?: string;
  tags?: string[];
  kpis?: InitiativeKPI[];
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeKPI {
  name: string;
  target: number;
  current: number;
  unit: string;
}

/**
 * A finance-model linkage written by M16 (Finance) against this initiative.
 * Surfaced read-only on the M13 detail so the economics relationship is visible
 * instead of being write-only/dead.
 */
export interface InitiativeEconomicsLink {
  linkageId: string;
  financeModelRef: string;
  linkageType: 'budget' | 'forecast' | 'actual' | 'variance';
  status:
    | 'not_started'
    | 'local_only'
    | 'linked_to_finance_model'
    | 'linked_to_finance_scenario'
    | 'linked_to_roi_tracking'
    | 'stale_vs_finance_model';
  createdAt: string;
  updatedAt: string;
}

export const InitiativeApi = {
  // ==========================================
  // INITIATIVES CRUD
  // ==========================================

  getInitiatives: async (projectId?: string): Promise<Initiative[]> => {
    let url = `${API_URL}/initiatives`;
    if (projectId) url += `?projectId=${projectId}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch initiatives');
    return res.json();
  },

  getInitiative: async (id: string): Promise<Initiative> => {
    const res = await fetch(`${API_URL}/initiatives/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch initiative');
    return res.json();
  },

  createInitiative: async (initiative: Partial<Initiative>): Promise<Initiative> => {
    const res = await fetch(`${API_URL}/initiatives`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(initiative),
    });
    return handleResponse(res, 'Failed to create initiative');
  },

  updateInitiative: async (id: string, updates: Partial<Initiative>): Promise<void> => {
    const res = await fetch(`${API_URL}/initiatives/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    await handleResponse(res, 'Failed to update initiative');
  },

  deleteInitiative: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/initiatives/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete initiative');
  },

  // ==========================================
  // INITIATIVE VALIDATION & ENRICHMENT
  // ==========================================

  validateInitiative: async (id: string): Promise<{ valid: boolean; issues: string[] }> => {
    const response = await fetch(`${API_URL}/initiatives/${id}/validate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Validation failed');
    return response.json();
  },

  enrichInitiative: async (id: string): Promise<Initiative> => {
    const response = await fetch(`${API_URL}/initiatives/${id}/enrich`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Enrichment failed');
    return response.json();
  },

  // ==========================================
  // ECONOMICS LINKAGES (M16 Finance → M13 display)
  // ==========================================

  /**
   * Fetch the finance-model linkages M16 wrote for this initiative (org-scoped on
   * the server). Returns [] on 404 (initiative not in org) or any error so the
   * detail surface degrades gracefully instead of throwing.
   */
  getEconomicsLinks: async (id: string): Promise<InitiativeEconomicsLink[]> => {
    try {
      const res = await fetch(`${API_URL}/initiatives/${id}/economics-links`, {
        headers: getHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const links = data?.links ?? data?.items ?? [];
      return Array.isArray(links) ? (links as InitiativeEconomicsLink[]) : [];
    } catch {
      return [];
    }
  },
};
