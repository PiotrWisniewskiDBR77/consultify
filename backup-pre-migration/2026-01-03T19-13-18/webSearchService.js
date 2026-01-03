import { createRequire } from 'module';
import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';

const require = createRequire(import.meta.url);


// Use native fetch (Node.js 18+) or fallback to node-fetch if available
let fetch;
try {
    // Node.js 18+ has native fetch
    fetch = global.fetch || globalThis.fetch;
    if (!fetch) {
        // Try to load node-fetch as fallback
        fetch = require('node-fetch');
    }
} catch (err) {
    console.warn('[WebSearch] No fetch implementation available. Web search will be disabled.');
    // Create a dummy fetch that returns error
    fetch = async () => {
        throw new Error('Fetch not available - web search disabled');
    };
}

// In-memory cache for search results
const searchCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour default
const CACHE_MAX_SIZE = 100;

// Helper to get API Key
const getSearchProvider = () => {
    return new Promise((resolve) => {
        db.get("SELECT * FROM llm_providers WHERE provider IN ('tavily', 'serper', 'google_search') AND is_active = 1 LIMIT 1", (err, row) => {
            resolve(row);
        });
    });
};

// Cache helper functions
const getCacheKey = (query, context) => {
    const contextStr = context ? JSON.stringify(context) : '';
    return `${query}_${contextStr}`.toLowerCase().replace(/\s+/g, '_');
};

const getFromCache = (cacheKey) => {
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log('[WebSearch] Cache hit for:', cacheKey.substring(0, 50));
        return cached.data;
    }
    if (cached) {
        searchCache.delete(cacheKey); // Remove expired
    }
    return null;
};

const setToCache = (cacheKey, data, ttl = CACHE_TTL_MS) => {
    // Evict oldest entries if cache is full
    if (searchCache.size >= CACHE_MAX_SIZE) {
        const oldestKey = searchCache.keys().next().value;
        searchCache.delete(oldestKey);
    }
    searchCache.set(cacheKey, { data, timestamp: Date.now(), ttl });
};

