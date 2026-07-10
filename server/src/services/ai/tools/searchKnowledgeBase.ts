/**
 * Tool: search_knowledge_base
 * Searches the knowledge base using RAG.
 *
 * Defaults to "global" search. When `toolSlug` / `packType` / `language` are provided,
 * it restricts retrieval to Tool Knowledge Packs indexed from `knowledge/tool-kb/**`.
 */

import { all as dbAll } from '../../../utils/DbPromise.js';
import logger from '../../../utils/Logger.js';
import { evaluateRetrievalPolicyDecision } from '../chatPolicyGateway.js';

type SearchParams = {
  query: string;
  maxResults?: number;
  toolSlug?: string;
  packType?: string;
  language?: string;
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
  /** Branding pass-through from ragService.searchRelevantChunks (fix 2026-07-10). */
  sourceAuthor?: string;
  branded?: boolean;
};

export async function searchKnowledgeBase(
  params: SearchParams,
  context: SearchContext = {}
): Promise<{
  results: Array<{
    content: string;
    source: string;
    relevance: number;
    /**
     * Branding for cited knowledge (decyzja D-E, `_KONCEPT_CONTENT_ENGINES_2026-07-10.md`
     * §7): populated when the chunk was indexed from a branded pack (e.g. the
     * "Digital Pathfinder" book — `knowledgeIndexer` tags drd/methodology chunks
     * with `source_author`/`branded`/`verbatim`). Callers that cite this content
     * in client-facing output should render "wg {source}, {sourceAuthor}" when
     * `branded` is true (previously always dropped — ragService.searchRelevantChunks
     * only returned `{content, source: filename, similarity}`).
     */
    sourceAuthor?: string;
    branded?: boolean;
  }>;
  totalFound: number;
}> {
  const { query, maxResults = 5, toolSlug, packType, language } = params;

  try {
    const policyResult = await evaluateRetrievalPolicyDecision({
      consumerClass: 'agent',
      query,
      organizationId: context.organizationId || 'system',
      userId: 'tool:search_knowledge_base',
    });
    logger.info(
      `[searchKnowledgeBase] Policy decision: id=${policyResult.decision.id}, allowed=${policyResult.decision.allowed}, outcome=${policyResult.decision.outcome}`
    );
    if (!policyResult.decision.allowed) {
      return { results: [], totalFound: 0 };
    }
  } catch (policyErr: any) {
    logger.warn(
      `[searchKnowledgeBase] Policy gateway error (fail-closed): ${policyErr?.message || String(policyErr)}`
    );
    return { results: [], totalFound: 0 };
  }

  try {
    const ragModule = await import('../../ragService.js');
    const ragService = (ragModule.default || ragModule) as {
      searchRelevantChunks: (
        queryText: string,
        options: Record<string, unknown>
      ) => Promise<RagChunk[]>;
    };

    const hasToolFilter = Boolean(toolSlug || packType || language);
    let documentIds: string[] | undefined = undefined;
    if (hasToolFilter) {
      try {
        const rows = (await dbAll(
          `SELECT id, metadata, filename FROM knowledge_docs WHERE source_type = ?`,
          ['tool_pack'],
          { fallback: true } as any
        )) as Array<{ id?: string; metadata?: string; filename?: string }>;

        const filtered = (rows || []).filter((r) => {
          if (!r?.id) return false;
          let meta: any = {};
          try {
            meta = r.metadata ? JSON.parse(String(r.metadata)) : {};
          } catch {
            meta = {};
          }
          const okTool = toolSlug
            ? String(meta?.tool_slug || '').toLowerCase() === String(toolSlug).toLowerCase()
            : true;
          const okPack = packType
            ? String(meta?.pack_type || '').toLowerCase() === String(packType).toLowerCase()
            : true;
          const okLang = language
            ? String(meta?.language || '').toLowerCase() === String(language).toLowerCase()
            : true;
          return okTool && okPack && okLang;
        });

        documentIds = filtered.map((r) => String(r.id));
      } catch (e: any) {
        logger.warn('[searchKnowledgeBase] Tool-pack filtering failed:', e?.message || String(e));
        documentIds = undefined;
      }
    }

    const results = await ragService.searchRelevantChunks(query, {
      limit: maxResults,
      organizationId: context.organizationId,
      ...(documentIds && documentIds.length > 0 ? { documentIds } : {}),
    });

    return {
      results: results.map((r) => ({
        content: r.content || r.text || '',
        source: r.source || r.document_name || 'DRD Methodology',
        relevance: r.similarity || r.score || 0.8,
        sourceAuthor: r.sourceAuthor,
        branded: Boolean(r.branded),
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
