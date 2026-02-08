/**
 * useOrgMemory
 *
 * Hook for fetching organization decision history and best-practice patterns
 * from the Organization Memory backend. Powers the "Past Decision Reference"
 * card shown inline in the AI chat, plus the memory-aware smart suggestions.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import Api from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PastDecision {
  id: string;
  decisionSummary: string;
  problemFraming: string | null;
  optionsConsidered: { count?: number } | null;
  chosenOption: string | null;
  recommendationText: string | null;
  confidenceScore: number | null;
  outcomeStatus: 'pending' | 'positive' | 'negative' | 'neutral' | 'mixed';
  outcomeNotes: string | null;
  tags: string[];
  industryContext: string | null;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface OrgPattern {
  id: string;
  type: string;
  title: string;
  content: string;
  applicabilityScore: number | null;
  usageCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOrgMemory() {
  const [decisions, setDecisions] = useState<PastDecision[]>([]);
  const [patterns, setPatterns] = useState<OrgPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Fetch decision history
  const fetchDecisions = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await Api.getAIDecisionHistory({ search, limit: 20 });
      setDecisions(result?.decisions || []);
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : String(err);
      console.warn('[useOrgMemory] Failed to fetch decisions:', msg);
      setError(msg || 'Failed to load decision history');
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch org patterns (best practices, lessons learned)
  const fetchPatterns = useCallback(async (type?: string) => {
    try {
      const result = await Api.getOrgPatterns({ type, limit: 10 });
      setPatterns(result?.patterns || []);
    } catch (err: any) {
      console.warn('[useOrgMemory] Failed to fetch patterns:', err?.message);
      setPatterns([]);
    }
  }, []);

  // Initial load (once)
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void fetchDecisions();
    void fetchPatterns();
  }, [fetchDecisions, fetchPatterns]);

  // Find relevant decisions for a given topic (client-side fuzzy)
  const findRelevant = useCallback(
    (topic: string, limit = 3): PastDecision[] => {
      if (!topic || decisions.length === 0) return [];
      const lower = topic.toLowerCase();
      const words = lower.split(/\s+/).filter((w) => w.length > 3);

      const scored = decisions.map((d) => {
        let score = 0;
        const text = [d.decisionSummary, d.problemFraming, d.recommendationText]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        for (const word of words) {
          if (text.includes(word)) score++;
        }
        // Boost positive outcomes
        if (d.outcomeStatus === 'positive') score += 0.5;
        return { decision: d, score };
      });

      return scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.decision);
    },
    [decisions]
  );

  return {
    decisions,
    patterns,
    loading,
    error,
    fetchDecisions,
    fetchPatterns,
    findRelevant,
  };
}
