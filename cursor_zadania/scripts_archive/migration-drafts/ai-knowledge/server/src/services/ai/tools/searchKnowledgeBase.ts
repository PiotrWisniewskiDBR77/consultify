/**
 * MIGRATION DRAFT (auto-generated)
 * Source: server/services/ai/tools/searchKnowledgeBase.js
 * Target: server/src/services/ai/tools/searchKnowledgeBase.ts
 * Status: wrapper
 *
 * TODO:
 * - Convert require/imports to ES module imports.
 * - Replace db callbacks with DbPromise/getDatabase().
 * - Add types and runtime validation where needed.
 */

/**
 * Tool: search_knowledge_base
 * Searches the DRD methodology knowledge base using RAG
 */

const RagService = require('../../ragService');

async function searchKnowledgeBase(params, context) {
    const { query, maxResults = 5 } = params;

    try {
        // Use existing RAG service for vector search
        const results = await RagService.searchRelevantChunks(query, {
            limit: maxResults,
            organizationId: context.organizationId,
        });

        return {
            results: results.map((r) => ({
                content: r.content || r.text,
                source: r.source || r.document_name || 'DRD Methodology',
                relevance: r.similarity || r.score || 0.8,
            })),
            totalFound: results.length,
        };
    } catch (error) {
        // Fallback: Return static DRD methodology content if RAG fails
        console.warn('[searchKnowledgeBase] RAG failed, using fallback:', error.message);

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

/**
 * Fallback content for common DRD queries
 */
function getDRDFallbackContent(query) {
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

module.exports = { searchKnowledgeBase };
