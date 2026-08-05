/**
 * RAG Service
 * Hybrid search (vector + BM25) with optional re-ranking.
 */

import { OpenAI } from 'openai';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';
import { embeddingService } from './ai/embeddingService.js';
import { aiLogger } from './ai/logger.js';

type _DbRow = Record<string, unknown>;

const isPg = (): boolean => process.env.DB_TYPE === 'postgres';

/**
 * Unified query helper that routes to PostgreSQL or SQLite.
 * Accepts `?` placeholders — converts to `$N` for PostgreSQL automatically.
 */
async function queryDb<T = _DbRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (isPg()) {
    const db = getDatabase();
    let pgSql = sql;
    let idx = 0;
    pgSql = pgSql.replace(/\?/g, () => `$${++idx}`);
    const result = await db.query<T>(pgSql, params);
    return result.rows;
  }
  return DbPromise.all<T>(sql, params, { fallback: true });
}

let knowledgeDocsColumns: Set<string> | null = null;
let knowledgeChunksColumns: Set<string> | null = null;

async function ensureKnowledgeDocsColumns(): Promise<Set<string>> {
  if (knowledgeDocsColumns) return knowledgeDocsColumns;
  const cols = new Set<string>();

  if (isPg()) {
    try {
      const rows = await queryDb<{ column_name?: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_docs'`
      );
      for (const r of rows || []) {
        const name = String(r?.column_name || '').trim();
        if (name) cols.add(name);
      }
    } catch {
      // ignore
    }
  } else {
    try {
      const rows = await queryDb<{ name?: string }>(`PRAGMA table_info(knowledge_docs)`);
      for (const r of rows || []) {
        const name = String(r?.name || '').trim();
        if (name) cols.add(name);
      }
    } catch {
      // ignore
    }
  }

  // Minimal fallback (for older DBs)
  if (cols.size === 0) {
    cols.add('id');
    cols.add('filename');
    cols.add('filepath');
    cols.add('status');
    cols.add('created_at');
  }

  knowledgeDocsColumns = cols;
  return cols;
}

async function ensureKnowledgeChunksColumns(): Promise<Set<string>> {
  if (knowledgeChunksColumns) return knowledgeChunksColumns;
  const cols = new Set<string>();

  if (isPg()) {
    try {
      const rows = await queryDb<{ column_name?: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_chunks'`
      );
      for (const r of rows || []) {
        const name = String(r?.column_name || '').trim();
        if (name) cols.add(name);
      }
    } catch {
      // ignore
    }
  } else {
    try {
      const rows = await queryDb<{ name?: string }>(`PRAGMA table_info(knowledge_chunks)`);
      for (const r of rows || []) {
        const name = String(r?.name || '').trim();
        if (name) cols.add(name);
      }
    } catch {
      // ignore
    }
  }

  if (cols.size === 0) {
    cols.add('doc_id');
  }

  knowledgeChunksColumns = cols;
  return cols;
}

function knowledgeChunkDocJoin(columns: Set<string>): string {
  const hasDocId = columns.has('doc_id');
  const hasDocumentId = columns.has('document_id');
  if (hasDocId && hasDocumentId) return '(c.doc_id = d.id OR c.document_id = d.id)';
  if (hasDocumentId) return 'c.document_id = d.id';
  return 'c.doc_id = d.id';
}

function chunkInsertDocumentColumns(columns: Set<string>): string[] {
  const out: string[] = [];
  if (columns.has('doc_id')) out.push('doc_id');
  if (columns.has('document_id')) out.push('document_id');
  return out.length > 0 ? out : ['doc_id'];
}

type RerankableChunk = {
  id?: string;
  content: string;
  filename?: string;
  vectorScore?: number;
  bm25Score?: number;
  bm25ScoreNormalized?: number;
  hybridScore?: number;
  source?: string;
  scoreBreakdown?: Record<string, unknown>;
  /**
   * Chunk-level metadata from `knowledge_chunks.metadata` (branding, tool_slug,
   * pack_type, etc. — set by `knowledgeIndexer.indexFile`/`indexToolKnowledgePacks`).
   * Previously dropped by `bm25Search`/`_vectorSearch` (never selected from SQL) —
   * see fix 2026-07-10, task "Diagnoza DRD → raport zarządczy z dowodami".
   */
  metadata?: Record<string, unknown>;
  /**
   * M01-P04B (fragment anchor): real chunk ordinal within its source document,
   * from `knowledge_chunks.chunk_index`. Previously dropped by `bm25Search`/
   * `_vectorSearch` (never selected from SQL) the same way `metadata` was —
   * the conversation-scoped `documentIds` search path (`hybridSearch` →
   * `searchRelevantChunks`) had NO fragment position at all, so citations built
   * from it could never anchor to a specific fragment (only the document as a
   * whole). Guarded by `ensureKnowledgeChunksColumns()` — never assumed present.
   */
  chunkIndex?: number;
};

