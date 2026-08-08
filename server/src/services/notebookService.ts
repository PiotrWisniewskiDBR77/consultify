/**
 * Notebook Service (V4-NOTE-01 through V4-NOTE-07)
 *
 * V4-NOTE-01: Capture connectors — web clipper, email forward, upload
 * V4-NOTE-02: Ingestion pipeline — extract → tokenize → index (FTS + embedding)
 * V4-NOTE-03: FTS — already implemented via migration 627 (search_vector)
 * V4-NOTE-04: Semantic search with RAG + citations (permission-safe)
 * V4-NOTE-06: AI insert-as-blocks with audit log
 * V4-NOTE-07: Embed chips + preview shell contract
 */

import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { embeddingService } from './ai/embeddingService.js';
import { persistNotebookSourceFile } from './notebookSourceFileService.js';
import PDFParserService from './pdfParserService.js';
import { P07_PROVENANCE_LANGUAGE, type P07Provenance } from './v8/notebookCanon.js';

// ============================================================
// Types
// ============================================================

export type CaptureSource = 'upload' | 'web_clipper' | 'email_forward' | 'api_import';

export interface CaptureRequest {
  source: CaptureSource;
  title?: string;
  content?: string;
  url?: string;
  emailFrom?: string;
  emailSubject?: string;
  fileBuffer?: Buffer;
  fileMimetype?: string;
  fileOriginalname?: string;
  tags?: string[];
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestionResult {
  pageId: string;
  title: string;
  contentText: string;
  tokensEstimate: number;
  embeddingStored: boolean;
  ftsIndexed: boolean;
  source: CaptureSource;
}

export interface SemanticSearchResult {
  pageId: string;
  title: string;
  snippet: string;
  score: number;
  sourceRef: { type: 'notebook_page'; id: string };
  matchType: 'fts' | 'semantic' | 'hybrid';
}

export interface AIBlockProposal {
  id: string;
  pageId: string;
  actorId: string;
  proposalType: 'insert' | 'replace' | 'append';
  blockContent: Record<string, unknown>;
  rationale: string;
  status: 'proposed' | 'accepted' | 'rejected';
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface BlockProvenance {
  type: P07Provenance;
  actor: string;
  timestamp: string;
  proposalId?: string;
  inputPointers?: string[];
}

export interface EmbedChipInfo {
  artifactType: string;
  artifactId: string;
  title: string;
  snippet: string;
  status?: string;
  updatedAt?: string;
  permissionOk: boolean;
}

/**
 * NotebookContextSnapshot — runtime model linking a notebook page
 * to its surrounding application context (chat thread, initiative,
 * project, organization scope, and retrieval parameters).
 *
 * Referenced by SSOT: NOTATKA_V8_PLATFORM_CONTEXT_AND_INTEGRATION.md
 */
export interface NotebookContextSnapshot {
  noteId: string;
  organizationId: string;
  chatThreadRef?: string;
  organizationContextRef?: string;
  linkedInitiativeId?: string;
  linkedProjectId?: string;
  retrievalScope: 'org' | 'project' | 'personal';
  capturedAt: string;
}

export function buildNotebookContextSnapshot(
  noteId: string,
  orgId: string,
  opts?: Partial<Omit<NotebookContextSnapshot, 'noteId' | 'organizationId' | 'capturedAt'>>
): NotebookContextSnapshot {
  return {
    noteId,
    organizationId: orgId,
    retrievalScope: opts?.retrievalScope || 'org',
    capturedAt: new Date().toISOString(),
    ...opts,
  };
}

// ============================================================
// Service
// ============================================================

class NotebookService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ──────────────────────────────────────────────
  // V4-NOTE-01: Capture connectors
  // ──────────────────────────────────────────────

