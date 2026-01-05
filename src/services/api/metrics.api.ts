/**
 * Metrics API Module
 * Enterprise SaaS Architecture - Analytics & Metrics
 */

import { API_URL, fetchWithRetry, getHeaders, handleResponse } from './baseClient';

export interface MetricsOverview {
    totalUsers: number;
    activeUsers: number;
    totalProjects: number;
    aiCalls: number;
    tokensUsed: number;
    revenue: number;
}

export interface FunnelMetrics {
    stage: string;
    count: number;
    conversionRate: number;
}

export interface CohortMetrics {
    cohort: string;
    week: number;
    retention: number;
}

export const MetricsApi = {
    // ==========================================
    // OVERVIEW METRICS
    // ==========================================

    getMetricsOverview: async (): Promise<MetricsOverview> => {
        const res = await fetch(`${API_URL}/metrics/overview`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch metrics overview');
        return res.json();
    },

    getOrgMetricsOverview: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/metrics/org/overview`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch org metrics overview');
        return json;
    },

    // ==========================================
    // FUNNEL & COHORT ANALYSIS
    // ==========================================

    getMetricsFunnels: async (days = 30): Promise<FunnelMetrics[]> => {
        const res = await fetch(`${API_URL}/metrics/funnels?days=${days}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch funnels');
        return res.json();
    },

    getMetricsCohorts: async (type = 'weekly', weeks = 12): Promise<CohortMetrics[]> => {
        const res = await fetch(`${API_URL}/metrics/cohorts?type=${type}&weeks=${weeks}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch cohorts');
        return res.json();
    },

    // ==========================================
    // HELP & SUPPORT METRICS
    // ==========================================

    getMetricsHelp: async (days = 30): Promise<unknown> => {
        const res = await fetch(`${API_URL}/metrics/help?days=${days}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch help metrics');
        return res.json();
    },

    getOrgMetricsHelp: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/metrics/org/help`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organization help metrics');
        return res.json();
    },

    // ==========================================
    // ATTRIBUTION & PARTNERS
    // ==========================================

    getMetricsAttribution: async (days = 30): Promise<unknown> => {
        const res = await fetch(`${API_URL}/metrics/attribution?days=${days}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch attribution');
        return res.json();
    },

    getMetricsPartners: async (days = 90): Promise<unknown> => {
        const res = await fetch(`${API_URL}/metrics/partners?days=${days}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch partner metrics');
        return res.json();
    },

    // ==========================================
    // AI ANALYTICS
    // ==========================================

    getOrgMetricsAIAnalytics: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/metrics/org/ai-analytics`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch AI analytics');
        return json;
    },

    getTokenUsageAnalytics: async (
        organizationId: string,
        timeRange: '7d' | '30d' | '90d' = '30d',
    ): Promise<unknown> => {
        const res = await fetchWithRetry(
            `${API_URL}/analytics/token-usage?orgId=${organizationId}&range=${timeRange}`,
            {
                headers: getHeaders(),
            },
        );
        return handleResponse(res, 'Failed to fetch token usage analytics');
    },

    // ==========================================
    // TEAM METRICS
    // ==========================================

    getOrgMetricsTeam: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/metrics/org/team`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organization team metrics');
        return res.json();
    },

    // ==========================================
    // WARNINGS & ALERTS
    // ==========================================

    getMetricsWarnings: async (): Promise<unknown[]> => {
        const res = await fetch(`${API_URL}/metrics/warnings`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch warnings');
        return res.json();
    },

    // ==========================================
    // ANALYTICS (Leadership Dashboard)
    // ==========================================

    getAnalyticsHealth: async (): Promise<unknown> => {
        const res = await fetchWithRetry(`${API_URL}/analytics/health`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch analytics health');
    },

    getAnalyticsPerformance: async (): Promise<unknown[]> => {
        const res = await fetchWithRetry(`${API_URL}/analytics/performance`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch analytics performance');
    },

    getAnalyticsEconomics: async (): Promise<unknown> => {
        const res = await fetchWithRetry(`${API_URL}/analytics/economics`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch analytics economics');
    },

    // ==========================================
    // ECOSYSTEM STATS
    // ==========================================

    getEcosystemStats: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/analytics/ecosystem`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch ecosystem stats');
    },
};