/** Parse a `knowledge_chunks.metadata` column value (JSON string or already-parsed object). */
function parseChunkMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

type SearchOptions = {
  limit?: number;
  organizationId?: string | null;
  minSimilarity?: number;
  /**
   * Restrict search to specific documents (conversation-scoped RAG).
   * When provided, ONLY chunks belonging to these `knowledge_docs.id` are considered.
   */
  documentIds?: string[];
};

type HybridOptions = {
  limit?: number;
  organizationId?: string | null;
  alpha?: number;
  enableReranking?: boolean;
  /**
   * Restrict hybrid search to specific documents (conversation-scoped RAG).
   */
  documentIds?: string[];
};

// M01-P04C — the ONLY legitimate reason `knowledge_docs.organization_id IS
// NULL` may be treated as retrievable: the row was produced by the internal
// tool/methodology/product knowledge-pack indexer
// (`knowledgeIndexer.insertDocument`, `source_type='tool_pack'`;
// `drdReportGrounding.ts`, `source_type='methodology'`; the product-pill
// `.md`-file walker in `knowledgeIndexer.ts`, `source_type='product_pill'`).
// That indexer is the ONLY writer of `source_type` for these values — no
// user-facing route accepts or forwards a `source_type` field — so a caller
// cannot spoof global visibility for their own upload by leaving
// `organization_id` unset. Every OTHER `organization_id IS NULL` row
// (pre-942-migration legacy rows; `ai.routes.ts` chat-attachment ingests
// whose best-effort `UPDATE ... SET organization_id` no-opped) has an
// UNRESOLVED owner, not a resolved "global" one, and must fail closed — see
// `KnowledgeService.getDocuments` for the identical contract on the Vault
// CRUD side, and `docs/ui-standards/evidence/.../M01_P04C_BACKFILL_PLAN.md`
// for how those legacy rows get a real owner assigned (not done in this
// packet).
//
// `product_pill` was added to this list by coordinator decision (M01-P04C
// review, 2026-08-05), NOT unilaterally by the original packet — the
// packet's own return summary flagged it as an open contract question
// rather than deciding it. Reason it belongs here, verified against the
// codebase: written by the identical internal indexing path as `tool_pack`
// (no user-facing route involved); `virtualWorkerKnowledgeService.ts`
// already unions `source_type IN ('product_pill', 'tool_pack')` in its own
// pre-existing query, treating them as the same trust class before this
// decision; `annaKnowledgeService.ts` actively queries `['product_pill']`
// as a live consumer. Excluding it would have made every `product_pill` row
// (98 on demo at review time) permanently unreachable by anyone —
// `annaKnowledgeService`'s knowledge base would have silently gone empty, a
// real functional regression this fix must not introduce.
const GLOBAL_KNOWLEDGE_SOURCE_TYPES = ['tool_pack', 'methodology', 'product_pill'] as const;

