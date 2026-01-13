/**
 * Tool: search_knowledge_base
 * Searches the DRD methodology knowledge base using RAG.
 */

import logger from '../../../utils/Logger.js';

type SearchParams = {
  query: string;
  maxResults?: number;
};

type SearchContext = {
  organizationId?: string;
};

type RagChunk = {
  content?: string;
  text?: string;
  source?: string;
  document_name?: string;
  similarity?: number;
  score?: number;
};

export async function searchKnowledgeBase(
  params: SearchParams,
  context: SearchContext = {}
): Promise<{
  results: Array<{ content: string; source: string; relevance: number }>;
  totalFound: number;
}> {
  const { query, maxResults = 5 } = params;

  try {
    const ragModule = await import('../../ragService.js');
    const ragService = (ragModule.default || ragModule) as {
      searchRelevantChunks: (
        queryText: string,
        options: Record<string, unknown>
      ) => Promise<RagChunk[]>;
    };

    const results = await ragService.searchRelevantChunks(query, {
      limit: maxResults,
      organizationId: context.organizationId,
    });

    return {
      results: results.map((r) => ({
        content: r.content || r.text || '',
        source: r.source || r.document_name || 'DRD Methodology',
        relevance: r.similarity || r.score || 0.8,
      })),
      totalFound: results.length,
    };
  } catch (error: unknown) {
    const err = error as Error;
    logger.warn('[searchKnowledgeBase] RAG failed, using fallback:', err.message);

    return {
      results: [
        {
          content: getDRDFallbackContent(query),
          source: 'DRD Methodology (Fallback)',
          relevance: 0.7,
        },
      ],
      totalFound: 1,
    };
  }
}

function getDRDFallbackContent(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('maturity') || lowerQuery.includes('assessment')) {
    return `DRD Maturity Assessment Framework:
- Evaluates digital readiness across 5 dimensions
- Uses 5-level maturity scale (Initial → Optimized)
- Assessments should be done quarterly
- Focus on gaps between current and target state
- Prioritize improvements with highest business impact`;
  }

  if (lowerQuery.includes('axis') || lowerQuery.includes('dimension')) {
    return `DRD Framework Axes:
1. Strategy & Governance - Vision, roadmap, leadership alignment
2. Technology & Infrastructure - Systems, platforms, integration
3. People & Culture - Skills, change readiness, training
4. Processes & Operations - Workflows, automation, efficiency
5. Data & Analytics - Data quality, insights, decision-making`;
  }

  if (lowerQuery.includes('initiative') || lowerQuery.includes('improvement')) {
    return `DRD Initiative Planning:
- Derive initiatives from assessment gaps
- Calculate ROI for each initiative
- Prioritize using impact vs effort matrix
- Track progress with clear KPIs
- Review and adjust quarterly`;
  }

  return `DRD (Digital Readiness Diagnostic) is a comprehensive framework for assessing and improving organizational digital maturity. It focuses on identifying gaps, prioritizing improvements, and tracking progress across key dimensions of digital transformation.`;
}

export default { searchKnowledgeBase };
