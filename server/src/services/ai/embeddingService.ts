/**
 * Embedding Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Generate and store vector embeddings using OpenAI text-embedding-3-small.
 */

// @ts-ignore - Missing type definitions for @ai-sdk/openai
import { createOpenAI } from '@ai-sdk/openai';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { getDatabase } from '../../database/Database.js';
import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { validateExternalServiceResponse } from '../../utils/typeGuards.js';
import { buildKnowledgeDocAccessFilter as buildSharedKnowledgeDocAccessFilter } from './knowledgeDocAccessFilter.js';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

type EmbeddingChunk = {
  content: string;
  chunkIndex?: number;
  documentId: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
  sourceType?: string;
};

type EmbeddingSearchOptions = {
  limit?: number;
  organizationId?: string;
  userId?: string;
  minSimilarity?: number;
  sourceType?: string;
  projectIds?: string[];
};

type EmbeddingRow = {
  id: string;
  organization_id?: string | null;
  document_id?: string | null;
  chunk_index?: number | null;
  content?: string | null;
  chunk_text?: string | null;
  embedding?: string | null;
  metadata?: string | Record<string, unknown> | null;
  source_type?: string | null;
  similarity?: number | null;
};

const EmbeddingResponseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
    })
  ),
});

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

// FIX-4 (dyżur 210): `buildKnowledgeDocAccessFilter`'s "no `scope` column"
// branch is fail-closed (excludes the entire knowledge base, not just
// private docs — see ODBIÓR_210.md §2), which is the RIGHT call for
// security, but it used to do so in total silence. `PostgresDatabase.initDb()`
// creates `knowledge_docs` WITHOUT `scope` (it only arrives via a runtime
// ALTER in `KnowledgeService.ts`/`ContextDocumentService.ts`), so an
// unlucky bootstrap order can go fully dark with zero signal in the logs.
// Module-level (not per-instance) so this fires ONCE per process regardless
// of how many `EmbeddingService` instances exist, instead of on every single
// search — `buildKnowledgeDocAccessFilter` re-queries `information_schema`
// per call (FIX-9, left as debt), so a naive per-call warn would flood logs.
let missingScopeColumnWarned = false;

export class EmbeddingService {
  private openaiConfigured: boolean;

  constructor() {
    // Prefer OpenRouter (proxies openai/text-embedding-3-small); the demo's
    // direct OpenAI key returns 401 so vector indexing was silently dead.
    this.openaiConfigured = Boolean(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY);
    this.initProvider();
  }