  async capture(orgId: string, userId: string, request: CaptureRequest): Promise<IngestionResult> {
    let contentText = '';
    let title = request.title || 'Untitled';

    switch (request.source) {
      case 'upload': {
        if (request.fileBuffer && request.fileMimetype && request.fileOriginalname) {
          contentText = await this.extractText(
            request.fileBuffer,
            request.fileMimetype,
            request.fileOriginalname
          );
          if (!request.title) {
            title = path.basename(request.fileOriginalname, path.extname(request.fileOriginalname));
          }
        }
        break;
      }
      case 'web_clipper': {
        contentText = request.content || '';
        if (request.url) {
          title = request.title || request.url;
          contentText = `Source: ${request.url}\n\n${contentText}`;
        }
        break;
      }
      case 'email_forward': {
        title = request.emailSubject || request.title || 'Email note';
        const emailHeader = [
          request.emailFrom ? `From: ${request.emailFrom}` : '',
          request.emailSubject ? `Subject: ${request.emailSubject}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        contentText = emailHeader
          ? `${emailHeader}\n\n${request.content || ''}`
          : request.content || '';
        break;
      }
      case 'api_import': {
        contentText = request.content || '';
        break;
      }
    }

    return this.ingest(orgId, userId, {
      title: title.slice(0, 200),
      contentText: contentText.slice(0, 500000),
      source: request.source,
      tags: request.tags || [],
      projectId: request.projectId,
      sourceFile:
        request.source === 'upload' &&
        request.fileBuffer &&
        request.fileOriginalname &&
        request.fileMimetype
          ? {
              buffer: request.fileBuffer,
              originalname: request.fileOriginalname,
              mimetype: request.fileMimetype,
            }
          : undefined,
      metadata: {
        ...request.metadata,
        captureSource: request.source,
        url: request.url,
        emailFrom: request.emailFrom,
        fileOriginalname: request.fileOriginalname,
        fileMimetype: request.fileMimetype,
      },
    });
  }

  // ──────────────────────────────────────────────
  // V4-NOTE-02: Ingestion pipeline
  // ──────────────────────────────────────────────

  async ingest(
    orgId: string,
    userId: string,
    data: {
      title: string;
      contentText: string;
      source: CaptureSource;
      tags?: string[];
      projectId?: string;
      sourceFile?: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
      };
      metadata?: Record<string, unknown>;
    }
  ): Promise<IngestionResult> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const persistedSourceMetadata =
      data.source === 'upload' && data.sourceFile
        ? await persistNotebookSourceFile({
            organizationId: orgId,
            pageId: id,
            fileBuffer: data.sourceFile.buffer,
            fileOriginalname: data.sourceFile.originalname,
            fileMimetype: data.sourceFile.mimetype,
          })
        : {};

    const contentJson = JSON.stringify({
      type: 'doc',
      content: this.textToBlocks(data.contentText),
    });

    const tokensEstimate = Math.ceil(data.contentText.length / 4);

    // Deployments created from the baseline schema may not yet have the V4
    // capture columns (the historical migration lives under never-ran/).
    // Keep the canonical ingest path compatible with both schemas instead of
    // making Note handoff fail after approval.
    const notebookColumns = await getTableColumns('notebook_pages');
    const values: Record<string, unknown> = {
      id,
      owner_user_id: userId,
      organization_id: orgId,
      project_id: data.projectId || null,
      visibility: 'private',
      title: data.title,
      content_json: contentJson,
      content_text: data.contentText,
      tags_json: JSON.stringify(data.tags || []),
      status: 'active',
      capture_source: data.source,
      capture_metadata: JSON.stringify({ ...(data.metadata || {}), ...persistedSourceMetadata }),
      created_at: now,
      updated_at: now,
    };
    const insertColumns = Object.keys(values).filter((column) => notebookColumns.has(column));
    await queryHelpers.queryRun(
      `INSERT INTO notebook_pages (${insertColumns.join(', ')})
       VALUES (${insertColumns.map(() => '?').join(', ')})`,
      insertColumns.map((column) => values[column])
    );

    let ftsIndexed = false;
    const isPg = process.env.DB_TYPE === 'postgres';
    if (isPg) {
      try {
        await queryHelpers.queryRun(
          `UPDATE notebook_pages
           SET search_vector = to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content_text,'') || ' ' || coalesce(tags_json,''))
           WHERE id = ?`,
          [id]
        );
        ftsIndexed = true;
      } catch (err: any) {
        logger.debug(`[NotebookService] FTS index update failed: ${err.message}`);
      }
    }

    let embeddingStored = false;
    try {
      await this.storeEmbedding(orgId, id, data.contentText);
      embeddingStored = true;
    } catch (err: any) {
      logger.debug(`[NotebookService] Embedding storage skipped: ${err.message}`);
    }

    return {
      pageId: id,
      title: data.title,
      contentText: data.contentText.slice(0, 500),
      tokensEstimate,
      embeddingStored,
      ftsIndexed,
      source: data.source,
    };
  }

  // ──────────────────────────────────────────────
  // V4-NOTE-04: Semantic search with RAG + citations
  // ──────────────────────────────────────────────

  async semanticSearch(
    orgId: string,
    userId: string,
    query: string,
    options?: { limit?: number; projectId?: string; minScore?: number }
  ): Promise<SemanticSearchResult[]> {
    const limit = Math.min(options?.limit || 20, 100);
    const results: SemanticSearchResult[] = [];

    const ftsResults = await this.ftsSearch(orgId, userId, query, {
      limit,
      projectId: options?.projectId,
    });
    for (const r of ftsResults) {
      results.push({ ...r, matchType: 'fts' });
    }

    const embeddingResults = await this.embeddingSearch(orgId, userId, query, {
      limit,
      projectId: options?.projectId,
    });
    for (const r of embeddingResults) {
      const existing = results.find((e) => e.pageId === r.pageId);
      if (existing) {
        existing.score = Math.max(existing.score, r.score);
        existing.matchType = 'hybrid';
      } else {
        results.push({ ...r, matchType: 'semantic' });
      }
    }

    results.sort((a, b) => b.score - a.score);

    const minScore = options?.minScore || 0;
    return results.filter((r) => r.score >= minScore).slice(0, limit);
  }

  async buildRAGContext(
    orgId: string,
    userId: string,
    query: string,
    options?: { maxTokens?: number; limit?: number }
  ): Promise<{
    context: string;
    citations: Array<{ pageId: string; title: string; snippet: string }>;
  }> {
    const maxTokens = options?.maxTokens || 4000;
    const results = await this.semanticSearch(orgId, userId, query, {
      limit: options?.limit || 10,
    });

    const citations: Array<{ pageId: string; title: string; snippet: string }> = [];
    const contextParts: string[] = [];
    let tokenCount = 0;

    for (const r of results) {
      const snippet = r.snippet.slice(0, 1000);
      const tokens = Math.ceil(snippet.length / 4);
      if (tokenCount + tokens > maxTokens) break;

      contextParts.push(`[Source: ${r.title} (${r.pageId})]\n${snippet}\n`);
      citations.push({ pageId: r.pageId, title: r.title, snippet: snippet.slice(0, 200) });
      tokenCount += tokens;
    }

    return {
      context: contextParts.join('\n---\n'),
      citations,
    };
  }

  // ──────────────────────────────────────────────
  // V4-NOTE-06: AI insert-as-blocks with audit
  // ──────────────────────────────────────────────

  async createAIProposal(
    orgId: string,
    actorId: string,
    pageId: string,
    proposal: {
      proposalType: 'insert' | 'replace' | 'append';
      blockContent: Record<string, unknown>;
      rationale: string;
    }
  ): Promise<AIBlockProposal> {
    const db = await this.getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    await this.ensureProposalTable(db);

    await db.run(
      `INSERT INTO notebook_ai_proposals
       (id, organization_id, page_id, actor_id, proposal_type, block_content, rationale, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'proposed', ?)`,
      [
        id,
        orgId,
        pageId,
        actorId,
        proposal.proposalType,
        JSON.stringify(proposal.blockContent),
        proposal.rationale,
        now,
      ]
    );

    return {
      id,
      pageId,
      actorId,
      proposalType: proposal.proposalType,
      blockContent: proposal.blockContent,
      rationale: proposal.rationale,
      status: 'proposed',
      createdAt: now,
      resolvedAt: null,
      resolvedBy: null,
    };
  }

  async resolveAIProposal(
    orgId: string,
    proposalId: string,
    userId: string,
    action: 'accepted' | 'rejected'
  ): Promise<AIBlockProposal | null> {
    const db = await this.getDb();
    await this.ensureProposalTable(db);

    const existing = await db.get(
      `SELECT * FROM notebook_ai_proposals WHERE id = ? AND organization_id = ?`,
      [proposalId, orgId]
    );
    if (!existing) return null;

    const now = new Date().toISOString();
    await db.run(
      `UPDATE notebook_ai_proposals SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ? AND organization_id = ?`,
      [action, now, userId, proposalId, orgId]
    );

    if (action === 'accepted') {
      await this.applyAcceptedProposal(db, orgId, existing);
    }

    const row = await db.get(
      `SELECT * FROM notebook_ai_proposals WHERE id = ? AND organization_id = ?`,
      [proposalId, orgId]
    );
    if (!row) return null;

    return mapProposalRow(row);
  }

  async getProposalsForPage(
    orgId: string,
    pageId: string,
    options?: { status?: string; limit?: number }
  ): Promise<AIBlockProposal[]> {
    const db = await this.getDb();
    await this.ensureProposalTable(db);

    const conditions = ['organization_id = ?', 'page_id = ?'];
    const params: unknown[] = [orgId, pageId];

    if (options?.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    const limit = Math.min(options?.limit || 50, 200);
    params.push(limit);

    const rows =
      (await db.all(
        `SELECT * FROM notebook_ai_proposals WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
        params
      )) || [];

