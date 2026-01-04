/**
 * Re-ranker Service
 *
 * Uses LLM to re-rank retrieved documents based on relevance to query.
 * This improves RAG precision by leveraging semantic understanding.
 *
 * @module rerankerService
 */
import { OpenAI } from 'openai';
interface Database {
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
}
interface AILogger {
    info: (service: string, message: string, data?: unknown) => void;
    debug: (service: string, message: string, data?: unknown) => void;
    warn: (service: string, message: string) => void;
    error: (service: string, message: string) => void;
}
export interface Document {
    id?: string;
    content: string;
    hybridScore?: number;
    score?: number;
    rerankerScore?: number;
    combinedScore?: number;
    originalRank?: number;
    rerankedPosition?: number;
    rankChange?: number;
    rerankerFailed?: boolean;
    rerankerMethod?: string;
}
export interface RerankerOptions {
    useCache?: boolean;
    model?: string;
}
export interface RerankerMetrics {
    documentsRanked: number;
    topKReturned: number;
    avgScoreChange: number;
    model: string;
}
export interface CacheEntry {
    results: Document[];
    timestamp: number;
}
export interface RerankerStatistics {
    cacheSize: number;
    config: typeof RERANKER_CONFIG;
}
interface Dependencies {
    db: Database;
    aiLogger: AILogger;
    OpenAI: typeof OpenAI;
}
/**
 * Set dependencies (for testing)
 */
export declare function setDependencies(newDeps?: Partial<Dependencies>): void;
declare const RERANKER_CONFIG: {
    readonly model: "gpt-4o-mini";
    readonly maxDocuments: 10;
    readonly timeout: 15000;
    readonly batchSize: 5;
    readonly cacheEnabled: true;
    readonly cacheTTL: 3600000;
};
export interface RerankerService {
    rerankDocuments: (query: string, documents: Document[], topK?: number, options?: RerankerOptions) => Promise<Document[]>;
    rerankCrossEncoder: (query: string, documents: Document[], topK?: number) => Promise<Document[]>;
    getStatistics: () => Promise<RerankerStatistics>;
    clearCache: () => Promise<void>;
}
declare const RerankerService: RerankerService;
export default RerankerService;
//# sourceMappingURL=rerankerService.d.ts.map