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

export interface OrganizationContext {
  organizationId: string;
  companyProfile: {
    name?: string;
    industry?: string;
    size?: string;
    location?: string;
    [key: string]: unknown;
  };
  transformationGoals: string[];
  currentChallenges: string[];
  strategicPriorities: string[];
  technologyStack: string[];
  completenessPercent: number;
  lastInterviewId?: string;
}

export interface InterviewInsight {
  id: string;
  sessionId: string;
  category: string;
  title: string;
  description?: string;
  sourceQuote?: string;
  insightType: 'risk' | 'opportunity' | 'strength' | 'weakness' | 'general';
  impactLevel: 'low' | 'medium' | 'high';
  confidence: 'low' | 'medium' | 'high';
  pmoDomain?: string;
  actionable: boolean;
  status: string;
}

export interface UseInterviewContextResult {
  context: OrganizationContext | null;
  insights: InterviewInsight[];
  isLoading: boolean;
  error: Error | null;
  hasContext: boolean;
  completenessPercent: number;
  refetch: () => Promise<void>;
  exportToTarget: (targetType: 'tool_session' | 'assessment_session', targetId: string) => Promise<void>;
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

      // If there's a last interview, get its insights
      if ((contextResponse as OrganizationContext).lastInterviewId) {
        const insightsResponse = await Api.get(
          `/interview/sessions/${(contextResponse as OrganizationContext).lastInterviewId}/insights`
        );
        setInsights(Array.isArray(insightsResponse) ? insightsResponse : []);
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

  if (context.companyProfile.name) {
    parts.push(`Company: ${context.companyProfile.name}`);
  }
  if (context.companyProfile.industry) {
    parts.push(`Industry: ${context.companyProfile.industry}`);
  }
  if (context.companyProfile.size) {
    parts.push(`Size: ${context.companyProfile.size}`);
  }

  if (context.transformationGoals.length > 0) {
    parts.push(`Transformation Goals: ${context.transformationGoals.join(', ')}`);
  }

  if (context.currentChallenges.length > 0) {
    parts.push(`Current Challenges: ${context.currentChallenges.join(', ')}`);
  }

  if (context.strategicPriorities.length > 0) {
    parts.push(`Strategic Priorities: ${context.strategicPriorities.join(', ')}`);
  }

  if (context.technologyStack.length > 0) {
    parts.push(`Technology Stack: ${context.technologyStack.join(', ')}`);
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
      const parts = [
        `[${insight.category.toUpperCase()}] ${insight.title}`,
        insight.description ? `Description: ${insight.description}` : '',
        `Impact: ${insight.impactLevel}, Confidence: ${insight.confidence}`,
      ].filter(Boolean);
      return parts.join(' | ');
    })
    .join('\n');
}

export default useInterviewContext;
