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

// USPOJNIENIE E2 — kształt odpowiedzi GET /initiatives/funnel/stats
export interface InitiativeFunnelStats {
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  conversion: {
    created: number;
    inExecution: number;
    tracking: number;
    conversionPct: number;
  };
  /** Z94 §3.2/§5.2 — avg days spent per status before leaving it. Optional for backward-compat with older payloads/tests. */
  cycleTime?: InitiativeCycleTimeStage[];
}

export interface InitiativeCycleTimeStage {
  status: string;
  avgDays: number;
  count: number;
}

// USPOJNIENIE E1 — kształt odpowiedzi GET /initiatives/:id/lineage
export interface InitiativeLineageChain {
  source: { type: string; id: string } | null;
  initiative: { id: string; title: string; status: string };
  downstream: {
    executionStatus?: string;
    benefits?: Array<{ kpi: string }>;
  };
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
  // USPOJNIENIE E1/E2 — OBSERWOWALNOŚĆ ŁAŃCUCHA (lineage + funnel)
  // ==========================================

  /**
   * Org-wide funnel: liczby per status, per źródło i konwersja
   * created → in-execution → tracking. Degraduje do pustych liczb na błędzie.
   */
  getFunnelStats: async (): Promise<InitiativeFunnelStats> => {
    try {
      const res = await fetch(`${API_URL}/initiatives/funnel/stats`, { headers: getHeaders() });
      if (!res.ok) throw new Error('funnel stats failed');
      return (await res.json()) as InitiativeFunnelStats;
    } catch {
      return {
        byStatus: {},
        bySource: {},
        conversion: { created: 0, inExecution: 0, tracking: 0, conversionPct: 0 },
        cycleTime: [],
      };
    }
  },

  /**
   * Łańcuch pochodzenia JEDNEJ inicjatywy: źródło → inicjatywa → wykonanie →
   * rezultaty. Zwraca null gdy inicjatywa nie rozwiązuje się w org / na błędzie.
   */
  getLineage: async (id: string): Promise<InitiativeLineageChain | null> => {
    try {
      const res = await fetch(`${API_URL}/initiatives/${id}/lineage`, { headers: getHeaders() });
      if (!res.ok) return null;
      return (await res.json()) as InitiativeLineageChain;
    } catch {
      return null;
    }
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
