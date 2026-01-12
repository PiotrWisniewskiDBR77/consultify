export default RagService;
declare namespace RagService {
    function setDependencies(newDeps?: {}): void;
    function generateEmbedding(text: any): Promise<any>;
    function getContext(query: string, limit?: number, filterOptions?: Object): Promise<any>;
    function getContextKeyword(query: any, limit?: number, organizationId?: null): Promise<any>;
    function storeChunks(docId: any, chunks: any): Promise<void>;
    function getAxisDefinitions(axisName: any): Promise<any>;
    function searchRelevantChunks(query: string, options?: Object): Promise<any>;
    function ingestDocument(params: Object): Promise<{
        documentId: any;
        totalChunks: any;
        embeddedChunks: number;
        success: boolean;
    }>;
    function bm25Search(query: string, limit?: number, organizationId?: string): Promise<any[]>;
    function hybridSearch(query: string, options?: Object): Promise<any[]>;
    function _vectorSearch(query: any, limit: any, organizationId: any): Promise<any>;
    function _logSearchMetrics(query: any, organizationId: any, metrics: any): Promise<void>;
    function getContextHybrid(query: string, options?: Object): Promise<{
        context: string;
        sources: {
            filename: any;
            score: any;
            method: any;
            breakdown: any;
        }[];
        metrics: {
            totalResults: number;
            topScore: any;
            method: string;
        };
    }>;
}
//# sourceMappingURL=ragService.d.ts.map