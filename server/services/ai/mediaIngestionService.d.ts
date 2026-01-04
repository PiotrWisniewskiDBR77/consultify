declare namespace _default {
    export { MediaIngestionService };
    export { mediaIngestionService };
}
export default _default;
/**
 * Media Ingestion Service Class
 */
export class MediaIngestionService {
    processors: {
        docx: any;
        spreadsheet: any;
        pptx: any;
        youtube: any;
        audio: any;
        video: any;
        image: any;
        url: any;
    };
    /**
     * Main ingestion method - automatically detects input type and processes
     *
     * @param {string|Buffer} input - File path, URL, YouTube URL, or buffer
     * @param {Object} options - Processing options
     * @param {string} options.organizationId - Organization ID for storage
     * @param {string} options.projectId - Optional project ID
     * @param {string} options.language - Language code for transcription
     * @param {string} options.source - Source identifier ('upload', 'url', 'youtube')
     * @param {string} options.filename - Original filename (for buffers)
     * @returns {Promise<Object>} Ingestion result
     */
    ingest(input: string | Buffer, options?: {
        organizationId: string;
        projectId: string;
        language: string;
        source: string;
        filename: string;
    }): Promise<Object>;
    /**
     * Process a file based on its extension
     */
    processFile(filePath: any, options?: {}): Promise<any>;
    /**
     * Process PDF file (using existing pdf-parse)
     */
    processPdf(filePath: any, options?: {}): Promise<{
        text: any;
        metadata: {
            type: string;
            filename: string;
            fileSize: number;
            pageCount: any;
            characterCount: any;
        };
    }>;
    /**
     * Process plain text file
     */
    processText(filePath: any, options?: {}): Promise<{
        text: string;
        metadata: {
            type: string;
            filename: string;
            fileSize: number;
            characterCount: number;
        };
    }>;
    /**
     * Process buffer with filename hint
     */
    processBuffer(buffer: any, options?: {}): Promise<any>;
    /**
     * Process YouTube URL
     */
    processYouTube(url: any, options?: {}): Promise<any>;
    /**
     * Process web URL
     */
    processUrl(url: any, options?: {}): Promise<any>;
    /**
     * Store processed content in knowledge base
     */
    storeContent(data: any): Promise<any>;
    /**
     * Check if URL is a YouTube URL
     */
    isYouTubeUrl(input: any): boolean;
    /**
     * Check if input is a URL
     */
    isUrl(input: any): boolean;
    /**
     * Count words in text
     */
    countWords(text: any): any;
    /**
     * Get all supported file types
     */
    getSupportedTypes(): {
        documents: string[];
        audio: string[];
        video: string[];
        images: string[];
        urls: string[];
        maxFileSize: string;
        audioVideoMaxDuration: string;
    };
    /**
     * Check if a file type is supported
     */
    isSupported(input: any): boolean;
    /**
     * Get processor for a specific type
     */
    getProcessor(type: any): any;
    /**
     * Get processing capabilities
     */
    getCapabilities(): {
        documents: {
            pdf: {
                parser: string;
                features: string[];
            };
            docx: {
                parser: string;
                features: string[];
            };
            xlsx: {
                parser: string;
                features: string[];
            };
            pptx: {
                parser: string;
                features: string[];
            };
        };
        media: {
            audio: {
                parser: string;
                features: string[];
                languages: any;
            };
            video: {
                parser: string;
                features: string[];
                requires: string;
            };
            image: {
                parser: string;
                features: string[];
                languages: any;
            };
        };
        web: {
            youtube: {
                parser: string;
                features: string[];
            };
            url: {
                parser: string;
                features: string[];
            };
        };
    };
}
export const mediaIngestionService: MediaIngestionService;
//# sourceMappingURL=mediaIngestionService.d.ts.map