/**
 * Deep Research Service v2.0
 *
 * Comprehensive multi-query research with iterative deepening.
 * Inspired by ChatGPT Research, Claude Web Search, and Gemini Deep Think.
 *
 * v2.0 changes:
 * - Iterative deepening: 2 rounds of queries (broad → targeted follow-ups)
 * - Task-specific synthesis prompts (competitive analysis, market entry, etc.)
 * - Full page content support (from Tavily raw_content)
 * - Dynamic model selection via modelRouter (strong model for synthesis)
 * - Organization context injection for personalized research
 * - Increased source limits (30 sources, 2000 chars per source)
 * - Tavily answer integration
 *
 * FLOW-AI-RESEARCH: Deep research with multi-query aggregation + iterative deepening
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
  /** 'initial' for first round, 'followup' for iterative deepening round */
  round: 'initial' | 'followup';
  results?: SearchResult[];
  error?: string;
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  /** Full page content (when available from Tavily advanced search) */
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
  /** Full page content (truncated to maxContentLength) */
  fullContent?: string;
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
  /** Tavily's built-in answer (if available) */
  tavilyAnswer?: string;
  /** Detected research type */
  researchType?: ResearchType;
  metadata: {
    totalSources: number;
    uniqueDomains: number;
    averageConfidence: number;
    researchDuration: number;
    queriesExecuted: number;
    /** Number of iterative deepening rounds */
    rounds: number;
  };
}

export interface DeepResearchOptions {
  maxQueries?: number;
  maxSourcesPerQuery?: number;
  minRelevanceScore?: number;
  includeNewsResults?: boolean;
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  language?: string;
  /** Enable iterative deepening (2nd round of targeted queries). Default: true */
  iterativeDeepening?: boolean;
  /** Max follow-up queries in 2nd round. Default: 5 */
  maxFollowUpQueries?: number;
  /** Organization context for personalized research */
  orgContext?: {
    industry?: string;
    region?: string;
    maturityLevel?: string;
    organizationName?: string;
    terminology?: Record<string, string>;
  };
  /** Clarification answers from user (used to focus queries) */
  clarificationAnswers?: Record<string, string>;
}

export type ResearchType =
  | 'competitive_analysis'
  | 'market_entry'
  | 'technology_comparison'
  | 'industry_analysis'
  | 'company_research'
  | 'general_research';

// ==========================================
// DEFAULT OPTIONS
// ==========================================

const DEFAULT_OPTIONS: DeepResearchOptions = {
  maxQueries: 8,
  maxSourcesPerQuery: 8,
  minRelevanceScore: 0.4,
  includeNewsResults: true,
  timeRange: 'all',
  language: 'en',
  iterativeDeepening: true,
  maxFollowUpQueries: 5,
};

// ==========================================
// RESEARCH TYPE DETECTION
// ==========================================

/**
 * Detect the type of research based on the topic/query
 */
function detectResearchType(topic: string): ResearchType {
  const lower = topic.toLowerCase();

  // Competitive analysis patterns
  if (
    lower.includes('konkurenc') ||
    lower.includes('competitor') ||
    lower.includes('competitive') ||
    lower.includes('analiza rynku') ||
    lower.includes('market analysis') ||
    lower.includes('rywalizacja') ||
    lower.includes('swot')
  ) {
    return 'competitive_analysis';
  }

  // Market entry patterns
  if (
    lower.includes('wejście na rynek') ||
    lower.includes('market entry') ||
    lower.includes('go-to-market') ||
    lower.includes('gtm') ||
    lower.includes('expansion') ||
    lower.includes('ekspansj') ||
    lower.includes('jak wejść') ||
    lower.includes('how to enter')
  ) {
    return 'market_entry';
  }

  // Technology comparison
  if (
    lower.includes('porównanie') ||
    lower.includes('compare') ||
    lower.includes('vs ') ||
    lower.includes(' versus ') ||
    lower.includes('comparison') ||
    lower.includes('alternatyw') ||
    lower.includes('alternative')
  ) {
    return 'technology_comparison';
  }

  // Industry analysis
  if (
    lower.includes('branża') ||
    lower.includes('industry') ||
    lower.includes('sektor') ||
    lower.includes('sector') ||
    lower.includes('trend') ||
    lower.includes('rynek') ||
    lower.includes('market size')
  ) {
    return 'industry_analysis';
  }

  // Company research
  if (
    lower.includes('firma') ||
    lower.includes('company') ||
    lower.includes('startup') ||
    lower.includes('organization') ||
    lower.includes('profil') ||
    lower.includes('profile')
  ) {
    return 'company_research';
  }

  return 'general_research';
}