    return rows.map(mapProposalRow);
  }

  // ──────────────────────────────────────────────
  // P07 §2.3.3: Export with provenance side-channel
  // ──────────────────────────────────────────────

  async exportWithProvenance(
    orgId: string,
    pageId: string
  ): Promise<{
    markdown: string;
    provenanceMap: Array<{ blockIndex: number; provenance: BlockProvenance }>;
  }> {
    const page = await queryHelpers.queryOne<{ content_json?: string | null }>(
      `SELECT content_json FROM notebook_pages WHERE id = ? AND organization_id = ?`,
      [pageId, orgId]
    );
    if (!page) {
      return { markdown: '', provenanceMap: [] };
    }

    const doc = safeParseDocument(page.content_json);
    const blocks = Array.isArray(doc.content) ? doc.content : [];

    const markdownParts: string[] = [];
    const provenanceMap: Array<{ blockIndex: number; provenance: BlockProvenance }> = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      markdownParts.push(blockToMarkdown(block));

      const raw = (block as any).provenance;
      const provenance: BlockProvenance =
        raw && typeof raw === 'object' && P07_PROVENANCE_LANGUAGE.includes(raw.type)
          ? {
              type: raw.type,
              actor: raw.actor || 'unknown',
              timestamp: raw.timestamp || '',
              proposalId: raw.proposalId,
              inputPointers: raw.inputPointers,
            }
          : { type: 'user_edit', actor: 'unknown', timestamp: '' };

      provenanceMap.push({ blockIndex: i, provenance });
    }

