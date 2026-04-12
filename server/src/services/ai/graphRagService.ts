/**
 * Graph RAG Service
 *
 * Integrates the Knowledge Graph with the retrieval pipeline as
 * an additional retrieval channel alongside vector + BM25 search.
 * Provides entity linking, graph traversal, and reasoning over
 * relationships for context-aware AI responses.
 */
import logger from '../../utils/Logger.js';

export interface GraphRagResult {
  entities: Array<{
    name: string;
    type: string;
    relevance: number;
    attributes: Record<string, unknown>;
  }>;
  relationships: Array<{
    from: string;
    to: string;
    type: string;
    strength: number;
    context?: string;
  }>;
  contextText: string;
  entityCount: number;
  relationCount: number;
}

class GraphRagService {
  async retrieveGraphContext(input: {
    query: string;
    organizationId: string;
    maxEntities?: number;
    maxDepth?: number;
  }): Promise<GraphRagResult> {
    const { query, organizationId, maxEntities = 10, maxDepth = 2 } = input;

    try {
      const { knowledgeGraphService } = await import('./knowledgeGraphService.js');

      const extractedEntities = this.extractQueryEntities(query);

      const entities: GraphRagResult['entities'] = [];
      const relationships: GraphRagResult['relationships'] = [];
      const visited = new Set<string>();

      for (const entityName of extractedEntities) {
        const searchResults = await (knowledgeGraphService as any).searchEntities(
          organizationId,
          entityName,
          undefined,
          5
        );

        for (const entity of searchResults) {
          if (visited.has(entity.id)) continue;
          visited.add(entity.id);

          entities.push({
            name: entity.name,
            type: entity.type,
            relevance: this.computeRelevance(entity.name, query),
            attributes: entity.attributes || {},
          });

          if (entities.length < maxEntities) {
            const relations = await knowledgeGraphService.getRelations(
              organizationId,
              entity.id
            );

            for (const rel of relations) {
              relationships.push({
                from: rel.sourceEntityId || entity.name,
                to: rel.targetEntityId || 'unknown',
                type: (rel as any).type,
                strength: (rel as any).strength || 0.5,
                context: (rel as any).context || undefined,
              });
            }
          }
        }
      }

      entities.sort((a, b) => b.relevance - a.relevance);
      const topEntities = entities.slice(0, maxEntities);

      const contextText = this.buildContextText(topEntities, relationships);

      return {
        entities: topEntities,
        relationships,
        contextText,
        entityCount: topEntities.length,
        relationCount: relationships.length,
      };
    } catch (err: any) {
      logger.warn(`[GraphRAG] Retrieval failed (non-blocking): ${err?.message}`);
      return {
        entities: [],
        relationships: [],
        contextText: '',
        entityCount: 0,
        relationCount: 0,
      };
    }
  }

  async linkEntities(input: {
    vectorResults: Array<{ content: string; metadata?: Record<string, unknown> }>;
    graphEntities: GraphRagResult['entities'];
  }): Promise<Array<{
    content: string;
    linkedEntities: string[];
    enrichedContext?: string;
  }>> {
    return input.vectorResults.map((result) => {
      const contentLower = result.content.toLowerCase();
      const linked = input.graphEntities
        .filter((e) => contentLower.includes(e.name.toLowerCase()))
        .map((e) => e.name);

      const enrichment = linked.length > 0
        ? `\n[Related entities: ${linked.join(', ')}]`
        : '';

      return {
        content: result.content,
        linkedEntities: linked,
        enrichedContext: enrichment || undefined,
      };
    });
  }

  private extractQueryEntities(query: string): string[] {
    const entities: string[] = [];

    const properNouns = query.match(/\b[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,}(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,})*/g) || [];
    entities.push(...properNouns);

    const quotedTerms = query.match(/"([^"]+)"/g) || [];
    entities.push(...quotedTerms.map((t) => t.replace(/"/g, '')));

    const techTerms = query.match(/\b(?:AI|ML|ERP|CRM|SAP|AWS|Azure|GCP|IoT|API)\b/gi) || [];
    entities.push(...techTerms);

    return [...new Set(entities)].slice(0, 8);
  }

  private computeRelevance(entityName: string, query: string): number {
    const nameLower = entityName.toLowerCase();
    const queryLower = query.toLowerCase();

    if (queryLower.includes(nameLower)) return 1.0;

    const nameWords = nameLower.split(/\s+/);
    const queryWords = queryLower.split(/\s+/);
    const overlap = nameWords.filter((w) => queryWords.includes(w)).length;

    return overlap > 0 ? Math.min(1, overlap / nameWords.length) : 0.1;
  }

  private buildContextText(
    entities: GraphRagResult['entities'],
    relationships: GraphRagResult['relationships']
  ): string {
    if (!entities.length) return '';

    const parts: string[] = ['[Knowledge Graph Context]'];

    for (const entity of entities.slice(0, 5)) {
      const attrs = Object.entries(entity.attributes)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .slice(0, 3)
        .join(', ');

      parts.push(`- ${entity.type}: "${entity.name}"${attrs ? ` (${attrs})` : ''}`);
    }

    if (relationships.length > 0) {
      parts.push('\nRelationships:');
      for (const rel of relationships.slice(0, 8)) {
        parts.push(`- ${rel.from} --[${rel.type}]--> ${rel.to}`);
      }
    }

    return parts.join('\n');
  }
}

export const graphRagService = new GraphRagService();
export default graphRagService;
