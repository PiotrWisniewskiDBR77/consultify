/**
 * Deep Research Service
 * 
 * Provides multi-query aggregation for comprehensive research
 * Similar to Perplexity Pro's deep research mode.
 * 
 * FLOW-AI-RESEARCH: Deep research with multi-query aggregation
 */

import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface ResearchQuery {
  id: string;
  query: string;
  purpose: string;
  status: 'pending' | 'searching' | 'done' | 'error';
  results?: SearchResult[];
  error?: string;
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  content?: string;
  relevanceScore: number;
  publishedDate?: string;
  source: string;
}

export interface Source {
  url: string;
  title: string;
  domain: string;
  relevanceScore: number;
  snippets: string[];
  accessedAt: Date;
}

export interface Citation {
  id: string;
  sourceIndex: number;
  text: string;
  url: string;
  title: string;
}

export interface ResearchResult {
  query: string;
  sources: Source[];
  summary: string;
  confidence: number;
}

export interface DeepResearchOutput {
  topic: string;
  queries: ResearchQuery[];
  results: ResearchResult[];
  synthesis: string;
  citations: Citation[];
  sources: Source[];
  metadata: {
    totalSources: number;
    uniqueDomains: number;
    averageConfidence: number;
    researchDuration: number;
    queriesExecuted: number;
  };
}

export interface DeepResearchOptions {
  maxQueries?: number;
  maxSourcesPerQuery?: number;
  minRelevanceScore?: number;
  includeNewsResults?: boolean;
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  language?: string;
}

// ==========================================
// DEFAULT OPTIONS
// ==========================================

const DEFAULT_OPTIONS: DeepResearchOptions = {
  maxQueries: 8,
  maxSourcesPerQuery: 5,
  minRelevanceScore: 0.6,
  includeNewsResults: true,
  timeRange: 'all',
  language: 'en',
};

// ==========================================
// QUERY GENERATION
// ==========================================

/**
 * Generate sub-queries for comprehensive research
 */
async function generateSubQueries(
  topic: string,
  options: DeepResearchOptions,
  llmClient?: any
): Promise<ResearchQuery[]> {
  const maxQueries = options.maxQueries || DEFAULT_OPTIONS.maxQueries!;

  // If no LLM client, use template-based query generation
  if (!llmClient) {
    return generateTemplateQueries(topic, maxQueries);
  }

  try {
    const prompt = `Given the research topic: "${topic}"
    
Generate ${maxQueries} specific search queries that would help comprehensively research this topic.
Each query should explore a different aspect:
1. Definitions and basic concepts
2. Current state and recent developments
3. Key players/organizations involved
4. Statistics and data
5. Challenges and problems
6. Solutions and best practices
7. Future trends and predictions
8. Case studies and examples

Return as JSON array with format:
[{"query": "search query text", "purpose": "what this query aims to find"}]`;

    const response = await llmClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '[]';
    const parsed = JSON.parse(content);
    const queries = Array.isArray(parsed) ? parsed : parsed.queries || [];

    return queries.slice(0, maxQueries).map((q: any, i: number) => ({
      id: `query-${i + 1}`,
      query: q.query,
      purpose: q.purpose || 'General research',
      status: 'pending' as const,
    }));
  } catch (error) {
    logger.error('[DeepResearch] Query generation failed:', error);
    return generateTemplateQueries(topic, maxQueries);
  }
}

/**
 * Generate template-based queries when LLM is not available
 */
