declare namespace _default {
    export { KnowledgeIndexer };
    export { knowledgeIndexer };
    export { KNOWLEDGE_SOURCES };
}
export default _default;
export class KnowledgeIndexer {
    projectRoot: string;
    embeddingService: import("./embeddingService.js").EmbeddingService | null;
    /**
     * Initialize the indexer with embedding service
     */
    initialize(): Promise<boolean>;
    /**
     * Ensure required database tables exist
     */
    ensureTables(): Promise<any>;
    /**
     * Index all configured knowledge sources
     */
    indexAll(options?: {}): Promise<{
        success: never[];
        failed: never[];
        skipped: never[];
    }>;
    /**
     * Index a single file
     */
    indexFile(filePath: any, config: any): Promise<{
        docId: string;
        filename: string;
        chunkCount: number;
    }>;
    /**
     * Extract text content from PDF
     */
    extractPdfContent(filePath: any): Promise<any>;
    /**
     * Extract content from Excel file
     */
    extractExcelContent(filePath: any): Promise<{}>;
    /**
     * Process Excel content into chunks
     */
    processExcelChunks(sheetContents: any, config: any): string[];
    /**
     * Split text into overlapping chunks
     */
    chunkText(text: any, chunkSize?: number, overlap?: number): any[];
    /**
     * Generate embedding for text
     */
    generateEmbedding(text: any): Promise<string | null>;
    /**
     * Insert document record
     */
    insertDocument(doc: any): Promise<any>;
    /**
     * Insert chunk record
     */
    insertChunk(chunk: any): Promise<any>;
    /**
     * Get document by file path
     */
    getDocByPath(filepath: any): Promise<any>;
    /**
     * Search knowledge base
     */
    search(query: any, options?: {}): Promise<any>;
    /**
     * Keyword-based fallback search
     */
    keywordSearch(query: any, options?: {}): Promise<any>;
    /**
     * Get all chunks with embeddings
     */
    getAllChunksWithEmbeddings(sourceTypes?: null): Promise<any>;
    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(vecA: any, vecB: any): number;
    /**
     * Get indexing statistics
     */
    getStats(): Promise<any>;
    /**
     * Delete all indexed content for a source type
     */
    deleteSource(sourceType: any): Promise<any>;
}
export const knowledgeIndexer: KnowledgeIndexer;
export namespace KNOWLEDGE_SOURCES {
    namespace methodology {
        let name: string;
        let files: string[];
        let chunkSize: number;
        let overlap: number;
        namespace metadata {
            let type: string;
            let weight: number;
        }
    }
    namespace initiatives {
        let name_1: string;
        export { name_1 as name };
        let files_1: string[];
        export { files_1 as files };
        export let parser: string;
        export namespace metadata_1 {
            let type_1: string;
            export { type_1 as type };
            let weight_1: number;
            export { weight_1 as weight };
        }
        export { metadata_1 as metadata };
    }
    namespace engine {
        let name_2: string;
        export { name_2 as name };
        let files_2: string[];
        export { files_2 as files };
        let parser_1: string;
        export { parser_1 as parser };
        export namespace metadata_2 {
            let type_2: string;
            export { type_2 as type };
            let weight_2: number;
            export { weight_2 as weight };
        }
        export { metadata_2 as metadata };
    }
    namespace maturity {
        let name_3: string;
        export { name_3 as name };
        let files_3: string[];
        export { files_3 as files };
        let parser_2: string;
        export { parser_2 as parser };
        export namespace metadata_3 {
            let type_3: string;
            export { type_3 as type };
            let weight_3: number;
            export { weight_3 as weight };
        }
        export { metadata_3 as metadata };
    }
    namespace rapid {
        let name_4: string;
        export { name_4 as name };
        let files_4: string[];
        export { files_4 as files };
        let chunkSize_1: number;
        export { chunkSize_1 as chunkSize };
        let overlap_1: number;
        export { overlap_1 as overlap };
        export namespace metadata_4 {
            let type_4: string;
            export { type_4 as type };
            let weight_4: number;
            export { weight_4 as weight };
        }
        export { metadata_4 as metadata };
    }
}
//# sourceMappingURL=knowledgeIndexer.d.ts.map