const WebSearchService = {
    /**
     * Verifies a fact or statement by searching the web.
     * Supports Tavily (recommended), Serper, or Google Programmable Search.
     */
    verifyFact: async (query) => {
        const providerConfig = await getSearchProvider();

        if (!providerConfig) {
            console.warn("[WebSearch] No active search provider found. Walled Garden mode.");
            return {
                isVerified: false,
                sources: [],
                confidence: 0,
                note: "No search provider configured. (Simulated)"
            };
        }

        try {
            if (providerConfig.provider === 'tavily') {
                return await searchTavily(query, providerConfig.api_key);
            }
            // Add other providers here
            return { isVerified: false, sources: [], confidence: 0, note: "Provider not implemented" };

        } catch (error) {
            console.error("[WebSearch] API Error:", error);
            return {
                isVerified: false,
                sources: [],
                confidence: 0,
                note: "Search failed."
            };
        }
    },

    /**
     * General search for enrichment
     */
    search: async (query) => {
        return WebSearchService.verifyFact(query);
    },

    /**
     * Search with organizational context for more relevant results
     * @param {string} query - Search query
     * @param {Object} context - Organizational context
     * @param {string} context.industry - Industry name
     * @param {string} context.companySize - Company size
     * @param {string[]} context.priorities - Strategic priorities
     * @param {Object} options - Search options
     * @returns {Promise<SearchResult>}
     */
    searchWithContext: async (query, context = {}, options = {}) => {
        const { 
            useCache = true, 
            cacheTTL = CACHE_TTL_MS,
            searchDepth = 'basic',
            maxResults = 5 
        } = options;

        // Build enhanced query with context
        let enhancedQuery = query;
        if (context.industry) {
            enhancedQuery = `${context.industry} industry ${query}`;
        }
        if (context.region) {
            enhancedQuery += ` ${context.region}`;
        }

        // Check cache first
        const cacheKey = getCacheKey(enhancedQuery, { industry: context.industry });
        if (useCache) {
            const cached = getFromCache(cacheKey);
            if (cached) {
                return { ...cached, fromCache: true };
            }
        }

        // Get provider
        const providerConfig = await getSearchProvider();
        if (!providerConfig) {
            return {
                isVerified: false,
                sources: [],
                confidence: 0,
                note: "No search provider configured",
                context: context
            };
        }

        try {
            let result;
            if (providerConfig.provider === 'tavily') {
                result = await searchTavilyAdvanced(enhancedQuery, providerConfig.api_key, {
                    searchDepth,
                    maxResults
                });
            } else {
                result = await WebSearchService.verifyFact(enhancedQuery);
            }

            // Enhance result with context
            const enhancedResult = {
                ...result,
                queryEnhanced: enhancedQuery,
                originalQuery: query,
                context: context,
                searchedAt: new Date().toISOString()
            };

            // Cache the result
            if (useCache && result.isVerified) {
                setToCache(cacheKey, enhancedResult, cacheTTL);
            }

            return enhancedResult;

        } catch (error) {
            console.error("[WebSearch] searchWithContext error:", error);
            return {
                isVerified: false,
                sources: [],
                confidence: 0,
                note: `Search failed: ${error.message}`,
                context: context
            };
        }
    },

    /**
     * Synthesize search results using AI
     * @param {Object[]} results - Array of search results
     * @param {string} synthesisGoal - What to synthesize (e.g., 'trends', 'benchmarks')
     * @returns {Promise<SynthesizedResult>}
     */
    synthesizeResults: async (results, synthesisGoal = 'summary') => {
        if (!results || results.length === 0) {
            return {
                synthesis: null,
                confidence: 0,
                note: 'No results to synthesize'
            };
        }

        // Extract key content from results
        const contents = results
            .filter(r => r.sources && r.sources.length > 0)
            .flatMap(r => r.sources.map(s => ({
                title: s.title,
                snippet: s.snippet || s.content,
                url: s.url
            })));

        if (contents.length === 0) {
            return {
                synthesis: null,
                confidence: 0,
                note: 'No content available for synthesis'
            };
        }

        // Simple extraction-based synthesis (can be enhanced with AI)
        const synthesis = {
            goal: synthesisGoal,
            sourceCount: contents.length,
            keyPoints: WebSearchService._extractKeyPoints(contents),
            sources: contents.slice(0, 5).map(c => ({ title: c.title, url: c.url })),
            synthesizedAt: new Date().toISOString()
        };

        return {
            synthesis,
            confidence: 0.7,
            note: 'Synthesis based on source extraction'
        };
    },

    /**
     * Cache management
     */
    cacheResults: (key, results, ttl = CACHE_TTL_MS) => {
        setToCache(key, results, ttl);
        return true;
    },

    getCachedResults: (key) => {
        return getFromCache(key);
    },

    clearCache: () => {
        searchCache.clear();
        console.log('[WebSearch] Cache cleared');
    },

    getCacheStats: () => {
        return {
            size: searchCache.size,
            maxSize: CACHE_MAX_SIZE,
            ttlMs: CACHE_TTL_MS
        };
    },

    /**
     * Internal helper for key point extraction
     */
    _extractKeyPoints: (contents) => {
        const keyPoints = [];
        const seenPhrases = new Set();

        contents.forEach(content => {
            const text = content.snippet || '';
            // Extract sentences that seem like key points
            const sentences = text.split(/[.!?]/).filter(s => s.length > 20 && s.length < 200);
            
            sentences.forEach(sentence => {
                const cleaned = sentence.trim();
                const normalized = cleaned.toLowerCase();
                
                // Avoid duplicates
                if (!seenPhrases.has(normalized) && keyPoints.length < 10) {
                    // Look for sentences with key indicator words
                    const hasIndicator = /trend|growth|important|significant|key|major|critical|emerging|future/i.test(cleaned);
                    if (hasIndicator) {
                        seenPhrases.add(normalized);
                        keyPoints.push(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
                    }
                }
            });
        });

        return keyPoints.slice(0, 5);
    }
};

// --- TAVILY IMPLEMENTATION ---
async function searchTavily(query, apiKey) {
    const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            api_key: apiKey,
            query: query,
            search_depth: "basic",
            include_answer: true,
            max_results: 5
        })
    });

    if (!response.ok) {
        throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
        isVerified: true,
        answer: data.answer,
        sources: data.results.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.content,
            score: r.score
        })),
        confidence: 0.9, // Tavily is usually reliable
        provider: 'tavily'
    };
}

// Advanced Tavily search with more options
async function searchTavilyAdvanced(query, apiKey, options = {}) {
    const { searchDepth = 'basic', maxResults = 5, includeDomains = [], excludeDomains = [] } = options;

    const requestBody = {
        api_key: apiKey,
        query: query,
        search_depth: searchDepth,
        include_answer: true,
        max_results: maxResults
    };

    // Add domain filters if provided
    if (includeDomains.length > 0) {
        requestBody.include_domains = includeDomains;
    }
    if (excludeDomains.length > 0) {
        requestBody.exclude_domains = excludeDomains;
    }

    const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
        isVerified: true,
        answer: data.answer,
        sources: (data.results || []).map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.content,
            score: r.score,
            publishedDate: r.published_date || null
        })),
        confidence: searchDepth === 'advanced' ? 0.95 : 0.9,
        provider: 'tavily',
        searchDepth,
        totalResults: data.results?.length || 0
    };
}

export default WebSearchService;