  private initProvider(): void {
    if (process.env.OPENAI_API_KEY) {
      createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Generate embedding for a text chunk
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openaiConfigured) {
      throw new Error('OpenAI API key not configured');
    }

    const routerKey = process.env.OPENROUTER_API_KEY;
    const embUrl = routerKey
      ? 'https://openrouter.ai/api/v1/embeddings'
      : 'https://api.openai.com/v1/embeddings';
    const embKey = routerKey || process.env.OPENAI_API_KEY;
    const embModel = routerKey ? `openai/${EMBEDDING_MODEL}` : EMBEDDING_MODEL;

    try {
      const response = await fetch(embUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${embKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: embModel,
          input: text.substring(0, 8000),
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = validateExternalServiceResponse(await response.json(), EmbeddingResponseSchema);
      return data.data[0]?.embedding ?? [];
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[EmbeddingService] Error:', err.message);
      throw err;
    }
  }

  /**
   * Store chunk with embedding in database
   * Works with both SQLite (JSON) and PostgreSQL (pgvector)
   */
  async storeChunk(chunk: EmbeddingChunk, embedding: number[]): Promise<{ id?: string | number }> {
    const isPg = process.env.DB_TYPE === 'postgres';

    if (isPg) {
      return this.storeChunkPg(chunk, embedding);
    }
    return this.storeChunkSqlite(chunk, embedding);
  }

  private async storeChunkSqlite(
    chunk: EmbeddingChunk,
    embedding: number[]
  ): Promise<{ id?: string | number }> {
    const { content, chunkIndex, documentId, organizationId, metadata } = chunk;
    const id = uuidv4();
    await DbPromise.run(
      `INSERT INTO ai_knowledge_embeddings 
             (id, organization_id, document_id, chunk_index, content, embedding, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        organizationId ?? null,
        documentId,
        chunkIndex ?? 0,
        content,
        JSON.stringify(embedding),
        JSON.stringify(metadata || {}),
      ],
      { fallback: false }
    );

    return { id };
  }

  private async storeChunkPg(
    chunk: EmbeddingChunk,
    embedding: number[]
  ): Promise<{ id?: string | number }> {
    const { content, chunkIndex, documentId, organizationId, metadata, sourceType } = chunk;
    const vectorLiteral = `[${embedding.join(',')}]`;
    const db = getDatabase();
    // Keep the JSON marker for backwards compatibility, but persist tenant
    // ownership as a first-class column. A NULL owner is never itself a signal
    // that a chunk is global; global material is identified by source_type.
    const metadataWithOrg = { ...(metadata || {}), organization_id: organizationId ?? null };
    const result = await db.query<{ id: string }>(
      `INSERT INTO ai_knowledge_embeddings
             (organization_id, document_id, chunk_index, chunk_text, embedding, metadata, source_type)
             VALUES ($1, $2, $3, $4, $5::vector, $6, $7)
             RETURNING id`,
      [
        organizationId ?? null,
        documentId,
        chunkIndex ?? 0,
        content,
        vectorLiteral,
        JSON.stringify(metadataWithOrg),
        sourceType || 'project',
      ]
    );

    return { id: result.rows[0]?.id };
  }

  /**
   * Search for similar chunks using cosine similarity
   */
  async search(query: string, options: EmbeddingSearchOptions = {}): Promise<EmbeddingRow[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    const isPg = process.env.DB_TYPE === 'postgres';

    if (isPg) {
      return this.searchPg(queryEmbedding, options);
    }
    return this.searchSqlite(queryEmbedding, options);
  }

  /**
   * SQLite search - compute cosine similarity in JS
   */
  private async searchSqlite(
    queryEmbedding: number[],
    options: EmbeddingSearchOptions
  ): Promise<EmbeddingRow[]> {
    const { limit = 5, organizationId, userId, projectIds, minSimilarity = 0.5 } = options;

    // FIX-1 (dyżur 210): `e.*` alone never populated `EmbeddingRow.content` — the
    // real (Postgres-only, see Database.ts header) `ai_knowledge_embeddings`
    // schema names the column `chunk_text`, not `content`, so every caller
    // reading `row.content` off this branch silently got `undefined` regardless
    // of access filtering. Alias it exactly like `searchPg` does, so this branch
    // actually returns usable content (surfaced by writing the day210 mutation
    // gate test for this path — the assertion was vacuously true before this fix,
    // since an always-undefined `content` can never "contain" anything).
    let sql = `SELECT e.*, e.chunk_text as content FROM ai_knowledge_embeddings e`;
    const params: Array<string | number> = [];
    const where: string[] = [];

    if (organizationId) {
      where.push(`e.organization_id = ?`);
      params.push(organizationId);
    }

    const accessFilter = await this.buildKnowledgeDocAccessFilter('e', userId, false, params.length + 1, projectIds);
    where.push(accessFilter.sql);
    params.push(...accessFilter.params);
    if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;

    const rows = await DbPromise.all<EmbeddingRow>(sql, params, { fallback: false });
    if (!rows || rows.length === 0) {
      return [];
    }

    const results = rows
      .map((row) => {
        const embedding = parseJson<number[]>(row.embedding ?? '[]', []);
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        return {
          ...row,
          similarity,
          metadata:
            typeof row.metadata === 'string'
              ? parseJson<Record<string, unknown>>(row.metadata, {})
              : row.metadata,
        };
      })
      .filter((result) => (result.similarity ?? 0) >= minSimilarity)
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, limit);

    return results;
  }

  /**
   * PostgreSQL search - use pgvector operators
   */
  private async searchPg(
    queryEmbedding: number[],
    options: EmbeddingSearchOptions
  ): Promise<EmbeddingRow[]> {
    const { limit = 5, minSimilarity = 0.5, sourceType, organizationId, userId, projectIds } = options;
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    let sql = `
            SELECT
                id,
                organization_id,
                document_id,
                chunk_text as content,
                metadata,
                source_type,
                1 - (embedding <=> $1::vector) as similarity
            FROM ai_knowledge_embeddings e
            WHERE 1 - (e.embedding <=> $1::vector) > $2
        `;
    const params: Array<string | number> = [vectorLiteral, minSimilarity];
    let paramIndex = 3;

    if (sourceType) {
      sql += ` AND source_type = $${paramIndex}`;
      params.push(sourceType);
      paramIndex++;
    }

    // Tenant-owned chunks must match the caller. Only explicitly classified
    // internal knowledge sources are global; missing ownership is fail-closed.
    if (organizationId) {
      sql += ` AND (e.organization_id = $${paramIndex} OR (e.organization_id IS NULL AND e.source_type IN ('tool_pack', 'methodology', 'product_pill')))`;
      params.push(organizationId);
      paramIndex++;
    }

    const accessFilter = await this.buildKnowledgeDocAccessFilter('e', userId, true, paramIndex, projectIds);
    sql += ` AND ${accessFilter.sql}`;
    params.push(...accessFilter.params);
    paramIndex += accessFilter.params.length;

    sql += ` ORDER BY e.embedding <=> $1::vector LIMIT $${paramIndex}`;
    params.push(limit);

    try {
      const db = getDatabase();
      const result = await db.query<EmbeddingRow>(sql, params);
      return (result.rows || []).map((row) => ({
        ...row,
        metadata:
          typeof row.metadata === 'string'
            ? parseJson<Record<string, unknown>>(row.metadata, {})
            : row.metadata,
      }));
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[EmbeddingService] PostgreSQL search error:', err.message);
      throw err;
    }
  }

  private async buildKnowledgeDocAccessFilter(
    embeddingAlias: string,
    userId: string | undefined,
    isPg: boolean,
    firstParamIndex: number,
    projectIds?: string[]
  ): Promise<{ sql: string; params: string[] }> {
    let hasScope = false;
    let hasOwner = false;
    try {
      if (isPg) {
        const result = await getDatabase().query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
            WHERE table_name = 'knowledge_docs' AND column_name IN ('scope', 'owner_id', 'project_id', 'ai_visibility', 'sensitivity')`
        );
        const columns = new Set(result.rows.map((row) => row.column_name));
        hasScope = columns.has('scope');
        hasOwner = columns.has('owner_id');
        return buildSharedKnowledgeDocAccessFilter({ columns, dialect: 'postgres', firstParamIndex, documentAlias: 'd', embeddingAlias, userId, projectIds });
      } else {
        const rows = await DbPromise.all<{ name?: string }>(`PRAGMA table_info(knowledge_docs)`, [], {
          fallback: false,
        });
        const columns = new Set((rows || []).map((row) => String(row.name || '')));
        hasScope = columns.has('scope');
        hasOwner = columns.has('owner_id');
        return buildSharedKnowledgeDocAccessFilter({ columns, dialect: 'question', documentAlias: 'd', embeddingAlias, userId, projectIds });
      }
    } catch {
      // Missing/unreadable provenance is resolved fail-closed below.
    }

    if (!hasScope) {
      if (!missingScopeColumnWarned) {
        missingScopeColumnWarned = true;
        logger.error(
          '[EmbeddingService] knowledge_docs.scope column is missing — the entire ' +
            'knowledge base (not just private Vault docs) is being excluded from ' +
            'embedding search fail-closed. This is expected only immediately after a ' +
            'fresh migration, before KnowledgeService/ContextDocumentService run their ' +
            'runtime ALTER TABLE. If this persists, retrieval is silently dark; run the ' +
            'ALTER (or the equivalent migration) against knowledge_docs.'
        );
      }
      return {
        sql: `NOT EXISTS (SELECT 1 FROM knowledge_docs d WHERE d.id = ${embeddingAlias}.document_id)`,
        params: [],
      };
    }

    return buildSharedKnowledgeDocAccessFilter({
      columns: new Set([...(hasScope ? ['scope'] : []), ...(hasOwner ? ['owner_id'] : [])]),
      dialect: isPg ? 'postgres' : 'question', firstParamIndex, documentAlias: 'd',
      embeddingAlias, userId, projectIds,
    });
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Ensure the embeddings table exists
   */
  async ensureTable(): Promise<void> {
    const isPg = process.env.DB_TYPE === 'postgres';

    if (isPg) {
      logger.info('[EmbeddingService] PostgreSQL - run migration for pgvector');
      return;
    }

    await DbPromise.run(
      `
                CREATE TABLE IF NOT EXISTS ai_knowledge_embeddings (
                    id TEXT PRIMARY KEY,
                    organization_id TEXT,
                    document_id TEXT,
                    chunk_index INTEGER,
                    content TEXT NOT NULL,
                    embedding TEXT,
                    metadata TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `,
      [],
      { fallback: false }
    );
  }
}

export const embeddingService = new EmbeddingService();

export default {
  EmbeddingService,
  embeddingService,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
};
