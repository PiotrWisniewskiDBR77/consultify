/**
 * useOrganizationContext - Hook to aggregate organization context for AI
 *
 * Collects and formats comprehensive organizational data for use in
 * AI prompts across strategic analysis tools.
 */

import { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';

interface OrganizationContextProfile {
  companyName: string | null;
  description: string | null;
  industry: string | null;
  companySize: string | null;
  location: string | null;
  employeeCount: number | null;
  annualRevenue: string | null;
  website: string | null;
  defaultLanguage: string | null;
  defaultTimezone: string | null;
  currency: string | null;
}

interface OrganizationContext {
  organizationId: string;
  profile: OrganizationContextProfile;
  strategic: {
    goals: string[];
    priorities: string[];
    mission: string | null;
    vision: string | null;
    competitivePosition: string | null;
    growthStage: string | null;
    riskAppetite: string | null;
  };
  operations: {
    keyMetrics: Array<Record<string, unknown>>;
    constraints: string[];
    gaps: Array<Record<string, unknown>>;
    interviewAnswers: Array<Record<string, unknown>>;
  };
  systems: {
    stack: string[];
    cloudAdoption: string | null;
    integrations: string[];
  };
  stakeholders: Array<Record<string, unknown>>;
  signals: {
    interviewInsights: string[];
  };
  conflicts: Array<{ claimPath: string; values: unknown[]; sourceTypes: string[] }>;
  counts: {
    items: number;
    claims: number;
    conflicts: number;
  };
}

interface OrganizationContextState {
  context: OrganizationContext | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  formatForPrompt: () => string;
}

const fallbackContext = (): OrganizationContext => ({
  organizationId: '',
  profile: {
    companyName: null,
    description: null,
    industry: null,
    companySize: null,
    location: null,
    employeeCount: null,
    annualRevenue: null,
    website: null,
    defaultLanguage: null,
    defaultTimezone: null,
    currency: null,
  },
  strategic: {
    goals: [],
    priorities: [],
    mission: null,
    vision: null,
    competitivePosition: null,
    growthStage: null,
    riskAppetite: null,
  },
  operations: {
    keyMetrics: [],
    constraints: [],
    gaps: [],
    interviewAnswers: [],
  },
  systems: {
    stack: [],
    cloudAdoption: null,
    integrations: [],
  },
  stakeholders: [],
  signals: {
    interviewInsights: [],
  },
  conflicts: [],
  counts: {
    items: 0,
    claims: 0,
    conflicts: 0,
  },
});

export const useOrganizationContext = (): OrganizationContextState => {
  const [context, setContext] = useState<OrganizationContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await Api.organizationContextGet();
      setContext((response as OrganizationContext) || fallbackContext());
    } catch (err) {
      console.error('[useOrganizationContext] Error fetching context:', err);
      setError('Failed to load organization context');
      setContext(fallbackContext());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const formatForPrompt = useCallback((): string => {
    if (!context) {
      return 'No organization context available.';
    }

    const sections: string[] = [];

    sections.push(`## Organization Overview
- Company: ${context.profile.companyName || 'Unknown'}
- Industry: ${context.profile.industry || 'Unknown'}
- Size: ${context.profile.companySize || 'Unknown'}
${context.profile.location ? `- Location: ${context.profile.location}` : ''}
${context.profile.employeeCount ? `- Employees: ${context.profile.employeeCount}` : ''}
${context.profile.annualRevenue ? `- Revenue: ${context.profile.annualRevenue}` : ''}
${context.profile.description ? `- Description: ${context.profile.description}` : ''}`);

    if (context.strategic.goals.length > 0 || context.strategic.priorities.length > 0) {
      sections.push(`## Strategic Direction
${context.strategic.goals.map((goal) => `- Goal: ${goal}`).join('\n')}
${context.strategic.priorities.map((priority) => `- Priority: ${priority}`).join('\n')}
${context.strategic.mission ? `- Mission: ${context.strategic.mission}` : ''}
${context.strategic.vision ? `- Vision: ${context.strategic.vision}` : ''}`);
    }

    if (context.operations.constraints.length > 0 || context.operations.gaps.length > 0) {
      sections.push(`## Constraints And Gaps
${context.operations.constraints.map((constraint) => `- Constraint: ${constraint}`).join('\n')}
${context.operations.gaps
  .map((gap) => `- Gap: ${String(gap.description || gap.category || 'Unspecified')}`)
  .join('\n')}`);
    }

    if (context.operations.keyMetrics.length > 0) {
      sections.push(`## Key Metrics
${context.operations.keyMetrics
  .map((metric) => `- ${String(metric.name || 'Metric')}: ${String(metric.value || '')}`)
  .join('\n')}`);
    }

    if (context.systems.stack.length > 0 || context.systems.cloudAdoption) {
      sections.push(`## Systems Landscape
${context.systems.stack.map((tool) => `- Stack: ${tool}`).join('\n')}
${context.systems.cloudAdoption ? `- Cloud adoption: ${context.systems.cloudAdoption}` : ''}
${context.systems.integrations.map((integration) => `- Integration: ${integration}`).join('\n')}`);
    }

    if (context.stakeholders.length > 0) {
      sections.push(`## Stakeholders
${context.stakeholders
  .map((stakeholder) => {
    const name = String(stakeholder.name || 'Unknown stakeholder');
    const role = stakeholder.role ? ` (${String(stakeholder.role)})` : '';
    return `- ${name}${role}`;
  })
  .join('\n')}`);
    }

    if (context.signals.interviewInsights.length > 0) {
      sections.push(`## Interview Signals
${context.signals.interviewInsights.map((signal) => `- ${signal}`).join('\n')}`);
    }

    if (context.conflicts.length > 0) {
      sections.push(`## Context Warnings
- There are ${context.conflicts.length} conflicting claims that may need review.`);
    }

    return sections
      .map((section) =>
        section
          .split('\n')
          .map((line) => line.trimEnd())
          .filter(Boolean)
          .join('\n')
      )
      .filter(Boolean)
      .join('\n\n');
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
