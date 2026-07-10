/**
 * DRD Report — RAG grounding provider (F14 / §7 `_KONCEPT_CONTENT_ENGINES_2026-07-10.md`,
 * decyzja D-E).
 *
 * Wires the "Digital Pathfinder" book — indexed as
 * `knowledge/tool-kb/drd/methodology/v1/*.en.md` by `knowledgeIndexer`
 * (`server/src/services/ai/knowledgeIndexer.ts`, see the `DRD_METHODOLOGY_TOOL_KB_DIR`
 * comment there) — into the DRD report narrator as ADDITIONAL evidence
 * (`type: 'drd_methodology_kb'`), alongside the existing engine-exact evidence
 * (`drd_axis` / `drd_area`) built in `drdReportModel.ts`.
 *
 * This does NOT relax the narrator's hard "liczby TYLKO z silnika" rule
 * (`drdLlmNarrator.ts` → `validateNumbersFromEngine`): book excerpts arrive as
 * evidence/citations for the LLM to reference and quote qualitatively, not as
 * `facts`, so any number the model lifts from a quoted excerpt still fails
 * validation unless it is ALSO present in the engine facts. Grounding only
 * widens what the narrator can CITE, never what it can COMPUTE — same closed-
 * grounding contract, wider evidence set.
 *
 * Fail-safe: any KB/DB failure resolves to `[]` — a report must always render
 * even when the tool-kb pack has not been indexed yet on this environment
 * (indexing is a separate, manually-triggered step — see handoff TODO).
 */
import type { ConclusionEvidenceRef } from './drdConclusionContract.js';

export type DrdGroundingProvider = (
  axisId: number,
  axisName: string
) => Promise<ConclusionEvidenceRef[]>;

export interface BuildDrdGroundingProviderOptions {
  organizationId?: string;
  language: 'pl' | 'en';
  /** Chunks per axis query (evidence, not a corpus dump — keep small). */
  maxChunksPerAxis?: number;
  logger?: { warn?: (msg: string, meta?: unknown) => void };
}

interface SearchKnowledgeBaseResult {
  content: string;
  source: string;
  relevance: number;
  sourceAuthor?: string;
  branded?: boolean;
}

interface SearchKnowledgeBaseFn {
  (
    params: {
      query: string;
      maxResults?: number;
      toolSlug?: string;
      packType?: string;
      language?: string;
    },
    context?: { organizationId?: string }
  ): Promise<{ results: SearchKnowledgeBaseResult[]; totalFound: number }>;
}

function formatCitation(r: SearchKnowledgeBaseResult): string {
  if (r.branded && r.sourceAuthor) return ` (wg „${r.source}", ${r.sourceAuthor})`;
  if (r.source) return ` (${r.source})`;
  return '';
}

/**
 * Build a per-axis grounding lookup backed by `searchKnowledgeBase`
 * (`tool_slug='drd'`, `pack_type='methodology'`). Memoized per axis within one
 * report generation so the exec-summary + chapter + gap-card narrator calls
 * that share an axis do not repeat the retrieval.
 */
export function buildDrdGroundingProvider(
  options: BuildDrdGroundingProviderOptions
): DrdGroundingProvider {
  const { organizationId, language, maxChunksPerAxis = 3, logger } = options;
  const cache = new Map<number, Promise<ConclusionEvidenceRef[]>>();

  return (axisId: number, axisName: string): Promise<ConclusionEvidenceRef[]> => {
    const cached = cache.get(axisId);
    if (cached) return cached;

    const promise = (async (): Promise<ConclusionEvidenceRef[]> => {
      try {
        const mod = await import('../ai/tools/searchKnowledgeBase.js');
        const searchKnowledgeBase = (mod.searchKnowledgeBase ||
          mod.default?.searchKnowledgeBase) as SearchKnowledgeBaseFn;
        if (!searchKnowledgeBase) return [];

        const { results } = await searchKnowledgeBase(
          {
            query: `${axisName} — metodyka, poziomy dojrzałości, dobre praktyki`,
            maxResults: maxChunksPerAxis,
            toolSlug: 'drd',
            packType: 'methodology',
            language,
          },
          { organizationId }
        );

        return results
          .filter((r) => r.content && r.content.trim().length > 0)
          .map((r, idx) => ({
            type: 'drd_methodology_kb',
            ref: `kb-drd-axis${axisId}-${idx}`,
            excerpt: `${r.content.slice(0, 600).trim()}${formatCitation(r)}`,
          }));
      } catch (error) {
        logger?.warn?.('[DrdReportGrounding] KB lookup failed, continuing without grounding', {
          axisId,
          axisName,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    })();

    cache.set(axisId, promise);
    return promise;
  };
}
