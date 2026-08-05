/**
 * Knowledge Indexer
 *
 * Indexes PDF and XLSX files from the /knowledge folder for RAG search.
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import * as DbPromise from '../../utils/DbPromise.js';
import { aiLogger } from '.././ai/logger.js';
import PDFParserService from '../pdfParserService.js';
import { embeddingService } from './embeddingService.js';

type KnowledgeSourceConfig = {
  name: string;
  files: string[];
  chunkSize?: number;
  overlap?: number;
  parser?: 'xlsx';
  metadata: Record<string, unknown>;
};

/**
 * DRD tool-scoped RAG grounding (F14 / §7 _KONCEPT_CONTENT_ENGINES_2026-07-10.md, decyzja D-E).
 *
 * The literal text of "Digital Pathfinder" (Piotr Wisniewski, PhD) lives at
 * `knowledge/tool-kb/drd/methodology/v1/drd-methodology-axis{0..7}-*.en.md`
 * (one file per axis/chapter, chunked ~1.8KB per [section_id:...] block,
 * verbatim — decision D-E: book DOSŁOWNIE + branding "Digital Pathfinder / DBR77").
 *
 * These files are picked up automatically by `indexToolKnowledgePacks()`
 * below, which walks `knowledge/tool-kb/**\/*.md` and infers
 * `tool_slug='drd'`, `pack_type='methodology'`, `pack_major=1`, `language='en'`
 * from the path (see `parseToolKbPath`). Resulting docs get
 * `source_type='tool_pack'`, which is what `searchKnowledgeBase({ toolSlug: 'drd' })`
 * (server/src/services/ai/tools/searchKnowledgeBase.ts) filters on for
 * DRD-scoped RAG grounding (toolScopedRAG). No separate registration entry
 * is needed here — dropping/updating files under that folder is the wiring.
 *
 * Do NOT also add these files to `KNOWLEDGE_SOURCES.methodology` below: that
 * legacy source indexes the SAME book as raw PDFs but tags docs with
 * `source_type='methodology'` (global, not tool-scoped), which
 * `searchKnowledgeBase`'s tool filter does not match. Indexing both would
 * duplicate the book content under two disconnected source types.
 */
export const DRD_METHODOLOGY_TOOL_KB_DIR = 'knowledge/tool-kb/drd/methodology/v1';