    return { markdown: markdownParts.join('\n\n'), provenanceMap };
  }

  // ──────────────────────────────────────────────
  // V4-NOTE-07: Embed chips — resolve artifact info
  // ──────────────────────────────────────────────

  async resolveEmbedChip(
    orgId: string,
    userId: string,
    artifactType: string,
    artifactId: string
  ): Promise<EmbedChipInfo | null> {
    const tableMap: Record<
      string,
      { table: string; titleCol: string; statusCol?: string; snippetCols?: string[] }
    > = {
      notebook_page: {
        table: 'notebook_pages',
        titleCol: 'title',
        statusCol: 'status',
        snippetCols: ['summary', 'content_text'],
      },
      notebook: {
        table: 'notebook_pages',
        titleCol: 'title',
        statusCol: 'status',
        snippetCols: ['summary', 'content_text'],
      },
      initiative: {
        table: 'initiatives',
        titleCol: 'name',
        statusCol: 'status',
        snippetCols: ['summary', 'description'],
      },
      task: {
        table: 'tasks',
        titleCol: 'title',
        statusCol: 'status',
        snippetCols: ['description'],
      },
      decision: {
        table: 'decisions',
        titleCol: 'title',
        statusCol: 'status',
        snippetCols: ['description'],
      },
      tool_session: {
        table: 'tool_sessions',
        titleCol: 'name',
        statusCol: 'status',
        snippetCols: ['summary'],
      },
      report: {
        table: 'report_builder_reports',
        titleCol: 'title',
        statusCol: 'status',
        snippetCols: ['description'],
      },
      assessment: {
        table: 'assessments',
        titleCol: 'name',
        statusCol: 'status',
        snippetCols: ['description'],
      },
      presentation: { table: 'presentations', titleCol: 'title', statusCol: 'status' },
      idea: { table: 'my_work_idea_maps', titleCol: 'name', snippetCols: ['description', 'body'] },
    };

    const config = tableMap[artifactType];
    if (!config) {
      return {
        artifactType,
        artifactId,
        title: `Unknown (${artifactType})`,
        snippet: '',
        permissionOk: false,
      };
    }

    try {
      const statusSelect = config.statusCol ? `, ${config.statusCol} as status` : '';
      const snippetSelect = (config.snippetCols || [])
        .map((col) => `COALESCE(${col}, '')`)
        .join(`, ' ', `);
      const snippetExpr = snippetSelect ? `, TRIM(${snippetSelect}) as snippet` : `, '' as snippet`;
      const row = await queryHelpers.queryOne<any>(
        `SELECT id, ${config.titleCol} as title${statusSelect}${snippetExpr}, updated_at as "updatedAt"
         FROM ${config.table}
         WHERE id = ? AND organization_id = ?
         LIMIT 1`,
        [artifactId, orgId]
      );

      if (!row) {
        return {
          artifactType,
          artifactId,
          title: 'Not found',
          snippet: '',
          permissionOk: false,
        };
      }

      return {
        artifactType,
        artifactId,
        title: row.title || artifactId,
        snippet: String(row.snippet || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 220),
        status: row.status,
        updatedAt: row.updatedAt,
        permissionOk: true,
      };
    } catch {
      return {
        artifactType,
        artifactId,
        title: artifactType,
        snippet: '',
        permissionOk: false,
      };
    }
  }

  async resolveEmbedChips(
    orgId: string,
    userId: string,
    refs: Array<{ type: string; id: string }>
  ): Promise<EmbedChipInfo[]> {
    const results: EmbedChipInfo[] = [];
    for (const ref of refs.slice(0, 50)) {
      const info = await this.resolveEmbedChip(orgId, userId, ref.type, ref.id);
      if (info) results.push(info);
    }
    return results;
  }

  // ──────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────

  private async extractText(
    buffer: Buffer,
    mimetype: string,
    originalname: string
  ): Promise<string> {
    const ext = path.extname(originalname || '').toLowerCase();
    if (ext === '.pdf' || mimetype === 'application/pdf') {
      return await PDFParserService.extractTextFromBuffer(buffer);
    }
    if (ext === '.xlsx' || ext === '.xls' || mimetype?.includes('spreadsheet')) {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const lines: string[] = [];
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(ws, { FS: '\t' });
        lines.push(`=== ${name} ===`, csv);
      }
      return lines.join('\n');
    }
    if (ext === '.docx' || mimetype?.includes('wordprocessingml')) {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      } catch {
        return buffer.toString('utf-8');
      }
    }
    if (ext === '.html' || ext === '.htm' || mimetype?.includes('html')) {
      return buffer
        .toString('utf-8')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return buffer.toString('utf-8');
  }

  private textToBlocks(
    text: string,
    provenanceType: P07Provenance = 'source'
  ): Array<Record<string, unknown>> {
    const now = new Date().toISOString();
    const paragraphs = text.split(/\n{2,}/).filter(Boolean);
    return paragraphs.slice(0, 200).map((p) => ({
      type: 'paragraph',
      provenance: {
        type: provenanceType,
        actor: 'system',
        timestamp: now,
      } satisfies BlockProvenance,
      content: [{ type: 'text', text: p.trim().slice(0, 10000) }],
    }));
  }

  private async ftsSearch(
    orgId: string,
    userId: string,
    query: string,
    options: { limit: number; projectId?: string }
  ): Promise<SemanticSearchResult[]> {
    const isPg = process.env.DB_TYPE === 'postgres';
    const conditions = ['np.organization_id = ?'];
    const params: unknown[] = [orgId];

    conditions.push(
      `((lower(np.visibility) = 'private' AND np.owner_user_id = ?)
        OR (lower(np.visibility) = 'project' AND np.project_id IS NOT NULL))`
    );
    params.push(userId);

    if (options.projectId) {
      conditions.push('np.project_id = ?');
      params.push(options.projectId);
    }

    let ftsQueryParam: string | null = null;
    if (isPg) {
      ftsQueryParam = query.trim();
      conditions.push(`np.search_vector @@ plainto_tsquery('simple', ?)`);
      params.push(ftsQueryParam);
    } else {
      const like = `%${query.toLowerCase()}%`;
      conditions.push(`(lower(np.title) LIKE ? OR lower(coalesce(np.content_text,'')) LIKE ?)`);
      params.push(like, like);
    }

    params.push(options.limit);

    // The FTS rank MUST be parameterised, not string-interpolated: a query
    // containing '?' (e.g. "…notatek?") was rewritten by the placeholder driver
    // into a bogus `$1`, shifting every other param → 42P18 "could not determine
    // data type of parameter $1" (and it was a SQL-injection vector). The rank
    // expression sits in SELECT, so its bind goes FIRST in the param list.
    const rankExpr = isPg ? `ts_rank(np.search_vector, plainto_tsquery('simple', ?))` : '1.0';
    const finalParams = isPg ? [ftsQueryParam, ...params] : params;

    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT np.id, np.title, SUBSTR(np.content_text, 1, 300) as snippet, ${rankExpr} as score
       FROM notebook_pages np
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${isPg ? 'score DESC,' : ''} np.updated_at DESC
       LIMIT ?`,
        finalParams
      )) || [];

    return rows.map((r: any) => ({
      pageId: r.id,
      title: r.title || '',
      snippet: r.snippet || '',
      score: r.score || 0.5,
      sourceRef: { type: 'notebook_page' as const, id: r.id },
      matchType: 'fts' as const,
    }));
  }

  private async embeddingSearch(
    orgId: string,
    userId: string,
    query: string,
    options: { limit: number; projectId?: string }
  ): Promise<SemanticSearchResult[]> {
    const db = await this.getDb();

    try {
      await db.get('SELECT 1 FROM notebook_embeddings LIMIT 1');
    } catch {
      return [];
    }

    const conditions = ['ne.organization_id = ?'];
    const params: unknown[] = [orgId];

    if (options.projectId) {
      conditions.push('np.project_id = ?');
      params.push(options.projectId);
    }

    conditions.push(
      `((lower(np.visibility) = 'private' AND np.owner_user_id = ?)
        OR (lower(np.visibility) = 'project' AND np.project_id IS NOT NULL))`
    );
    params.push(userId);

    params.push(options.limit);

    const rows =
      (await db.all(
        `SELECT ne.page_id, np.title, SUBSTR(ne.chunk_text, 1, 300) as snippet, ne.embedding_vector
       FROM notebook_embeddings ne
       JOIN notebook_pages np ON np.id = ne.page_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ne.updated_at DESC
       LIMIT ?`,
        params
      )) || [];

    if (rows.length === 0) return [];

    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await embeddingService.generateEmbedding(query);
    } catch {
      queryEmbedding = null;
    }

    const scored = rows.map((r: any) => {
      const snippet = r.snippet || '';
      const storedEmbedding = parseEmbeddingVector(r.embedding_vector);
      const score =
        queryEmbedding && storedEmbedding
          ? cosineSimilarity(queryEmbedding, storedEmbedding)
          : lexicalSimilarity(query, snippet);
      return {
        pageId: r.page_id,
        title: r.title || '',
        snippet,
        score,
        sourceRef: { type: 'notebook_page' as const, id: r.page_id },
        matchType: 'semantic' as const,
      };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit);
  }

  private async storeEmbedding(orgId: string, pageId: string, text: string): Promise<void> {
    const db = await this.getDb();
    await this.ensureEmbeddingTable(db);

    const chunks = this.chunkText(text, 1000);
    const now = new Date().toISOString();

    await db.run(`DELETE FROM notebook_embeddings WHERE page_id = ? AND organization_id = ?`, [
      pageId,
      orgId,
    ]);

    for (let i = 0; i < chunks.length && i < 50; i++) {
      let embeddingVector: string | null = null;
      try {
        const embedding = await embeddingService.generateEmbedding(chunks[i]);
        if (Array.isArray(embedding) && embedding.length > 0) {
          embeddingVector = JSON.stringify(embedding);
        }
      } catch {
        embeddingVector = null;
      }
      await db.run(
        `INSERT INTO notebook_embeddings (id, organization_id, page_id, chunk_index, chunk_text, embedding_vector, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), orgId, pageId, i, chunks[i], embeddingVector, now]
      );
    }
  }

  private chunkText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n{2,}/);
    let current = '';

    for (const p of paragraphs) {
      if (current.length + p.length > chunkSize && current.length > 0) {
        chunks.push(current.trim());
        current = '';
      }
      current += p + '\n\n';
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  private async ensureEmbeddingTable(db: IDatabase): Promise<void> {
    try {
      await db.run(`CREATE TABLE IF NOT EXISTS notebook_embeddings (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        page_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL DEFAULT 0,
        chunk_text TEXT NOT NULL,
        embedding_vector TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      await db.run(
        `CREATE INDEX IF NOT EXISTS idx_nb_embed_page ON notebook_embeddings(organization_id, page_id)`
      );
    } catch {
      /* may exist */
    }
  }

  private async ensureProposalTable(db: IDatabase): Promise<void> {
    try {
      await db.run(`CREATE TABLE IF NOT EXISTS notebook_ai_proposals (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        page_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        proposal_type TEXT NOT NULL DEFAULT 'insert',
        block_content TEXT NOT NULL DEFAULT '{}',
        rationale TEXT,
        status TEXT NOT NULL DEFAULT 'proposed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        resolved_by TEXT
      )`);
      await db.run(
        `CREATE INDEX IF NOT EXISTS idx_nb_proposals_page ON notebook_ai_proposals(organization_id, page_id, status)`
      );
    } catch {
      /* may exist */
    }
  }

  private async applyAcceptedProposal(
    db: IDatabase,
    orgId: string,
    proposalRow: any
  ): Promise<void> {
    const page = (await db.get(
      `SELECT id, content_json, content_text FROM notebook_pages WHERE id = ? AND organization_id = ?`,
      [proposalRow.page_id, orgId]
    )) as { id: string; content_json?: string | null; content_text?: string | null } | undefined;
    if (!page) return;

    const currentDoc = safeParseDocument(page.content_json);
    const proposalType = String(proposalRow.proposal_type || 'insert') as
      | 'insert'
      | 'replace'
      | 'append';
    // J26 (two-channel doctrine): fragment-level replace. The stored
    // `blockContent` may carry optional targeting metadata for the inline
    // "select → rewrite" flow (NotebookInlineAIMenu):
    //   `_replaceRange`  = { from, to } — inclusive top-level block indices to swap out.
    //   `_replaceBlocks` = explicit replacement blocks (preserves paragraph structure).
    // Both keys are stripped before the block is persisted. When absent,
    // `replace` keeps its legacy whole-document semantics (backward compatible).
    const rawBlock = safeParseJson(proposalRow.block_content);
    const replaceRange = extractReplaceRange(rawBlock);
    const replaceBlocks = extractReplaceBlocks(rawBlock);
    const nextBlock = normalizeNotebookBlock(rawBlock);
    const existingBlocks = Array.isArray(currentDoc.content) ? currentDoc.content : [];

    const provenance = {
      type: 'ai_transform' as P07Provenance,
      actor: proposalRow.actor_id,
      proposalId: proposalRow.id,
      inputPointers: [proposalRow.page_id],
      timestamp: new Date().toISOString(),
    } satisfies BlockProvenance;

    const replacementBlocks: Array<Record<string, unknown>> = (
      replaceBlocks && replaceBlocks.length > 0 ? replaceBlocks : [nextBlock]
    ).map((b) => ({ ...b, provenance }));

    let updatedBlocks = existingBlocks;
    if (proposalType === 'replace') {
      if (replaceRange && existingBlocks.length > 0) {
        const from = Math.max(0, Math.min(replaceRange.from, existingBlocks.length - 1));
        const to = Math.max(from, Math.min(replaceRange.to, existingBlocks.length - 1));
        updatedBlocks = [
          ...existingBlocks.slice(0, from),
          ...replacementBlocks,
          ...existingBlocks.slice(to + 1),
        ];
      } else {
        updatedBlocks = replacementBlocks;
      }
    } else if (proposalType === 'append') {
      updatedBlocks = [...existingBlocks, ...replacementBlocks];
    } else {
      updatedBlocks = [...replacementBlocks, ...existingBlocks];
    }

    const nextDoc = { ...currentDoc, type: 'doc', content: updatedBlocks };
    const nextText = blocksToPlainText(updatedBlocks);

    await db.run(
      `UPDATE notebook_pages
       SET content_json = ?, content_text = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [JSON.stringify(nextDoc), nextText, new Date().toISOString(), proposalRow.page_id, orgId]
    );
  }
}

// ============================================================
// Helpers
// ============================================================

function mapProposalRow(r: any): AIBlockProposal {
  return {
    id: r.id,
    pageId: r.page_id,
    actorId: r.actor_id,
    proposalType: r.proposal_type || 'insert',
    blockContent: safeParseJson(r.block_content),
    rationale: r.rationale || '',
    status: r.status || 'proposed',
    createdAt: r.created_at,
    resolvedAt: r.resolved_at || null,
    resolvedBy: r.resolved_by || null,
  };
}

function safeParseJson(val: unknown): Record<string, unknown> {
  if (!val) return {};
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val as Record<string, unknown>);
  } catch {
    return {};
  }
}