// ==========================================
// QUERY GENERATION
// ==========================================

/**
 * Generate context-aware, topic-specific sub-queries
 */
async function generateSubQueries(
  topic: string,
  researchType: ResearchType,
  options: DeepResearchOptions,
  llmClient?: any
): Promise<ResearchQuery[]> {
  const maxQueries = options.maxQueries || DEFAULT_OPTIONS.maxQueries!;

  if (!llmClient) {
    return generateTemplateQueries(topic, maxQueries, researchType);
  }

  try {
    const orgContextBlock = options.orgContext
      ? `\nOrganization context:
- Industry: ${options.orgContext.industry || 'Unknown'}
- Region: ${options.orgContext.region || 'Global'}
- Maturity level: ${options.orgContext.maturityLevel || 'Unknown'}
- Name: ${options.orgContext.organizationName || 'Unknown'}`
      : '';

    const clarificationBlock = options.clarificationAnswers
      ? `\nUser clarifications:\n${Object.entries(options.clarificationAnswers)
          .map(([q, a]) => `- ${q}: ${a}`)
          .join('\n')}`
      : '';

    const typeInstructions = getQueryGenerationInstructions(researchType);

    const prompt = `You are a research strategist. Generate ${maxQueries} highly specific, targeted search queries for this research topic.

Topic: "${topic}"
Research type: ${researchType}
${orgContextBlock}${clarificationBlock}

${typeInstructions}

CRITICAL RULES:
- Each query MUST include specific names (companies, products, regions, technologies) mentioned in the topic.
- NO generic queries like "What is [topic]". Every query must be targeted and specific.
- Include location-specific queries if a region is mentioned.
- Include queries for financial data, market size, and recent news.
- Use the current year (2026) in queries about recent developments.

Return as JSON object: {"queries": [{"query": "specific search query", "purpose": "what this finds"}]}`;

    const response = await llmClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const queries = Array.isArray(parsed) ? parsed : parsed.queries || [];

    return queries.slice(0, maxQueries).map((q: any, i: number) => ({
      id: `query-${i + 1}`,
      query: q.query,
      purpose: q.purpose || 'Targeted research',
      status: 'pending' as const,
      round: 'initial' as const,
    }));
  } catch (error) {
    logger.error('[DeepResearch] Query generation failed:', error);
    return generateTemplateQueries(topic, maxQueries, researchType);
  }
}

/**
 * Type-specific instructions for query generation
 */
