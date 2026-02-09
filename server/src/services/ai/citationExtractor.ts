/**
 * Citation Extractor Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Extracts structured citations from AI responses.
 */
import logger from '../../utils/Logger.js';

export interface Citation {
  id: string;
  index: number;
  text: string;
  sourceType:
    | 'assessment'
    | 'initiative'
    | 'report'
    | 'roadmap'
    | 'external'
    | 'document'
    | 'knowledge';
  sourceId?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  confidence: number;
  startOffset?: number;
  endOffset?: number;
}

export interface CitationExtractionResult {
  citations: Citation[];
  totalFound: number;
  verified: number;
  unverified: number;
  textWithMarkers: string;
}

const NUMERIC_RE = /\[(\d{1,3})\]/g;
const NAMED_RE = /\[(Source|Ref|Reference|Doc):\s*([^\]]+)\]/gi;
const URL_RE = /https?:\/\/[^\s\])]+/g;

class CitationExtractorService {
  extract(
    responseText: string,
    knowledgeSources: Array<{ id: string; title: string; type: string; url?: string }> = [],
    ragChunks: Array<{ text: string; metadata?: Record<string, unknown> }> = []
  ): CitationExtractionResult {
    const citations: Citation[] = [];
    let idx = 0;

    for (const m of responseText.matchAll(NUMERIC_RE)) {
      const num = parseInt(m[1], 10);
      const src = ragChunks.length >= num ? ragChunks[num - 1] : null;
      const meta = src?.metadata || {};
      citations.push({
        id: `cit_${++idx}`,
        index: num,
        text: m[0],
        sourceType: (meta.sourceType as any) || 'document',
        sourceId: (meta.documentId as string) || `rag_${num}`,
        sourceTitle: (meta.title as string) || `Source ${num}`,
        sourceUrl: meta.url as string | undefined,
        confidence: src ? 0.85 : 0.3,
        startOffset: m.index,
        endOffset: m.index != null ? m.index + m[0].length : undefined,
      });
    }

    for (const m of responseText.matchAll(NAMED_RE)) {
      const title = m[2].trim();
      const src = knowledgeSources.find((s) => s.title.toLowerCase().includes(title.toLowerCase()));
      citations.push({
        id: `cit_${++idx}`,
        index: idx,
        text: m[0],
        sourceType: (src?.type as any) || 'document',
        sourceId: src?.id,
        sourceTitle: src?.title || title,
        sourceUrl: src?.url,
        confidence: src ? 0.9 : 0.5,
        startOffset: m.index,
        endOffset: m.index != null ? m.index + m[0].length : undefined,
      });
    }

    for (const m of responseText.matchAll(URL_RE)) {
      if (citations.some((c) => c.sourceUrl === m[0])) continue;
      let domain = m[0];
      try {
        domain = new URL(m[0]).hostname;
      } catch {
        /* keep raw */
      }
      citations.push({
        id: `cit_${++idx}`,
        index: idx,
        text: m[0],
        sourceType: 'external',
        sourceUrl: m[0],
        sourceTitle: domain,
        confidence: 0.7,
        startOffset: m.index,
        endOffset: m.index != null ? m.index + m[0].length : undefined,
      });
    }

    const seen = new Set<string>();
    const deduped = citations.filter((c) => {
      const k = c.sourceId || c.sourceUrl || c.text;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const verified = deduped.filter((c) => c.confidence >= 0.7).length;

    logger.debug(`[CitationExtractor] ${deduped.length} citations (${verified} verified)`);
    return {
      citations: deduped,
      totalFound: deduped.length,
      verified,
      unverified: deduped.length - verified,
      textWithMarkers: responseText,
    };
  }
}

export const citationExtractor = new CitationExtractorService();
export default citationExtractor;
export { CitationExtractorService };