function appendKnowledgeDocAccessFilter(params: {
  sql: string;
  queryParams: unknown[];
  columns: Set<string>;
  organizationId: string | null;
  documentIds?: string[];
}): { sql: string; allowed: boolean } {
  const { columns, organizationId, documentIds, queryParams } = params;
  let sql = params.sql;
  const hasOrg = columns.has('organization_id');
  const hasStatus = columns.has('status');
  const hasDeletedAt = columns.has('deleted_at');
  const hasScope = columns.has('scope');
  const hasSourceType = columns.has('source_type');

  if (Array.isArray(documentIds) && documentIds.length > 0) {
    if (!hasOrg) {
      aiLogger.warn(
        'RagService',
        'Explicit documentIds search blocked because organization_id filtering is unavailable'
      );
      return { sql, allowed: false };
    }
    // `documentIds` is a curated allow-list (e.g. the tool-pack filter in
    // searchKnowledgeBase). A NULL organization_id is retrievable ONLY when
    // `source_type` explicitly marks it as one of the internal global packs
    // (see GLOBAL_KNOWLEDGE_SOURCE_TYPES above) — never merely because it is
    // NULL. Org-scoped docs still require a matching organization_id, so
    // there is no cross-org leak for those. If this schema has no
    // `source_type` column at all, there is no signal to distinguish a
    // legitimate global pack from an unresolved-owner legacy row, so NULL
    // rows are excluded entirely (fail closed, not fail open).
    const placeholders = documentIds.map(() => '?').join(',');
    const globalPlaceholders = GLOBAL_KNOWLEDGE_SOURCE_TYPES.map(() => '?').join(',');
    if (organizationId) {
      if (hasSourceType) {
        sql += ` AND d.id IN (${placeholders}) AND (d.organization_id = ? OR (d.organization_id IS NULL AND d.source_type IN (${globalPlaceholders})))`;
        queryParams.push(...documentIds, organizationId, ...GLOBAL_KNOWLEDGE_SOURCE_TYPES);
      } else {
        sql += ` AND d.id IN (${placeholders}) AND d.organization_id = ?`;
        queryParams.push(...documentIds, organizationId);
      }
    } else if (hasSourceType) {
      sql += ` AND d.id IN (${placeholders}) AND d.organization_id IS NULL AND d.source_type IN (${globalPlaceholders})`;
      queryParams.push(...documentIds, ...GLOBAL_KNOWLEDGE_SOURCE_TYPES);
    } else {
      aiLogger.warn(
        'RagService',
        'Explicit documentIds search with no caller organization blocked: no source_type column to distinguish global packs from unresolved-owner rows'
      );
      return { sql, allowed: false };
    }
  } else if (organizationId && hasOrg) {
    sql += ' AND d.organization_id = ?';
    queryParams.push(organizationId);
  }

  if (hasDeletedAt) {
    sql += ' AND d.deleted_at IS NULL';
  }
  if (hasStatus) {
    sql += " AND (d.status IS NULL OR d.status IN ('ready', 'indexed'))";
  }

  // ★ VLT-002: these code paths (bm25Search/_vectorSearch → AI/Teresa retrieval) run
  // WITHOUT a requesting userId, so there is no owner to check a `scope='user'`
  // (Vault-private, VLT-001) document against. Mirrors the "no userId" branch of
  // KnowledgeService.getDocuments (:748-751 on feat/vlt-001-vault-scope): a private
  // document must never surface in a context-less/other-user AI answer, so it is
  // excluded outright from this shared retrieval path. Owner-aware retrieval (so A's
  // own private docs CAN ground A's own AI chat) needs userId threaded through the
  // whole tool-call chain (searchKnowledgeBase → ragService) — not done here, see
  // DZIENNIK VLT-002 wątpliwości.
  if (hasScope) {
    sql += ` AND (d.scope IS NULL OR d.scope != 'user')`;
  }

  return { sql, allowed: true };
}

type ScreenContext = {
  screenId?: string;
  data?: { _meta?: { title?: string } };
};

const BM25_K1 = 1.5;
const BM25_B = 0.75;

const HYBRID_CONFIG = {
  alpha: 0.6,
  minVectorScore: 0.3,
  minBm25Score: 0.1,
  rerankerEnabled: true,
};

const tokenize = (text: string): string[] => {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
};

const termFrequency = (term: string, tokens: string[]): number => {
  return tokens.filter((token) => token === term).length;
};

const bm25Score = (
  queryTokens: string[],
  docTokens: string[],
  avgDocLength: number,
  idf: Record<string, number>
): number => {
  let score = 0;
  const docLength = docTokens.length;

  for (const term of queryTokens) {
    const tf = termFrequency(term, docTokens);
    const termIdf = idf[term] || 0;
    const numerator = tf * (BM25_K1 + 1);
    const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength));
    score += termIdf * (numerator / denominator);
  }

  return score;
};

