declare namespace _default {
    export { EmbeddingService };
    export { embeddingService };
    export { EMBEDDING_MODEL };
    export { EMBEDDING_DIMENSIONS };
}
export default _default;
export class EmbeddingService {
    openai: import("@ai-sdk/openai").OpenAIProvider | null;
    initProvider(): void;
    /**
     * Generate embedding for a text chunk
     * @param {string} text - Text to embed
     * @returns {number[]} Embedding vector
     */
    generateEmbedding(text: string): number[];
    /**
     * Store chunk with embedding in database
     * Works with both SQLite (JSON) and PostgreSQL (pgvector)
     */
    storeChunk(chunk: any, embedding: any): Promise<any>;
    storeChunkSqlite(chunk: any, embedding: any): Promise<any>;
    storeChunkPg(chunk: any, embedding: any): Promise<any>;
    /**
     * Search for similar chunks using cosine similarity
     * @param {string} query - Search query
     * @param {Object} options - Search options
     */
    search(query: string, options?: Object): Promise<any>;
    /**
     * SQLite search - compute cosine similarity in JS
     */
    searchSqlite(queryEmbedding: any, options: any): Promise<any>;
    /**
     * PostgreSQL search - use pgvector operators
     */
    searchPg(queryEmbedding: any, options: any): Promise<any>;
    /**
     * Compute cosine similarity between two vectors
     */
    cosineSimilarity(a: any, b: any): number;
    /**
     * Ensure the embeddings table exists
     */
    ensureTable(): Promise<any>;
}
export const embeddingService: EmbeddingService;
export const EMBEDDING_MODEL: "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS: 1536;
//# sourceMappingURL=embeddingService.d.ts.map