export const KNOWLEDGE_SOURCES: Record<string, KnowledgeSourceConfig> = {
  // LEGACY / global-scoped (not tool-scoped): raw PDF chapters of the same
  // "Digital Pathfinder" book, indexed for generic (non-DRD-tool-filtered)
  // RAG. Kept for backward compatibility with any existing non-tool-scoped
  // callers of `indexAll()`. DRD-tool RAG grounding uses
  // `DRD_METHODOLOGY_TOOL_KB_DIR` above instead (see comment there).
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
  /** ★ M01-055: real organization scope column (`knowledge_docs.organization_id`), not just JSON metadata. */
  organizationId?: string | null;
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
  /** ★ VLT-002: cached `knowledge_docs.scope` column presence (VLT-001 ALTER). */
  private hasScopeColumnCache: boolean | null = null;

  constructor() {
    // Runtime and local scripts run with a stable CWD (typically repo root or `server/`).
    // Using CWD makes path resolution robust for both TS source and compiled dist layouts.
    this.projectRoot = path.resolve(process.cwd());
    this.embeddingService = null;
    this.isPg = process.env.DB_TYPE === 'postgres';
  }

  /**
   * ★ VLT-002 — does `knowledge_docs` have the `scope` column (VLT-001 ALTER,
   * `KnowledgeService.ts` `ensureKnowledgeSchema`/`ContextDocumentService.ensureSchema`)?
   * Defensive introspection (not assumed) because this table is shared across three
   * services that migrate it independently and may not have run yet in every process.
   */
  private async hasScopeColumn(): Promise<boolean> {
    if (this.hasScopeColumnCache !== null) return this.hasScopeColumnCache;
    try {
      if (this.isPg) {
        const db = getDatabase();
        const result = await db.query<{ column_name?: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_docs' AND column_name = 'scope'`
        );
        this.hasScopeColumnCache = (result.rows || []).length > 0;
      } else {
        const rows = await DbPromise.all<{ name?: string }>(
          `PRAGMA table_info(knowledge_docs)`,
          [],
          { fallback: true }
        );
        this.hasScopeColumnCache = (rows || []).some((r) => r?.name === 'scope');
      }
    } catch {
      this.hasScopeColumnCache = false;
    }
    return this.hasScopeColumnCache;
  }

  private resolveWorkspacePath(relativePath: string): string {
    const normalized = String(relativePath || '').replace(/^\/+/, '');
    const candidates = [
      path.join(this.projectRoot, normalized),
      path.join(this.projectRoot, '..', normalized),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
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
                status TEXT DEFAULT 'indexed',
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
        const filePath = this.resolveWorkspacePath(relativeFilePath);

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
    } else if (ext === '.md' || ext === '.markdown') {
      // Treat markdown as plain text for chunking purposes.
      // (We keep headers/bullets to improve retrieval anchors.)
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

        await this.insertChunk({
          id: `${docId}-chunk-${i}`,
          docId,
          chunkIndex: i,
          content: chunks[i],
          embedding: embedding || null,
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

  // ============================================
  // Tool Knowledge Packs (knowledge/tool-kb)
  // ============================================

  private slugifySegment(value: string): string {
    return String(value || '')
      .replace(/[łŁ]/g, 'l')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private resolveProductSlug(folderName: string): string {
    const slug = this.slugifySegment(folderName);
    if (slug.includes('consultinity') || slug.includes('consultify')) return 'consultify';
    if (slug.includes('vector')) return 'vector';
    if (slug.includes('marketplace')) return 'marketplace';
    if (slug.includes('dbr77') || slug.includes('dbr-77')) return 'dbr77';
    if (slug.includes('iiot') || slug.includes('iot')) return 'iiot';
    if (slug === 'dt-info-pils' || slug.startsWith('dt-')) return 'digital-twin';
    if (slug.includes('digital-twin')) return 'digital-twin';
    if (slug.includes('iris')) return 'iris';
    return slug || 'unknown-product';
  }

  private findProductPillsRoot(): string | null {
    const runtimeRootAbs = this.resolveWorkspacePath('knowledge-runtime/product-pills');
    if (fs.existsSync(runtimeRootAbs)) return runtimeRootAbs;

    const knowledgeAbs = this.resolveWorkspacePath('knowledge');
    if (!fs.existsSync(knowledgeAbs)) return null;

    const entries = fs.readdirSync(knowledgeAbs, { withFileTypes: true });
    const match = entries.find((entry) => {
      if (!entry.isDirectory()) return false;
      const slug = this.slugifySegment(entry.name);
      return slug.includes('pigulki-wiedzy') || slug.includes('knowledge-pills');
    });

    return match ? path.join(knowledgeAbs, match.name) : null;
  }

  private walkDirForMdFiles(rootAbs: string): string[] {
    const out: string[] = [];
    const stack: string[] = [rootAbs];
    while (stack.length > 0) {
      const dir = stack.pop();
      if (!dir) break;
      let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }> = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true }) as any;
      } catch {
        continue;
      }
      for (const e of entries) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) {
          // Skip templates (never ingest)
          if (e.name === '_templates') continue;
          stack.push(abs);
          continue;
        }
        if (!e.isFile()) continue;
        const ext = path.extname(e.name).toLowerCase();
        if (ext === '.md' || ext === '.markdown') out.push(abs);
      }
    }
    return out;
  }

  private parseToolKbPath(relativeFilePath: string): {
    toolSlug: string | null;
    packType: string | null;
    majorVersion: number | null;
    language: string | null;
  } {
    // Expected:
    // knowledge/tool-kb/<tool_slug>/<pack_type>/v<major>/<filename>.<lang>.md
    const normalized = relativeFilePath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    const idx = parts.indexOf('tool-kb');
    if (idx < 0) return { toolSlug: null, packType: null, majorVersion: null, language: null };
    const toolSlug = parts[idx + 1] || null;
    const packType = parts[idx + 2] || null;
    const vPart = parts[idx + 3] || null;
    const majorVersion = vPart && /^v\d+$/i.test(vPart) ? Number(vPart.slice(1)) : null;

    const base = path.basename(normalized);
    const m = base.match(/\.([a-z]{2})\.(md|markdown)$/i);
    const language = m?.[1]?.toLowerCase() || null;
    return { toolSlug, packType, majorVersion, language };
  }

  private parseProductPillPath(relativeFilePath: string): {
    productSlug: string | null;
    pillId: string | null;
    language: string | null;
  } {
    const normalized = relativeFilePath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    const base = path.basename(normalized);
    const withoutExt = base.replace(/\.(md|markdown)$/i, '');
    const pillId = this.slugifySegment(withoutExt) || null;
    const language = /\.([a-z]{2})\.(md|markdown)$/i.test(base)
      ? base.match(/\.([a-z]{2})\./i)?.[1]?.toLowerCase() || null
      : 'pl';

    // Docker/Railway: pills are copied to `/app/knowledge-runtime/product-pills/<product-folder>/*.md`
    // (see Dockerfile.api). Relative path from CWD `/app/server` is
    // `../knowledge-runtime/product-pills/Vector-info-pills/file.md` — no `knowledge/` segment.
    const runtimeIdx = parts.indexOf('knowledge-runtime');
    if (
      runtimeIdx >= 0 &&
      parts[runtimeIdx + 1] === 'product-pills' &&
      parts.length >= runtimeIdx + 4
    ) {
      const productFolder = parts[runtimeIdx + 2] || null;
      const productSlug = productFolder ? this.resolveProductSlug(productFolder) : null;
      return { productSlug, pillId, language };
    }

    const knowledgeIdx = parts.indexOf('knowledge');
    if (knowledgeIdx < 0 || parts.length < knowledgeIdx + 3) {
      return { productSlug: null, pillId, language };
    }

    const productFolder = parts[knowledgeIdx + 2] || null;
    const productSlug = productFolder ? this.resolveProductSlug(productFolder) : null;
    return { productSlug, pillId, language };
  }

  private async deleteDocAndChunks(docId: string): Promise<void> {
    if (!docId) return;
    if (this.isPg) {
      const db = getDatabase();
      await db.query('DELETE FROM knowledge_chunks WHERE doc_id = $1', [docId]);
      await db.query('DELETE FROM knowledge_docs WHERE id = $1', [docId]);
      return;
    }
    await DbPromise.run('DELETE FROM knowledge_chunks WHERE doc_id = ?', [docId], {
      fallback: false,
    });
    await DbPromise.run('DELETE FROM knowledge_docs WHERE id = ?', [docId], { fallback: false });
  }

  /**
   * Index all Tool Knowledge Packs under `knowledge/tool-kb/`.
   *
   * - Uses `source_type = 'tool_pack'` for all such docs.
   * - Stores pack metadata in `knowledge_docs.metadata` and per-chunk `knowledge_chunks.metadata`.
   * - Idempotent by `knowledge_docs.filepath` (relative path). If `forceReindex=true`, replaces doc+chunks.
   */
  async indexToolKnowledgePacks(options: { forceReindex?: boolean } = {}): Promise<{
    indexed: Array<{ file: string; chunks: number; docId: string }>;
    skipped: Array<{ file: string; reason: string }>;
    failed: Array<{ file: string; error: string }>;
  }> {
    const { forceReindex = false } = options;
    const results = {
      indexed: [] as Array<{ file: string; chunks: number; docId: string }>,
      skipped: [] as Array<{ file: string; reason: string }>,
      failed: [] as Array<{ file: string; error: string }>,
    };

    const runtimeToolKbAbs = this.resolveWorkspacePath('knowledge-runtime/tool-kb');
    const toolKbAbs = fs.existsSync(runtimeToolKbAbs)
      ? runtimeToolKbAbs
      : this.resolveWorkspacePath('knowledge/tool-kb');
    if (!fs.existsSync(toolKbAbs)) {
      results.failed.push({ file: 'knowledge/tool-kb', error: 'Folder not found' });
      return results;
    }

    const filesAbs = this.walkDirForMdFiles(toolKbAbs);
    for (const abs of filesAbs) {
      const relativeFilePath = path.relative(this.projectRoot, abs).replace(/\\/g, '/').trim();

      try {
        const existing = await this.getDocByPath(relativeFilePath);
        if (existing && !forceReindex) {
          results.skipped.push({ file: relativeFilePath, reason: 'Already indexed' });
          continue;
        }

        if (existing && forceReindex) {
          await this.deleteDocAndChunks(existing.id);
        }

        const inferred = this.parseToolKbPath(relativeFilePath);
        const metadata: Record<string, unknown> = {
          type: 'tool_pack',
          source_kind: 'tool_pack',
          tool_slug: inferred.toolSlug,
          pack_type: inferred.packType,
          pack_major: inferred.majorVersion,
          language: inferred.language,
          weight: 1.0,
          filepath: relativeFilePath,
        };

        // DRD book branding (decyzja D-E, §7 _KONCEPT_CONTENT_ENGINES_2026-07-10.md):
        // every chunk cut from the literal "Digital Pathfinder" text must carry a
        // machine-readable citation tag, not just the in-text blockquote markers —
        // markdown headers/quotes can land on either side of the indexer's own
        // sentence-based re-chunking (see `chunkText` below), so this is the
        // reliable per-chunk citation. Scoped to drd/methodology only (the literal
        // book pack); other tool-kb packs are unaffected.
        if (inferred.toolSlug === 'drd' && inferred.packType === 'methodology') {
          metadata.source = 'Digital Pathfinder / DBR77';
          metadata.source_author = 'Piotr Wisniewski, PhD';
          metadata.branded = true;
          metadata.verbatim = true;
        }

        const res = await this.indexFile(abs, {
          name: 'Tool Knowledge Pack',
          files: [relativeFilePath],
          chunkSize: 1100,
          overlap: 200,
          metadata,
          sourceName: 'tool_pack',
          relativeFilePath,
        });

        results.indexed.push({ file: relativeFilePath, chunks: res.chunkCount, docId: res.docId });
      } catch (error: unknown) {
        const err = error as Error;
        results.failed.push({ file: abs, error: err.message });
      }
    }

    return results;
  }

  async indexProductKnowledgePills(options: { forceReindex?: boolean } = {}): Promise<{
    indexed: Array<{ file: string; chunks: number; docId: string }>;
    skipped: Array<{ file: string; reason: string }>;
    failed: Array<{ file: string; error: string }>;
  }> {
    const { forceReindex = false } = options;
    const results = {
      indexed: [] as Array<{ file: string; chunks: number; docId: string }>,
      skipped: [] as Array<{ file: string; reason: string }>,
      failed: [] as Array<{ file: string; error: string }>,
    };

    const productPillsAbs = this.findProductPillsRoot();
    if (!productPillsAbs || !fs.existsSync(productPillsAbs)) {
      results.failed.push({ file: 'knowledge/product-pills', error: 'Folder not found' });
      return results;
    }

    const filesAbs = this.walkDirForMdFiles(productPillsAbs);
    for (const abs of filesAbs) {
      const relativeFilePath = path.relative(this.projectRoot, abs).replace(/\\/g, '/').trim();

      try {
        const existing = await this.getDocByPath(relativeFilePath);
        if (existing && !forceReindex) {
          results.skipped.push({ file: relativeFilePath, reason: 'Already indexed' });
          continue;
        }

        if (existing && forceReindex) {
          await this.deleteDocAndChunks(existing.id);
        }

        const inferred = this.parseProductPillPath(relativeFilePath);
        const metadata = {
          type: 'product_pill',
          source_kind: 'product_pill',
          product_slug: inferred.productSlug,
          pill_id: inferred.pillId,
          language: inferred.language,
          weight: inferred.productSlug === 'consultify' ? 1.2 : 1.0,
          filepath: relativeFilePath,
        };

        const res = await this.indexFile(abs, {
          name: 'Product Knowledge Pill',
          files: [relativeFilePath],
          chunkSize: 1100,
          overlap: 200,
          metadata,
          sourceName: 'product_pill',
          relativeFilePath,
        });

        results.indexed.push({ file: relativeFilePath, chunks: res.chunkCount, docId: res.docId });
      } catch (error: unknown) {
        const err = error as Error;
        results.failed.push({ file: abs, error: err.message });
      }
    }

    return results;
  }

  /**
   * Extract text content from PDF
   */
  async extractPdfContent(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    return PDFParserService.extractTextFromBuffer(dataBuffer);
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
                    (id, filename, filepath, source_type, organization_id, metadata, chunk_count, status, indexed_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'indexed', NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        filename = EXCLUDED.filename,
                        filepath = EXCLUDED.filepath,
                        source_type = EXCLUDED.source_type,
                        organization_id = EXCLUDED.organization_id,
                        metadata = EXCLUDED.metadata,
                        chunk_count = EXCLUDED.chunk_count,
                        status = 'indexed',
                        updated_at = NOW()
                `,
        [
          doc.id,
          doc.filename,
          doc.filepath,
          doc.sourceType,
          doc.organizationId ?? null,
          JSON.stringify(doc.metadata || {}),
          doc.chunkCount,
        ]
      );
      return;
    }

    await DbPromise.run(
      `
                INSERT OR REPLACE INTO knowledge_docs
                (id, filename, filepath, source_type, organization_id, metadata, chunk_count, status, indexed_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'indexed', datetime('now'), datetime('now'))
            `,
      [
        doc.id,
        doc.filename,
        doc.filepath,
        doc.sourceType,
        doc.organizationId ?? null,
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

    // ★ VLT-002: this path (search() fallback) has no requesting userId — a
    // Vault-private (scope='user') document must never ground an AI answer here.
    // Same rationale as ragService.appendKnowledgeDocAccessFilter.
    if (await this.hasScopeColumn()) {
      sql += ` AND (d.scope IS NULL OR d.scope != 'user')`;
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

    // ★ VLT-002: vector-search path behind search() — same no-userId private-doc
    // exclusion as keywordSearch() above.
    if (await this.hasScopeColumn()) {
      sql += ` AND (d.scope IS NULL OR d.scope != 'user')`;
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
