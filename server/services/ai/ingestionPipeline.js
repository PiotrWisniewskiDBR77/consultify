/**
 * Knowledge Base Ingestion Pipeline
 * 
 * Handles document ingestion, chunking, and embedding generation
 * for the RAG (Retrieval Augmented Generation) system.
 */

const { embeddingService } = require('./embeddingService');
const { aiLogger } = require('./logger');
const db = require('../../database');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

// Chunking configuration
const CHUNK_CONFIG = {
    targetSize: 800,      // Target tokens per chunk
    maxSize: 1200,        // Maximum tokens per chunk
    overlapSize: 150,     // Token overlap between chunks
    minSize: 100          // Minimum chunk size
};

// Document types with parsing configs
const DOCUMENT_TYPES = {
    markdown: { extensions: ['.md', '.mdx'], parser: 'markdown' },
    text: { extensions: ['.txt'], parser: 'text' },
    json: { extensions: ['.json'], parser: 'json' }
};

class IngestionPipeline {
    constructor() {
        this.stats = {
            documentsProcessed: 0,
            chunksCreated: 0,
            errors: 0
        };
    }

    /**
     * Ingest a document from file path
     * @param {string} filePath - Path to the document
     * @param {Object} options - Ingestion options
     */
    async ingestFile(filePath, options = {}) {
        const {
            organizationId,
            sourceType = 'knowledge_base',
            metadata = {}
        } = options;

        try {
            aiLogger.info('Ingestion', `Processing file: ${filePath}`);

            // Read file content
            const content = await fs.readFile(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            const extension = path.extname(filePath).toLowerCase();

            // Determine document type
            const docType = Object.entries(DOCUMENT_TYPES).find(
                ([, config]) => config.extensions.includes(extension)
            );

            if (!docType) {
                throw new Error(`Unsupported file type: ${extension}`);
            }

            // Parse document
            const parsedContent = this._parseDocument(content, docType[1].parser);

            // Create document record
            const documentId = uuidv4();

            // Chunk the content
            const chunks = this._smartChunk(parsedContent, {
                fileName,
                documentId,
                ...metadata
            });

            aiLogger.info('Ingestion', `Created ${chunks.length} chunks from ${fileName}`);

            // Generate embeddings and store chunks
            let storedCount = 0;
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                
                try {
                    const embedding = await embeddingService.generateEmbedding(chunk.content);
                    
                    await embeddingService.storeChunk({
                        content: chunk.content,
                        chunkIndex: i,
                        documentId,
                        organizationId,
                        sourceType,
                        metadata: {
                            fileName,
                            ...chunk.metadata,
                            ...metadata
                        }
                    }, embedding);

                    storedCount++;
                } catch (error) {
                    aiLogger.warn('Ingestion', `Failed to embed chunk ${i}: ${error.message}`);
                    this.stats.errors++;
                }
            }

            this.stats.documentsProcessed++;
            this.stats.chunksCreated += storedCount;

            aiLogger.info('Ingestion', `Completed ${fileName}: ${storedCount}/${chunks.length} chunks stored`);

            return {
                documentId,
                fileName,
                chunksCreated: storedCount,
                totalChunks: chunks.length
            };

        } catch (error) {
            aiLogger.error('Ingestion', `Failed to process ${filePath}: ${error.message}`);
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Ingest multiple files from a directory
     * @param {string} dirPath - Directory path
     * @param {Object} options - Ingestion options
     */
    async ingestDirectory(dirPath, options = {}) {
        const { recursive = true, pattern, ...ingestionOptions } = options;

        try {
            const files = await this._listFiles(dirPath, { recursive, pattern });
            
            aiLogger.info('Ingestion', `Found ${files.length} files in ${dirPath}`);

            const results = [];
            for (const file of files) {
                try {
                    const result = await this.ingestFile(file, ingestionOptions);
                    results.push(result);
                } catch (error) {
                    results.push({
                        file,
                        error: error.message
                    });
                }
            }

            return {
                totalFiles: files.length,
                successful: results.filter(r => !r.error).length,
                failed: results.filter(r => r.error).length,
                results
            };
        } catch (error) {
            aiLogger.error('Ingestion', `Failed to process directory: ${error.message}`);
            throw error;
        }
    }

    /**
     * Ingest text content directly
     * @param {string} content - Text content
     * @param {Object} options - Ingestion options
     */
    async ingestText(content, options = {}) {
        const {
            title,
            organizationId,
            sourceType = 'knowledge_base',
            metadata = {}
        } = options;

        try {
            const documentId = uuidv4();

            // Chunk the content
            const chunks = this._smartChunk(content, {
                title,
                documentId,
                ...metadata
            });

            // Generate embeddings and store chunks
            let storedCount = 0;
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                
                try {
                    const embedding = await embeddingService.generateEmbedding(chunk.content);
                    
                    await embeddingService.storeChunk({
                        content: chunk.content,
                        chunkIndex: i,
                        documentId,
                        organizationId,
                        sourceType,
                        metadata: {
                            title,
                            ...chunk.metadata,
                            ...metadata
                        }
                    }, embedding);

                    storedCount++;
                } catch (error) {
                    aiLogger.warn('Ingestion', `Failed to embed chunk ${i}: ${error.message}`);
                }
            }

            this.stats.documentsProcessed++;
            this.stats.chunksCreated += storedCount;

            return {
                documentId,
                title,
                chunksCreated: storedCount,
                totalChunks: chunks.length
            };

        } catch (error) {
            aiLogger.error('Ingestion', `Failed to ingest text: ${error.message}`);
            throw error;
        }
    }

    /**
     * Parse document based on type
     * @private
     */
    _parseDocument(content, parser) {
        switch (parser) {
            case 'markdown':
                // Remove code blocks but keep meaningful content
                return content
                    .replace(/```[\s\S]*?```/g, '\n[CODE BLOCK]\n')
                    .replace(/`[^`]+`/g, match => match.replace(/`/g, ''));

            case 'json':
                try {
                    const parsed = JSON.parse(content);
                    return JSON.stringify(parsed, null, 2);
                } catch {
                    return content;
                }

            case 'text':
            default:
                return content;
        }
    }

    /**
     * Smart chunking with semantic awareness
     * @private
     */
    _smartChunk(content, metadata = {}) {
        const chunks = [];
        
        // Split by natural boundaries (headers, paragraphs)
        const sections = content.split(/(?=^#{1,3}\s)/m);
        
        let currentChunk = '';
        let chunkMetadata = { ...metadata };

        for (const section of sections) {
            // Check if this is a header
            const headerMatch = section.match(/^(#{1,3})\s+(.+?)[\r\n]/);
            if (headerMatch) {
                const level = headerMatch[1].length;
                const title = headerMatch[2].trim();
                
                if (level === 1) {
                    chunkMetadata.section = title;
                } else if (level === 2) {
                    chunkMetadata.subsection = title;
                }
            }

            const tokenEstimate = this._estimateTokens(currentChunk + section);

            // If adding this section exceeds max size
            if (tokenEstimate > CHUNK_CONFIG.maxSize && currentChunk.length > 0) {
                // Save current chunk
                if (this._estimateTokens(currentChunk) >= CHUNK_CONFIG.minSize) {
                    chunks.push({
                        content: currentChunk.trim(),
                        metadata: { ...chunkMetadata }
                    });
                }

                // Start new chunk with overlap
                const overlap = this._getOverlap(currentChunk);
                currentChunk = overlap + section;
            } else {
                currentChunk += section;
            }

            // If current chunk is at target size, consider splitting
            if (this._estimateTokens(currentChunk) >= CHUNK_CONFIG.targetSize) {
                const paragraphs = currentChunk.split(/\n\n+/);
                
                if (paragraphs.length > 1) {
                    // Find good split point
                    let splitContent = '';
                    let remaining = '';
                    
                    for (const para of paragraphs) {
                        if (this._estimateTokens(splitContent + para) < CHUNK_CONFIG.targetSize) {
                            splitContent += para + '\n\n';
                        } else {
                            remaining += para + '\n\n';
                        }
                    }

                    if (splitContent.trim() && this._estimateTokens(splitContent) >= CHUNK_CONFIG.minSize) {
                        chunks.push({
                            content: splitContent.trim(),
                            metadata: { ...chunkMetadata }
                        });
                        currentChunk = this._getOverlap(splitContent) + remaining;
                    }
                }
            }
        }

        // Don't forget the last chunk
        if (currentChunk.trim() && this._estimateTokens(currentChunk) >= CHUNK_CONFIG.minSize) {
            chunks.push({
                content: currentChunk.trim(),
                metadata: { ...chunkMetadata }
            });
        }

        return chunks;
    }

    /**
     * Get overlap text from end of chunk
     * @private
     */
    _getOverlap(text) {
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
        let overlap = '';
        
        for (let i = sentences.length - 1; i >= 0; i--) {
            if (this._estimateTokens(overlap + sentences[i]) > CHUNK_CONFIG.overlapSize) {
                break;
            }
            overlap = sentences[i] + overlap;
        }

        return overlap.trim() + '\n\n';
    }

    /**
     * Estimate token count
     * @private
     */
    _estimateTokens(text) {
        // Rough estimation: 1 token ≈ 4 characters for English
        // For Polish/mixed, use 3 characters
        return Math.ceil((text || '').length / 3);
    }

    /**
     * List files in directory
     * @private
     */
    async _listFiles(dirPath, options = {}) {
        const { recursive = true, pattern } = options;
        const files = [];
        
        const supportedExtensions = Object.values(DOCUMENT_TYPES)
            .flatMap(t => t.extensions);

        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory() && recursive) {
                const subFiles = await this._listFiles(fullPath, options);
                files.push(...subFiles);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (supportedExtensions.includes(ext)) {
                    if (!pattern || new RegExp(pattern).test(entry.name)) {
                        files.push(fullPath);
                    }
                }
            }
        }

        return files;
    }

    /**
     * Get ingestion statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            documentsProcessed: 0,
            chunksCreated: 0,
            errors: 0
        };
    }
}

// Singleton instance
const ingestionPipeline = new IngestionPipeline();

module.exports = {
    IngestionPipeline,
    ingestionPipeline,
    CHUNK_CONFIG,
    DOCUMENT_TYPES
};