function getQueryGenerationInstructions(type: ResearchType): string {
  const instructions: Record<ResearchType, string> = {
    competitive_analysis: `Generate queries that cover:
1. Direct competitors by name (search for "[company] competitors" and specific company names)
2. Market share data and financial information
3. Product/service comparisons and feature matrices
4. Customer reviews and case studies of competitors
5. Recent funding rounds, acquisitions, and partnerships
6. Pricing models and go-to-market strategies
7. Technology stack and differentiators
8. SWOT analysis elements and market positioning`,

    market_entry: `Generate queries that cover:
1. Target market size, growth rate, and key players
2. Local regulations, compliance requirements, and standards
3. Distribution channels and partnership opportunities
4. Local events, conferences, and industry associations
5. Economic incentives, grants, and tax benefits for the region
6. Cultural and business practice considerations
7. Existing competitors in the target market
8. Success stories of similar market entries`,

    technology_comparison: `Generate queries that cover:
1. Feature-by-feature comparison of each technology
2. Pricing and licensing models
3. Performance benchmarks and case studies
4. Integration capabilities and ecosystem
5. User reviews and satisfaction scores
6. Vendor stability and roadmap
7. Implementation complexity and timeline
8. Industry-specific use cases`,

    industry_analysis: `Generate queries that cover:
1. Industry size, growth projections, and market trends
2. Key players and market concentration
3. Technology disruptions and innovation trends
4. Regulatory landscape and compliance requirements
5. Supply chain dynamics and challenges
6. Workforce and talent availability
7. Investment and M&A activity
8. Future outlook and emerging opportunities`,

    company_research: `Generate queries that cover:
1. Company overview, founding, and leadership team
2. Products/services and business model
3. Financial performance, funding, and valuation
4. Competitive positioning and market share
5. Technology and innovation
6. Customer base and case studies
7. Strategic partnerships and alliances
8. Recent news, announcements, and future plans`,

    general_research: `Generate queries that cover:
1. Core concepts and current state of the art
2. Key organizations and thought leaders
3. Recent developments and news (2025-2026)
4. Quantitative data, statistics, and benchmarks
5. Challenges, risks, and mitigation strategies
6. Best practices and implementation guides
7. Case studies and real-world examples
8. Future trends and predictions`,
  };

  return instructions[type];
}

/**
 * Generate template-based queries when LLM is not available
 */
function generateTemplateQueries(
  topic: string,
  maxQueries: number,
  _researchType: ResearchType
): ResearchQuery[] {
  const templates = [
    { template: '{topic} overview 2026', purpose: 'Current state and overview' },
    { template: '{topic} competitors market share', purpose: 'Competitive landscape' },
    { template: '{topic} latest news funding 2025 2026', purpose: 'Recent developments' },
    { template: '{topic} market size revenue growth', purpose: 'Market data and statistics' },
    { template: '{topic} challenges risks problems', purpose: 'Challenges and risks' },
    { template: '{topic} best practices strategy', purpose: 'Best practices and strategy' },
    { template: '{topic} case study success story', purpose: 'Real-world examples' },
    { template: '{topic} future trends predictions 2026', purpose: 'Future outlook' },
    { template: '{topic} pricing comparison alternative', purpose: 'Alternatives and pricing' },
    { template: '{topic} reviews customer feedback', purpose: 'Customer perspectives' },
  ];

  return templates.slice(0, maxQueries).map((t, i) => ({
    id: `query-${i + 1}`,
    query: t.template.replace('{topic}', topic),
    purpose: t.purpose,
    status: 'pending' as const,
    round: 'initial' as const,
  }));
}

// ==========================================
// ITERATIVE DEEPENING
// ==========================================

/**
 * Generate follow-up queries based on first-round results (iterative deepening).
 * Analyzes gaps in initial results and generates targeted follow-up queries.
 */
