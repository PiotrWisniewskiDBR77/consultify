/**
 * Media Ingestion Service
 * 
 * Unified orchestrator for processing various media types and adding them
 * to the AI knowledge base. Supports documents, audio, video, images, 
 * YouTube videos, and web URLs.
 * 
 * Part of the Multimodal Content Ingestion System
 * 
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import processors
import docxProcessor from './processors/docxProcessor';
import spreadsheetProcessor from './processors/spreadsheetProcessor';
import pptxProcessor from './processors/pptxProcessor';
import youtubeProcessor from './processors/youtubeProcessor';
import audioProcessor from './processors/audioProcessor';
import videoProcessor from './processors/videoProcessor';
import imageProcessor from './processors/imageProcessor';
import urlProcessor from './processors/urlProcessor';

// Import existing services
import RagService from '../ragService';
import KnowledgeService from '../knowledgeService';

// Import external libraries
import * as pdfParse from 'pdf-parse';
const pdf = pdfParse.default || pdfParse;

// File extension to processor mapping
const FILE_PROCESSORS = {
    // Documents
    '.pdf': 'pdf',
    '.docx': 'docx',
    '.doc': 'docx',
    '.xlsx': 'spreadsheet',
    '.xls': 'spreadsheet',
    '.csv': 'spreadsheet',
    '.tsv': 'spreadsheet',
    '.pptx': 'pptx',
    '.txt': 'text',
    '.md': 'text',
    '.json': 'text',

    // Audio
    '.mp3': 'audio',
    '.wav': 'audio',
    '.m4a': 'audio',
    '.webm': 'audio',
    '.ogg': 'audio',
    '.flac': 'audio',

    // Video
    '.mp4': 'video',
    '.avi': 'video',
    '.mov': 'video',
    '.mkv': 'video',
    '.wmv': 'video',

    // Images
    '.png': 'image',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.gif': 'image',
    '.webp': 'image',
    '.bmp': 'image',
    '.tiff': 'image',
    '.tif': 'image'
};

/**
 * Media Ingestion Service Class
 */
class MediaIngestionService {
    constructor() {
        this.processors = {
            docx: docxProcessor,
            spreadsheet: spreadsheetProcessor,
            pptx: pptxProcessor,
            youtube: youtubeProcessor,
            audio: audioProcessor,
            video: videoProcessor,
            image: imageProcessor,
            url: urlProcessor
        };
    }

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
    async ingest(input, options = {}) {
        const {
            organizationId,
            projectId = null,
            language = 'pl',
            source = 'upload',
            filename = null
        } = options;

        if (!organizationId) {
            throw new Error('organizationId is required');
        }

        const startTime = Date.now();
        let result;
        let inputType;

        try {
            // Detect input type and process accordingly
            if (this.isYouTubeUrl(input)) {
                inputType = 'youtube';
                result = await this.processYouTube(input, { language });
            } else if (this.isUrl(input)) {
                inputType = 'url';
                result = await this.processUrl(input, options);
            } else if (typeof input === 'string' && fs.existsSync(input)) {
                inputType = 'file';
                result = await this.processFile(input, { language, ...options });
            } else if (Buffer.isBuffer(input)) {
                inputType = 'buffer';
                result = await this.processBuffer(input, { language, filename, ...options });
            } else {
                throw new Error('Invalid input: expected file path, URL, YouTube URL, or Buffer');
            }

            // Store in knowledge base
            const docId = await this.storeContent({
                text: result.text,
                metadata: {
                    ...result.metadata,
                    source,
                    inputType
                },
                organizationId,
                projectId
            });

            const totalTime = Date.now() - startTime;

            return {
                success: true,
                docId,
                inputType,
                source,
                metadata: result.metadata,
                characterCount: result.text.length,
                wordCount: this.countWords(result.text),
                processingTimeMs: totalTime
            };

        } catch (error) {
            console.error('[MediaIngestion] Error:', error.message);
            throw error;
        }
    }

    /**
     * Process a file based on its extension
     */
    async processFile(filePath, options = {}) {
        const ext = path.extname(filePath).toLowerCase();
        const processorType = FILE_PROCESSORS[ext];

        if (!processorType) {
            throw new Error(`Unsupported file type: ${ext}`);
        }

        // Handle PDF separately (using existing ingestionService)
        if (processorType === 'pdf') {
            return this.processPdf(filePath, options);
        }

        // Handle plain text files
        if (processorType === 'text') {
            return this.processText(filePath, options);
        }

        // Use specialized processor
        const processor = this.processors[processorType];
        if (!processor) {
            throw new Error(`No processor available for type: ${processorType}`);
        }

        return processor.process(filePath, options);
    }

    /**
     * Process PDF file (using existing pdf-parse)
     */
    async processPdf(filePath, options = {}) {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        const stats = fs.statSync(filePath);

        return {
            text: data.text,
            metadata: {
                type: 'pdf',
                filename: path.basename(filePath),
                fileSize: stats.size,
                pageCount: data.numpages,
                characterCount: data.text.length
            }
        };
    }

