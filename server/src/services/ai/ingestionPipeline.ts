/**
 * Knowledge Base Ingestion Pipeline
 *
 * Handles document ingestion, chunking, and embedding generation.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { aiLogger } from '.././ai/logger.js';
import { embeddingService } from './embeddingService.js';

export const CHUNK_CONFIG = {
  targetSize: 800,
  maxSize: 1200,
  overlapSize: 150,
  minSize: 100,
};

export const DOCUMENT_TYPES = {
  markdown: { extensions: ['.md', '.mdx'], parser: 'markdown' },
  text: { extensions: ['.txt'], parser: 'text' },
  json: { extensions: ['.json'], parser: 'json' },
} as const;

type DocumentType = keyof typeof DOCUMENT_TYPES;
type DocumentParser = (typeof DOCUMENT_TYPES)[DocumentType]['parser'];

type IngestionOptions = {
  organizationId?: string;
  sourceType?: string;
  metadata?: Record<string, unknown>;
};

type DirectoryIngestionOptions = IngestionOptions & {
  recursive?: boolean;
  pattern?: string;
};

type TextIngestionOptions = IngestionOptions & {
  title?: string;
};

type ChunkMetadata = Record<string, unknown>;

type Chunk = {
  content: string;
  metadata: ChunkMetadata;
};

type IngestionStats = {
  documentsProcessed: number;
  chunksCreated: number;
  errors: number;
};

export class IngestionPipeline {
  private stats: IngestionStats;

  constructor() {
    this.stats = {
      documentsProcessed: 0,
      chunksCreated: 0,
      errors: 0,
    };
  }

  /**
   * Ingest a document from file path
   */
  async ingestFile(
    filePath: string,
    options: IngestionOptions = {}
  ): Promise<{
    documentId: string;
    fileName: string;
    chunksCreated: number;
    totalChunks: number;
  }> {
    const { organizationId, sourceType = 'knowledge_base', metadata = {} } = options;

    try {
      aiLogger.info('Ingestion', `Processing file: ${filePath}`);

      const content = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath);
      const extension = path.extname(filePath).toLowerCase();

      const docType = Object.entries(DOCUMENT_TYPES).find(([, config]) =>
        (config.extensions as unknown as any[]).includes(extension)
      );

      if (!docType) {
        throw new Error(`Unsupported file type: ${extension}`);
      }

      const parsedContent = this._parseDocument(content, docType[1].parser as DocumentParser);
      const documentId = uuidv4();

      const chunks = this._smartChunk(parsedContent, {
        fileName,
        documentId,
        ...metadata,
      });

      aiLogger.info('Ingestion', `Created ${chunks.length} chunks from ${fileName}`);

      let storedCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          const embedding = await embeddingService.generateEmbedding(chunk.content);

          await embeddingService.storeChunk(
            {
              content: chunk.content,
              chunkIndex: i,
              documentId,
              organizationId,
              sourceType,
              metadata: {
                fileName,
                ...chunk.metadata,
                ...metadata,
              },
            },
            embedding
          );

          storedCount++;
        } catch (error: unknown) {
          const err = error as Error;
          aiLogger.warn('Ingestion', `Failed to embed chunk ${i}: ${err.message}`);
          this.stats.errors++;
        }
      }

      this.stats.documentsProcessed++;
      this.stats.chunksCreated += storedCount;

      aiLogger.info(
        'Ingestion',
        `Completed ${fileName}: ${storedCount}/${chunks.length} chunks stored`
      );

      return {
        documentId,
        fileName,
        chunksCreated: storedCount,
        totalChunks: chunks.length,
      };
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.error('Ingestion', `Failed to process ${filePath}: ${err.message}`);
      this.stats.errors++;
      throw err;
    }
  }

  /**
   * Ingest multiple files from a directory
   */
  async ingestDirectory(
    dirPath: string,
    options: DirectoryIngestionOptions = {}
  ): Promise<{
    totalFiles: number;
    successful: number;
    failed: number;
    results: Array<{
      file?: string;
      error?: string;
      documentId?: string;
      fileName?: string;
      chunksCreated?: number;
      totalChunks?: number;
    }>;
  }> {
    const { recursive = true, pattern, ...ingestionOptions } = options;

    try {
      const files = await this._listFiles(dirPath, { recursive, pattern });

      aiLogger.info('Ingestion', `Found ${files.length} files in ${dirPath}`);

      const results: Array<{
        file?: string;
        error?: string;
        documentId?: string;
        fileName?: string;
        chunksCreated?: number;
        totalChunks?: number;
      }> = [];
      for (const file of files) {
        try {
          const result = await this.ingestFile(file, ingestionOptions);
          results.push(result);
        } catch (error: unknown) {
          const err = error as Error;
          results.push({
            file,
            error: err.message,
          });
        }
      }

      return {
        totalFiles: files.length,
        successful: results.filter((result) => !result.error).length,
        failed: results.filter((result) => result.error).length,
        results,
      };
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.error('Ingestion', `Failed to process directory: ${err.message}`);
      throw err;
    }
  }

  /**
   * Ingest text content directly
   */
  async ingestText(
    content: string,
    options: TextIngestionOptions = {}
  ): Promise<{ documentId: string; title?: string; chunksCreated: number; totalChunks: number }> {
    const { title, organizationId, sourceType = 'knowledge_base', metadata = {} } = options;

    try {
      const documentId = uuidv4();

      const chunks = this._smartChunk(content, {
        title,
        documentId,
        ...metadata,
      });

      let storedCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          const embedding = await embeddingService.generateEmbedding(chunk.content);

          await embeddingService.storeChunk(
            {
              content: chunk.content,
              chunkIndex: i,
              documentId,
              organizationId,
              sourceType,
              metadata: {
                title,
                ...chunk.metadata,
                ...metadata,
              },
            },
            embedding
          );

          storedCount++;
        } catch (error: unknown) {
          const err = error as Error;
          aiLogger.warn('Ingestion', `Failed to embed chunk ${i}: ${err.message}`);
        }
      }

      this.stats.documentsProcessed++;
      this.stats.chunksCreated += storedCount;

      return {
        documentId,
        title,
        chunksCreated: storedCount,
        totalChunks: chunks.length,
      };
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.error('Ingestion', `Failed to ingest text: ${err.message}`);
      throw err;
    }
  }

  /**
   * Parse document based on type
   */
  private _parseDocument(content: string, parser: DocumentParser): string {
    switch (parser) {
      case 'markdown':
        return content
          .replace(/```[\s\S]*?```/g, '\n[CODE BLOCK]\n')
          .replace(/`[^`]+`/g, (match) => match.replace(/`/g, ''));
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
   */
  private _smartChunk(content: string, metadata: ChunkMetadata = {}): Chunk[] {
    const chunks: Chunk[] = [];

    const sections = content.split(/(?=^#{1,3}\s)/m);

    let currentChunk = '';
    const chunkMetadata = { ...metadata };

    for (const section of sections) {
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

      if (tokenEstimate > CHUNK_CONFIG.maxSize && currentChunk.length > 0) {
        if (this._estimateTokens(currentChunk) >= CHUNK_CONFIG.minSize) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: { ...chunkMetadata },
          });
        }

        const overlap = this._getOverlap(currentChunk);
        currentChunk = overlap + section;
      } else {
        currentChunk += section;
      }

      if (this._estimateTokens(currentChunk) >= CHUNK_CONFIG.targetSize) {
        const paragraphs = currentChunk.split(/\n\n+/);

        if (paragraphs.length > 1) {
          let splitContent = '';
          let remaining = '';

          for (const para of paragraphs) {
            if (this._estimateTokens(splitContent + para) < CHUNK_CONFIG.targetSize) {
              splitContent += `${para}\n\n`;
            } else {
              remaining += `${para}\n\n`;
            }
          }

          if (splitContent.trim() && this._estimateTokens(splitContent) >= CHUNK_CONFIG.minSize) {
            chunks.push({
              content: splitContent.trim(),
              metadata: { ...chunkMetadata },
            });
            currentChunk = this._getOverlap(splitContent) + remaining;
          }
        }
      }
    }

    if (currentChunk.trim() && this._estimateTokens(currentChunk) >= CHUNK_CONFIG.minSize) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { ...chunkMetadata },
      });
    }

    return chunks;
  }

  /**
   * Get overlap text from end of chunk
   */
  private _getOverlap(text: string): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    let overlap = '';

    for (let i = sentences.length - 1; i >= 0; i--) {
      if (this._estimateTokens(overlap + sentences[i]) > CHUNK_CONFIG.overlapSize) {
        break;
      }
      overlap = sentences[i] + overlap;
    }

    return `${overlap.trim()}\n\n`;
  }

  /**
   * Estimate token count
   */
  private _estimateTokens(text: string): number {
    return Math.ceil((text || '').length / 3);
  }

  /**
   * List files in directory
   */
  private async _listFiles(
    dirPath: string,
    options: { recursive?: boolean; pattern?: string } = {}
  ): Promise<string[]> {
    const { recursive = true, pattern } = options;
    const files: string[] = [];

    const supportedExtensions = Object.values(DOCUMENT_TYPES).flatMap((type) => type.extensions);

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && recursive) {
        const subFiles = await this._listFiles(fullPath, options);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (supportedExtensions.includes(ext as any)) {
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
  getStats(): IngestionStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      documentsProcessed: 0,
      chunksCreated: 0,
      errors: 0,
    };
  }
}

export const ingestionPipeline = new IngestionPipeline();

export default {
  IngestionPipeline,
  ingestionPipeline,
  CHUNK_CONFIG,
  DOCUMENT_TYPES,
};
