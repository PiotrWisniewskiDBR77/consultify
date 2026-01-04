export default WebSearchService;
declare namespace WebSearchService {
    function verifyFact(query: any): Promise<{
        isVerified: boolean;
        answer: any;
        sources: any;
        confidence: number;
        provider: string;
    } | {
        isVerified: boolean;
        sources: never[];
        confidence: number;
        note: string;
    }>;
    function search(query: any): Promise<{
        isVerified: boolean;
        answer: any;
        sources: any;
        confidence: number;
        provider: string;
    } | {
        isVerified: boolean;
        sources: never[];
        confidence: number;
        note: string;
    }>;
    function searchWithContext(query: string, context?: {
        industry: string;
        companySize: string;
        priorities: string[];
    }, options?: Object): Promise<SearchResult>;
    function synthesizeResults(results: Object[], synthesisGoal?: string): Promise<SynthesizedResult>;
    function cacheResults(key: any, results: any, ttl?: number): boolean;
    function getCachedResults(key: any): any;
    function clearCache(): void;
    function getCacheStats(): {
        size: number;
        maxSize: number;
        ttlMs: number;
    };
    function _extractKeyPoints(contents: any): any[];
}
//# sourceMappingURL=webSearchService.d.ts.map