async function generateFollowUpQueries(
  topic: string,
  researchType: ResearchType,
  firstRoundResults: ResearchQuery[],
  options: DeepResearchOptions,
  llmClient?: any
): Promise<ResearchQuery[]> {
  const maxFollowUp = options.maxFollowUpQueries || DEFAULT_OPTIONS.maxFollowUpQueries!;

  if (!llmClient) {
    return [];
  }

  try {
    // Summarize what we found in round 1
    const foundSummary = firstRoundResults
      .filter((q) => q.status === 'done' && q.results && q.results.length > 0)
      .map((q) => {
        const titles = q.results!.slice(0, 3).map((r) => r.title).join('; ');
        return `- Query: "${q.query}" → Found: ${titles}`;
      })
      .join('\n');

    const failedQueries = firstRoundResults
      .filter((q) => q.status === 'error' || (q.results && q.results.length === 0))
      .map((q) => `- "${q.query}" (no results)`)
      .join('\n');

    const prompt = `You are a research strategist performing iterative deepening. 
Based on the initial research results below, generate ${maxFollowUp} NEW follow-up queries that:
1. Explore specific companies/products/people mentioned in the results
2. Fill gaps where initial queries returned no results
3. Go deeper on the most promising findings
4. Search for specific data points (pricing, market size, dates, events)

Topic: "${topic}"
Research type: ${researchType}

Initial results:
${foundSummary}

${failedQueries ? `Queries with no results (need alternative phrasing):\n${failedQueries}` : ''}

RULES:
- Each follow-up must be MORE SPECIFIC than the initial queries.
- Include actual company/product names found in round 1.
- Include region-specific queries if applicable.
- Use current year (2026) for recent data.

Return as JSON: {"queries": [{"query": "specific follow-up query", "purpose": "what gap this fills"}]}`;

    const response = await llmClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const queries = Array.isArray(parsed) ? parsed : parsed.queries || [];

    const startIdx = firstRoundResults.length;
    return queries.slice(0, maxFollowUp).map((q: any, i: number) => ({
      id: `query-${startIdx + i + 1}`,
      query: q.query,
      purpose: q.purpose || 'Follow-up research',
      status: 'pending' as const,
      round: 'followup' as const,
    }));
  } catch (error) {
    logger.error('[DeepResearch] Follow-up query generation failed:', error);
    return [];
  }
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
      maxResults: options.maxSourcesPerQuery || 8,
      includeNews: options.includeNewsResults,
    });

    query.results = searchResults.results.map((r: any) => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet || r.content?.slice(0, 500) || '',
      content: r.content,
      relevanceScore: r.score || 0.5,
      publishedDate: r.publishedDate,
      source: (() => {
        try {
          return new URL(r.url).hostname;
        } catch {
          return r.url;
        }
      })(),
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
 * Deduplicate and aggregate sources (increased limits, full content support)
 */
function aggregateSources(queries: ResearchQuery[], options: DeepResearchOptions): Source[] {
  const sourceMap = new Map<string, Source>();
  const minScore = options.minRelevanceScore || 0.4;

  for (const query of queries) {
    if (!query.results) continue;

    for (const result of query.results) {
      if (result.relevanceScore < minScore) continue;

      const key = result.url;
      if (sourceMap.has(key)) {
        const existing = sourceMap.get(key)!;
        if (!existing.snippets.includes(result.snippet)) {
          existing.snippets.push(result.snippet);
        }
        existing.relevanceScore = Math.max(existing.relevanceScore, result.relevanceScore);
        // Keep the longest content version
        if (result.content && (!existing.fullContent || result.content.length > existing.fullContent.length)) {
          existing.fullContent = result.content;
        }
      } else {
        sourceMap.set(key, {
          url: result.url,
          title: result.title,
          domain: result.source,
          relevanceScore: result.relevanceScore,
          snippets: [result.snippet],
          fullContent: result.content,
          accessedAt: new Date(),
        });
      }
    }
  }

  return Array.from(sourceMap.values())
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 30);
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
        fullContent: r.content,
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
// TASK-SPECIFIC SYNTHESIS
// ==========================================

/**
 * Build task-specific synthesis prompt based on detected research type
 */
function buildSynthesisPrompt(
  topic: string,
  researchType: ResearchType,
  sourceMaterial: string,
  options: DeepResearchOptions,
  tavilyAnswer?: string
): string {
  const languageInstruction = (options.language || 'en').startsWith('pl')
    ? 'Respond entirely in Polish (język polski).'
    : (options.language || 'en').startsWith('de')
      ? 'Respond entirely in German (Deutsch).'
      : (options.language || 'en').startsWith('es')
        ? 'Respond entirely in Spanish (Español).'
        : 'Respond in English.';

  const orgContextBlock = options.orgContext
    ? `\nOrganization context for personalization:
- Organization: ${options.orgContext.organizationName || 'N/A'}
- Industry: ${options.orgContext.industry || 'N/A'}
- Region: ${options.orgContext.region || 'N/A'}
- Digital maturity: ${options.orgContext.maturityLevel || 'N/A'}
Tailor recommendations specifically to this organization's context.`
    : '';

  const tavilyBlock = tavilyAnswer
    ? `\nTavily AI Summary (additional context):\n${tavilyAnswer}\n`
    : '';

  const typePrompts: Record<ResearchType, string> = {
    competitive_analysis: `You are a senior strategy consultant writing a competitive analysis report.

Based on the research data below about "${topic}", create a comprehensive competitive analysis.
${languageInstruction}
${orgContextBlock}
${tavilyBlock}

REQUIRED SECTIONS (follow this exact structure):

## 1. Executive Summary
Brief overview of the competitive landscape (3-5 sentences).

## 2. Competitive Landscape by Category
For EACH category of competitors:
### [Category Name] (e.g., "Enterprise Digital Twin Platforms")
- List specific companies with brief descriptions
- **How to win against this category**: Specific tactical advice

## 3. SWOT Analysis
| Strengths | Weaknesses |
|-----------|------------|
| ... | ... |

| Opportunities | Threats |
|---------------|---------|
| ... | ... |

## 4. Competitive Positioning Map
Describe where the subject sits relative to competitors on key dimensions.

## 5. Key Recommendations
5-7 actionable recommendations with priorities (High/Medium/Low).

RULES:
- Include specific company names, products, and data points from sources.
- Use citation markers [1], [2], etc.
- Include financial data (funding, market size, revenue) when available.
- Be opinionated — give clear "how to win" advice, not neutral descriptions.

SOURCE MATERIAL:
${sourceMaterial}`,

    market_entry: `You are a senior strategy consultant writing a market entry playbook.

Based on the research data below about "${topic}", create a comprehensive market entry strategy.
${languageInstruction}
${orgContextBlock}
${tavilyBlock}

REQUIRED SECTIONS:

## 1. Executive Summary
Market opportunity overview (3-5 sentences).

## 2. Market Analysis
- Market size and growth projections (with numbers)
- Key industry clusters and segments
- Major players already in the market

## 3. Competitive Landscape
Who is already serving this market? How are they positioned?

## 4. Entry Strategy (Go-to-Market)
10-15 specific, actionable tactics. For each:
- **Tactic name**: Description
- **Priority**: High/Medium/Low
- **Timeline**: Immediate/Short-term/Medium-term
- **Expected outcome**

## 5. Partnership Opportunities
Specific organizations, universities, associations to partner with (with names and reasons).

## 6. Events & Conferences
List specific events with dates (2026) where presence would be valuable.

## 7. 90-Day Action Plan
| Days | Actions | Deliverables | Target Metrics |
|------|---------|-------------|----------------|
| 1-14 | ... | ... | ... |
| 15-45 | ... | ... | ... |
| 46-90 | ... | ... | ... |

## 8. Risks & Mitigation
Top 5 risks with specific mitigation strategies.

## 9. Success Metrics (KPIs)
5-7 measurable KPIs for the first 6-12 months.

RULES:
- Include specific names, dates, data from sources.
- Use citation markers [1], [2], etc.
- Be extremely practical — every recommendation must be actionable.
- Include financial incentives, grants, tax benefits if found.

SOURCE MATERIAL:
${sourceMaterial}`,

    technology_comparison: `You are a senior technology analyst writing a comparison report.

Based on the research data below about "${topic}", create a comprehensive technology comparison.
${languageInstruction}
${orgContextBlock}
${tavilyBlock}

REQUIRED SECTIONS:

## 1. Executive Summary
Quick comparison overview and recommendation (3-5 sentences).

## 2. Comparison Matrix
| Feature | Technology A | Technology B | ... |
|---------|-------------|-------------|-----|
| ... | ... | ... | ... |

## 3. Detailed Analysis per Technology
For each technology:
### [Technology Name]
- Overview and key features
- Strengths and weaknesses
- Pricing model
- Ideal use case

## 4. Performance & Benchmarks
Quantitative comparisons where data is available.

## 5. Ecosystem & Integration
API, plugins, third-party integrations, community.

## 6. Recommendation
Clear recommendation with reasoning. Include "best for..." scenarios.

RULES:
- Use citation markers [1], [2], etc.
- Include pricing when available.
- Be opinionated — recommend clearly.

SOURCE MATERIAL:
${sourceMaterial}`,

    industry_analysis: `You are a senior industry analyst writing a sector report.

Based on the research data below about "${topic}", create a comprehensive industry analysis.
${languageInstruction}
${orgContextBlock}
${tavilyBlock}

REQUIRED SECTIONS:

## 1. Industry Overview
Market size, growth rate, and key characteristics.

## 2. Market Structure
Key players, market concentration, value chain.

## 3. Trends & Drivers
Technology, regulatory, economic, and social trends shaping the industry.

## 4. Challenges & Risks
Top industry challenges with impact assessment.

## 5. Investment & M&A Activity
Recent deals, funding rounds, and strategic moves.

## 6. Future Outlook (2026-2030)
Projections and expected developments.

## 7. Opportunities
Where are the biggest opportunities? For whom?

RULES:
- Include specific data (market size in $, growth rates in %, etc.)
- Use citation markers [1], [2], etc.

SOURCE MATERIAL:
${sourceMaterial}`,

    company_research: `You are a senior business analyst preparing a company research brief.

Based on the research data below about "${topic}", create a comprehensive company profile.
${languageInstruction}
${orgContextBlock}
${tavilyBlock}

REQUIRED SECTIONS:

## 1. Company Overview
Name, founding, HQ, leadership, mission.

## 2. Products & Services
Core offerings, business model, pricing.

## 3. Market Position
Competitive position, market share, key differentiators.

## 4. Financial Profile
Funding, revenue, valuation, key financial metrics.

## 5. Strategy & Recent Developments
Strategic direction, recent news, partnerships.

## 6. SWOT Analysis
Strengths, weaknesses, opportunities, threats.

## 7. Key Takeaways
3-5 critical insights.

RULES:
- Include specific data from sources.
- Use citation markers [1], [2], etc.

SOURCE MATERIAL:
${sourceMaterial}`,

    general_research: `You are a senior research analyst preparing a comprehensive research report.

Based on the research data below about "${topic}", create a thorough, well-structured report.
${languageInstruction}
${orgContextBlock}
${tavilyBlock}

REQUIRED SECTIONS:

## 1. Executive Summary
Key findings in 3-5 sentences.

## 2. Background & Context
What this topic is and why it matters.

## 3. Current State of Affairs
What is happening now — key facts, data, trends.

## 4. Key Players & Stakeholders
Who is involved and what are their roles/positions.

## 5. Analysis & Insights
Deep analysis connecting the facts. Include patterns, correlations, and implications.

## 6. Challenges & Risks
What could go wrong? What are the obstacles?

## 7. Opportunities & Recommendations
Actionable recommendations based on the findings.

## 8. Future Outlook
What to expect in the coming 1-3 years.

RULES:
- Include specific data, names, numbers from sources.
- Use citation markers [1], [2], etc.
- Be analytical, not just descriptive.

SOURCE MATERIAL:
${sourceMaterial}`,
  };

  return typePrompts[researchType];
}

/**
 * Build source material block for synthesis (with full content support)
 */
function buildSourceMaterial(sources: Source[]): string {
  const topSources = sources.slice(0, 20);

  return topSources
    .map((s, i) => {
      // Use full content if available, otherwise use all snippets
      const content = s.fullContent
        ? s.fullContent.slice(0, 3000)
        : s.snippets.join(' ').slice(0, 1500);

      return `[${i + 1}] ${s.title} (${s.domain})\nURL: ${s.url}\n${content}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Synthesize research findings using LLM with task-specific prompts
 */
async function synthesizeFindings(
  topic: string,
  researchType: ResearchType,
  _results: ResearchResult[],
  sources: Source[],
  options: DeepResearchOptions,
  llmClient?: any,
  tavilyAnswer?: string
): Promise<string> {
  if (!llmClient) {
    return sources
      .slice(0, 10)
      .map((s) => s.snippets.join(' '))
      .join('\n\n');
  }

  try {
    const sourceMaterial = buildSourceMaterial(sources);
    const prompt = buildSynthesisPrompt(topic, researchType, sourceMaterial, options, tavilyAnswer);

    // Use a strong model for synthesis (not mini!)
    // Try gpt-4o first, fall back to whatever is available
    const synthesisModel = 'gpt-4o';

    const response = await llmClient.chat.completions.create({
      model: synthesisModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 8000,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error: any) {
    // Fallback to gpt-4o-mini if gpt-4o fails
    logger.warn(`[DeepResearch] Synthesis with strong model failed, falling back: ${error.message}`);
    try {
      const sourceMaterial = buildSourceMaterial(sources);
      const prompt = buildSynthesisPrompt(topic, researchType, sourceMaterial, options, tavilyAnswer);

      const response = await llmClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 6000,
      });

      return response.choices[0]?.message?.content || '';
    } catch (fallbackError) {
      logger.error('[DeepResearch] Synthesis fallback also failed:', fallbackError);
      return sources
        .slice(0, 10)
        .map((s) => s.snippets.join(' '))
        .join('\n\n');
    }
  }
}

// ==========================================
// CLARIFICATION
// ==========================================

/**
 * Generate clarification questions for the user before starting research.
 * Returns 2-3 questions that help focus the research.
 */
export async function generateClarificationQuestions(
  topic: string,
  llmClient?: any
): Promise<{ questions: Array<{ id: string; question: string; options: string[] }> }> {
  if (!llmClient) {
    return { questions: [] };
  }

  try {
    const researchType = detectResearchType(topic);

    const prompt = `You are a research assistant preparing to do deep research. Before starting, generate 2-3 clarification questions that would help focus the research.

Topic: "${topic}"
Detected research type: ${researchType}

Generate questions that help narrow the scope. Each question should have 3-4 concrete options.

Return as JSON: {"questions": [{"id": "q1", "question": "What specific aspect...", "options": ["Option A", "Option B", "Option C"]}]}

Keep questions short and practical. Max 3 questions.`;

    const response = await llmClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    return { questions: parsed.questions || [] };
  } catch (error) {
    logger.error('[DeepResearch] Clarification generation failed:', error);
    return { questions: [] };
  }
}

// ==========================================
// MAIN SERVICE
// ==========================================

/**
 * Conduct deep research on a topic with iterative deepening
 */
export async function conductDeepResearch(
  topic: string,
  options: DeepResearchOptions = {},
  dependencies?: {
    webSearchService?: any;
    llmClient?: any;
    onProgress?: (status: {
      stage: string;
      queries: ResearchQuery[];
      round?: number;
      totalRounds?: number;
    }) => void;
  }
): Promise<DeepResearchOutput> {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const { webSearchService, llmClient, onProgress } = dependencies || {};

  // Detect research type
  const researchType = detectResearchType(topic);
  logger.info(`[DeepResearch] Starting research on: "${topic}" (type: ${researchType})`);

  // ---- ROUND 1: Initial queries ----
  onProgress?.({ stage: 'generating_queries', queries: [], round: 1, totalRounds: 2 });
  const initialQueries = await generateSubQueries(topic, researchType, mergedOptions, llmClient);

  logger.info(`[DeepResearch] Generated ${initialQueries.length} initial queries`);
  onProgress?.({ stage: 'queries_ready', queries: initialQueries, round: 1, totalRounds: 2 });

  let executedInitial = initialQueries;
  let tavilyAnswer: string | undefined;

  if (webSearchService) {
    onProgress?.({ stage: 'searching', queries: initialQueries, round: 1, totalRounds: 2 });
    executedInitial = await executeAllQueries(
      initialQueries,
      webSearchService,
      mergedOptions,
      (q) => onProgress?.({ stage: 'searching', queries: q, round: 1, totalRounds: 2 })
    );

    // Collect Tavily answer from first successful search
    for (const q of executedInitial) {
      if ((q as any)._tavilyAnswer) {
        tavilyAnswer = (q as any)._tavilyAnswer;
        break;
      }
    }
  }

  // ---- ROUND 2: Iterative deepening (follow-up queries) ----
  let allQueries = [...executedInitial];
  let rounds = 1;

  if (mergedOptions.iterativeDeepening !== false && webSearchService && llmClient) {
    onProgress?.({ stage: 'deepening', queries: allQueries, round: 2, totalRounds: 2 });

    const followUpQueries = await generateFollowUpQueries(
      topic,
      researchType,
      executedInitial,
      mergedOptions,
      llmClient
    );

    if (followUpQueries.length > 0) {
      logger.info(`[DeepResearch] Generated ${followUpQueries.length} follow-up queries (round 2)`);
      onProgress?.({
        stage: 'searching',
        queries: [...allQueries, ...followUpQueries],
        round: 2,
        totalRounds: 2,
      });

      const executedFollowUp = await executeAllQueries(
        followUpQueries,
        webSearchService,
        mergedOptions,
        (q) =>
          onProgress?.({
            stage: 'searching',
            queries: [...allQueries, ...q],
            round: 2,
            totalRounds: 2,
          })
      );

      allQueries = [...allQueries, ...executedFollowUp];
      rounds = 2;
    }
  }

  // ---- AGGREGATION ----
  onProgress?.({ stage: 'aggregating', queries: allQueries });
  const sources = aggregateSources(allQueries, mergedOptions);
  const results = buildResults(allQueries);
  const citations = generateCitations(sources);

  logger.info(
    `[DeepResearch] Aggregated ${sources.length} unique sources from ${allQueries.length} queries (${rounds} rounds)`
  );

  // ---- SYNTHESIS (with task-specific prompt + strong model) ----
  onProgress?.({ stage: 'synthesizing', queries: allQueries });
  const synthesis = await synthesizeFindings(
    topic,
    researchType,
    results,
    sources,
    mergedOptions,
    llmClient,
    tavilyAnswer
  );

  const duration = Date.now() - startTime;
  const uniqueDomains = new Set(sources.map((s) => s.domain)).size;
  const avgConfidence =
    results.length > 0 ? results.reduce((acc, r) => acc + r.confidence, 0) / results.length : 0;

  const output: DeepResearchOutput = {
    topic,
    queries: allQueries,
    results,
    synthesis,
    citations,
    sources,
    tavilyAnswer,
    researchType,
    metadata: {
      totalSources: sources.length,
      uniqueDomains,
      averageConfidence: avgConfidence,
      researchDuration: duration,
      queriesExecuted: allQueries.filter((q) => q.status === 'done').length,
      rounds,
    },
  };

  logger.info(
    `[DeepResearch] Completed in ${duration}ms with ${sources.length} sources, ${rounds} rounds, type: ${researchType}`
  );

  return output;
}

// ==========================================
// EXPORTS
// ==========================================

export const deepResearchService = {
  conductDeepResearch,
  generateSubQueries,
  generateFollowUpQueries,
  generateClarificationQuestions,
  aggregateSources,
  detectResearchType,
};

export default deepResearchService;
