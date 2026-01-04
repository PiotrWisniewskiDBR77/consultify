declare namespace _default {
    export { IngestionPipeline };
    export { ingestionPipeline };
    export { CHUNK_CONFIG };
    export { DOCUMENT_TYPES };
}
export default _default;
export class IngestionPipeline {
    stats: {
        documentsProcessed: number;
        chunksCreated: number;
        errors: number;
    };
    /**
     * Ingest a document from file path
     * @param {string} filePath - Path to the document
     * @param {Object} options - Ingestion options
     */
    ingestFile(filePath: string, options?: Object): Promise<{
        documentId: string;
        fileName: string;
        chunksCreated: number;
        totalChunks: number;
    }>;
    /**
     * Ingest multiple files from a directory
     * @param {string} dirPath - Directory path
     * @param {Object} options - Ingestion options
     */
    ingestDirectory(dirPath: string, options?: Object): Promise<{
        totalFiles: any;
        successful: number;
        failed: number;
        results: ({
            documentId: string;
            fileName: string;
            chunksCreated: number;
            totalChunks: number;
        } | {
            file: any;
            error: any;
        })[];
    }>;
    /**
     * Ingest text content directly
     * @param {string} content - Text content
     * @param {Object} options - Ingestion options
     */
    ingestText(content: string, options?: Object): Promise<{
        documentId: string;
        title: any;
        chunksCreated: number;
        totalChunks: number;
    }>;
    /**
     * Parse document based on type
     * @private
     */
    private _parseDocument;
    /**
     * Smart chunking with semantic awareness
     * @private
     */
    private _smartChunk;
    /**
     * Get overlap text from end of chunk
     * @private
     */
    private _getOverlap;
    /**
     * Estimate token count
     * @private
     */
    private _estimateTokens;
    /**
     * List files in directory
     * @private
     */
    private _listFiles;
    /**
     * Get ingestion statistics
     */
    getStats(): {
        documentsProcessed: number;
        chunksCreated: number;
        errors: number;
    };
    /**
     * Reset statistics
     */
    resetStats(): void;
}
export const ingestionPipeline: IngestionPipeline;
export namespace CHUNK_CONFIG {
    let targetSize: number;
    let maxSize: number;
    let overlapSize: number;
    let minSize: number;
}
export namespace DOCUMENT_TYPES {
    namespace markdown {
        let extensions: string[];
        let parser: string;
    }
    namespace text {
        let extensions_1: string[];
        export { extensions_1 as extensions };
        let parser_1: string;
        export { parser_1 as parser };
    }
    namespace json {
        let extensions_2: string[];
        export { extensions_2 as extensions };
        let parser_2: string;
        export { parser_2 as parser };
    }
}
//# sourceMappingURL=ingestionPipeline.d.ts.map