    /**
     * Process plain text file
     */
    async processText(filePath, options = {}) {
        const content = fs.readFileSync(filePath, 'utf8');
        const stats = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();

        return {
            text: content,
            metadata: {
                type: ext === '.md' ? 'markdown' : ext === '.json' ? 'json' : 'text',
                filename: path.basename(filePath),
                fileSize: stats.size,
                characterCount: content.length
            }
        };
    }

    /**
     * Process buffer with filename hint
     */
    async processBuffer(buffer, options = {}) {
        const { filename } = options;

        if (!filename) {
            throw new Error('filename is required when processing buffer');
        }

        const ext = path.extname(filename).toLowerCase();
        const processorType = FILE_PROCESSORS[ext];

        if (!processorType) {
            throw new Error(`Unsupported file type: ${ext}`);
        }

        // Save to temp file and process
        const tempDir = path.join(__dirname, '../../../uploads/temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempPath = path.join(tempDir, `temp_${Date.now()}_${filename}`);

        try {
            fs.writeFileSync(tempPath, buffer);
            const result = await this.processFile(tempPath, options);
            fs.unlinkSync(tempPath);
            return result;
        } catch (error) {
            if (fs.existsSync(tempPath)) {
                try { fs.unlinkSync(tempPath); } catch (e) { }
            }
            throw error;
        }
    }

    /**
     * Process YouTube URL
     */
    async processYouTube(url, options = {}) {
        return youtubeProcessor.process(url, options);
    }

    /**
     * Process web URL
     */
    async processUrl(url, options = {}) {
        const needsJs = urlProcessor.needsJsRendering(url);
        return urlProcessor.process(url, { ...options, renderJs: needsJs });
    }

    /**
     * Store processed content in knowledge base
     */
    async storeContent(data) {
        const { text, metadata, organizationId, projectId } = data;
        const docId = uuidv4();

        try {
            // 1. Store document metadata
            await KnowledgeService.addDocument(
                metadata.filename || metadata.title || 'Ingested Content',
                null, // No file path for URL/YouTube
                organizationId,
                projectId,
                metadata.fileSize || Buffer.byteLength(text, 'utf8')
            );

            // 2. Chunk and embed using RAG service
            const chunkResult = await RagService.ingestDocument({
                content: text,
                filename: metadata.filename || metadata.title || 'content',
                mimeType: metadata.type,
                organizationId
            });

            return chunkResult.documentId || docId;

        } catch (error) {
            console.error('[MediaIngestion] Storage error:', error.message);
            // Fallback to basic storage
            return docId;
        }
    }

    /**
     * Check if URL is a YouTube URL
     */
    isYouTubeUrl(input) {
        if (typeof input !== 'string') return false;
        return /(?:youtube\.com|youtu\.be)/.test(input);
    }

    /**
     * Check if input is a URL
     */
    isUrl(input) {
        if (typeof input !== 'string') return false;
        return input.startsWith('http://') || input.startsWith('https://');
    }

    /**
     * Count words in text
     */
    countWords(text) {
        if (!text) return 0;
        return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    }

    /**
     * Get all supported file types
     */
    getSupportedTypes() {
        return {
            documents: ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.pptx', '.txt', '.md', '.json'],
            audio: ['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.flac'],
            video: ['.mp4', '.avi', '.mov', '.mkv', '.wmv'],
            images: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff'],
            urls: ['YouTube URLs', 'Any web URL'],
            maxFileSize: '100MB',
            audioVideoMaxDuration: '60 minutes'
        };
    }

    /**
     * Check if a file type is supported
     */
    isSupported(input) {
        if (this.isYouTubeUrl(input)) return true;
        if (this.isUrl(input)) return true;

        if (typeof input === 'string') {
            const ext = path.extname(input).toLowerCase();
            return !!FILE_PROCESSORS[ext];
        }

        return false;
    }

    /**
     * Get processor for a specific type
     */
    getProcessor(type) {
        return this.processors[type] || null;
    }

    /**
     * Get processing capabilities
     */
    getCapabilities() {
        return {
            documents: {
                pdf: { parser: 'pdf-parse', features: ['text extraction'] },
                docx: { parser: 'mammoth', features: ['text extraction', 'structure preservation'] },
                xlsx: { parser: 'xlsx', features: ['all sheets', 'table formatting'] },
                pptx: { parser: 'jszip', features: ['slide text', 'speaker notes'] }
            },
            media: {
                audio: {
                    parser: 'whisper/deepgram',
                    features: ['transcription', 'language detection', 'timestamps'],
                    languages: audioProcessor.getAvailableLanguages()
                },
                video: {
                    parser: 'ffmpeg + whisper',
                    features: ['audio extraction', 'transcription'],
                    requires: 'FFmpeg installation'
                },
                image: {
                    parser: 'tesseract.js / GPT-4 Vision',
                    features: ['OCR', 'diagram description'],
                    languages: imageProcessor.getAvailableLanguages()
                }
            },
            web: {
                youtube: { parser: 'youtube-transcript', features: ['transcript', 'metadata'] },
                url: { parser: 'cheerio', features: ['content extraction', 'metadata'] }
            }
        };
    }
}

// Export singleton instance
const mediaIngestionService = new MediaIngestionService();

export {
MediaIngestionService,
    mediaIngestionService,
};

export default {
    MediaIngestionService,
    mediaIngestionService,
};






