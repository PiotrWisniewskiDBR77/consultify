/**
 * Knowledge Indexer
 *
 * Indexes PDF and XLSX files from the /knowledge folder for RAG search.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import * as DbPromise from '../../utils/DbPromise.js';
import { aiLogger } from '.././ai/logger.js';
import { embeddingService } from './embeddingService.js';

type KnowledgeSourceConfig = {
  name: string;
  files: string[];
  chunkSize?: number;
  overlap?: number;
  parser?: 'xlsx';
  metadata: Record<string, unknown>;
};

export const KNOWLEDGE_SOURCES: Record<string, KnowledgeSourceConfig> = {
  methodology: {
    name: 'DRD Methodology',
    files: [
      'knowledge/0. Wprowadzenie .pdf',
      'knowledge/1. Digitlne processy.pdf',
      'knowledge/2. Digitalne produkty.pdf',
      'knowledge/3. digitlane modele .pdf',
      'knowledge/4. Big data.pdf',
      'knowledge/5. Kultura.pdf',
      'knowledge/6. Cyberbezpieczenstwo .pdf',
      'knowledge/7. Os AI opis.pdf',
      'knowledge/DRD1.pdf',
    ],
    chunkSize: 1000,
    overlap: 200,
    metadata: { type: 'methodology', weight: 1.0 },
  },
  initiatives: {
    name: 'Initiative Library',
    files: ['knowledge/DRD 2.0/INITIATIVE_LIBRARY.xlsx'],
    parser: 'xlsx',
    metadata: { type: 'initiative_template', weight: 0.9 },
  },
  engine: {
    name: 'Assessment Engine',
    files: [
      'knowledge/DRD 2.0/MASTER_DRD_ENGINE.xlsx',
      'knowledge/DRD 2.0/MASTER_DRD_ENGINE_EN.xlsx',
    ],
    parser: 'xlsx',
    metadata: { type: 'assessment_logic', weight: 1.0 },
  },
  maturity: {
    name: 'AI Maturity Matrix',
    files: ['knowledge/DRD 2.0/DRD_AI_Maturity_Matrix.xlsx'],
    parser: 'xlsx',
    metadata: { type: 'maturity_matrix', weight: 0.9 },
  },
  rapid: {
    name: 'Rapid Assessments',
    files: ['knowledge/Rapid 1.pdf'],
    chunkSize: 800,
    overlap: 150,
    metadata: { type: 'rapid_assessment', weight: 0.8 },
  },
};

type PdfParseResult = { text: string };
type PdfParseModule = (data: Buffer) => Promise<PdfParseResult>;
type XlsxModule = {
  readFile: (filePath: string) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: {
    sheet_to_json: (sheet: unknown, opts: { header: number }) => Array<Array<unknown>>;
  };
};

let pdfParse: PdfParseModule | null = null;
let pdfParseAttempted = false;
let xlsxParse: XlsxModule | null = null;
let xlsxAttempted = false;

const getPdfParse = async (): Promise<PdfParseModule | null> => {
  if (pdfParse || pdfParseAttempted) return pdfParse;
  pdfParseAttempted = true;
  try {
    const mod = await import('pdf-parse');
    // @ts-ignore
    pdfParse = (mod.default ?? mod) as PdfParseModule;
  } catch (error: unknown) {
    const err = error as Error;
    aiLogger.warn(
      'KnowledgeIndexer',
      `pdf-parse not installed, PDF indexing disabled: ${err.message}`
    );
  }
  return pdfParse;
};

const getXlsxParse = async (): Promise<XlsxModule | null> => {
  if (xlsxParse || xlsxAttempted) return xlsxParse;
  xlsxAttempted = true;
  try {
    const mod = await import('xlsx');
    // @ts-ignore
    xlsxParse = (mod.default ?? mod) as XlsxModule;
  } catch (error: unknown) {
    const err = error as Error;
    aiLogger.warn(
      'KnowledgeIndexer',
      `xlsx not installed, Excel indexing disabled: ${err.message}`
    );
  }
  return xlsxParse;
};

type KnowledgeChunk = {
  id: string;
  docId: string;
  chunkIndex: number;
  content: string;
  embedding: string | null;
  metadata?: Record<string, unknown>;
};

type KnowledgeDoc = {
  id: string;
  filename: string;
  filepath: string;
  sourceType: string;
  metadata?: Record<string, unknown>;
  chunkCount: number;
};

type KnowledgeChunkRow = {
  id: string;
  content: string;
  embedding: string | null;
  metadata: string | null;
  filename: string;
  source_type: string;
  similarity?: number;
};

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (!value) return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};

const toPgPlaceholders = (sql: string): string => {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
};

export class KnowledgeIndexer {
  private projectRoot: string;
  private embeddingService: typeof embeddingService | null;
  private isPg: boolean;

  constructor() {
    const rootUrl = new URL('../../../', import.meta.url);
    this.projectRoot = path.resolve(fileURLToPath(rootUrl));
    this.embeddingService = null;
    this.isPg = process.env.DB_TYPE === 'postgres';
  }

  /**
   * Initialize the indexer with embedding service
   */
  async initialize(): Promise<boolean> {
    try {
      this.embeddingService = embeddingService;
      await this.ensureTables();
      return true;
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.error('KnowledgeIndexer', `Initialization failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Ensure required database tables exist
   */
  async ensureTables(): Promise<void> {
    const createDocsTable = `
            CREATE TABLE IF NOT EXISTS knowledge_docs (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                filepath TEXT,
                source_type TEXT,
                organization_id TEXT,
                file_hash TEXT,
                chunk_count INTEGER DEFAULT 0,
                metadata TEXT,
                indexed_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        `;

    const createChunksTable = `
            CREATE TABLE IF NOT EXISTS knowledge_chunks (
                id TEXT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                chunk_index INTEGER,
                content TEXT NOT NULL,
                embedding TEXT,
                metadata TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (doc_id) REFERENCES knowledge_docs(id)
            )
        `;

    if (this.isPg) {
      const db = getDatabase();
      await db.query(createDocsTable);
      await db.query(createChunksTable);
      return;
    }

    await DbPromise.run(createDocsTable, [], { fallback: true });
    await DbPromise.run(createChunksTable, [], { fallback: true });
  }

  /**
   * Index all configured knowledge sources
   */
  async indexAll(options: { forceReindex?: boolean; sourceNames?: string[] | null } = {}): Promise<{
    success: Array<{ file: string; chunks: number }>;
    failed: Array<{ file: string; error: string }>;
    skipped: Array<{ file: string; reason: string }>;
  }> {
    const { forceReindex = false, sourceNames = null } = options;
    const results = {
      success: [] as Array<{ file: string; chunks: number }>,
      failed: [] as Array<{ file: string; error: string }>,
      skipped: [] as Array<{ file: string; reason: string }>,
    };

    const sources = sourceNames
      ? Object.entries(KNOWLEDGE_SOURCES).filter(([name]) => sourceNames.includes(name))
      : Object.entries(KNOWLEDGE_SOURCES);

    for (const [sourceName, sourceConfig] of sources) {
      aiLogger.info('KnowledgeIndexer', `Processing source: ${sourceName}`);

      for (const relativeFilePath of sourceConfig.files) {
        const filePath = path.join(this.projectRoot, relativeFilePath);

        try {
          if (!fs.existsSync(filePath)) {
            aiLogger.warn('KnowledgeIndexer', `File not found: ${filePath}`);
            results.skipped.push({ file: relativeFilePath, reason: 'File not found' });
            continue;
          }

          if (!forceReindex) {
            const existing = await this.getDocByPath(relativeFilePath);
            if (existing) {
              aiLogger.debug('KnowledgeIndexer', `Already indexed: ${relativeFilePath}`);
              results.skipped.push({ file: relativeFilePath, reason: 'Already indexed' });
              continue;
            }
          }

          const result = await this.indexFile(filePath, {
            ...sourceConfig,
            sourceName,
            relativeFilePath,
          });

          results.success.push({ file: relativeFilePath, chunks: result.chunkCount });
        } catch (error: unknown) {
          const err = error as Error;
          aiLogger.error('KnowledgeIndexer', `Error indexing ${relativeFilePath}: ${err.message}`);
          results.failed.push({ file: relativeFilePath, error: err.message });
        }
      }
    }

    aiLogger.info('KnowledgeIndexer', 'Indexing complete', {
      success: results.success.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
    });

    return results;
  }

  /**
   * Index a single file
   */
  async indexFile(
    filePath: string,
    config: KnowledgeSourceConfig & { sourceName: string; relativeFilePath: string }
  ): Promise<{ docId: string; filename: string; chunkCount: number }> {
    const ext = path.extname(filePath).toLowerCase();
    let content: string | Record<string, string>;
    let chunks: string[];

    if (ext === '.pdf') {
      content = await this.extractPdfContent(filePath);
      chunks = this.chunkText(content, config.chunkSize || 1000, config.overlap || 200);
    } else if (ext === '.xlsx' || ext === '.xls') {
      const sheetContents = await this.extractExcelContent(filePath);
      chunks = this.processExcelChunks(sheetContents, config);
    } else if (ext === '.txt') {
      content = fs.readFileSync(filePath, 'utf-8');
      chunks = this.chunkText(content, config.chunkSize || 1000, config.overlap || 200);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    const docId = uuidv4();
    const filename = path.basename(filePath);

    await this.insertDocument({
      id: docId,
      filename,
      filepath: config.relativeFilePath,
      sourceType: config.sourceName,
      metadata: config.metadata,
      chunkCount: chunks.length,
    });

    let successCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await this.generateEmbedding(chunks[i]);
        if (!embedding) {
          continue;
        }

        await this.insertChunk({
          id: `${docId}-chunk-${i}`,
          docId,
          chunkIndex: i,
          content: chunks[i],
          embedding,
          metadata: { ...config.metadata, chunkIndex: i },
        });

        successCount++;
      } catch (error: unknown) {
        const err = error as Error;
        aiLogger.warn('KnowledgeIndexer', `Error creating chunk ${i}: ${err.message}`);
      }
    }

    aiLogger.info(
      'KnowledgeIndexer',
      `Indexed ${filename}: ${successCount}/${chunks.length} chunks`
    );

    return {
      docId,
      filename,
      chunkCount: successCount,
    };
  }

  /**
   * Extract text content from PDF
   */
  async extractPdfContent(filePath: string): Promise<string> {
    const parser = await getPdfParse();
    if (!parser) {
      throw new Error('pdf-parse library not available');
    }

    const dataBuffer = fs.readFileSync(filePath);
    const data = await parser(dataBuffer);
    return data.text;
  }

  /**
   * Extract content from Excel file
   */
  async extractExcelContent(filePath: string): Promise<Record<string, string>> {
    const xlsx = await getXlsxParse();
    if (!xlsx) {
      throw new Error('xlsx library not available');
    }

    const workbook = xlsx.readFile(filePath);
    const sheetContents: Record<string, string> = {};

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      const textContent = jsonData
        .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ''))
        .map((row) => row.filter((cell) => cell !== null && cell !== undefined).join(' | '))
        .join('\n');

      sheetContents[sheetName] = textContent;
    }

    return sheetContents;
  }

  /**
   * Process Excel content into chunks
   */
  processExcelChunks(
    sheetContents: Record<string, string>,
    config: KnowledgeSourceConfig
  ): string[] {
    const chunks: string[] = [];

    for (const [sheetName, content] of Object.entries(sheetContents)) {
      if (!content || content.trim().length < 50) continue;

      const sheetChunks = this.chunkText(content, config.chunkSize || 800, config.overlap || 100);

      for (const chunk of sheetChunks) {
        chunks.push(`[Sheet: ${sheetName}]\n${chunk}`);
      }
    }

    return chunks;
  }

  /**
   * Split text into overlapping chunks
   */
  chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
    if (!text || text.length === 0) return [];

    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);

    let currentChunk = '';
    let lastChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          lastChunk = currentChunk;

          const overlapText = lastChunk.slice(-overlap);
          currentChunk = `${overlapText} ${sentence}`;
        } else {
          chunks.push(sentence.slice(0, chunkSize).trim());
          currentChunk = sentence.slice(chunkSize - overlap);
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string): Promise<string | null> {
    if (!this.embeddingService) {
      return null;
    }

    try {
      const embedding = await this.embeddingService.generateEmbedding(text);
      return JSON.stringify(embedding);
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.warn('KnowledgeIndexer', `Embedding generation failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Insert document record
   */
  async insertDocument(doc: KnowledgeDoc): Promise<void> {
    if (this.isPg) {
      const db = getDatabase();
      await db.query(
        `
                    INSERT INTO knowledge_docs 
                    (id, filename, filepath, source_type, metadata, chunk_count, indexed_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        filename = EXCLUDED.filename,
                        filepath = EXCLUDED.filepath,
                        source_type = EXCLUDED.source_type,
                        metadata = EXCLUDED.metadata,
                        chunk_count = EXCLUDED.chunk_count,
                        updated_at = NOW()
                `,
        [
          doc.id,
          doc.filename,
          doc.filepath,
          doc.sourceType,
          JSON.stringify(doc.metadata || {}),
          doc.chunkCount,
        ]
      );
      return;
    }

    await DbPromise.run(
      `
                INSERT OR REPLACE INTO knowledge_docs 
                (id, filename, filepath, source_type, metadata, chunk_count, indexed_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `,
      [
        doc.id,
        doc.filename,
        doc.filepath,
        doc.sourceType,
        JSON.stringify(doc.metadata || {}),
        doc.chunkCount,
      ],
      { fallback: false }
    );
  }

  /**
   * Insert chunk record
   */
  async insertChunk(chunk: KnowledgeChunk): Promise<void> {
    if (this.isPg) {
      const db = getDatabase();
      await db.query(
        `
                    INSERT INTO knowledge_chunks 
                    (id, doc_id, chunk_index, content, embedding, metadata, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        content = EXCLUDED.content,
                        embedding = EXCLUDED.embedding,
                        metadata = EXCLUDED.metadata
                `,
        [
          chunk.id,
          chunk.docId,
          chunk.chunkIndex,
          chunk.content,
          chunk.embedding,
          JSON.stringify(chunk.metadata || {}),
        ]
      );
      return;
    }

    await DbPromise.run(
      `
                INSERT OR REPLACE INTO knowledge_chunks 
                (id, doc_id, chunk_index, content, embedding, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `,
      [
        chunk.id,
        chunk.docId,
        chunk.chunkIndex,
        chunk.content,
        chunk.embedding,
        JSON.stringify(chunk.metadata || {}),
      ],
      { fallback: false }
    );
  }

  /**
   * Get document by file path
   */
  async getDocByPath(filepath: string): Promise<KnowledgeDoc | null> {
    if (this.isPg) {
      const db = getDatabase();
      const result = await db.query<KnowledgeDoc>(
        'SELECT * FROM knowledge_docs WHERE filepath = $1',
        [filepath]
      );
      return result.rows[0] ?? null;
    }

    const row = await DbPromise.get<KnowledgeDoc>(
      'SELECT * FROM knowledge_docs WHERE filepath = ?',
      [filepath],
      {
        fallback: false,
      }
    );
    return row ?? null;
  }

  /**
   * Search knowledge base
   */
  async search(
    query: string,
    options: { limit?: number; minSimilarity?: number; sourceTypes?: string[] | null } = {}
  ): Promise<
    Array<{
      content: string;
      source: string;
      sourceType: string;
      similarity: number;
      metadata: Record<string, unknown>;
    }>
  > {
    const { limit = 5, minSimilarity = 0.5, sourceTypes = null } = options;

    if (!this.embeddingService) {
      return this.keywordSearch(query, { limit, sourceTypes });
    }

    try {
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      if (!queryEmbedding) {
        return this.keywordSearch(query, { limit, sourceTypes });
      }

      const chunks = await this.getAllChunksWithEmbeddings(sourceTypes);

      const scored = chunks.map((chunk) => {
        const chunkEmbedding = parseJson<number[] | null>(chunk.embedding, null);
        if (!chunkEmbedding) {
          return { ...chunk, similarity: 0 };
        }

        const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);
        return { ...chunk, similarity };
      });

      return scored
        .filter((chunk) => (chunk.similarity ?? 0) >= minSimilarity)
        .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
        .slice(0, limit)
        .map((chunk) => ({
          content: chunk.content,
          source: chunk.filename,
          sourceType: chunk.source_type,
          similarity: chunk.similarity ?? 0,
          metadata: parseJson<Record<string, unknown>>(chunk.metadata, {}),
        }));
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.error('KnowledgeIndexer', `Search error: ${err.message}`);
      return this.keywordSearch(query, { limit, sourceTypes });
    }
  }

  /**
   * Keyword-based fallback search
   */
  async keywordSearch(
    query: string,
    options: { limit?: number; sourceTypes?: string[] | null } = {}
  ): Promise<
    Array<{
      content: string;
      source: string;
      sourceType: string;
      similarity: number;
      metadata: Record<string, unknown>;
    }>
  > {
    const { limit = 5, sourceTypes = null } = options;

    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3);

    if (keywords.length === 0) {
      return [];
    }

    const whereClauses = keywords.map(() => 'c.content LIKE ?').join(' OR ');
    const params: unknown[] = keywords.map((word) => `%${word}%`);

    let sql = `
            SELECT c.content, c.metadata, d.filename, d.source_type
            FROM knowledge_chunks c
            JOIN knowledge_docs d ON c.doc_id = d.id
            WHERE (${whereClauses})
        `;

    if (sourceTypes && sourceTypes.length > 0) {
      sql += ` AND d.source_type IN (${sourceTypes.map(() => '?').join(',')})`;
      params.push(...sourceTypes);
    }

    sql += ` LIMIT ?`;
    params.push(limit);

    if (this.isPg) {
      const pgSql = toPgPlaceholders(sql);
      const db = getDatabase();
      const result = await db.query<KnowledgeChunkRow>(pgSql, params);
      return (result.rows || []).map((row) => ({
        content: row.content,
        source: row.filename,
        sourceType: row.source_type,
        similarity: 0.5,
        metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
      }));
    }

    const rows = await DbPromise.all<KnowledgeChunkRow>(sql, params, { fallback: false });
    return (rows || []).map((row) => ({
      content: row.content,
      source: row.filename,
      sourceType: row.source_type,
      similarity: 0.5,
      metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
    }));
  }

  /**
   * Get all chunks with embeddings
   */
  async getAllChunksWithEmbeddings(
    sourceTypes: string[] | null = null
  ): Promise<KnowledgeChunkRow[]> {
    let sql = `
            SELECT c.id, c.content, c.embedding, c.metadata, d.filename, d.source_type
            FROM knowledge_chunks c
            JOIN knowledge_docs d ON c.doc_id = d.id
            WHERE c.embedding IS NOT NULL
        `;

    const params: unknown[] = [];
    if (sourceTypes && sourceTypes.length > 0) {
      sql += ` AND d.source_type IN (${sourceTypes.map(() => '?').join(',')})`;
      params.push(...sourceTypes);
    }

    if (this.isPg) {
      const pgSql = toPgPlaceholders(sql);
      const db = getDatabase();
      const result = await db.query<KnowledgeChunkRow>(pgSql, params);
      return result.rows || [];
    }

    const rows = await DbPromise.all<KnowledgeChunkRow>(sql, params, { fallback: false });
    return rows || [];
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dot / denominator;
  }

  /**
   * Get indexing statistics
   */
  async getStats(): Promise<
    Array<{
      source_type: string;
      doc_count: number;
      chunk_count: number;
      last_indexed: string;
    }>
  > {
    const sql = `
            SELECT 
                d.source_type,
                COUNT(DISTINCT d.id) as doc_count,
                SUM(d.chunk_count) as chunk_count,
                MAX(d.indexed_at) as last_indexed
            FROM knowledge_docs d
            GROUP BY d.source_type
        `;

    if (this.isPg) {
      const db = getDatabase();
      const result = await db.query(sql);
      return (result.rows || []) as any;
    }

    const rows = await DbPromise.all(sql, [], { fallback: false });
    return (rows || []) as any;
  }

  /**
   * Delete all indexed content for a source type
   */
  async deleteSource(sourceType: string): Promise<void> {
    if (this.isPg) {
      const db = getDatabase();
      await db.query(
        `
                    DELETE FROM knowledge_chunks 
                    WHERE doc_id IN (SELECT id FROM knowledge_docs WHERE source_type = $1)
                `,
        [sourceType]
      );
      await db.query('DELETE FROM knowledge_docs WHERE source_type = $1', [sourceType]);
      return;
    }

    await DbPromise.run(
      `
                DELETE FROM knowledge_chunks 
                WHERE doc_id IN (SELECT id FROM knowledge_docs WHERE source_type = ?)
            `,
      [sourceType],
      { fallback: false }
    );
    await DbPromise.run('DELETE FROM knowledge_docs WHERE source_type = ?', [sourceType], {
      fallback: false,
    });
  }
}

export const knowledgeIndexer = new KnowledgeIndexer();

export default {
  KnowledgeIndexer,
  knowledgeIndexer,
  KNOWLEDGE_SOURCES,
};
