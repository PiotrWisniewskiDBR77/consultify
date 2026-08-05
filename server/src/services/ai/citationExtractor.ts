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
    | 'knowledge'
    | 'system_doc'
    | 'core_doc';
  sourceId?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  confidence: number;
  startOffset?: number;
  endOffset?: number;
  /**
   * M01-P04B (GF-CHAT-02, fragment anchor): real ordinal position of the cited
   * chunk within its SOURCE document (`knowledge_chunks.chunk_index`, threaded
   * through `ragService.searchRelevantChunks`/`hybridSearch`). Distinct from
   * `startOffset`/`endOffset` above, which locate the citation MARKER inside the
   * AI *response* text, not the fragment inside the *source*. `undefined` when
   * no chunk-backed source is available — MUST NOT be fabricated as `0`, which
   * would make every citation appear to anchor to the same (first) fragment.
   */
  fragmentIndex?: number;
  /**
   * Real retrieved chunk text (not the marker `text` above) — the actual
   * fragment content a "open fragment" UI shows. Truncated defensively by
   * the caller before it reaches the client.
   */
  fragmentExcerpt?: string;
}

export interface CitationExtractionResult {
  citations: Citation[];
  totalFound: number;
  verified: number;
  unverified: number;
  textWithMarkers: string;
}

const NUMERIC_RE = /\[(\d{1,3})\]/g;
const ATTACHMENT_RE = /\[A(\d{1,3})\]/gi;
const NAMED_RE = /\[(Source|Ref|Reference|Doc):\s*([^\]]+)\]/gi;
const URL_RE = /https?:\/\/[^\s\])]+/g;

function resolveCitationTitle(meta: Record<string, unknown>, num: number, source?: any): string {
  const candidates = [
    meta.title,
    meta.documentTitle,
    meta.fileName,
    meta.filename,
    meta.sourceName,
    source?.source,
    source?.filename,
  ];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const title = value.trim();
    if (title && !/^source\s+\d+$/i.test(title) && !/^rag_\d+$/i.test(title)) return title;
  }
  const sourceType = typeof meta.sourceType === 'string' ? meta.sourceType : '';
  if (sourceType === 'external' || typeof meta.url === 'string') return `External source ${num}`;
  if (sourceType === 'document' || sourceType === 'attachment') return `Attached document ${num}`;
  return `Knowledge base source ${num}`;
}

class CitationExtractorService {
  extract(
    responseText: string,
    knowledgeSources: Array<{ id: string; title: string; type: string; url?: string }> = [],
    ragChunks: Array<{
      text?: string;
      /** Real chunk content — the field actually returned by ragService (`content`, not `text`). */
      content?: string;
      /** Real chunk ordinal from `knowledge_chunks.chunk_index` — see `Citation.fragmentIndex`. */
      chunkIndex?: number;
      metadata?: Record<string, unknown>;
    }> = []
  ): CitationExtractionResult {
    const citations: Citation[] = [];
    let idx = 0;

    // Fragment anchor helpers (M01-P04B / GF-CHAT-02): a chunk-backed source
    // contributes a real fragment position + excerpt. `fragmentIndex` is left
    // `undefined` (never `0`) when no chunk data is available — a constant `0`
    // would make every citation look like it anchors to the same fragment.
    const fragmentFor = (src: (typeof ragChunks)[number] | null | undefined) => {
      if (!src) return { fragmentIndex: undefined, fragmentExcerpt: undefined };
      const rawExcerpt = typeof src.content === 'string' ? src.content : src.text;
      return {
        fragmentIndex: typeof src.chunkIndex === 'number' ? src.chunkIndex : undefined,
        fragmentExcerpt:
          typeof rawExcerpt === 'string' && rawExcerpt.trim()
            ? rawExcerpt.trim().slice(0, 500)
            : undefined,
      };
    };

    for (const m of responseText.matchAll(ATTACHMENT_RE)) {
      const num = parseInt(m[1], 10);
      const src = ragChunks.length >= num ? ragChunks[num - 1] : null;
      const meta = src?.metadata || {};
      citations.push({
        id: `cit_${++idx}`,
        index: num,
        text: m[0],
        sourceType: 'document',
        sourceId:
          (meta.documentId as string) ||
          (meta.sourceId as string) ||
          ((src as any)?.documentId as string) ||
          undefined,
        sourceTitle: resolveCitationTitle(meta, num, src),
        sourceUrl: meta.url as string | undefined,
        confidence: src ? 0.9 : 0.35,
        startOffset: m.index,
        endOffset: m.index != null ? m.index + m[0].length : undefined,
        ...fragmentFor(src),
      });
    }

    for (const m of responseText.matchAll(NUMERIC_RE)) {
      const num = parseInt(m[1], 10);
      const src = ragChunks.length >= num ? ragChunks[num - 1] : null;
      const meta = src?.metadata || {};
      citations.push({
        id: `cit_${++idx}`,
        index: num,
        text: m[0],
        sourceType: (meta.sourceType as any) || 'document',
        sourceId: (meta.documentId as string) || (meta.sourceId as string) || undefined,
        sourceTitle: resolveCitationTitle(meta, num, src),
        sourceUrl: meta.url as string | undefined,
        confidence: src ? 0.85 : 0.3,
        startOffset: m.index,
        endOffset: m.index != null ? m.index + m[0].length : undefined,
        ...fragmentFor(src),
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
      // M01-P04B: the key MUST include `fragmentIndex` when present. Before
      // this fix, two markers citing DIFFERENT fragments of the SAME
      // document (same `sourceId`) collapsed into a single citation here —
      // the second fragment silently vanished. That directly defeats
      // GF-CHAT-02 (each cited passage should be distinguishable): a
      // response quoting two different passages of one document would only
      // ever show/anchor the first.
      const base = c.sourceId || c.sourceUrl || c.text;
      const k = typeof c.fragmentIndex === 'number' ? `${base}#frag${c.fragmentIndex}` : base;
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