function safeParseDocument(val: unknown): {
  type: string;
  content: Array<Record<string, unknown>>;
} {
  if (!val) return { type: 'doc', content: [] };
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    if (parsed && typeof parsed === 'object') {
      const candidate = parsed as { type?: string; content?: Array<Record<string, unknown>> };
      return {
        type: candidate.type || 'doc',
        content: Array.isArray(candidate.content) ? candidate.content : [],
      };
    }
  } catch {
    // fall through
  }
  return { type: 'doc', content: [] };
}

function normalizeNotebookBlock(block: Record<string, unknown>): Record<string, unknown> {
  if (block.type && Array.isArray(block.content)) return block;
  const text = String((block as any).text || (block as any).content || '').trim();
  return {
    type: 'paragraph',
    content: [{ type: 'text', text }],
  };
}

/**
 * J26: extract + strip the optional `_replaceRange` targeting hint from a
 * proposal block. Mutates `block` so the metadata never lands in the stored doc.
 */
function extractReplaceRange(block: Record<string, unknown>): { from: number; to: number } | null {
  const raw = (block as any)._replaceRange;
  delete (block as any)._replaceRange;
  if (raw && typeof raw === 'object') {
    const from = Number((raw as any).from);
    const to = Number((raw as any).to);
    if (Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to >= from) {
      return { from: Math.floor(from), to: Math.floor(to) };
    }
  }
  return null;
}