function generateTemplateQueries(topic: string, maxQueries: number): ResearchQuery[] {
  const templates = [
    { template: 'What is {topic}', purpose: 'Basic definition and overview' },
    { template: '{topic} latest news 2024', purpose: 'Recent developments' },
    { template: '{topic} statistics data', purpose: 'Quantitative information' },
    { template: '{topic} best practices guide', purpose: 'Practical recommendations' },
    { template: '{topic} challenges problems', purpose: 'Issues and obstacles' },
    { template: '{topic} future trends predictions', purpose: 'Forward-looking insights' },
    { template: '{topic} case study examples', purpose: 'Real-world applications' },
    { template: '{topic} comparison alternatives', purpose: 'Competitive landscape' },
    { template: '{topic} expert opinions', purpose: 'Authority perspectives' },
    { template: '{topic} implementation guide how to', purpose: 'Actionable guidance' },
  ];

  return templates.slice(0, maxQueries).map((t, i) => ({
    id: `query-${i + 1}`,
    query: t.template.replace('{topic}', topic),
    purpose: t.purpose,
    status: 'pending' as const,
  }));
}

// ==========================================
// SEARCH EXECUTION
// ==========================================

/**
 * Execute a single search query using web search service
 */
async function executeQuery(
  query: ResearchQuery,
  webSearchService: any,
  options: DeepResearchOptions
): Promise<ResearchQuery> {
  try {
    query.status = 'searching';

    const searchResults = await webSearchService.search(query.query, {
      maxResults: options.maxSourcesPerQuery || 5,
      includeNews: options.includeNewsResults,
    });

    query.results = searchResults.results.map((r: any) => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet || r.content?.slice(0, 300) || '',
      content: r.content,
      relevanceScore: r.score || 0.5,
      publishedDate: r.publishedDate,
      source: new URL(r.url).hostname,
    }));

    query.status = 'done';
    return query;
  } catch (error: any) {
    query.status = 'error';
    query.error = error.message;
    logger.error(`[DeepResearch] Query failed: ${query.query}`, error);
    return query;
  }
}

/**
 * Execute all queries in parallel with rate limiting
 */
async function executeAllQueries(
  queries: ResearchQuery[],
  webSearchService: any,
  options: DeepResearchOptions,
  onProgress?: (queries: ResearchQuery[]) => void
): Promise<ResearchQuery[]> {
  const BATCH_SIZE = 3;
  const results: ResearchQuery[] = [];

  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((q) => executeQuery(q, webSearchService, options))
    );
    results.push(...batchResults);

    if (onProgress) {
      onProgress([...results, ...queries.slice(i + BATCH_SIZE)]);
    }

    if (i + BATCH_SIZE < queries.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}

// ==========================================
// RESULT PROCESSING
// ==========================================

/**
 * Deduplicate and aggregate sources
 */
function aggregateSources(queries: ResearchQuery[], options: DeepResearchOptions): Source[] {
  const sourceMap = new Map<string, Source>();
  const minScore = options.minRelevanceScore || 0.6;

  for (const query of queries) {
    if (!query.results) continue;

    for (const result of query.results) {
      if (result.relevanceScore < minScore) continue;

      const key = result.url;
      if (sourceMap.has(key)) {
        const existing = sourceMap.get(key)!;
        existing.snippets.push(result.snippet);
        existing.relevanceScore = Math.max(existing.relevanceScore, result.relevanceScore);
      } else {
        sourceMap.set(key, {
          url: result.url,
          title: result.title,
          domain: result.source,
          relevanceScore: result.relevanceScore,
          snippets: [result.snippet],
          accessedAt: new Date(),
        });
      }
    }
  }

  return Array.from(sourceMap.values())
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 20);
}

/**
 * Build research results from queries
 */
function buildResults(queries: ResearchQuery[]): ResearchResult[] {
  return queries
    .filter((q) => q.status === 'done' && q.results && q.results.length > 0)
    .map((q) => ({
      query: q.query,
      sources: q.results!.map((r) => ({
        url: r.url,
        title: r.title,
        domain: r.source,
        relevanceScore: r.relevanceScore,
        snippets: [r.snippet],
        accessedAt: new Date(),
      })),
      summary: q.results!.map((r) => r.snippet).join(' '),
      confidence: q.results!.reduce((acc, r) => acc + r.relevanceScore, 0) / q.results!.length,
    }));
}