const calculateIDF = (terms: string[], documents: string[][]): Record<string, number> => {
  const N = documents.length;
  const idf: Record<string, number> = {};

  for (const term of terms) {
    const docsWithTerm = documents.filter((doc) => doc.includes(term)).length;
    idf[term] = Math.log((N - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);
  }

  return idf;
};

const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const parseEmbedding = (value: unknown): number[] | null => {
  if (!value) return null;
  try {
    const str = Buffer.isBuffer(value) ? value.toString('utf-8') : String(value);
    return JSON.parse(str) as number[];
  } catch {
    return null;
  }
};

const RagService = {
  setDependencies: (
    newDeps: {
      OpenAI?: typeof OpenAI;
      embeddingService?: typeof embeddingService;
      uuidv4?: typeof uuidv4;
    } = {}
  ) => {
    if (newDeps.OpenAI) deps.OpenAI = newDeps.OpenAI;
    if (newDeps.embeddingService) deps.embeddingService = newDeps.embeddingService;
    if (newDeps.uuidv4) deps.uuidv4 = newDeps.uuidv4;
  },

  generateEmbedding: async (text: string): Promise<number[] | null> => {
    await initDeps();

    // Prefer OpenRouter for embeddings when configured (chat already uses it).
    // The demo's direct OpenAI key returns 401, so vector search was dead —
    // OpenRouter proxies `openai/text-embedding-3-small` (same 1536 dims).
    const routerKey = process.env.OPENROUTER_API_KEY;
    let apiKey: string | undefined;
    let baseURL: string | undefined;
    let model = 'text-embedding-3-small';

    if (routerKey) {
      apiKey = routerKey;
      baseURL = 'https://openrouter.ai/api/v1';
      model = 'openai/text-embedding-3-small';
    } else {
      // Try env var first (works on both SQLite and PostgreSQL)
      apiKey = process.env.OPENAI_API_KEY;

      // Fallback to llm_providers table
      if (!apiKey) {
        if (isPg()) {
          const rows = await queryDb<{ api_key?: string }>(
            "SELECT api_key FROM llm_providers WHERE provider = 'openai' AND is_active = 1 LIMIT 1"
          );
          apiKey = rows[0]?.api_key;
        } else {
          const provider = await DbPromise.get<{ api_key?: string }>(
            "SELECT * FROM llm_providers WHERE provider = 'openai' AND is_active = 1 LIMIT 1",
            [],
            { fallback: true }
          );
          apiKey = provider?.api_key;
        }
      }
    }

    if (!apiKey) {
      return null;
    }

    try {
      const openai = new deps.OpenAI(baseURL ? { apiKey, baseURL } : { apiKey });
      const response = await openai.embeddings.create({
        model,
        input: text,
        encoding_format: 'float',
      });
      return response.data[0]?.embedding || null;
    } catch (error: unknown) {
      aiLogger.error('RagService', 'Embedding Error', error);
      return null;
    }
  },

  getContext: async (
    query: string,
    limit = 3,
    filterOptions: { organizationId?: string; screenContext?: ScreenContext } = {}
  ): Promise<string> => {
    await initDeps();
    const { organizationId, screenContext } = filterOptions;
    const cols = await ensureKnowledgeDocsColumns();
    const chunkCols = await ensureKnowledgeChunksColumns();
    const hasOrg = cols.has('organization_id');
    const hasScope = cols.has('scope');
    const chunkJoin = knowledgeChunkDocJoin(chunkCols);

    let expandedQuery = query;
    if (screenContext) {
      const screenTitle = screenContext.data?._meta?.title || screenContext.screenId || '';
      if (screenTitle) expandedQuery += ` ${screenTitle}`;
    }

    const queryEmbedding = await RagService.generateEmbedding(expandedQuery);
    if (!queryEmbedding) {
      return RagService.getContextKeyword(expandedQuery, limit, organizationId || null);
    }

    let sql = `
            SELECT c.content, d.filename, c.embedding
            FROM knowledge_chunks c
            JOIN knowledge_docs d ON ${chunkJoin}
            WHERE c.embedding IS NOT NULL
        `;
    const params: unknown[] = [];

    if (organizationId && hasOrg) {
      sql += ' AND d.organization_id = ?';
      params.push(organizationId);
    }

    // ★ VLT-002: no userId in this call chain — exclude Vault-private (scope='user')
    // docs, same rationale as appendKnowledgeDocAccessFilter above.
    if (hasScope) {
      sql += ` AND (d.scope IS NULL OR d.scope != 'user')`;
    }

    const rows = await queryDb<{ content: string; filename: string; embedding: string }>(
      sql,
      params
    );

    if (!rows || rows.length === 0) {
      return RagService.getContextKeyword(expandedQuery, limit, organizationId || null);
    }

    const scored = rows.map((row) => {
      const vec = parseEmbedding(row.embedding);
      return {
        ...row,
        score: vec ? cosineSimilarity(queryEmbedding, vec) : 0,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, limit);

    const context = topChunks
      .filter((chunk) => chunk.score > 0.5)
      .map(
        (row) =>
          `[Source: ${row.filename}] (Relevance: ${Math.round(row.score * 100)}%)\n${row.content}`
      )
      .join('\n\n');

    if (organizationId) {
      await DbPromise.run(
        `INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, new_value, created_at)
                 VALUES (?, ?, NULL, 'rag_query', 'knowledge', NULL, ?, CURRENT_TIMESTAMP)`,
        [
          deps.uuidv4(),
          organizationId,
          JSON.stringify({
            query: query.substring(0, 200),
            resultsCount: topChunks.filter((chunk) => chunk.score > 0.5).length,
            topScore: topChunks[0]?.score,
          }),
        ],
        { fallback: true }
      );
    }

    return context;
  },

  getContextKeyword: async (
    query: string,
    limit = 3,
    organizationId: string | null = null
  ): Promise<string> => {
    await initDeps();
    const cols = await ensureKnowledgeDocsColumns();
    const chunkCols = await ensureKnowledgeChunksColumns();
    const hasOrg = cols.has('organization_id');
    const hasScope = cols.has('scope');
    const chunkJoin = knowledgeChunkDocJoin(chunkCols);
    if (!query) return '';
    const keywords = query
      .split(' ')
      .map((word) => word.trim().replace(/[^\w\s]/gi, ''))
      .filter((word) => word.length > 3);
    if (keywords.length === 0) return '';

    const sqlParts = keywords.map(() => 'c.content LIKE ?').join(' OR ');
    const params: unknown[] = keywords.map((word) => `%${word}%`);

    let sql = `
            SELECT c.content, d.filename
            FROM knowledge_chunks c
            JOIN knowledge_docs d ON ${chunkJoin}
            WHERE (${sqlParts})
        `;

    if (organizationId && hasOrg) {
      sql += ' AND d.organization_id = ?';
      params.push(organizationId);
    }

    // ★ VLT-002: no userId here either — same private-doc exclusion as getContext.
    if (hasScope) {
      sql += ` AND (d.scope IS NULL OR d.scope != 'user')`;
    }

    sql += ` LIMIT ${limit}`;

    const rows = await queryDb<{ content: string; filename: string }>(sql, params);
    return (rows || []).map((row) => `[Source: ${row.filename}]\n${row.content}`).join('\n\n');
  },

  storeChunks: async (docId: string, chunks: string[]): Promise<void> => {
    await initDeps();
    const chunkCols = await ensureKnowledgeChunksColumns();
    const docColumns = chunkInsertDocumentColumns(chunkCols);
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${docId}-chk-${i}`;
      const embedding = await RagService.generateEmbedding(chunks[i]);

      await DbPromise.run(
        `INSERT INTO knowledge_chunks (id, ${docColumns.join(', ')}, content, embedding)
                 VALUES (?, ${docColumns.map(() => '?').join(', ')}, ?, ?)`,
        [chunkId, ...docColumns.map(() => docId), chunks[i], JSON.stringify(embedding || [])],
        { fallback: true }
      );
    }
  },

  getAxisDefinitions: (axisName: string): Promise<string> => {
    const query = `${axisName} maturity levels definitions 1 2 3 4 5`;
    return RagService.getContext(query, 5);
  },

  searchRelevantChunks: async (
    query: string,
    options: SearchOptions = {}
  ): Promise<
    Array<{
      content: string;
      source: string;
      similarity: number;
      documentId?: string;
      chunkIndex?: number;
      /**
       * Branding pass-through (decyzja D-E, `_KONCEPT_CONTENT_ENGINES_2026-07-10.md`
       * §7): chunk-level citation metadata set by `knowledgeIndexer` for branded
       * packs (e.g. the "Digital Pathfinder" book — `source`/`source_author`/
       * `branded`/`verbatim`). Previously computed then discarded here — only
       * `filename` survived into `source`. Optional: most KB sources have none.
       */
      sourceAuthor?: string;
      branded?: boolean;
      metadata?: Record<string, unknown>;
    }>
  > => {
    await initDeps();
    const { limit = 5, organizationId, minSimilarity = 0.5, documentIds } = options;

    try {
      // Conversation-scoped RAG: if documentIds are provided, bypass embeddingService.search()
      // (which may not support doc-level filters) and use the hybrid SQL path with doc filters.
      if (Array.isArray(documentIds) && documentIds.length > 0) {
        const results = await RagService.hybridSearch(query, {
          limit,
          organizationId: organizationId || null,
          enableReranking: true,
          documentIds,
        });
        return results.map((r) => {
          const meta = r.metadata || {};
          return {
            content: r.content || '',
            source: (meta.source as string) || r.filename || 'Knowledge Base',
            similarity: r.hybridScore || 0,
            documentId: (r as any)?.doc_id || (r as any)?.documentId || undefined,
            // M01-P04B: real chunk ordinal (knowledge_chunks.chunk_index), not fabricated —
            // undefined when the column is absent (ensureKnowledgeChunksColumns guard
            // upstream in bm25Search/_vectorSearch), never a hardcoded 0.
            chunkIndex: typeof r.chunkIndex === 'number' ? r.chunkIndex : undefined,
            sourceAuthor: (meta.source_author as string) || undefined,
            branded: Boolean(meta.branded),
            metadata: meta,
          };
        });
      }

      const results = await deps.embeddingService.search(query, {
        limit,
        organizationId: organizationId || undefined,
        minSimilarity,
      });

      if (!results || results.length === 0) {
        const legacyContext = await RagService.getContext(query, limit, {
          organizationId: organizationId || undefined,
        });
        if (legacyContext) {
          return [
            {
              content: legacyContext,
              source: 'legacy_knowledge_base',
              similarity: 0.7,
            },
          ];
        }
        return [];
      }

      return results.map((result) => {
        const meta = (result.metadata as Record<string, unknown>) || {};
        return {
          content: result.content || '',
          source: (meta.source as string) || (meta.filename as string) || 'Knowledge Base',
          similarity: result.similarity || 0,
          documentId: result.document_id || undefined,
          chunkIndex: result.chunk_index || undefined,
          sourceAuthor: (meta.source_author as string) || undefined,
          branded: Boolean(meta.branded),
          metadata: meta,
        };
      });
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.error('RagService', `searchRelevantChunks error: ${err.message}`);
      const keywordContext = await RagService.getContextKeyword(
        query,
        limit,
        organizationId || null
      );
      if (keywordContext) {
        return [
          {
            content: keywordContext,
            source: 'keyword_search',
            similarity: 0.5,
          },
        ];
      }
      return [];
    }
  },

  ingestDocument: async (params: {
    content: string;
    filename: string;
    mimeType?: string;
    organizationId?: string;
  }): Promise<{
    documentId: string;
    totalChunks: number;
    embeddedChunks: number;
    success: boolean;
  }> => {
    await initDeps();
    const { content, filename, mimeType, organizationId } = params;
    const ingestionModule = await import('./ai/ingestionPipeline.js');
    const ingestionPipeline = (ingestionModule.ingestionPipeline || ingestionModule.default) as {
      process?: (
        args: Record<string, unknown>
      ) => Promise<{ chunks: Array<{ content: string; chunkIndex: number }> }>;
    };

    if (!ingestionPipeline.process) {
      throw new Error('Ingestion pipeline does not support process()');
    }

    const documentId = deps.uuidv4();

    const { chunks } = await ingestionPipeline.process({
      content,
      filename,
      mimeType,
      documentId,
      organizationId,
    });

    let successCount = 0;
    for (const chunk of chunks) {
      try {
        const embedding = await deps.embeddingService.generateEmbedding(chunk.content);
        await deps.embeddingService.storeChunk({ ...chunk, documentId }, embedding);
        successCount++;
      } catch (error: unknown) {
        const err = error as Error;
        aiLogger.warn('RagService', `Failed to embed chunk ${chunk.chunkIndex}: ${err.message}`);
      }
    }

    return {
      documentId,
      totalChunks: chunks.length,
      embeddedChunks: successCount,
      success: successCount > 0,
    };
  },

  bm25Search: async (
    query: string,
    limit = 10,
    organizationId: string | null = null,
    documentIds?: string[]
  ): Promise<RerankableChunk[]> => {
    await initDeps();
    const cols = await ensureKnowledgeDocsColumns();
    const chunkCols = await ensureKnowledgeChunksColumns();
    const hasCategory = cols.has('category');
    const hasVersion = cols.has('version');
    const hasChunkIndex = chunkCols.has('chunk_index');
    const chunkJoin = knowledgeChunkDocJoin(chunkCols);
    let sql = `
            SELECT
              c.id,
              c.content,
              c.metadata as chunk_metadata,
              d.filename,
              d.id as doc_id
              ${hasCategory ? ', d.category as doc_category' : ''}
              ${hasVersion ? ', d.version as doc_version' : ''}
              ${hasChunkIndex ? ', c.chunk_index as chunk_index' : ''}
            FROM knowledge_chunks c
            JOIN knowledge_docs d ON ${chunkJoin}
            WHERE 1=1
        `;
    const params: unknown[] = [];

    const accessFilter = appendKnowledgeDocAccessFilter({
      sql,
      queryParams: params,
      columns: cols,
      organizationId,
      documentIds,
    });
    if (!accessFilter.allowed) return [];
    sql = accessFilter.sql;

    const rows = await queryDb<{
      id: string;
      content: string;
      filename: string;
      chunk_metadata?: string | Record<string, unknown> | null;
      chunk_index?: number | null;
    }>(sql, params);
    if (!rows || rows.length === 0) {
      return [];
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const tokenizedDocs = rows.map((row) => tokenize(row.content));
    const totalLength = tokenizedDocs.reduce((sum, doc) => sum + doc.length, 0);
    const avgDocLength = totalLength / tokenizedDocs.length;
    const idf = calculateIDF(queryTokens, tokenizedDocs);

    const scored = rows.map((row, idx) => ({
      ...row,
      metadata: parseChunkMetadata(row.chunk_metadata),
      chunkIndex: typeof row.chunk_index === 'number' ? row.chunk_index : undefined,
      bm25Score: bm25Score(queryTokens, tokenizedDocs[idx], avgDocLength, idf),
      tokens: tokenizedDocs[idx],
    }));

    const results = scored
      .filter((result) => (result.bm25Score || 0) > HYBRID_CONFIG.minBm25Score)
      .sort((a, b) => (b.bm25Score || 0) - (a.bm25Score || 0))
      .slice(0, limit);

    const maxBm25 = results.length > 0 ? results[0].bm25Score || 1 : 1;
    return results.map((result) => ({
      ...result,
      bm25ScoreNormalized: (result.bm25Score || 0) / maxBm25,
    }));
  },

  hybridSearch: async (query: string, options: HybridOptions = {}): Promise<RerankableChunk[]> => {
    await initDeps();
    const {
      limit = 5,
      organizationId = null,
      alpha = HYBRID_CONFIG.alpha,
      enableReranking = HYBRID_CONFIG.rerankerEnabled,
      documentIds,
    } = options;

    aiLogger.info(
      'RagService',
      `Hybrid search: query="${query.substring(0, 50)}...", alpha=${alpha}`
    );

    const candidateLimit = limit * 3;
    const [bm25Results, vectorResults] = await Promise.all([
      RagService.bm25Search(query, candidateLimit, organizationId, documentIds),
      RagService._vectorSearch(query, candidateLimit, organizationId, documentIds),
    ]);

    aiLogger.info(
      'RagService',
      `BM25 results: ${bm25Results.length}, Vector results: ${vectorResults.length}`
    );

    const resultMap = new Map<string, RerankableChunk>();

    for (const result of bm25Results) {
      const key = result.id || result.content.substring(0, 100);
      resultMap.set(key, {
        ...result,
        bm25Score: result.bm25ScoreNormalized || 0,
        vectorScore: 0,
        source: 'bm25',
      });
    }

    for (const result of vectorResults) {
      const key = result.id || result.content.substring(0, 100);
      const existing = resultMap.get(key);
      const vectorScore = result.vectorScore || 0;

      if (existing) {
        existing.vectorScore = vectorScore;
        existing.source = 'hybrid';
      } else {
        resultMap.set(key, {
          ...result,
          bm25Score: 0,
          vectorScore,
          source: 'vector',
        });
      }
    }

    const combined = Array.from(resultMap.values()).map((result) => {
      const hybridScore = alpha * (result.vectorScore || 0) + (1 - alpha) * (result.bm25Score || 0);
      return {
        ...result,
        hybridScore,
        scoreBreakdown: {
          vector: result.vectorScore || 0,
          bm25: result.bm25Score || 0,
          hybrid: hybridScore,
          alpha,
        },
      };
    });

    combined.sort((a, b) => (b.hybridScore || 0) - (a.hybridScore || 0));
    let finalResults: RerankableChunk[] = combined.slice(0, limit);

    if (enableReranking && finalResults.length > 1) {
      try {
        const rerankerModule = await import('./ai/rerankerService.js');
        const reranker = (rerankerModule.default || rerankerModule) as {
          rerankDocuments: (
            queryText: string,
            docs: RerankableChunk[],
            topK: number
          ) => Promise<RerankableChunk[]>;
        };
        finalResults = await reranker.rerankDocuments(query, finalResults, limit);
        aiLogger.info('RagService', `Re-ranked ${finalResults.length} results`);
      } catch (error: unknown) {
        const err = error as Error;
        aiLogger.warn('RagService', `Re-ranking skipped: ${err.message}`);
      }
    }

    await RagService._logSearchMetrics(query, organizationId, {
      bm25Count: bm25Results.length,
      vectorCount: vectorResults.length,
      hybridCount: combined.length,
      finalCount: finalResults.length,
      topScore: finalResults[0]?.hybridScore || 0,
    });

    return finalResults;
  },

  _vectorSearch: async (
    query: string,
    limit: number,
    organizationId: string | null = null,
    documentIds?: string[]
  ): Promise<Array<RerankableChunk & { vectorScore: number }>> => {
    await initDeps();
    const cols = await ensureKnowledgeDocsColumns();
    const chunkCols = await ensureKnowledgeChunksColumns();
    const hasCategory = cols.has('category');
    const hasVersion = cols.has('version');
    const hasChunkIndex = chunkCols.has('chunk_index');
    const chunkJoin = knowledgeChunkDocJoin(chunkCols);
    const queryEmbedding = await RagService.generateEmbedding(query);
    if (!queryEmbedding) return [];

    let sql = `
            SELECT
              c.id,
              c.content,
              c.metadata as chunk_metadata,
              d.filename,
              d.id as doc_id,
              c.embedding
              ${hasCategory ? ', d.category as doc_category' : ''}
              ${hasVersion ? ', d.version as doc_version' : ''}
              ${hasChunkIndex ? ', c.chunk_index as chunk_index' : ''}
            FROM knowledge_chunks c
            JOIN knowledge_docs d ON ${chunkJoin}
            WHERE c.embedding IS NOT NULL
        `;
    const params: unknown[] = [];

    const accessFilter = appendKnowledgeDocAccessFilter({
      sql,
      queryParams: params,
      columns: cols,
      organizationId,
      documentIds,
    });
    if (!accessFilter.allowed) return [];
    sql = accessFilter.sql;

    const rows = await queryDb<{
      id: string;
      content: string;
      filename: string;
      embedding: string;
      chunk_metadata?: string | Record<string, unknown> | null;
      chunk_index?: number | null;
    }>(sql, params);

    const scored = rows.map((row) => {
      const vec = parseEmbedding(row.embedding);
      return {
        ...row,
        metadata: parseChunkMetadata(row.chunk_metadata),
        chunkIndex: typeof row.chunk_index === 'number' ? row.chunk_index : undefined,
        vectorScore: vec ? cosineSimilarity(queryEmbedding, vec) : 0,
      };
    });

    return scored
      .filter((result) => result.vectorScore > HYBRID_CONFIG.minVectorScore)
      .sort((a, b) => b.vectorScore - a.vectorScore)
      .slice(0, limit);
  },

  _logSearchMetrics: async (
    query: string,
    organizationId: string | null,
    metrics: Record<string, unknown>
  ): Promise<void> => {
    if (!organizationId) return;
    await initDeps();

    await DbPromise.run(
      `INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, new_value, created_at)
             VALUES (?, ?, NULL, 'hybrid_search', 'knowledge', NULL, ?, CURRENT_TIMESTAMP)`,
      [
        deps.uuidv4(),
        organizationId,
        JSON.stringify({
          query: query.substring(0, 200),
          ...metrics,
          timestamp: new Date().toISOString(),
        }),
      ],
      { fallback: true }
    );
  },

  getContextHybrid: async (
    query: string,
    options: {
      limit?: number;
      organizationId?: string;
      screenContext?: ScreenContext;
      documentIds?: string[];
    } = {}
  ): Promise<{
    context: string;
    sources: Array<{
      filename?: string;
      score?: number;
      method?: string;
      breakdown?: Record<string, unknown>;
    }>;
    metrics: Record<string, unknown>;
  }> => {
    const { limit = 5, organizationId, screenContext, documentIds } = options;
    let expandedQuery = query;

    if (screenContext) {
      const screenTitle = screenContext.data?._meta?.title || screenContext.screenId || '';
      if (screenTitle) expandedQuery += ` ${screenTitle}`;
    }

    const results = await RagService.hybridSearch(expandedQuery, {
      limit,
      organizationId,
      enableReranking: true,
      documentIds,
    });

    const context = results
      .filter((result) => (result.hybridScore || 0) > 0.2)
      .map((result, idx) => {
        const source = result.filename || 'Knowledge Base';
        const score = Math.round((result.hybridScore || 0) * 100);
        return `[${idx + 1}] [Source: ${source}] (Relevance: ${score}%, Method: ${result.source})\n${result.content}`;
      })
      .join('\n\n---\n\n');

    return {
      context,
      sources: results.map((result) => ({
        filename: result.filename,
        score: result.hybridScore,
        method: result.source,
        breakdown: result.scoreBreakdown,
      })),
      metrics: {
        totalResults: results.length,
        topScore: results[0]?.hybridScore || 0,
        method: 'hybrid_bm25_vector',
      },
    };
  },
};

const deps = {
  OpenAI,
  embeddingService,
  uuidv4,
};

async function initDeps(): Promise<void> {
  if (!deps.OpenAI) {
    const mod = await import('openai');
    deps.OpenAI = (mod as { OpenAI?: typeof OpenAI }).OpenAI || OpenAI;
  }
  if (!deps.embeddingService) {
    deps.embeddingService = embeddingService;
  }
  if (!deps.uuidv4) {
    deps.uuidv4 = uuidv4;
  }
}

export default RagService;
