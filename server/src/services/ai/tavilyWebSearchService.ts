/**
 * Tavily Web Search Service (v2.0)
 *
 * Advanced adapter used by Deep Thinking / Deep Research flows.
 * Provides a stable `search(query, { maxResults, includeNews, searchDepth })` interface.
 *
 * v2.0 changes:
 * - search_depth: 'advanced' for comprehensive results
 * - include_raw_content: true for full page content (not just snippets)
 * - include_answer: true for Tavily's built-in synthesis
 * - Increased default maxResults to 8
 * - Added searchDepth option for caller control
 */
import logger from '../../utils/Logger.js';

export type TavilySearchOptions = {
  maxResults?: number;
  includeNews?: boolean;
  /** 'basic' for fast/cheap, 'advanced' for comprehensive (default: 'advanced') */
  searchDepth?: 'basic' | 'advanced';
};

export type TavilySearchResult = {
  url: string;
  title: string;
  snippet?: string;
  /** Full page content (from raw_content). Available when search_depth is 'advanced'. */
  content?: string;
  score?: number;
  publishedDate?: string;
};

export type TavilySearchResponse = {
  query: string;
  results: TavilySearchResult[];
  /** Tavily's built-in answer synthesis (if available) */
  answer?: string;
};

export class TavilyWebSearchService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, options: TavilySearchOptions = {}): Promise<TavilySearchResponse> {
    const maxResults = Math.max(1, Math.min(15, options.maxResults ?? 8));
    const includeNews = options.includeNews ?? true;
    const searchDepth = options.searchDepth ?? 'advanced';

    const payload = {
      api_key: this.apiKey,
      query,
      max_results: maxResults,
      search_depth: searchDepth,
      include_answer: true,
      include_raw_content: true,
      include_images: false,
      include_domains: [],
      exclude_domains: [],
      // Tavily supports `topic: "news"` for news-focused search.
      ...(includeNews ? {} : { topic: 'general' }),
    };

    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const raw = await resp.text().catch(() => '');
      logger.warn('[Tavily] Search failed', {
        status: resp.status,
        statusText: resp.statusText,
        raw: raw?.slice(0, 500),
      });
      throw new Error(`Tavily search failed: HTTP ${resp.status} ${resp.statusText}`);
    }

    const data = (await resp.json()) as any;
    const results = Array.isArray(data?.results) ? data.results : [];

    return {
      query,
      answer: typeof data?.answer === 'string' ? data.answer : undefined,
      results: results.map((r: any) => ({
        url: String(r.url || ''),
        title: String(r.title || ''),
        snippet: typeof r.content === 'string' ? r.content.slice(0, 500) : String(r.snippet || ''),
        // Full page content: prefer raw_content (complete page), fall back to content (Tavily summary)
        content:
          typeof r.raw_content === 'string'
            ? r.raw_content.slice(0, 8000)
            : typeof r.content === 'string'
              ? r.content
              : undefined,
        score: typeof r.score === 'number' ? r.score : undefined,
        publishedDate: r.published_date ? String(r.published_date) : undefined,
      })),
    };
  }
}

export default TavilyWebSearchService;