/**
 * Generate citations from sources
 */
function generateCitations(sources: Source[]): Citation[] {
  return sources.map((source, index) => ({
    id: `cite-${index + 1}`,
    sourceIndex: index + 1,
    text: source.snippets[0] || source.title,
    url: source.url,
    title: source.title,
  }));
}

// ==========================================
// SYNTHESIS
// ==========================================

/**
 * Synthesize research findings using LLM
 */
async function synthesizeFindings(
  topic: string,
  results: ResearchResult[],
  sources: Source[],
  llmClient?: any
): Promise<string> {
  if (!llmClient) {
    return results.map((r) => r.summary).join('\n\n');
  }

  try {
    const sourceSummaries = sources.slice(0, 10).map((s, i) => 
      `[${i + 1}] ${s.title}: ${s.snippets[0]}`
    ).join('\n\n');

    const prompt = `Based on the following research about "${topic}", synthesize a comprehensive summary:

${sourceSummaries}

Provide:
1. Key findings (3-5 bullet points)
2. Main themes and patterns
3. Notable insights
4. Areas of consensus/disagreement
5. Gaps in the research

Use citation numbers [1], [2], etc. to reference sources.`;

    const response = await llmClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    logger.error('[DeepResearch] Synthesis failed:', error);
    return results.map((r) => r.summary).join('\n\n');
  }
}

// ==========================================
// MAIN SERVICE
// ==========================================

/**
 * Conduct deep research on a topic
 */
export async function conductDeepResearch(
  topic: string,
  options: DeepResearchOptions = {},
  dependencies?: {
    webSearchService?: any;
    llmClient?: any;
    onProgress?: (status: { stage: string; queries: ResearchQuery[] }) => void;
  }
): Promise<DeepResearchOutput> {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const { webSearchService, llmClient, onProgress } = dependencies || {};

  logger.info(`[DeepResearch] Starting research on: ${topic}`);

  onProgress?.({ stage: 'generating_queries', queries: [] });
  const queries = await generateSubQueries(topic, mergedOptions, llmClient);
  
  logger.info(`[DeepResearch] Generated ${queries.length} queries`);
  onProgress?.({ stage: 'queries_ready', queries });

  let executedQueries = queries;
  if (webSearchService) {
    onProgress?.({ stage: 'searching', queries });
    executedQueries = await executeAllQueries(
      queries,
      webSearchService,
      mergedOptions,
      (q) => onProgress?.({ stage: 'searching', queries: q })
    );
  }

  onProgress?.({ stage: 'aggregating', queries: executedQueries });
  const sources = aggregateSources(executedQueries, mergedOptions);
  const results = buildResults(executedQueries);
  const citations = generateCitations(sources);

  logger.info(`[DeepResearch] Aggregated ${sources.length} unique sources`);

  onProgress?.({ stage: 'synthesizing', queries: executedQueries });
  const synthesis = await synthesizeFindings(topic, results, sources, llmClient);

  const duration = Date.now() - startTime;
  const uniqueDomains = new Set(sources.map((s) => s.domain)).size;
  const avgConfidence = results.length > 0
    ? results.reduce((acc, r) => acc + r.confidence, 0) / results.length
    : 0;

  const output: DeepResearchOutput = {
    topic,
    queries: executedQueries,
    results,
    synthesis,
    citations,
    sources,
    metadata: {
      totalSources: sources.length,
      uniqueDomains,
      averageConfidence: avgConfidence,
      researchDuration: duration,
      queriesExecuted: executedQueries.filter((q) => q.status === 'done').length,
    },
  };

  logger.info(`[DeepResearch] Completed in ${duration}ms with ${sources.length} sources`);
  
  return output;
}

// ==========================================
// EXPORTS
// ==========================================

export const deepResearchService = {
  conductDeepResearch,
  generateSubQueries,
  aggregateSources,
};

export default deepResearchService;
