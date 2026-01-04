declare namespace _default {
    export { WebResearchService };
    export { webResearchService };
    export { INDUSTRY_KEYWORDS };
    export { AXIS_SEARCH_TOPICS };
}
export default _default;
export class WebResearchService {
    perplexityApiKey: string | undefined;
    tavilyApiKey: string | undefined;
    geminiApiKey: string | undefined;
    serperApiKey: string | undefined;
    googleSearchApiKey: string | undefined;
    googleSearchEngineId: string | undefined;
    genAI: GoogleGenerativeAI | undefined;
    model: import("@google/generative-ai").GenerativeModel | undefined;
    cache: Map<any, any>;
    cacheMaxAge: number;
    backend: string;
    _detectBackend(): "google" | "tavily" | "perplexity" | "serper" | "gemini" | "mock";
    /**
     * Search for industry benchmarks for a specific axis
     */
    searchIndustryBenchmarks(industry: any, axisId: any, options?: {}): Promise<any>;
    /**
     * Find case studies for transformation type
     */
    findCaseStudies(industry: any, transformationType: any, options?: {}): Promise<any>;
    /**
     * Get technology trends for a domain
     */
    getTechnologyTrends(domain: any, options?: {}): Promise<any>;
    /**
     * Get competitor/leader practices for an axis
     */
    getLeaderPractices(industry: any, axisId: any, options?: {}): Promise<any>;
    /**
     * Comprehensive research for a full report
     */
    conductFullResearch(industry: any, assessmentData: any, options?: {}): Promise<{
        success: boolean;
        timestamp: string;
        industry: any;
        data: {
            industryOverview: any;
            benchmarks: any[];
            caseStudies: any;
            trends: any;
            leaderPractices: any;
        };
        priorityAxes: string[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data: {
            industryOverview: {
                industry: any;
                summary: string;
                source: string;
            };
            benchmarks: {
                axisId: any;
                industry: any;
                summary: string;
                data: any;
                source: string;
                note: string;
                retrievedAt: string;
            }[];
            caseStudies: {
                industry: any;
                transformationType: any;
                caseStudies: any;
                source: string;
                note: string;
                retrievedAt: string;
            };
            trends: {
                domain: any;
                trends: any;
                source: string;
                year: number;
                retrievedAt: string;
            };
            leaderPractices: {
                industry: any;
                axisId: any;
                leaders: any;
                practices: any;
                source: string;
                retrievedAt: string;
            };
        };
        timestamp?: undefined;
        industry?: undefined;
        priorityAxes?: undefined;
    }>;
    _executeSearch(query: any, options?: {}): Promise<{
        content: any;
        citations: any;
        source: string;
    }>;
    _searchPerplexity(query: any, options?: {}): Promise<{
        content: any;
        citations: any;
        source: string;
    }>;
    _searchTavily(query: any, options?: {}): Promise<{
        content: any;
        results: any;
        citations: any;
        source: string;
    }>;
    /**
     * Search using Serper.dev (Google Search API wrapper)
     * Docs: https://serper.dev/
     * Cost: ~$0.001 per search
     */
    _searchSerper(query: any, options?: {}): Promise<{
        content: string;
        results: any;
        citations: any;
        knowledgeGraph: any;
        source: string;
        query: any;
    }>;
    /**
     * Search using Google Custom Search API (official)
     * Docs: https://developers.google.com/custom-search/v1/overview
     * Cost: Free 100/day, then $5 per 1000 queries
     */
    _searchGoogle(query: any, options?: {}): Promise<{
        content: string;
        results: any;
        citations: any;
        searchInfo: {
            totalResults: any;
            searchTime: any;
        };
        source: string;
        query: any;
    }>;
    _searchGemini(query: any, options?: {}): Promise<{
        content: string;
        citations: never[];
        source: string;
        note: string;
    }>;
    _mockSearch(query: any, options?: {}): Promise<{
        content: string;
        citations: never[];
        source: string;
        isMock: boolean;
    }>;
    _processBenchmarkResults(results: any, axisId: any, industry: any): {
        axisId: any;
        industry: any;
        summary: any;
        statistics: any;
        dataYear: number;
        citations: any;
        source: any;
        retrievedAt: string;
    };
    _processCaseStudyResults(results: any, industry: any, transformationType: any): {
        industry: any;
        transformationType: any;
        summary: any;
        mentionedCompanies: any[];
        citations: any;
        source: any;
        retrievedAt: string;
    };
    _processTrendResults(results: any, domain: any): {
        domain: any;
        summary: any;
        fullContent: any;
        citations: any;
        source: any;
        retrievedAt: string;
    };
    _processLeaderResults(results: any, industry: any, axisId: any): {
        industry: any;
        axisId: any;
        summary: any;
        leaders: any;
        allIndustryLeaders: any;
        citations: any;
        source: any;
        retrievedAt: string;
    };
    _getFallbackBenchmarks(industry: any, axisId: any): {
        axisId: any;
        industry: any;
        summary: string;
        data: any;
        source: string;
        note: string;
        retrievedAt: string;
    };
    _getFallbackCaseStudies(industry: any, transformationType: any): {
        industry: any;
        transformationType: any;
        caseStudies: any;
        source: string;
        note: string;
        retrievedAt: string;
    };
    _getFallbackTrends(domain: any): {
        domain: any;
        trends: any;
        source: string;
        year: number;
        retrievedAt: string;
    };
    _getFallbackLeaderPractices(industry: any, axisId: any): {
        industry: any;
        axisId: any;
        leaders: any;
        practices: any;
        source: string;
        retrievedAt: string;
    };
    _getComprehensiveFallback(industry: any, assessmentData: any): {
        industryOverview: {
            industry: any;
            summary: string;
            source: string;
        };
        benchmarks: {
            axisId: any;
            industry: any;
            summary: string;
            data: any;
            source: string;
            note: string;
            retrievedAt: string;
        }[];
        caseStudies: {
            industry: any;
            transformationType: any;
            caseStudies: any;
            source: string;
            note: string;
            retrievedAt: string;
        };
        trends: {
            domain: any;
            trends: any;
            source: string;
            year: number;
            retrievedAt: string;
        };
        leaderPractices: {
            industry: any;
            axisId: any;
            leaders: any;
            practices: any;
            source: string;
            retrievedAt: string;
        };
    };
    _identifyPriorityAxes(assessmentData: any): {
        id: string;
        gap: number;
        topics: any;
    }[];
    _getFromCache(key: any): any;
    _setCache(key: any, data: any): void;
    /**
     * Get service status
     */
    getStatus(): {
        backend: string;
        cacheSize: number;
        hasPerplexity: boolean;
        hasTavily: boolean;
        hasSerper: boolean;
        hasGoogleSearch: boolean;
        hasGemini: boolean;
        supportedIndustries: string[];
        supportedAxes: string[];
        backendPriority: string[];
    };
    /**
     * Force use a specific backend for testing
     */
    setBackend(backend: any): void;
    /**
     * Synthesize findings from multiple research results using AI
     * @param {Array} results - Array of research results to synthesize
     * @param {Object} context - Context for synthesis (industry, focus area, etc.)
     */
    synthesizeFindings(results: any[], context?: Object): Promise<{
        synthesis: string;
        citations: never[];
        method?: undefined;
        sourceCount?: undefined;
        error?: undefined;
    } | {
        synthesis: string;
        citations: any[];
        method: string;
        sourceCount?: undefined;
        error?: undefined;
    } | {
        synthesis: string;
        citations: any[];
        sourceCount: number;
        method: string;
        error?: undefined;
    } | {
        synthesis: string;
        citations: any[];
        method: string;
        error: any;
        sourceCount?: undefined;
    }>;
    /**
     * Search for best practices in a specific axis
     * @param {string} axisId - DRD axis identifier
     * @param {Object} options - Search options
     */
    searchBestPractices(axisId: string, options?: Object): Promise<any>;
    /**
     * Extract structured practices from content
     * @private
     */
    private _extractPractices;
    /**
     * Get fallback best practices
     * @private
     */
    private _getFallbackBestPractices;
    /**
     * Track citations for audit and attribution
     * @param {string} reportId - Report ID for tracking
     * @param {Array} citations - Citations to track
     */
    trackCitations(reportId: string, citations: any[]): {
        reportId: string;
        citations: {
            url: any;
            title: any;
            accessedAt: string;
        }[];
        trackedAt: string;
    };
}
export const webResearchService: WebResearchService;
export namespace INDUSTRY_KEYWORDS {
    namespace manufacturing {
        let pl: string[];
        let en: string[];
        let leaders: string[];
    }
    namespace retail {
        let pl_1: string[];
        export { pl_1 as pl };
        let en_1: string[];
        export { en_1 as en };
        let leaders_1: string[];
        export { leaders_1 as leaders };
    }
    namespace financial {
        let pl_2: string[];
        export { pl_2 as pl };
        let en_2: string[];
        export { en_2 as en };
        let leaders_2: string[];
        export { leaders_2 as leaders };
    }
    namespace healthcare {
        let pl_3: string[];
        export { pl_3 as pl };
        let en_3: string[];
        export { en_3 as en };
        let leaders_3: string[];
        export { leaders_3 as leaders };
    }
    namespace technology {
        let pl_4: string[];
        export { pl_4 as pl };
        let en_4: string[];
        export { en_4 as en };
        let leaders_4: string[];
        export { leaders_4 as leaders };
    }
    namespace logistics {
        let pl_5: string[];
        export { pl_5 as pl };
        let en_5: string[];
        export { en_5 as en };
        let leaders_5: string[];
        export { leaders_5 as leaders };
    }
    namespace energy {
        let pl_6: string[];
        export { pl_6 as pl };
        let en_6: string[];
        export { en_6 as en };
        let leaders_6: string[];
        export { leaders_6 as leaders };
    }
}
export namespace AXIS_SEARCH_TOPICS {
    namespace processes {
        let topics: string[];
        let benchmarkQueries: string[];
    }
    namespace digitalProducts {
        let topics_1: string[];
        export { topics_1 as topics };
        let benchmarkQueries_1: string[];
        export { benchmarkQueries_1 as benchmarkQueries };
    }
    namespace businessModels {
        let topics_2: string[];
        export { topics_2 as topics };
        let benchmarkQueries_2: string[];
        export { benchmarkQueries_2 as benchmarkQueries };
    }
    namespace dataManagement {
        let topics_3: string[];
        export { topics_3 as topics };
        let benchmarkQueries_3: string[];
        export { benchmarkQueries_3 as benchmarkQueries };
    }
    namespace culture {
        let topics_4: string[];
        export { topics_4 as topics };
        let benchmarkQueries_4: string[];
        export { benchmarkQueries_4 as benchmarkQueries };
    }
    namespace cybersecurity {
        let topics_5: string[];
        export { topics_5 as topics };
        let benchmarkQueries_5: string[];
        export { benchmarkQueries_5 as benchmarkQueries };
    }
    namespace aiMaturity {
        let topics_6: string[];
        export { topics_6 as topics };
        let benchmarkQueries_6: string[];
        export { benchmarkQueries_6 as benchmarkQueries };
    }
}
import { GoogleGenerativeAI } from '@google/generative-ai';
//# sourceMappingURL=webResearchService.d.ts.map