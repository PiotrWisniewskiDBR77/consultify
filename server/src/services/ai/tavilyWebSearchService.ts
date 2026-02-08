/**
 * Tavily Web Search Service (MVP)
 *
 * Minimal adapter used by Deep Thinking research flows.
 * Provides a stable `search(query, { maxResults, includeNews })` interface.
 */
import logger from '../../utils/Logger.js';

export type TavilySearchOptions = {
  maxResults?: number;
  includeNews?: boolean;
};

export type TavilySearchResult = {
  url: string;
  title: string;
  snippet?: string;
  content?: string;
  score?: number;
  publishedDate?: string;
};

export type TavilySearchResponse = {
  query: string;
  results: TavilySearchResult[];
};

export class TavilyWebSearchService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, options: TavilySearchOptions = {}): Promise<TavilySearchResponse> {
    const maxResults = Math.max(1, Math.min(10, options.maxResults ?? 5));
    const includeNews = options.includeNews ?? true;

    // Tavily API: https://docs.tavily.com/ (request: query, max_results, search_depth, include_answer, include_raw_content)
    const payload = {
      api_key: this.apiKey,
      query,
      max_results: maxResults,
      search_depth: 'basic',
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      include_domains: [],
      exclude_domains: [],
      // Best-effort: Tavily supports `topic: "news"` for news-focused search in newer versions.
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
      results: results.map((r: any) => ({
        url: String(r.url || ''),
        title: String(r.title || ''),
        snippet: typeof r.content === 'string' ? r.content.slice(0, 300) : String(r.snippet || ''),
        content: typeof r.raw_content === 'string' ? r.raw_content : undefined,
        score: typeof r.score === 'number' ? r.score : undefined,
        publishedDate: r.published_date ? String(r.published_date) : undefined,
      })),
    };
  }
}

export default TavilyWebSearchService;
