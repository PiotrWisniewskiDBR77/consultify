/**
 * Knowledge Service
 *
 * Canonical backend implementation for `server/src/routes/knowledge.routes.ts`.
 * Focus: candidates (idea inbox), global strategies, and RAG documents.
 */

import { randomUUID } from 'node:crypto';

import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { EmbeddingService } from './ai/embeddingService.js';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

// ★ VLT-001: 3 poziomy przypisania dokumentu Vault (osoba/projekt/organizacja).
export type VaultDocumentScope = 'user' | 'project' | 'organization';

export interface VaultDocumentAccess {
  userId?: string | null;
  role?: string | null;
  /** Jeżeli podane — filtruj do JEDNEGO poziomu; jeżeli brak — widok domyślny (patrz getDocuments). */
  scope?: VaultDocumentScope | null;
  projectId?: string | null;
}

const embeddingService = new EmbeddingService();

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};

const toJsonArrayString = (value: unknown): string => {
  if (value === null || value === undefined) return '[]';
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '[]';
    if (trimmed.startsWith('[')) return trimmed;
    return JSON.stringify(
      trimmed
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    );
  }
  return JSON.stringify(value);
};

const safeFilename = (name: string): string => {
  return String(name || 'document')
    .replace(/[/\\]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
};

const buildDocKey = (row: {
  organization_id?: unknown;
  project_id?: unknown;
  filename?: unknown;
  id?: unknown;
}) => {
  return [
    String(row.organization_id || 'global').trim() || 'global',
    String(row.project_id || 'default').trim() || 'default',
    String(row.filename || row.id || 'document').trim() || 'document',
  ].join(':');
};

const chunkText = (text: string, opts?: { chunkSize?: number; overlap?: number }): string[] => {
  const chunkSize = Math.max(200, Math.min(2000, opts?.chunkSize ?? 1000));
  const overlap = Math.max(0, Math.min(chunkSize - 50, opts?.overlap ?? 200));
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  if (!normalized.trim()) return [];

  const chunks: string[] = [];
  let i = 0;
  while (i < normalized.length) {
    const end = Math.min(normalized.length, i + chunkSize);
    const slice = normalized.slice(i, end).trim();
    if (slice.length >= 40) chunks.push(slice);
    i = end - overlap;
    if (i <= 0) i = end;
  }
  return chunks;
};

async function ensureKnowledgeSchema(): Promise<void> {
  try {
    // Candidates (ideas inbox)
    await DbPromise.run(
      `CREATE TABLE IF NOT EXISTS knowledge_candidates (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        reasoning TEXT,
        source TEXT DEFAULT 'user_feedback',
        status TEXT DEFAULT 'pending',
        origin_context TEXT,
        related_axis TEXT,
        category TEXT,
        tags TEXT,
        implementation_notes TEXT,
        impact_score REAL,
        related_project_ids TEXT,
        admin_comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )`,
      [],
      { fallback: true } as any
    );

    // Global strategies
    await DbPromise.run(
      `CREATE TABLE IF NOT EXISTS global_strategies (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        created_by TEXT,
        success_metrics TEXT,
        priority TEXT DEFAULT 'medium',
        target_date TEXT,
        progress_percentage INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        related_document_ids TEXT,
        related_idea_ids TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )`,
      [],
      { fallback: true } as any
    );

    // knowledge_docs (RAG documents metadata)
    await DbPromise.run(
      `CREATE TABLE IF NOT EXISTS knowledge_docs (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        filepath TEXT,
        organization_id TEXT,
        project_id TEXT,
        file_size_bytes INTEGER,
        status TEXT DEFAULT 'pending',
        category TEXT,
        tags TEXT,
        version INTEGER DEFAULT 1,
        parent_doc_id TEXT,
        chunk_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      [],
      { fallback: true } as any
    );

    // ★ VLT-001: kolumny 3-poziomowego scope (osoba/projekt/organizacja) dopisane addytywnie
    // do bazowego schematu Vault — wcześniej istniały tylko dzięki ALTER w
    // ContextDocumentService.ensureSchema() (ta sama tabela, druga usługa), więc Vault zależał
    // od kolejności inicjalizacji obcego serwisu. `fallback: true` + brak IF NOT EXISTS na
    // dialekcie, który go nie wspiera, jest bezpieczne — DbPromise.run z fallback:true łyka błąd
    // "column already exists" (patrz identyczny wzorzec: ContextDocumentService.ts:2389-2411).
    const knowledgeDocsScopeColumns = [
      `ALTER TABLE knowledge_docs ADD COLUMN owner_id TEXT`,
      `ALTER TABLE knowledge_docs ADD COLUMN scope TEXT`,
    ];
    for (const statement of knowledgeDocsScopeColumns) {
      await DbPromise.run(statement, [], { fallback: true } as any);
    }

    // knowledge_chunks (local chunks store)
    await DbPromise.run(
      `CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        doc_id TEXT NOT NULL,
        chunk_index INTEGER,
        content TEXT NOT NULL,
        embedding TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doc_id) REFERENCES knowledge_docs(id)
      )`,
      [],
      { fallback: true } as any
    );
  } catch (e: any) {
    logger.warn('[KnowledgeService] ensureKnowledgeSchema failed:', e?.message || e);
  }
}

type CandidateRow = Record<string, unknown>;
type StrategyRow = Record<string, unknown>;
type DocumentRow = Record<string, unknown>;

const normalizeCandidate = (row: CandidateRow) => ({
  ...row,
  tags: parseJson<string[]>(row.tags, []),
  related_project_ids: parseJson<string[]>(row.related_project_ids, []),
});

const normalizeStrategy = (row: StrategyRow) => ({
  ...row,
  success_metrics: parseJson<string[]>(row.success_metrics, []),
  related_document_ids: parseJson<string[]>(row.related_document_ids, []),
  related_idea_ids: parseJson<string[]>(row.related_idea_ids, []),
  is_active: Boolean((row as any).is_active === true || Number((row as any).is_active) === 1),
});

const normalizeDocument = (row: DocumentRow) => ({
  ...row,
  tags: parseJson<string[]>(row.tags, []),
  doc_key: buildDocKey(row),
  storage_backend: 'local_embedded',
  external_provider: null,
});

const KnowledgeService = {
  // -------------------------
  // Candidates (Idea inbox)
  // -------------------------
  async getCandidates(status: string = 'pending'): Promise<any[]> {
    await ensureKnowledgeSchema();
    const st = String(status || 'pending')
      .trim()
      .toLowerCase();
    const params: unknown[] = [];
    let sql = `SELECT * FROM knowledge_candidates`;
    if (st && st !== 'all') {
      sql += ` WHERE status = ?`;
      params.push(st);
    }
    sql += ` ORDER BY created_at DESC LIMIT 500`;
    const rows = await DbPromise.all<CandidateRow>(sql, params, { fallback: true } as any);
    return (rows || []).map(normalizeCandidate);
  },

  async addCandidate(
    content: string,
    reasoning: string,
    source: string,
    relatedAxis?: string,
    originContext?: string
  ): Promise<string> {
    await ensureKnowledgeSchema();
    const id = randomUUID();
    await DbPromise.run(
      `INSERT INTO knowledge_candidates
        (id, content, reasoning, source, status, origin_context, related_axis, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        String(content || '').trim(),
        reasoning || null,
        source || 'user_feedback',
        originContext || null,
        relatedAxis || null,
      ],
      { fallback: true } as any
    );
    return id;
  },

  async updateCandidateStatus(id: string, status: string, adminComment?: string): Promise<void> {
    await ensureKnowledgeSchema();
    await DbPromise.run(
      `UPDATE knowledge_candidates SET status = ?, admin_comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [
        String(status || '')
          .trim()
          .toLowerCase(),
        adminComment || null,
        id,
      ],
      { fallback: true } as any
    );
  },

  async updateCandidate(
    id: string,
    updates: Record<string, unknown>
  ): Promise<{ changes: number }> {
    await ensureKnowledgeSchema();
    const allowed: Array<[string, string, unknown]> = [];

    if ('category' in updates)
      allowed.push(['category', 'category = ?', (updates as any).category ?? null]);
    if ('tags' in updates)
      allowed.push(['tags', 'tags = ?', toJsonArrayString((updates as any).tags)]);
    if ('implementation_notes' in updates)
      allowed.push([
        'implementation_notes',
        'implementation_notes = ?',
        (updates as any).implementation_notes ?? null,
      ]);
    if ('impact_score' in updates)
      allowed.push(['impact_score', 'impact_score = ?', (updates as any).impact_score ?? null]);
    if ('status' in updates)
      allowed.push([
        'status',
        'status = ?',
        String((updates as any).status || '')
          .trim()
          .toLowerCase(),
      ]);

    if (allowed.length === 0) return { changes: 0 };

    const setClauses = allowed.map(([, clause]) => clause);
    const params = allowed.map(([, , v]) => v);
    params.push(id);

    const result = await DbPromise.run(
      `UPDATE knowledge_candidates SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params,
      { fallback: true } as any
    );

    return { changes: (result as any)?.changes ?? 0 };
  },

  async linkIdeaToProject(
    ideaId: string,
    projectId: string,
    notes: string
  ): Promise<{ changes: number }> {
    await ensureKnowledgeSchema();
    const row = await DbPromise.get<CandidateRow>(
      `SELECT related_project_ids, implementation_notes FROM knowledge_candidates WHERE id = ?`,
      [ideaId],
      { fallback: true } as any
    );
    const current = parseJson<string[]>(row?.related_project_ids, []);
    const next = Array.from(
      new Set([...(Array.isArray(current) ? current : []), String(projectId)])
    );
    const impl = String(notes || '').trim();
    const result = await DbPromise.run(
      `UPDATE knowledge_candidates
       SET related_project_ids = ?, implementation_notes = COALESCE(NULLIF(?, ''), implementation_notes), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(next), impl, ideaId],
      { fallback: true } as any
    );
    return { changes: (result as any)?.changes ?? 0 };
  },

  async getApprovedIdeas(filters: { category?: string } = {}): Promise<any[]> {
    await ensureKnowledgeSchema();
    const params: unknown[] = ['approved'];
    let sql = `SELECT * FROM knowledge_candidates WHERE status = ?`;
    if (filters?.category) {
      sql += ` AND category = ?`;
      params.push(String(filters.category));
    }
    sql += ` ORDER BY created_at DESC LIMIT 500`;
    const rows = await DbPromise.all<CandidateRow>(sql, params, { fallback: true } as any);
    return (rows || []).map(normalizeCandidate);
  },

  async getIdeasByCategory(category: string): Promise<any[]> {
    await ensureKnowledgeSchema();
    const rows = await DbPromise.all<CandidateRow>(
      `SELECT * FROM knowledge_candidates WHERE category = ? ORDER BY created_at DESC LIMIT 500`,
      [String(category)],
      { fallback: true } as any
    );
    return (rows || []).map(normalizeCandidate);
  },

  async getIdeasByProject(projectId: string): Promise<any[]> {
    await ensureKnowledgeSchema();
    const pid = String(projectId);
    const rows = await DbPromise.all<CandidateRow>(
      `SELECT * FROM knowledge_candidates
       WHERE related_project_ids LIKE ?
       ORDER BY created_at DESC LIMIT 500`,
      [`%${pid}%`],
      { fallback: true } as any
    );
    return (rows || []).map(normalizeCandidate);
  },

  // -------------------------
  // Global strategies
  // -------------------------
  async getAllStrategies(): Promise<any[]> {
    await ensureKnowledgeSchema();
    const rows = await DbPromise.all<StrategyRow>(
      `SELECT * FROM global_strategies ORDER BY created_at DESC LIMIT 500`,
      [],
      { fallback: true } as any
    );
    return (rows || []).map(normalizeStrategy);
  },

  async getActiveStrategies(): Promise<any[]> {
    await ensureKnowledgeSchema();
    const rows = await DbPromise.all<StrategyRow>(
      `SELECT * FROM global_strategies WHERE is_active = 1 ORDER BY created_at DESC LIMIT 500`,
      [],
      { fallback: true } as any
    );
    return (rows || []).map(normalizeStrategy);
  },

  async addStrategy(
    title: string,
    description: string,
    createdBy: string,
    options: {
      success_metrics?: string[];
      priority?: string;
      target_date?: string | null;
      progress_percentage?: number;
    }
  ): Promise<string> {
    await ensureKnowledgeSchema();
    const id = randomUUID();
    await DbPromise.run(
      `INSERT INTO global_strategies
        (id, title, description, created_by, success_metrics, priority, target_date, progress_percentage, is_active, related_document_ids, related_idea_ids, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '[]', '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        String(title || '').trim(),
        description || '',
        createdBy || 'admin',
        JSON.stringify(options?.success_metrics || []),
        options?.priority || 'medium',
        options?.target_date || null,
        Number.isFinite(Number(options?.progress_percentage))
          ? Number(options?.progress_percentage)
          : 0,
      ],
      { fallback: true } as any
    );
    return id;
  },

  async updateStrategy(id: string, updates: Record<string, unknown>): Promise<{ changes: number }> {
    await ensureKnowledgeSchema();
    const allowed: Array<[string, string, unknown]> = [];

    if ('title' in updates) allowed.push(['title', 'title = ?', (updates as any).title ?? null]);
    if ('description' in updates)
      allowed.push(['description', 'description = ?', (updates as any).description ?? null]);
    if ('success_metrics' in updates)
      allowed.push([
        'success_metrics',
        'success_metrics = ?',
        toJsonArrayString((updates as any).success_metrics),
      ]);
    if ('priority' in updates)
      allowed.push(['priority', 'priority = ?', String((updates as any).priority || 'medium')]);
    if ('target_date' in updates)
      allowed.push(['target_date', 'target_date = ?', (updates as any).target_date ?? null]);
    if ('progress_percentage' in updates)
      allowed.push([
        'progress_percentage',
        'progress_percentage = ?',
        Number.isFinite(Number((updates as any).progress_percentage))
          ? Number((updates as any).progress_percentage)
          : 0,
      ]);
    if ('is_active' in updates)
      allowed.push([
        'is_active',
        'is_active = ?',
        (updates as any).is_active === true || Number((updates as any).is_active) === 1 ? 1 : 0,
      ]);
    if ('related_document_ids' in updates)
      allowed.push([
        'related_document_ids',
        'related_document_ids = ?',
        toJsonArrayString((updates as any).related_document_ids),
      ]);
    if ('related_idea_ids' in updates)
      allowed.push([
        'related_idea_ids',
        'related_idea_ids = ?',
        toJsonArrayString((updates as any).related_idea_ids),
      ]);

    if (allowed.length === 0) return { changes: 0 };

    const setClauses = allowed.map(([, clause]) => clause);
    const params = allowed.map(([, , v]) => v);
    params.push(id);

    const result = await DbPromise.run(
      `UPDATE global_strategies SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params,
      { fallback: true } as any
    );
    return { changes: (result as any)?.changes ?? 0 };
  },

  async updateStrategyProgress(
    id: string,
    progressPercentage: number
  ): Promise<{ changes: number }> {
    return KnowledgeService.updateStrategy(id, { progress_percentage: progressPercentage });
  },

  async toggleStrategy(id: string, isActive: boolean): Promise<void> {
    await KnowledgeService.updateStrategy(id, { is_active: isActive ? 1 : 0 });
  },

  async getStrategyWithRelated(id: string): Promise<any | null> {
    await ensureKnowledgeSchema();
    const row = await DbPromise.get<StrategyRow>(
      `SELECT * FROM global_strategies WHERE id = ?`,
      [id],
      { fallback: true } as any
    );
    return row ? normalizeStrategy(row) : null;
  },

  async linkStrategyToDocument(
    strategyId: string,
    documentId: string
  ): Promise<{ changes: number }> {
    await ensureKnowledgeSchema();
    const row = await DbPromise.get<StrategyRow>(
      `SELECT related_document_ids FROM global_strategies WHERE id = ?`,
      [strategyId],
      { fallback: true } as any
    );
    const current = parseJson<string[]>(row?.related_document_ids, []);
    const next = Array.from(
      new Set([...(Array.isArray(current) ? current : []), String(documentId)])
    );
    return KnowledgeService.updateStrategy(strategyId, { related_document_ids: next });
  },

  async linkStrategyToIdea(strategyId: string, ideaId: string): Promise<{ changes: number }> {
    await ensureKnowledgeSchema();
    const row = await DbPromise.get<StrategyRow>(
      `SELECT related_idea_ids FROM global_strategies WHERE id = ?`,
      [strategyId],
      { fallback: true } as any
    );
    const current = parseJson<string[]>(row?.related_idea_ids, []);
    const next = Array.from(new Set([...(Array.isArray(current) ? current : []), String(ideaId)]));
    return KnowledgeService.updateStrategy(strategyId, { related_idea_ids: next });
  },

  async unlinkStrategyFromDocument(
    strategyId: string,
    docId: string
  ): Promise<{ changes: number }> {
    await ensureKnowledgeSchema();
    const row = await DbPromise.get<StrategyRow>(
      `SELECT related_document_ids FROM global_strategies WHERE id = ?`,
      [strategyId],
      { fallback: true } as any
    );
    const current = parseJson<string[]>(row?.related_document_ids, []);
    const next = (Array.isArray(current) ? current : []).filter((x) => String(x) !== String(docId));
    return KnowledgeService.updateStrategy(strategyId, { related_document_ids: next });
  },

  async unlinkStrategyFromIdea(strategyId: string, ideaId: string): Promise<{ changes: number }> {
    await ensureKnowledgeSchema();
    const row = await DbPromise.get<StrategyRow>(
      `SELECT related_idea_ids FROM global_strategies WHERE id = ?`,
      [strategyId],
      { fallback: true } as any
    );
    const current = parseJson<string[]>(row?.related_idea_ids, []);
    const next = (Array.isArray(current) ? current : []).filter(
      (x) => String(x) !== String(ideaId)
    );
    return KnowledgeService.updateStrategy(strategyId, { related_idea_ids: next });
  },

  // -------------------------
  // Documents (RAG)
  // -------------------------
  async addDocument(
    originalFilename: string,
    filepath: string,
    organizationId: string,
    projectId: string | null,
    fileSizeBytes: number,
    category: string | null,
    tags: string[] = [],
    id?: string,
    ownerId?: string | null,
    scope?: VaultDocumentScope | null
  ): Promise<string> {
    await ensureKnowledgeSchema();
    const docId = id || randomUUID();
    const filename = safeFilename(originalFilename);
    // ★ VLT-001: scope ∈ {user,project,organization}; 'project' wymaga project_id (egzekwowane
    // w warstwie routes — knowledge.routes.ts). Brak scope (stary caller) = 'organization'
    // (zachowanie sprzed VLT-001: dokument widoczny dla całej organizacji).
    const resolvedScope: VaultDocumentScope =
      scope === 'user' || scope === 'project' || scope === 'organization' ? scope : 'organization';
    await DbPromise.run(
      `INSERT INTO knowledge_docs
        (id, filename, filepath, organization_id, project_id, owner_id, scope, file_size_bytes, status, category, tags, chunk_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'indexing', ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        docId,
        filename,
        filepath,
        organizationId,
        resolvedScope === 'project' ? projectId : null,
        ownerId || null,
        resolvedScope,
        Number.isFinite(Number(fileSizeBytes)) ? Number(fileSizeBytes) : null,
        category,
        JSON.stringify(tags || []),
      ],
      { fallback: true } as any
    );
    return docId;
  },

  async processDocument(docId: string, text: string): Promise<number> {
    await ensureKnowledgeSchema();
    const chunks = chunkText(text, { chunkSize: 1000, overlap: 200 });

    try {
      await DbPromise.run(`DELETE FROM knowledge_chunks WHERE doc_id = ?`, [docId], {
        fallback: true,
      } as any);
    } catch {
      // ignore
    }

    let stored = 0;
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      let embedding: number[] | null = null;

      try {
        embedding = await embeddingService.generateEmbedding(content);
      } catch {
        embedding = null;
      }

      const chunkId = randomUUID();
      const metadata: Record<string, JsonValue> = { chunk_index: i, source: 'knowledge_upload' };

      await DbPromise.run(
        `INSERT INTO knowledge_chunks (id, doc_id, chunk_index, content, embedding, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          chunkId,
          docId,
          i,
          content,
          embedding ? JSON.stringify(embedding) : null,
          JSON.stringify(metadata),
        ],
        { fallback: true } as any
      );

      if (embedding && embedding.length > 0) {
        try {
          await embeddingService.storeChunk(
            { content, chunkIndex: i, documentId: docId, metadata, sourceType: 'knowledge' },
            embedding
          );
        } catch {
          // ignore
        }
      }

      stored++;
    }

    await DbPromise.run(
      `UPDATE knowledge_docs SET status = 'indexed', chunk_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [stored, docId],
      { fallback: true } as any
    );

    return stored;
  },

  /**
   * ★ VLT-001 — odczyt Vault filtrowany wg 3 poziomów przypisania.
   * Wzór logiki: ContextDocumentService.listAccessibleDocuments (:3789), rozszerzony o
   * poziom 'organization' (którego tamta usługa w ogóle nie modeluje — jej `scope` to
   * tylko 'project'|'user', patrz ContextDocumentService.ts:12). Dlatego logika NIE jest
   * fizycznie reużyta stąd (patrz DZIENNIK VLT-001), tylko odtworzona z tym samym kształtem
   * WHERE. Dokumenty sprzed VLT-001 mają `scope IS NULL` — traktowane jak 'organization'
   * (to było ich faktyczne dotychczasowe zachowanie: widoczne dla całej organizacji).
   */
  async getDocuments(
    orgId: string,
    userId?: string,
    _role?: string,
    access?: {
      scope?: VaultDocumentScope | null;
      projectId?: string | null;
      memberProjectIds?: string[];
    }
  ): Promise<any[]> {
    await ensureKnowledgeSchema();
    const where: string[] = [
      `(organization_id = ? OR organization_id IS NULL)`,
      `deleted_at IS NULL`,
    ];
    const params: unknown[] = [orgId];

    const requestedScope = access?.scope || null;
    const projectId = access?.projectId || null;
    const memberIds = (access?.memberProjectIds || []).filter(Boolean);

    if (requestedScope === 'user') {
      where.push(`scope = 'user'`);
      where.push(`owner_id = ?`);
      params.push(userId || null);
    } else if (requestedScope === 'project') {
      where.push(`scope = 'project'`);
      if (projectId) {
        where.push(`project_id = ?`);
        params.push(projectId);
      } else if (memberIds.length > 0) {
        where.push(`project_id IN (${memberIds.map(() => '?').join(',')})`);
        params.push(...memberIds);
      } else {
        where.push(`1 = 0`);
      }
    } else if (requestedScope === 'organization') {
      where.push(`(scope = 'organization' OR scope IS NULL)`);
    } else if (userId) {
      // Widok domyślny (bez filtra poziomu): własne prywatne + organizacyjne/legacy +
      // projektowe TYLKO dla projektów, w których user jest członkiem.
      const projectClause =
        memberIds.length > 0
          ? `(scope = 'project' AND project_id IN (${memberIds.map(() => '?').join(',')}))`
          : `1 = 0`;
      where.push(
        `((scope = 'user' AND owner_id = ?) OR (scope = 'organization' OR scope IS NULL) OR ${projectClause})`
      );
      params.push(userId);
      if (memberIds.length > 0) params.push(...memberIds);
    } else {
      // Brak userId (np. aiContextBuilder — wywołanie wewnętrzne bez kontekstu usera):
      // pokaż wszystko OPRÓCZ prywatnych dokumentów (nie ujawniaj cudzych 'user'-scope).
      where.push(`(scope != 'user' OR scope IS NULL)`);
    }

    const rows = await DbPromise.all<DocumentRow>(
      `SELECT * FROM knowledge_docs WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
      params,
      { fallback: true } as any
    );
    return (rows || []).map(normalizeDocument);
  },

  async getDocumentsByCategory(orgId: string, category: string): Promise<any[]> {
    await ensureKnowledgeSchema();
    const rows = await DbPromise.all<DocumentRow>(
      `SELECT * FROM knowledge_docs
       WHERE (organization_id = ? OR organization_id IS NULL) AND category = ? AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 200`,
      [orgId, String(category)],
      { fallback: true } as any
    );
    return (rows || []).map(normalizeDocument);
  },

  async getDocumentsByStrategy(strategyId: string): Promise<any[]> {
    await ensureKnowledgeSchema();
    const strategy = await KnowledgeService.getStrategyWithRelated(strategyId);
    const ids = Array.isArray(strategy?.related_document_ids) ? strategy.related_document_ids : [];
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await DbPromise.all<DocumentRow>(
      `SELECT * FROM knowledge_docs WHERE id IN (${placeholders}) ORDER BY created_at DESC LIMIT 200`,
      ids,
      { fallback: true } as any
    );
    return (rows || []).map(normalizeDocument);
  },

  async deleteDocument(orgId: string, docId: string): Promise<{ deleted: boolean }> {
    await ensureKnowledgeSchema();
    const result = await DbPromise.run(
      `UPDATE knowledge_docs
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)`,
      [docId, orgId],
      { fallback: true } as any
    );
    return { deleted: Boolean((result as any)?.changes) };
  },

  async updateDocumentMetadata(
    orgId: string,
    docId: string,
    updates: { category?: string | null; tags?: string[] | null }
  ): Promise<{ updated: boolean }> {
    await ensureKnowledgeSchema();
    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.category !== undefined) {
      sets.push('category = ?');
      params.push(updates.category ?? null);
    }
    if (updates.tags !== undefined) {
      sets.push('tags = ?');
      params.push(JSON.stringify(updates.tags ?? []));
    }
    if (!sets.length) return { updated: false };

    params.push(docId, orgId);
    const result = await DbPromise.run(
      `UPDATE knowledge_docs
       SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)`,
      params,
      { fallback: true } as any
    );

    return { updated: Boolean((result as any)?.changes) };
  },
};

export const knowledgeService = KnowledgeService;
export default KnowledgeService;