/**
 * J26: extract + strip the optional `_replaceBlocks` array (explicit replacement
 * blocks that preserve paragraph structure). Mutates `block`.
 */
function extractReplaceBlocks(
  block: Record<string, unknown>
): Array<Record<string, unknown>> | null {
  const raw = (block as any)._replaceBlocks;
  delete (block as any)._replaceBlocks;
  if (Array.isArray(raw)) {
    const blocks = raw
      .filter((b) => b && typeof b === 'object')
      .map((b) => normalizeNotebookBlock(b as Record<string, unknown>));
    return blocks.length > 0 ? blocks : null;
  }
  return null;
}

function blockToMarkdown(block: Record<string, unknown>): string {
  const content = Array.isArray((block as any).content) ? (block as any).content : [];
  const text = content
    .map((node: any) => (typeof node?.text === 'string' ? node.text : ''))
    .filter(Boolean)
    .join('');
  const blockType = String(block.type || 'paragraph');
  if (blockType.startsWith('heading')) {
    const level = parseInt(blockType.replace(/\D/g, ''), 10) || 1;
    return '#'.repeat(Math.min(level, 6)) + ' ' + text;
  }
  return text;
}

function blocksToPlainText(blocks: Array<Record<string, unknown>>): string {
  return blocks
    .map((block) => {
      const content = Array.isArray((block as any).content) ? (block as any).content : [];
      return content
        .map((node: any) => (typeof node?.text === 'string' ? node.text : ''))
        .filter(Boolean)
        .join('');
    })
    .filter(Boolean)
    .join('\n\n');
}

