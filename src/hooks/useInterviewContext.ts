/**
 * useInterviewContext Hook - v2.0
 *
 * Provides access to organization context collected during Interview.
 * Used by Tools and Assessment modules to enrich their analysis.
 *
 * 5 Categories: Strategy, Operations, Digital, People, Finance
 * ONLY facts - no recommendations
 *
 * @see PROMPT 8 in wdrozenia/PROMPTY_DLA_AGENTOW.md
 */

import { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';
import { V8InterviewApi } from '@/services/api/v8/interview';

export interface OrganizationContext {
  id?: string;
  organizationId: string;
  companyName: string | null;
  industry: string | null;
  companySize: string | null;
  location: string | null;
  employeeCount: number | null;
  annualRevenue: string | null;
  keyMetrics: Array<{ name: string; value: string; category?: string }>;
  stakeholders: Array<{ name: string; role: string; department?: string }>;
  openGaps: Array<{ category: string; description: string; priority: string }>;
  completenessPercent: number;
  lastInterviewId?: string;
}

export interface InterviewInsight {
  id: string;
  organizationId?: string;
  title: string;
  promptType?: string;
  sourceSessionIds?: string[];
  content?: string;
  status: string;

  // Legacy fields (optional)
  sessionId?: string;
  category?: string;
  description?: string;
  sourceQuote?: string;
  insightType?: string;
  impactLevel?: string;
  confidence?: string;
  pmoDomain?: string;
  actionable?: boolean;
}

export interface UseInterviewContextResult {
  context: OrganizationContext | null;
  insights: InterviewInsight[];
  isLoading: boolean;
  error: Error | null;
  hasContext: boolean;
  completenessPercent: number;
  refetch: () => Promise<void>;
  exportToTarget: (
    targetType: 'tool_session' | 'assessment_session',
    targetId: string
  ) => Promise<void>;
}

export function useInterviewContext(): UseInterviewContextResult {
  const [context, setContext] = useState<OrganizationContext | null>(null);
  const [insights, setInsights] = useState<InterviewInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchContext = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const contextResponse = await Api.get('/interview/context');
      setContext(contextResponse as OrganizationContext);

      // If there's a last interview, get insights related to that session.
      if ((contextResponse as OrganizationContext).lastInterviewId) {
        const lastId = String((contextResponse as OrganizationContext).lastInterviewId);
        const insightsResponse = await V8InterviewApi.listInsights({ limit: 100, offset: 0 })
          .then((r) => r.insights)
          .catch(() => Api.get(`/interview/insights?limit=100&offset=0`).catch(() => []));
        const list = Array.isArray(insightsResponse)
          ? (insightsResponse as InterviewInsight[])
          : [];
        const filtered = list.filter((i) => {
          const sessionId = String((i as any).sessionId || '');
          if (sessionId && sessionId === lastId) return true;
          const source = Array.isArray((i as any).sourceSessionIds)
            ? ((i as any).sourceSessionIds as string[])
            : [];
          return source.map(String).includes(lastId);
        });
        setInsights(filtered);
      }
    } catch (err) {
      console.error('[useInterviewContext] Failed to fetch context:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch interview context'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const exportToTarget = useCallback(
    async (targetType: 'tool_session' | 'assessment_session', targetId: string) => {
      if (!context?.lastInterviewId) {
        throw new Error('No interview session to export from');
      }

      await Api.post(`/interview/sessions/${context.lastInterviewId}/export`, {
        targetType,
        targetId,
      });
    },
    [context?.lastInterviewId]
  );

  return {
    context,
    insights,
    isLoading,
    error,
    hasContext: context !== null && context.completenessPercent > 0,
    completenessPercent: context?.completenessPercent || 0,
    refetch: fetchContext,
    exportToTarget,
  };
}

/**
 * Helper to get relevant insights by category
 */
export function getInsightsByCategory(
  insights: InterviewInsight[],
  category: string
): InterviewInsight[] {
  return insights.filter((insight) => insight.category === category);
}

/**
 * Helper to get high impact insights
 */
export function getHighImpactInsights(insights: InterviewInsight[]): InterviewInsight[] {
  return insights.filter((insight) => insight.impactLevel === 'high');
}

/**
 * Helper to format context for AI prompts
 */
export function formatContextForAI(context: OrganizationContext | null): string {
  if (!context || context.completenessPercent === 0) {
    return '';
  }

  const parts: string[] = [];

  if (context.companyName) {
    parts.push(`Company: ${context.companyName}`);
  }
  if (context.industry) {
    parts.push(`Industry: ${context.industry}`);
  }
  if (context.companySize) {
    parts.push(`Size: ${context.companySize}`);
  }
  if (context.location) {
    parts.push(`Location: ${context.location}`);
  }
  if (context.employeeCount) {
    parts.push(`Employees: ${context.employeeCount}`);
  }
  if (context.annualRevenue) {
    parts.push(`Annual Revenue: ${context.annualRevenue}`);
  }

  if (context.keyMetrics.length > 0) {
    parts.push(`Key Metrics: ${context.keyMetrics.map((m) => `${m.name}: ${m.value}`).join(', ')}`);
  }

  if (context.stakeholders.length > 0) {
    parts.push(
      `Stakeholders: ${context.stakeholders.map((s) => `${s.name} (${s.role})`).join(', ')}`
    );
  }

  if (context.openGaps.length > 0) {
    parts.push(`Open Gaps: ${context.openGaps.map((g) => g.description).join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Helper to format insights for AI prompts
 */
export function formatInsightsForAI(insights: InterviewInsight[]): string {
  if (insights.length === 0) {
    return '';
  }

  return insights
    .map((insight) => {
      const category = String(insight.category || insight.promptType || 'INSIGHT').toUpperCase();
      const parts = [
        `[${category}] ${insight.title}`,
        insight.description ? `Description: ${insight.description}` : '',
        insight.impactLevel || insight.confidence
          ? `Impact: ${insight.impactLevel || '-'}, Confidence: ${insight.confidence || '-'}`
          : '',
      ].filter(Boolean);
      return parts.join(' | ');
    })
    .join('\n');
}

export default useInterviewContext;
