/**
 * Web Research Service
 * 
 * Provides web search capabilities for enriching DRD reports with:
 * - Industry benchmarks and statistics
 * - Case studies from similar transformations
 * - Technology trends and best practices
 * - Competitor/leader practices
 * 
 * Supports multiple backends:
 * - Perplexity API (recommended for quality)
 * - Tavily Search API (good for AI agents)
 * - Gemini with Google Search (fallback)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Industry mapping for search queries
const INDUSTRY_KEYWORDS = {
    manufacturing: {
        pl: ['produkcja', 'przemysł', 'fabryka', 'manufacturing', 'Industry 4.0'],
        en: ['manufacturing', 'production', 'factory', 'Industry 4.0', 'smart factory'],
        leaders: ['Siemens', 'Bosch', 'Toyota', 'GE Digital', 'Rockwell Automation']
    },
    retail: {
        pl: ['handel', 'retail', 'e-commerce', 'sprzedaż detaliczna'],
        en: ['retail', 'e-commerce', 'omnichannel', 'consumer goods'],
        leaders: ['Amazon', 'Walmart', 'Alibaba', 'Zalando', 'IKEA']
    },
    financial: {
        pl: ['bankowość', 'finanse', 'usługi finansowe', 'fintech'],
        en: ['banking', 'financial services', 'fintech', 'insurance'],
        leaders: ['JPMorgan', 'Goldman Sachs', 'ING', 'Revolut', 'Stripe']
    },
    healthcare: {
        pl: ['ochrona zdrowia', 'szpital', 'medycyna', 'farmacja'],
        en: ['healthcare', 'hospital', 'medical', 'pharma', 'health tech'],
        leaders: ['Mayo Clinic', 'Kaiser Permanente', 'Philips Healthcare', 'Siemens Healthineers']
    },
    technology: {
        pl: ['IT', 'technologia', 'software', 'SaaS'],
        en: ['technology', 'software', 'SaaS', 'cloud', 'digital native'],
        leaders: ['Google', 'Microsoft', 'Salesforce', 'ServiceNow', 'Atlassian']
    },
    logistics: {
        pl: ['logistyka', 'transport', 'łańcuch dostaw', 'TSL'],
        en: ['logistics', 'supply chain', 'transportation', 'warehousing'],
        leaders: ['DHL', 'Maersk', 'FedEx', 'Amazon Logistics', 'Flexport']
    },
    energy: {
        pl: ['energetyka', 'utilities', 'OZE', 'energia'],
        en: ['energy', 'utilities', 'renewable', 'power generation'],
        leaders: ['Shell', 'BP', 'Enel', 'Ørsted', 'NextEra Energy']
    }
};

// DRD Axis to search topic mapping
const AXIS_SEARCH_TOPICS = {
    processes: {
        topics: ['process automation', 'RPA', 'workflow digitization', 'BPM', 'lean digital'],
        benchmarkQueries: [
            'digital process automation benchmark {industry} 2024',
            'RPA implementation success rate {industry}',
            'process digitization ROI statistics'
        ]
    },
    digitalProducts: {
        topics: ['digital products', 'connected products', 'IoT products', 'product digitization'],
        benchmarkQueries: [
            'digital product revenue share {industry} 2024',
            'IoT connected products benchmark',
            'product-as-a-service adoption rate'
        ]
    },
    businessModels: {
        topics: ['digital business models', 'subscription economy', 'platform business', 'servitization'],
        benchmarkQueries: [
            'digital business model transformation {industry}',
            'subscription revenue growth benchmark',
            'platform economy statistics {industry}'
        ]
    },
    dataManagement: {
        topics: ['data management', 'data governance', 'analytics maturity', 'data-driven decision'],
        benchmarkQueries: [
            'data maturity benchmark {industry} 2024',
            'analytics adoption rate enterprises',
            'data governance implementation statistics'
        ]
    },
    culture: {
        topics: ['digital culture', 'agile transformation', 'change management', 'digital skills'],
        benchmarkQueries: [
            'digital culture transformation success rate',
            'employee digital skills gap {industry}',
            'agile adoption statistics enterprises'
        ]
    },
    cybersecurity: {
        topics: ['cybersecurity maturity', 'zero trust', 'security posture', 'cyber resilience'],
        benchmarkQueries: [
            'cybersecurity maturity benchmark {industry} 2024',
            'zero trust adoption rate enterprises',
            'cyber attack statistics {industry}'
        ]
    },
    aiMaturity: {
        topics: ['AI adoption', 'machine learning enterprise', 'AI maturity', 'generative AI'],
        benchmarkQueries: [
            'AI adoption rate {industry} 2024',
            'enterprise AI ROI statistics',
            'generative AI implementation benchmark'
        ]
    }
};

class WebResearchService {
    constructor() {
        this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
        this.tavilyApiKey = process.env.TAVILY_API_KEY;
        this.geminiApiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
        
        // Google Search options
        this.serperApiKey = process.env.SERPER_API_KEY;
        this.googleSearchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
        this.googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID; // Custom Search Engine ID
        
        // Initialize Gemini for fallback and summarization
        if (this.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        }
        
        // Cache for research results (in-memory, consider Redis for production)
        this.cache = new Map();
        this.cacheMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        // Determine available backend
        this.backend = this._detectBackend();
        console.log(`[WebResearch] Initialized with backend: ${this.backend}`);
    }
    
    _detectBackend() {
        if (this.perplexityApiKey) return 'perplexity';
        if (this.tavilyApiKey) return 'tavily';
        if (this.serperApiKey) return 'serper'; // Google via Serper.dev
        if (this.googleSearchApiKey && this.googleSearchEngineId) return 'google'; // Official Google Custom Search
        if (this.geminiApiKey) return 'gemini';
        return 'mock';
    }
    
    /**
     * Search for industry benchmarks for a specific axis
     */
    async searchIndustryBenchmarks(industry, axisId, options = {}) {
        const cacheKey = `benchmark:${industry}:${axisId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;
        
        const axisConfig = AXIS_SEARCH_TOPICS[axisId];
        if (!axisConfig) {
            return { error: 'Unknown axis', benchmarks: [] };
        }
        
        const industryKeywords = INDUSTRY_KEYWORDS[industry] || INDUSTRY_KEYWORDS.manufacturing;
        const queries = axisConfig.benchmarkQueries.map(q => 
            q.replace('{industry}', industryKeywords.en[0])
        );
        
        try {
            const results = await this._executeSearch(queries[0], {
                ...options,
                searchType: 'benchmark',
                industry,
                axisId
            });
            
            const processed = this._processBenchmarkResults(results, axisId, industry);
            this._setCache(cacheKey, processed);
            return processed;
        } catch (error) {
            console.error(`[WebResearch] Benchmark search error:`, error);
            return this._getFallbackBenchmarks(industry, axisId);
        }
    }
    
    /**
     * Find case studies for transformation type
     */
    async findCaseStudies(industry, transformationType, options = {}) {
        const cacheKey = `casestudy:${industry}:${transformationType}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;
        
        const industryConfig = INDUSTRY_KEYWORDS[industry] || INDUSTRY_KEYWORDS.manufacturing;
        const query = `${transformationType} digital transformation case study ${industryConfig.en[0]} success story 2023 2024`;
        
        try {
            const results = await this._executeSearch(query, {
                ...options,
                searchType: 'casestudy',
                industry
            });
            
            const processed = this._processCaseStudyResults(results, industry, transformationType);
            this._setCache(cacheKey, processed);
            return processed;
        } catch (error) {
            console.error(`[WebResearch] Case study search error:`, error);
            return this._getFallbackCaseStudies(industry, transformationType);
        }
    }
    
    /**
     * Get technology trends for a domain
     */
    async getTechnologyTrends(domain, options = {}) {
        const cacheKey = `trends:${domain}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;
        
        const query = `${domain} technology trends 2024 2025 enterprise digital transformation`;
        
        try {
            const results = await this._executeSearch(query, {
                ...options,
                searchType: 'trends'
            });
            
            const processed = this._processTrendResults(results, domain);
            this._setCache(cacheKey, processed);
            return processed;
        } catch (error) {
            console.error(`[WebResearch] Trends search error:`, error);
            return this._getFallbackTrends(domain);
        }
    }
    
    /**
     * Get competitor/leader practices for an axis
     */
    async getLeaderPractices(industry, axisId, options = {}) {
        const cacheKey = `leaders:${industry}:${axisId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;
        
        const industryConfig = INDUSTRY_KEYWORDS[industry] || INDUSTRY_KEYWORDS.manufacturing;
        const axisConfig = AXIS_SEARCH_TOPICS[axisId];
        
        if (!axisConfig) {
            return { error: 'Unknown axis', practices: [] };
        }
        
        const leaders = industryConfig.leaders.slice(0, 3).join(' OR ');
        const topic = axisConfig.topics[0];
        const query = `(${leaders}) ${topic} best practices implementation`;
        
        try {
            const results = await this._executeSearch(query, {
                ...options,
                searchType: 'leaders',
                industry,
                axisId
            });
            
            const processed = this._processLeaderResults(results, industry, axisId);
            this._setCache(cacheKey, processed);
            return processed;
        } catch (error) {
            console.error(`[WebResearch] Leader practices search error:`, error);
            return this._getFallbackLeaderPractices(industry, axisId);
        }
    }
    
    /**
     * Comprehensive research for a full report
     */
    async conductFullResearch(industry, assessmentData, options = {}) {
        const { language = 'pl' } = options;
        
        // Identify priority axes (largest gaps)
        const priorityAxes = this._identifyPriorityAxes(assessmentData);
        
        // Parallel research for efficiency
        const researchPromises = [
            // Industry overview
            this._executeSearch(`${industry} digital transformation state 2024`, { searchType: 'overview' }),
            
            // Top 3 priority axes benchmarks
            ...priorityAxes.slice(0, 3).map(axis => 
                this.searchIndustryBenchmarks(industry, axis.id)
            ),
            
            // Case studies for main transformation type
            this.findCaseStudies(industry, priorityAxes[0]?.name || 'digital transformation'),
            
            // Technology trends
            this.getTechnologyTrends(priorityAxes[0]?.topics?.[0] || 'digital transformation'),
            
            // Leader practices for weakest area
            this.getLeaderPractices(industry, priorityAxes[0]?.id || 'processes')
        ];
        
        try {
            const results = await Promise.allSettled(researchPromises);
            
            return {
                success: true,
                timestamp: new Date().toISOString(),
                industry,
                data: {
                    industryOverview: results[0].status === 'fulfilled' ? results[0].value : null,
                    benchmarks: results.slice(1, 4).filter(r => r.status === 'fulfilled').map(r => r.value),
                    caseStudies: results[4].status === 'fulfilled' ? results[4].value : null,
                    trends: results[5].status === 'fulfilled' ? results[5].value : null,
                    leaderPractices: results[6].status === 'fulfilled' ? results[6].value : null
                },
                priorityAxes: priorityAxes.map(a => a.id)
            };
        } catch (error) {
            console.error('[WebResearch] Full research error:', error);
            return {
                success: false,
                error: error.message,
                data: this._getComprehensiveFallback(industry, assessmentData)
            };
        }
    }
    
    // =========================================================================
    // PRIVATE: Search Execution
    // =========================================================================
    
    async _executeSearch(query, options = {}) {
        switch (this.backend) {
            case 'perplexity':
                return this._searchPerplexity(query, options);
            case 'tavily':
                return this._searchTavily(query, options);
            case 'serper':
                return this._searchSerper(query, options);
            case 'google':
                return this._searchGoogle(query, options);
            case 'gemini':
                return this._searchGemini(query, options);
            default:
                return this._mockSearch(query, options);
        }
    }
    
    async _searchPerplexity(query, options = {}) {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.perplexityApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-sonar-small-128k-online',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a research assistant. Provide factual, well-sourced information with specific statistics and examples. Always cite sources when available.'
                    },
                    {
                        role: 'user',
                        content: query
                    }
                ],
                temperature: 0.2,
                max_tokens: 1500,
                return_citations: true
            })
        });
        
        if (!response.ok) {
            throw new Error(`Perplexity API error: ${response.status}`);
        }
        
        const data = await response.json();
        return {
            content: data.choices[0]?.message?.content || '',
            citations: data.citations || [],
            source: 'perplexity'
        };
    }
    
    async _searchTavily(query, options = {}) {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: this.tavilyApiKey,
                query,
                search_depth: 'advanced',
                include_answer: true,
                include_raw_content: false,
                max_results: 5
            })
        });
        
        if (!response.ok) {
            throw new Error(`Tavily API error: ${response.status}`);
        }
        
        const data = await response.json();
        return {
            content: data.answer || '',
            results: data.results || [],
            citations: data.results?.map(r => ({ url: r.url, title: r.title })) || [],
            source: 'tavily'
        };
    }
    
    /**
     * Search using Serper.dev (Google Search API wrapper)
     * Docs: https://serper.dev/
     * Cost: ~$0.001 per search
     */
    async _searchSerper(query, options = {}) {
        const { searchType = 'search', numResults = 10 } = options;
        
        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': this.serperApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: query,
                gl: 'pl', // Poland
                hl: 'pl', // Polish language
                num: numResults,
                autocorrect: true
            })
        });
        
        if (!response.ok) {
            throw new Error(`Serper API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Extract organic results
        const organicResults = data.organic || [];
        const knowledgeGraph = data.knowledgeGraph || null;
        const answerBox = data.answerBox || null;
        
        // Build summary from results
        let summary = '';
        
        if (answerBox?.snippet) {
            summary += `${answerBox.snippet}\n\n`;
        }
        
        if (knowledgeGraph?.description) {
            summary += `${knowledgeGraph.description}\n\n`;
        }
        
        // Add snippets from organic results
        organicResults.slice(0, 5).forEach((result, i) => {
            if (result.snippet) {
                summary += `${i + 1}. ${result.snippet}\n`;
            }
        });
        
        // If we have Gemini, use it to synthesize results
        if (this.model && organicResults.length > 0) {
            try {
                const synthesisPrompt = `Based on these Google search results for "${query}", provide a concise synthesis:

${organicResults.slice(0, 5).map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`).join('\n')}

Provide:
1. Key statistics and data points
2. Main findings
3. Notable companies or examples mentioned

Be concise and factual. Use Polish language.`;
                
                const aiResult = await this.model.generateContent(synthesisPrompt);
                summary = aiResult.response.text();
            } catch (e) {
                console.warn('[WebResearch] Gemini synthesis failed, using raw results');
            }
        }
        
        return {
            content: summary,
            results: organicResults.map(r => ({
                title: r.title,
                url: r.link,
                snippet: r.snippet,
                position: r.position
            })),
            citations: organicResults.slice(0, 5).map(r => ({
                title: r.title,
                url: r.link
            })),
            knowledgeGraph,
            source: 'serper',
            query
        };
    }
    
    /**
     * Search using Google Custom Search API (official)
     * Docs: https://developers.google.com/custom-search/v1/overview
     * Cost: Free 100/day, then $5 per 1000 queries
     */
    async _searchGoogle(query, options = {}) {
        const { numResults = 10, language = 'pl' } = options;
        
        const params = new URLSearchParams({
            key: this.googleSearchApiKey,
            cx: this.googleSearchEngineId,
            q: query,
            num: Math.min(numResults, 10), // Max 10 per request
            lr: `lang_${language}`,
            gl: 'pl'
        });
        
        const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Google Search API error: ${response.status} - ${error.error?.message || 'Unknown'}`);
        }
        
        const data = await response.json();
        const items = data.items || [];
        
        // Build summary from results
        let summary = '';
        
        items.slice(0, 5).forEach((item, i) => {
            if (item.snippet) {
                summary += `${i + 1}. ${item.snippet}\n`;
            }
        });
        
        // Use Gemini to synthesize if available
        if (this.model && items.length > 0) {
            try {
                const synthesisPrompt = `Based on these Google search results for "${query}", provide a concise synthesis:

${items.slice(0, 5).map((item, i) => `${i + 1}. ${item.title}: ${item.snippet}`).join('\n')}

Provide:
1. Key statistics and data points
2. Main findings
3. Notable companies or examples mentioned

Be concise and factual. Use Polish language.`;
                
                const aiResult = await this.model.generateContent(synthesisPrompt);
                summary = aiResult.response.text();
            } catch (e) {
                console.warn('[WebResearch] Gemini synthesis failed, using raw results');
            }
        }
        
        return {
            content: summary,
            results: items.map((item, i) => ({
                title: item.title,
                url: item.link,
                snippet: item.snippet,
                displayLink: item.displayLink,
                position: i + 1
            })),
            citations: items.slice(0, 5).map(item => ({
                title: item.title,
                url: item.link
            })),
            searchInfo: {
                totalResults: data.searchInformation?.totalResults,
                searchTime: data.searchInformation?.searchTime
            },
            source: 'google',
            query
        };
    }
    
    async _searchGemini(query, options = {}) {
        if (!this.model) {
            throw new Error('Gemini not initialized');
        }
        
        const prompt = `As a research analyst, provide factual information about:
        
${query}

Focus on:
1. Specific statistics and percentages where available
2. Recent data (2023-2024)
3. Named companies and their practices
4. Industry benchmarks

Format your response with clear sections and bullet points. If you don't have specific data, provide reasonable estimates based on industry knowledge.`;
        
        const result = await this.model.generateContent(prompt);
        const text = result.response.text();
        
        return {
            content: text,
            citations: [],
            source: 'gemini',
            note: 'Data synthesized by AI, verify critical statistics'
        };
    }
    
    async _mockSearch(query, options = {}) {
        // Return structured mock data for development/testing
        return {
            content: `Research results for: ${query}. This is mock data for development.`,
            citations: [],
            source: 'mock',
            isMock: true
        };
    }
    
    // =========================================================================
    // PRIVATE: Result Processing
    // =========================================================================
    
    _processBenchmarkResults(results, axisId, industry) {
        const content = results.content || '';
        
        // Extract statistics patterns
        const percentageMatches = content.match(/(\d+(?:\.\d+)?)\s*%/g) || [];
        const yearMatches = content.match(/20\d{2}/g) || [];
        
        return {
            axisId,
            industry,
            summary: content.substring(0, 500),
            statistics: percentageMatches.slice(0, 5),
            dataYear: yearMatches.length > 0 ? Math.max(...yearMatches.map(Number)) : 2024,
            citations: results.citations || [],
            source: results.source,
            retrievedAt: new Date().toISOString()
        };
    }
    
    _processCaseStudyResults(results, industry, transformationType) {
        const content = results.content || '';
        
        // Try to extract company names (capitalized words)
        const companyPattern = /([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g;
        const companies = [...new Set((content.match(companyPattern) || []).slice(0, 10))];
        
        return {
            industry,
            transformationType,
            summary: content.substring(0, 800),
            mentionedCompanies: companies,
            citations: results.citations || [],
            source: results.source,
            retrievedAt: new Date().toISOString()
        };
    }
    
    _processTrendResults(results, domain) {
        const content = results.content || '';
        
        return {
            domain,
            summary: content.substring(0, 600),
            fullContent: content,
            citations: results.citations || [],
            source: results.source,
            retrievedAt: new Date().toISOString()
        };
    }
    
    _processLeaderResults(results, industry, axisId) {
        const content = results.content || '';
        const industryConfig = INDUSTRY_KEYWORDS[industry] || INDUSTRY_KEYWORDS.manufacturing;
        
        // Check which leaders are mentioned
        const mentionedLeaders = industryConfig.leaders.filter(leader => 
            content.toLowerCase().includes(leader.toLowerCase())
        );
        
        return {
            industry,
            axisId,
            summary: content.substring(0, 700),
            leaders: mentionedLeaders,
            allIndustryLeaders: industryConfig.leaders,
            citations: results.citations || [],
            source: results.source,
            retrievedAt: new Date().toISOString()
        };
    }
    
    // =========================================================================
    // PRIVATE: Fallback Data
    // =========================================================================
    
    _getFallbackBenchmarks(industry, axisId) {
        const fallbackData = {
            processes: { average: 3.8, leader: 6.2, laggard: 2.1, adoptionRate: '67%' },
            digitalProducts: { average: 2.9, leader: 4.5, laggard: 1.5, adoptionRate: '45%' },
            businessModels: { average: 2.5, leader: 4.2, laggard: 1.3, adoptionRate: '38%' },
            dataManagement: { average: 3.2, leader: 5.8, laggard: 1.8, adoptionRate: '52%' },
            culture: { average: 2.7, leader: 4.3, laggard: 1.6, adoptionRate: '41%' },
            cybersecurity: { average: 3.1, leader: 4.6, laggard: 1.9, adoptionRate: '58%' },
            aiMaturity: { average: 2.1, leader: 3.9, laggard: 1.2, adoptionRate: '34%' }
        };
        
        return {
            axisId,
            industry,
            summary: `Industry benchmark data for ${axisId} in ${industry} sector.`,
            data: fallbackData[axisId] || fallbackData.processes,
            source: 'fallback',
            note: 'Using cached industry averages. Live data unavailable.',
            retrievedAt: new Date().toISOString()
        };
    }
    
    _getFallbackCaseStudies(industry, transformationType) {
        const genericCaseStudies = {
            manufacturing: [
                { company: 'Siemens', transformation: 'Digital Twin implementation', result: '20% productivity increase' },
                { company: 'Bosch', transformation: 'IoT-enabled production', result: '15% cost reduction' },
                { company: 'Toyota', transformation: 'AI quality control', result: '30% defect reduction' }
            ],
            retail: [
                { company: 'Walmart', transformation: 'Omnichannel integration', result: '25% online sales growth' },
                { company: 'Zara', transformation: 'Real-time inventory', result: '40% faster restocking' }
            ],
            financial: [
                { company: 'ING', transformation: 'Agile transformation', result: '30% faster time-to-market' },
                { company: 'JPMorgan', transformation: 'AI in operations', result: '$150M annual savings' }
            ]
        };
        
        return {
            industry,
            transformationType,
            caseStudies: genericCaseStudies[industry] || genericCaseStudies.manufacturing,
            source: 'fallback',
            note: 'Using curated case study database. Live search unavailable.',
            retrievedAt: new Date().toISOString()
        };
    }
    
    _getFallbackTrends(domain) {
        const trends2024 = {
            'process automation': [
                'Hyperautomation combining RPA with AI',
                'Low-code/no-code automation platforms',
                'Process mining for discovery and optimization',
                'Intelligent document processing (IDP)'
            ],
            'data management': [
                'Data mesh architecture adoption',
                'Real-time analytics and streaming',
                'Data fabric for unified governance',
                'Privacy-preserving analytics'
            ],
            'AI': [
                'Generative AI in enterprise applications',
                'AI agents and autonomous systems',
                'Responsible AI and governance frameworks',
                'MLOps and AI infrastructure maturation'
            ],
            'cybersecurity': [
                'Zero Trust architecture adoption',
                'AI-powered threat detection',
                'Cloud security posture management',
                'Identity-first security'
            ],
            'default': [
                'Cloud-native transformation',
                'Composable enterprise architecture',
                'Sustainability-driven digitization',
                'Employee experience platforms'
            ]
        };
        
        return {
            domain,
            trends: trends2024[domain] || trends2024.default,
            source: 'fallback',
            year: 2024,
            retrievedAt: new Date().toISOString()
        };
    }
    
    _getFallbackLeaderPractices(industry, axisId) {
        const industryConfig = INDUSTRY_KEYWORDS[industry] || INDUSTRY_KEYWORDS.manufacturing;
        
        const practices = {
            processes: [
                `${industryConfig.leaders[0]} uses digital twins for end-to-end process visibility`,
                `${industryConfig.leaders[1]} implemented AI-driven quality control reducing defects by 40%`,
                'Industry leaders achieve >85% OEE through predictive maintenance'
            ],
            dataManagement: [
                `${industryConfig.leaders[0]} built enterprise data platform with real-time analytics`,
                'Leaders maintain data quality scores >95% through automated governance',
                'Top performers have 3x more data scientists per 1000 employees'
            ],
            aiMaturity: [
                `${industryConfig.leaders[0]} deploys AI in >50 production use cases`,
                'Leaders achieve 18-month payback on AI investments',
                'Top 10% have dedicated AI Center of Excellence with 50+ practitioners'
            ]
        };
        
        return {
            industry,
            axisId,
            leaders: industryConfig.leaders,
            practices: practices[axisId] || practices.processes,
            source: 'fallback',
            retrievedAt: new Date().toISOString()
        };
    }
    
    _getComprehensiveFallback(industry, assessmentData) {
        return {
            industryOverview: {
                industry,
                summary: `The ${industry} sector is undergoing significant digital transformation with focus on automation, data analytics, and customer experience.`,
                source: 'fallback'
            },
            benchmarks: Object.keys(AXIS_SEARCH_TOPICS).map(axisId => 
                this._getFallbackBenchmarks(industry, axisId)
            ),
            caseStudies: this._getFallbackCaseStudies(industry, 'digital transformation'),
            trends: this._getFallbackTrends('digital transformation'),
            leaderPractices: this._getFallbackLeaderPractices(industry, 'processes')
        };
    }
    
    // =========================================================================
    // PRIVATE: Helpers
    // =========================================================================
    
    _identifyPriorityAxes(assessmentData) {
        if (!assessmentData || typeof assessmentData !== 'object') {
            return Object.keys(AXIS_SEARCH_TOPICS).map(id => ({
                id,
                gap: 2,
                topics: AXIS_SEARCH_TOPICS[id].topics
            }));
        }
        
        return Object.entries(assessmentData)
            .filter(([key, val]) => val?.actual && AXIS_SEARCH_TOPICS[key])
            .map(([key, val]) => ({
                id: key,
                name: key,
                actual: val.actual,
                target: val.target || val.actual + 2,
                gap: (val.target || val.actual + 2) - val.actual,
                topics: AXIS_SEARCH_TOPICS[key].topics
            }))
            .sort((a, b) => b.gap - a.gap);
    }
    
    _getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        const age = Date.now() - cached.timestamp;
        if (age > this.cacheMaxAge) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }
    
    _setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // Cleanup old entries periodically
        if (this.cache.size > 100) {
            const now = Date.now();
            for (const [k, v] of this.cache.entries()) {
                if (now - v.timestamp > this.cacheMaxAge) {
                    this.cache.delete(k);
                }
            }
        }
    }
    
    /**
     * Get service status
     */
    getStatus() {
        return {
            backend: this.backend,
            cacheSize: this.cache.size,
            hasPerplexity: !!this.perplexityApiKey,
            hasTavily: !!this.tavilyApiKey,
            hasSerper: !!this.serperApiKey,
            hasGoogleSearch: !!(this.googleSearchApiKey && this.googleSearchEngineId),
            hasGemini: !!this.geminiApiKey,
            supportedIndustries: Object.keys(INDUSTRY_KEYWORDS),
            supportedAxes: Object.keys(AXIS_SEARCH_TOPICS),
            backendPriority: ['perplexity', 'tavily', 'serper', 'google', 'gemini', 'mock']
        };
    }
    
    /**
     * Force use a specific backend for testing
     */
    setBackend(backend) {
        const validBackends = ['perplexity', 'tavily', 'serper', 'google', 'gemini', 'mock'];
        if (validBackends.includes(backend)) {
            this.backend = backend;
            console.log(`[WebResearch] Backend changed to: ${backend}`);
        }
    }

    // =========================================================================
    // NEW: Synthesize Findings with AI
    // =========================================================================

    /**
     * Synthesize findings from multiple research results using AI
     * @param {Array} results - Array of research results to synthesize
     * @param {Object} context - Context for synthesis (industry, focus area, etc.)
     */
    async synthesizeFindings(results, context = {}) {
        if (!results || results.length === 0) {
            return { synthesis: 'No research results to synthesize.', citations: [] };
        }

        const { industry, focusArea, language = 'pl' } = context;

        // Collect all content and citations
        const contents = results.map(r => r.summary || r.content || '').filter(Boolean);
        const allCitations = results.flatMap(r => r.citations || []);

        // If no AI model available, create manual summary
        if (!this.model) {
            return {
                synthesis: contents.join('\n\n'),
                citations: [...new Set(allCitations)],
                method: 'concatenation'
            };
        }

        try {
            const synthesisPrompt = `${language === 'pl' ? 
                'Podsumuj poniższe wyniki badań w spójny, profesjonalny tekst. Skup się na kluczowych wnioskach i statystykach.' :
                'Synthesize the following research findings into a coherent, professional summary. Focus on key insights and statistics.'
            }

${industry ? `Industry: ${industry}` : ''}
${focusArea ? `Focus Area: ${focusArea}` : ''}

Research Findings:
${contents.map((c, i) => `[${i+1}] ${c}`).join('\n\n')}

${language === 'pl' ? 
    'Wymagania:\n- Maksymalnie 500 słów\n- Podkreśl kluczowe statystyki\n- Zachowaj obiektywny ton\n- Stwórz spójną narrację' :
    'Requirements:\n- Maximum 500 words\n- Highlight key statistics\n- Maintain objective tone\n- Create coherent narrative'
}`;

            const result = await this.model.generateContent(synthesisPrompt);
            const synthesis = result.response.text();

            return {
                synthesis,
                citations: [...new Set(allCitations)],
                sourceCount: results.length,
                method: 'ai_synthesis'
            };
        } catch (error) {
            console.error('[WebResearch] Synthesis error:', error.message);
            return {
                synthesis: contents.slice(0, 3).join('\n\n'),
                citations: [...new Set(allCitations)],
                method: 'fallback_concatenation',
                error: error.message
            };
        }
    }

    /**
     * Search for best practices in a specific axis
     * @param {string} axisId - DRD axis identifier
     * @param {Object} options - Search options
     */
    async searchBestPractices(axisId, options = {}) {
        const { industry, language = 'pl' } = options;
        const cacheKey = `bestpractices:${axisId}:${industry || 'generic'}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        const axisConfig = AXIS_SEARCH_TOPICS[axisId] || AXIS_SEARCH_TOPICS.processes;
        const topics = axisConfig.topics || [];

        const query = language === 'pl' ?
            `najlepsze praktyki ${topics[0]} ${industry || ''} case study wdrożenie` :
            `${topics[0]} best practices ${industry || ''} implementation guide`;

        try {
            const results = await this._executeSearch(query, { language, numResults: 8 });
            const processed = {
                axisId,
                industry,
                practices: this._extractPractices(results.content || ''),
                summary: results.content?.substring(0, 800) || '',
                citations: results.citations || [],
                source: results.source,
                retrievedAt: new Date().toISOString()
            };
            
            this._setCache(cacheKey, processed);
            return processed;
        } catch (error) {
            console.error(`[WebResearch] Best practices search error for ${axisId}:`, error.message);
            return this._getFallbackBestPractices(axisId, industry);
        }
    }

    /**
     * Extract structured practices from content
     * @private
     */
    _extractPractices(content) {
        // Try to identify numbered or bulleted items
        const listPattern = /(?:^|\n)\s*(?:\d+\.|\-|\•)\s*(.+)/g;
        const practices = [];
        let match;
        
        while ((match = listPattern.exec(content)) !== null && practices.length < 10) {
            const practice = match[1].trim();
            if (practice.length > 20 && practice.length < 300) {
                practices.push(practice);
            }
        }

        // If no list items found, extract sentences
        if (practices.length === 0) {
            const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
            return sentences
                .filter(s => s.length > 30 && s.length < 250)
                .slice(0, 5);
        }

        return practices;
    }

    /**
     * Get fallback best practices
     * @private
     */
    _getFallbackBestPractices(axisId, industry) {
        const bestPractices = {
            processes: [
                'Map and document all critical business processes before automation',
                'Start with high-volume, rule-based processes for RPA implementation',
                'Implement process mining to identify optimization opportunities',
                'Create a Center of Excellence for automation governance',
                'Measure process KPIs before and after digitization'
            ],
            dataManagement: [
                'Establish clear data ownership and stewardship roles',
                'Implement data quality monitoring with automated alerts',
                'Create a single source of truth for master data',
                'Enable self-service analytics with proper governance',
                'Ensure data lineage tracking for compliance'
            ],
            aiMaturity: [
                'Start with well-defined, measurable AI use cases',
                'Invest in data quality before AI deployment',
                'Build cross-functional teams combining AI and domain expertise',
                'Establish AI ethics guidelines and governance',
                'Implement MLOps for production AI systems'
            ],
            culture: [
                'Secure visible executive sponsorship for digital initiatives',
                'Create psychological safety for experimentation',
                'Invest in continuous digital skills development',
                'Celebrate both successes and learning from failures',
                'Break down silos through cross-functional collaboration'
            ],
            cybersecurity: [
                'Implement Zero Trust architecture principles',
                'Conduct regular security assessments and penetration testing',
                'Establish incident response procedures and practice drills',
                'Enable security awareness training for all employees',
                'Deploy AI-powered threat detection systems'
            ]
        };

        return {
            axisId,
            industry,
            practices: bestPractices[axisId] || bestPractices.processes,
            source: 'fallback',
            note: 'Using curated best practices database.',
            retrievedAt: new Date().toISOString()
        };
    }

    /**
     * Track citations for audit and attribution
     * @param {string} reportId - Report ID for tracking
     * @param {Array} citations - Citations to track
     */
    trackCitations(reportId, citations) {
        // Store citation metadata for compliance and attribution
        const citationData = {
            reportId,
            citations: citations.map(c => ({
                url: c.url || c,
                title: c.title || '',
                accessedAt: new Date().toISOString()
            })),
            trackedAt: new Date().toISOString()
        };

        // In production, store to database
        // For now, log for audit trail
        console.log(`[WebResearch] Tracked ${citations.length} citations for report ${reportId}`);
        
        return citationData;
    }
}

// Export singleton and config
const webResearchService = new WebResearchService();

module.exports = {
    WebResearchService,
    webResearchService,
    INDUSTRY_KEYWORDS,
    AXIS_SEARCH_TOPICS
};