function parseEmbeddingVector(value: unknown): number[] | null {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map(Number) : null;
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function lexicalSimilarity(query: string, text: string): number {
  const queryTerms = tokenize(query);
  const textTerms = new Set(tokenize(text));
  if (queryTerms.length === 0 || textTerms.size === 0) return 0;
  let matches = 0;
  for (const term of queryTerms) {
    if (textTerms.has(term)) matches++;
  }
  return matches / queryTerms.length;
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

const notebookService = new NotebookService();

/**
 * Convenience wrapper for external callers (e.g. Teresa copilot handoff)
 * that need to create a note without knowing the internal capture/ingest API.
 */
export async function createNote(params: {
  organizationId: string;
  title?: string;
  body?: string;
  source?: string;
  userId?: string;
  proposalId?: string;
  projectId?: string;
  /**
   * #21 Notatnik-centrum-myśli: opcjonalny termin przypomnienia „przypomnij mi …".
   * Persist w capture_metadata.reminder (kolumna JSON — bez migracji).
   */
  reminder?: { dueAt?: string | null; term?: string | null } | null;
}): Promise<{ id: string; noteId: string; title: string }> {
  const userId = params.userId || 'system';
  const title = params.title || 'Untitled';
  const hasReminder = Boolean(params.reminder && (params.reminder.dueAt || params.reminder.term));
  const result = await notebookService.ingest(params.organizationId, userId, {
    title,
    contentText: params.body || '',
    source: 'api_import',
    projectId: params.projectId,
    metadata: {
      externalSource: params.source || 'api',
      proposalId: params.proposalId,
      ...(hasReminder
        ? {
            reminder: {
              dueAt: params.reminder!.dueAt ?? null,
              term: params.reminder!.term ?? null,
              createdAt: new Date().toISOString(),
              status: 'pending',
            },
          }
        : {}),
    },
  });
  return { id: result.pageId, noteId: result.pageId, title: result.title };
}

export default notebookService;
export { createNote as createNotebookNote, NotebookService, notebookService };
