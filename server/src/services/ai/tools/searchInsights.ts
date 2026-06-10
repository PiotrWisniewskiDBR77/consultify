/**
 * Tool: search_insights (ff_teresaRetrieval / ENABLE_TERESA_RETRIEVAL)
 *
 * Text search over interview insights (wnioski) for the caller's organization.
 * There is no FTS index on interview_insights, so this reuses the org-scoped
 * InterviewInsightService.list() (same query path the interview routes use)
 * and ranks in-process by query-token overlap on title / summary / content —
 * schema-tolerant across the legacy (`description`) and AI (`content`) columns.
 *
 * READ-only. Returns the compact { results, truncated } envelope (~4KB cap).
 */

import logger from '../../../utils/Logger.js';
import interviewInsightService from '../../InterviewInsightService.js';
import {
  capResultPayload,
  clampLimit,
  isTeresaRetrievalEnabled,
  type OrgRetrievalEnvelope,
  toSnippet,
} from './orgRetrievalShared.js';

type SearchInsightsParams = {
  query: string;
  limit?: number;
};

type SearchInsightsContext = {
  organizationId?: string;
  userId?: string;
};

export interface InsightHit {
  id: string;
  title: string;
  snippet: string;
  type: string;
}

/** How many recent org insights to scan in-process for a match. */
const CANDIDATE_SCAN_LIMIT = 200;

function tokenize(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
}

export async function searchInsights(
  params: SearchInsightsParams,
  context: SearchInsightsContext = {}
): Promise<OrgRetrievalEnvelope<InsightHit>> {
  if (!isTeresaRetrievalEnabled()) {
    return { results: [], truncated: false };
  }

  const orgId = String(context.organizationId || '').trim();
  if (!orgId) {
    logger.warn('[searchInsights] Missing organizationId in tool context — returning empty');
    return { results: [], truncated: false };
  }

  const query = String(params.query || '')
    .trim()
    .slice(0, 300);
  if (!query) return { results: [], truncated: false };

  const limit = clampLimit(params.limit);
  const tokens = tokenize(query);
  if (tokens.length === 0) return { results: [], truncated: false };

  // scope 'all' deliberately: 'active' assumes the archived_at column exists
  // (controller-managed), which this read-only tool must not depend on.
  const candidates = await interviewInsightService.list(orgId, {
    limit: CANDIDATE_SCAN_LIMIT,
    scope: 'all',
  });

  const scored = candidates
    .map((insight) => {
      const haystack = [insight.title, insight.executiveSummary, insight.content]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const score = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
      return { insight, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return capResultPayload(
    scored.map(({ insight }) => ({
      id: insight.id,
      title: toSnippet(insight.title, 200),
      snippet: toSnippet(insight.executiveSummary || insight.content || '', 300),
      type: String(insight.promptType || 'summary'),
    }))
  );
}

export default { searchInsights };
