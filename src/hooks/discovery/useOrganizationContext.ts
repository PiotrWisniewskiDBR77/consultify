/**
 * useOrganizationContext - Hook to aggregate organization context for AI
 *
 * Collects and formats comprehensive organizational data for use in
 * AI prompts across strategic analysis tools.
 */

import { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';

// ==================== TYPES ====================

interface OrganizationContext {
  // Company profile
  companyName: string;
  industry: string;
  size: string;
  description: string;

  // Projects and initiatives
  activeProjects: Array<{
    id: string;
    name: string;
    status: string;
    progress: number;
  }>;

  // Assessment data
  assessmentScores: Record<string, number>;
  maturityLevel: string;

  // Initiatives
  initiatives: Array<{
    id: string;
    title: string;
    status: string;
    type: string;
  }>;

  // KPIs
  kpis: Array<{
    name: string;
    value: number;
    target: number;
    trend: 'up' | 'down' | 'stable';
  }>;

  // Strategic context
  strategicGoals: string[];
  challenges: string[];
}

interface OrganizationContextState {
  context: OrganizationContext | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  formatForPrompt: () => string;
}

// ==================== HOOK ====================

export const useOrganizationContext = (): OrganizationContextState => {
  // Try to get org from localStorage or use a default
  const [currentOrg, setCurrentOrg] = useState<{ id: string; name: string } | null>(() => {
    try {
      const stored = localStorage.getItem('currentOrganization');
      if (stored) {
        const parsed = JSON.parse(stored);
        return { id: parsed.id || 'default', name: parsed.name || 'Organization' };
      }
    } catch {
      // Ignore parse errors
    }
    return { id: 'default', name: 'Organization' };
  });

  const [context, setContext] = useState<OrganizationContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    if (!currentOrg?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch organization profile
      const profileResponse = await Api.get(`/organizations/${currentOrg.id}/profile`).catch(
        () => null
      );

      // Fetch projects
      const projectsResponse = await Api.get('/projects').catch(() => ({ projects: [] }));

      // Fetch initiatives
      const initiativesResponse = await Api.get('/initiatives').catch(() => ({ initiatives: [] }));

      // Fetch assessment summary
      const assessmentResponse = await Api.get('/assessment/summary').catch(() => null);

      // Fetch KPIs
      const kpisResponse = await Api.get('/kpis').catch(() => ({ kpis: [] }));

      // Build context object
      const orgContext: OrganizationContext = {
        companyName: profileResponse?.name || currentOrg.name || 'Your Organization',
        industry: profileResponse?.industry || 'Not specified',
        size: profileResponse?.size || 'Not specified',
        description: profileResponse?.description || '',

        activeProjects: (projectsResponse?.projects || []).slice(0, 10).map((p: any) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          progress: p.progress || 0,
        })),

        assessmentScores: assessmentResponse?.scores || {},
        maturityLevel: assessmentResponse?.maturityLevel || 'Not assessed',

        initiatives: (initiativesResponse?.initiatives || []).slice(0, 10).map((i: any) => ({
          id: i.id,
          title: i.title,
          status: i.status,
          type: i.type,
        })),

        kpis: (kpisResponse?.kpis || []).slice(0, 10).map((k: any) => ({
          name: k.name,
          value: k.value,
          target: k.target,
          trend: k.trend || 'stable',
        })),

        strategicGoals: profileResponse?.strategicGoals || [],
        challenges: profileResponse?.challenges || [],
      };

      setContext(orgContext);
    } catch (err) {
      console.error('[useOrganizationContext] Error fetching context:', err);
      setError('Failed to load organization context');

      // Set default context on error
      setContext({
        companyName: currentOrg?.name || 'Your Organization',
        industry: 'Not specified',
        size: 'Not specified',
        description: '',
        activeProjects: [],
        assessmentScores: {},
        maturityLevel: 'Not assessed',
        initiatives: [],
        kpis: [],
        strategicGoals: [],
        challenges: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, currentOrg?.name]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const formatForPrompt = useCallback((): string => {
    if (!context) {
      return 'No organization context available.';
    }

    const sections: string[] = [];

    // Company overview
    sections.push(`## Organization Overview
- **Company**: ${context.companyName}
- **Industry**: ${context.industry}
- **Size**: ${context.size}
${context.description ? `- **Description**: ${context.description}` : ''}`);

    // Strategic goals
    if (context.strategicGoals.length > 0) {
      sections.push(`## Strategic Goals
${context.strategicGoals.map((g) => `- ${g}`).join('\n')}`);
    }

    // Challenges
    if (context.challenges.length > 0) {
      sections.push(`## Current Challenges
${context.challenges.map((c) => `- ${c}`).join('\n')}`);
    }

    // Assessment maturity
    if (context.maturityLevel !== 'Not assessed') {
      sections.push(`## Maturity Assessment
- **Level**: ${context.maturityLevel}
${Object.entries(context.assessmentScores)
  .map(([key, value]) => `- ${key}: ${value}/5`)
  .join('\n')}`);
    }

    // Active projects
    if (context.activeProjects.length > 0) {
      sections.push(`## Active Projects (${context.activeProjects.length})
${context.activeProjects
  .map((p) => `- ${p.name} (${p.status}, ${p.progress}% complete)`)
  .join('\n')}`);
    }

    // Initiatives
    if (context.initiatives.length > 0) {
      sections.push(`## Current Initiatives (${context.initiatives.length})
${context.initiatives.map((i) => `- ${i.title} [${i.type}] - ${i.status}`).join('\n')}`);
    }

    // KPIs
    if (context.kpis.length > 0) {
      sections.push(`## Key Performance Indicators
${context.kpis
  .map((k) => `- ${k.name}: ${k.value} (target: ${k.target}, trend: ${k.trend})`)
  .join('\n')}`);
    }

    return sections.join('\n\n');
  }, [context]);

  return {
    context,
    isLoading,
    error,
    refresh: fetchContext,
    formatForPrompt,
  };
};

export default useOrganizationContext;
