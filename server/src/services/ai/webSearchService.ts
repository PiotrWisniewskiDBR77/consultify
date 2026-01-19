/**
 * Web Search Service
 * 
 * Provides web search capabilities using Tavily API for AI context enrichment.
 * Supports caching, rate limiting, and multiple search modes.
 * 
 * @version 1.0.0
 */

import crypto from 'crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface SearchOptions {
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
  includeAnswer?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  topic?: 'general' | 'news';
}

export interface ResearchResult {
  query: string;
  answer?: string;
  results: SearchResult[];
  followUpQuestions?: string[];
  searchDuration: number;
  cached: boolean;
}

export interface FactCheckResult {
  claim: string;
  verdict: 'supported' | 'contradicted' | 'unverified' | 'mixed';
  confidence: number;
  sources: SearchResult[];
  explanation: string;
}

export interface WebSearchConfig {
  provider: 'tavily' | 'perplexity';
  apiKey: string | null;
  maxResultsPerQuery: number;
  cacheTimeMinutes: number;
  rateLimitPerMinute: number;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class WebSearchServiceImpl {
  private static instance: WebSearchServiceImpl;
  private config: WebSearchConfig;
  private requestCount: Map<string, { count: number; resetTime: number }> = new Map();

  private constructor() {
    this.config = {
      provider: (process.env.WEB_SEARCH_PROVIDER as 'tavily' | 'perplexity') || 'tavily',
      apiKey: process.env.TAVILY_API_KEY || process.env.WEB_SEARCH_API_KEY || null,
      maxResultsPerQuery: parseInt(process.env.WEB_SEARCH_MAX_RESULTS || '5', 10),
      cacheTimeMinutes: parseInt(process.env.WEB_SEARCH_CACHE_MINUTES || '60', 10),
      rateLimitPerMinute: parseInt(process.env.WEB_SEARCH_RATE_LIMIT || '30', 10),
    };
  }

  public static getInstance(): WebSearchServiceImpl {
    if (!WebSearchServiceImpl.instance) {
      WebSearchServiceImpl.instance = new WebSearchServiceImpl();
    }
    return WebSearchServiceImpl.instance;
  }

  /**
   * Check if web search is available
   */
  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Get configuration (without sensitive data)
   */
  getConfig(): Omit<WebSearchConfig, 'apiKey'> & { hasApiKey: boolean } {
    return {
      provider: this.config.provider,
      maxResultsPerQuery: this.config.maxResultsPerQuery,
      cacheTimeMinutes: this.config.cacheTimeMinutes,
      rateLimitPerMinute: this.config.rateLimitPerMinute,
      hasApiKey: !!this.config.apiKey,
    };
  }

  // ==========================================
  // SEARCH METHODS
  // ==========================================

  /**
   * Perform a web search
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.isAvailable()) {
      logger.warn('[WebSearchService] API key not configured');
      return [];
    }

    try {
      // Check rate limit
      if (!this.checkRateLimit('search')) {
        logger.warn('[WebSearchService] Rate limit exceeded');
        return [];
      }

      // Check cache
      const cached = await this.getCachedResults(query, options);
      if (cached) {
        logger.info(`[WebSearchService] Cache hit for query: ${query.substring(0, 50)}...`);
        return cached;
      }

      // Perform search
      const results = await this.executeSearch(query, options);

      // Cache results
      await this.cacheResults(query, options, results);

      return results;
    } catch (error: any) {
      logger.error('[WebSearchService] search failed:', error);
      return [];
    }
  }

  /**
   * Research a topic in depth
   */
  async researchTopic(
    topic: string,
    depth: 'quick' | 'deep' = 'quick'
  ): Promise<ResearchResult> {
    const startTime = Date.now();
    const results: SearchResult[] = [];
    const cached = await this.getCachedResults(topic, { searchDepth: depth === 'deep' ? 'advanced' : 'basic' });

    if (cached) {
      return {
        query: topic,
        results: cached,
        searchDuration: Date.now() - startTime,
        cached: true,
      };
    }

    try {
      // Initial search
      const initialResults = await this.search(topic, {
        maxResults: depth === 'deep' ? 10 : 5,
        searchDepth: depth === 'deep' ? 'advanced' : 'basic',
        includeAnswer: true,
      });
      results.push(...initialResults);

      // For deep research, perform follow-up searches
      if (depth === 'deep' && initialResults.length > 0) {
        const followUpQueries = this.generateFollowUpQueries(topic, initialResults);
        
        for (const followUpQuery of followUpQueries.slice(0, 3)) {
          const followUpResults = await this.search(followUpQuery, {
            maxResults: 3,
            searchDepth: 'basic',
          });
          results.push(...followUpResults);
        }
      }

      // Deduplicate by URL
      const uniqueResults = this.deduplicateResults(results);

      return {
        query: topic,
        results: uniqueResults,
        searchDuration: Date.now() - startTime,
        cached: false,
        followUpQuestions: depth === 'deep' ? this.generateFollowUpQueries(topic, uniqueResults) : undefined,
      };
    } catch (error: any) {
      logger.error('[WebSearchService] researchTopic failed:', error);
      return {
        query: topic,
        results: [],
        searchDuration: Date.now() - startTime,
        cached: false,
      };
    }
  }

  /**
   * Verify a factual claim
   */
  async verifyFact(claim: string): Promise<FactCheckResult> {
    try {
      const searchResults = await this.search(`fact check: ${claim}`, {
        maxResults: 5,
        searchDepth: 'advanced',
        topic: 'news',
      });

      // Simple verdict based on content analysis
      let supportCount = 0;
      let contradictCount = 0;

      for (const result of searchResults) {
        const contentLower = result.content.toLowerCase();
        const claimLower = claim.toLowerCase();

        // Simple keyword matching (in production, use AI for this)
        if (contentLower.includes('true') || contentLower.includes('confirmed') || contentLower.includes('verified')) {
          supportCount++;
        } else if (contentLower.includes('false') || contentLower.includes('debunked') || contentLower.includes('misleading')) {
          contradictCount++;
        }
      }

      let verdict: FactCheckResult['verdict'] = 'unverified';
      let confidence = 0.3;

      if (supportCount > contradictCount && supportCount >= 2) {
        verdict = 'supported';
        confidence = Math.min(0.9, 0.5 + (supportCount * 0.1));
      } else if (contradictCount > supportCount && contradictCount >= 2) {
        verdict = 'contradicted';
        confidence = Math.min(0.9, 0.5 + (contradictCount * 0.1));
      } else if (supportCount > 0 && contradictCount > 0) {
        verdict = 'mixed';
        confidence = 0.5;
      }

      return {
        claim,
        verdict,
        confidence,
        sources: searchResults,
        explanation: `Based on ${searchResults.length} sources: ${supportCount} supporting, ${contradictCount} contradicting.`,
      };
    } catch (error: any) {
      logger.error('[WebSearchService] verifyFact failed:', error);
      return {
        claim,
        verdict: 'unverified',
        confidence: 0,
        sources: [],
        explanation: 'Unable to verify due to search error.',
      };
    }
  }

  // ==========================================
  // CONTEXT BUILDING
  // ==========================================

  /**
   * Build web search context for AI prompts
   */
  async buildWebContext(
    query: string,
    organizationContext?: { name?: string; industry?: string }
  ): Promise<string> {
    try {
      // Enhance query with organization context
      let enhancedQuery = query;
      if (organizationContext?.industry) {
        enhancedQuery = `${query} in ${organizationContext.industry} industry`;
      }

      const results = await this.search(enhancedQuery, {
        maxResults: 5,
        searchDepth: 'basic',
      });

      if (results.length === 0) {
        return '';
      }

      // Format results for AI context
      const lines: string[] = ['## Web Search Results'];
      lines.push(`Query: "${query}"`);
      lines.push('');

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        lines.push(`### Source ${i + 1}: ${result.title}`);
        lines.push(`URL: ${result.url}`);
        lines.push(result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''));
        lines.push('');
      }

      return lines.join('\n');
    } catch (error: any) {
      logger.error('[WebSearchService] buildWebContext failed:', error);
      return '';
    }
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  private async executeSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    if (this.config.provider === 'tavily') {
      return this.searchWithTavily(query, options);
    }
    // Add other providers here
    return [];
  }

  private async searchWithTavily(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const url = 'https://api.tavily.com/search';
    
    const body = {
      api_key: this.config.apiKey,
      query,
      search_depth: options.searchDepth || 'basic',
      max_results: options.maxResults || this.config.maxResultsPerQuery,
      include_answer: options.includeAnswer ?? false,
      include_domains: options.includeDomains,
      exclude_domains: options.excludeDomains,
      topic: options.topic || 'general',
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.results || []).map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        content: r.content || r.snippet || '',
        score: r.score || 0,
        publishedDate: r.published_date,
      }));
    } catch (error: any) {
      logger.error('[WebSearchService] Tavily search failed:', error);
      return [];
    }
  }

  private checkRateLimit(operation: string): boolean {
    const key = operation;
    const now = Date.now();
    const limit = this.requestCount.get(key);

    if (!limit || now > limit.resetTime) {
      this.requestCount.set(key, {
        count: 1,
        resetTime: now + 60000, // 1 minute window
      });
      return true;
    }

    if (limit.count >= this.config.rateLimitPerMinute) {
      return false;
    }

    limit.count++;
    return true;
  }

  private async getCachedResults(query: string, options: SearchOptions): Promise<SearchResult[] | null> {
    try {
      const queryHash = this.hashQuery(query, options);
      const row = await dbGet(
        `SELECT results FROM ai_web_search_cache 
         WHERE query_hash = ? AND expires_at > datetime('now')`,
        [queryHash]
      );

      if (row) {
        // Update hit count
        await dbRun(
          `UPDATE ai_web_search_cache SET hit_count = hit_count + 1 WHERE query_hash = ?`,
          [queryHash]
        );
        return JSON.parse((row as any).results);
      }

      return null;
    } catch (error: any) {
      logger.warn('[WebSearchService] Cache read failed:', error.message);
      return null;
    }
  }

  private async cacheResults(query: string, options: SearchOptions, results: SearchResult[]): Promise<void> {
    try {
      const queryHash = this.hashQuery(query, options);
      const expiresAt = new Date(Date.now() + this.config.cacheTimeMinutes * 60000).toISOString();

      await dbRun(
        `INSERT OR REPLACE INTO ai_web_search_cache (
          id, query_hash, query, results, provider, result_count, search_options, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `cache-${crypto.randomUUID()}`,
          queryHash,
          query,
          JSON.stringify(results),
          this.config.provider,
          results.length,
          JSON.stringify(options),
          expiresAt,
          new Date().toISOString(),
        ]
      );
    } catch (error: any) {
      logger.warn('[WebSearchService] Cache write failed:', error.message);
    }
  }

  private hashQuery(query: string, options: SearchOptions): string {
    const data = JSON.stringify({ query: query.toLowerCase().trim(), options });
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  private generateFollowUpQueries(topic: string, results: SearchResult[]): string[] {
    const followUps: string[] = [];

    // Extract common themes from results
    const allContent = results.map(r => r.title + ' ' + r.content).join(' ').toLowerCase();
    
    // Simple pattern-based follow-up generation
    if (allContent.includes('trend')) {
      followUps.push(`${topic} latest trends 2026`);
    }
    if (allContent.includes('challenge') || allContent.includes('problem')) {
      followUps.push(`${topic} challenges solutions`);
    }
    if (allContent.includes('best practice')) {
      followUps.push(`${topic} best practices guide`);
    }
    if (allContent.includes('case study') || allContent.includes('example')) {
      followUps.push(`${topic} case studies`);
    }

    return followUps.slice(0, 3);
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache(): Promise<number> {
    try {
      const result = await dbRun(
        `DELETE FROM ai_web_search_cache WHERE expires_at < datetime('now')`
      );
      return (result as any)?.changes || 0;
    } catch (error: any) {
      logger.error('[WebSearchService] cleanExpiredCache failed:', error);
      return 0;
    }
  }
}

// ==========================================
// EXPORTS
// ==========================================

export const WebSearchService = WebSearchServiceImpl.getInstance();
export default WebSearchService;
