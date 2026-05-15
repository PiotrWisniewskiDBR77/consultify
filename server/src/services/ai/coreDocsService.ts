import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'product', 'DOCUMENTATION_REGISTRY.md');
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

export interface CoreDoc {
  id: string;
  title: string;
  filePath: string;
  fileHash: string;
  version: number;
  scope: string;
  processingStatus: string;
  chunkCount: number;
  lastIndexedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriftReport {
  totalDocs: number;
  upToDate: number;
  stale: number;
  missing: number;
  details: Array<{
    filePath: string;
    title: string;
    status: 'up_to_date' | 'stale' | 'missing_file' | 'not_indexed';
    indexedHash: string | null;
    currentHash: string | null;
  }>;
}

export interface CoreDocSnippet {
  docId: string;
  docTitle: string;
  docSlug: string;
  chunkIndex: number;
  content: string;
  sectionTitle: string | null;
}

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function chunkMarkdown(text: string): Array<{ content: string; sectionTitle: string | null }> {
  const lines = text.split('\n');
  const chunks: Array<{ content: string; sectionTitle: string | null }> = [];
  let currentSection: string | null = null;
  let buffer = '';

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (buffer.trim().length > 0) {
        chunks.push(...splitBuffer(buffer, currentSection));
      }
      currentSection = headingMatch[1].trim();
      buffer = line + '\n';
      continue;
    }
    buffer += line + '\n';
    if (buffer.length >= CHUNK_SIZE) {
      chunks.push(...splitBuffer(buffer, currentSection));
      buffer = '';
    }
  }
  if (buffer.trim().length > 0) {
    chunks.push(...splitBuffer(buffer, currentSection));
  }
  return chunks;
}

function splitBuffer(
  text: string,
  sectionTitle: string | null
): Array<{ content: string; sectionTitle: string | null }> {
  const result: Array<{ content: string; sectionTitle: string | null }> = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      result.push({ content: chunk, sectionTitle });
    }
    start = end - CHUNK_OVERLAP;
    if (start >= text.length) break;
    if (end === text.length) break;
  }
  return result;
}

async function parseRegistry(): Promise<string[]> {
  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf-8');
    const matches = content.match(/`(docs\/[^`]+\.md)`/g) || [];
    return matches.map((m) => m.replace(/`/g, ''));
  } catch (err: any) {
    logger.warn('[CoreDocsService] Registry not found:', err?.message);
    return [];
  }
}

function titleFromPath(filePath: string): string {
  const basename = path.basename(filePath, '.md');
  return basename.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

class CoreDocsService {
  async ingestAll(): Promise<{ ingested: number; skipped: number; errors: number }> {
    const docPaths = await parseRegistry();
    let ingested = 0;
    let skipped = 0;
    let errors = 0;

    for (const relPath of docPaths) {
      try {
        const result = await this.ingestSingle(relPath);
        if (result === 'ingested') ingested++;
        else skipped++;
      } catch (err: any) {
        logger.error(`[CoreDocsService] Failed to ingest ${relPath}:`, err?.message);
        errors++;
      }
    }

    logger.info(
      `[CoreDocsService] Ingest complete: ${ingested} ingested, ${skipped} skipped, ${errors} errors`
    );
    return { ingested, skipped, errors };
  }

  async ingestSingle(relPath: string): Promise<'ingested' | 'skipped'> {
    const absPath = path.join(REPO_ROOT, relPath);
    const content = await fs.readFile(absPath, 'utf-8');
    const fileHash = computeHash(content);
    const title = titleFromPath(relPath);

    const existing = (await dbGet(
      `SELECT id, file_hash, version FROM knowledge_documents WHERE file_path = ? AND scope = 'system'`,
      [relPath]
    )) as any;

    if (existing && existing.file_hash === fileHash) {
      return 'skipped';
    }

    const now = new Date().toISOString();
    const chunks = chunkMarkdown(content);

    if (existing) {
      const newVersion = (existing.version || 1) + 1;
      await dbRun(
        `UPDATE knowledge_documents SET file_hash = ?, version = ?, processing_status = 'completed', chunk_count = ?, last_indexed_at = ?, updated_at = ?, title = ? WHERE id = ?`,
        [fileHash, newVersion, chunks.length, now, now, title, existing.id]
      );
      await dbRun(`DELETE FROM knowledge_chunks WHERE document_id = ?`, [existing.id]);
      await this._insertChunks(existing.id, chunks);
    } else {
      const id = crypto.randomUUID();
      await dbRun(
        `INSERT INTO knowledge_documents (id, title, file_path, file_hash, version, scope, organization_id, processing_status, chunk_count, last_indexed_at, created_at, updated_at, document_type)
         VALUES (?, ?, ?, ?, 1, 'system', NULL, 'completed', ?, ?, ?, ?, 'markdown')`,
        [id, title, relPath, fileHash, chunks.length, now, now, now]
      );
      await this._insertChunks(id, chunks);
    }

    return 'ingested';
  }

  private async _insertChunks(
    docId: string,
    chunks: Array<{ content: string; sectionTitle: string | null }>
  ): Promise<void> {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await dbRun(
        `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, section_title, scope, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 'system', 1, ?)`,
        [crypto.randomUUID(), docId, i, chunk.content, chunk.sectionTitle, new Date().toISOString()]
      );
    }
  }

  async detectDrift(): Promise<DriftReport> {
    const docPaths = await parseRegistry();
    const details: DriftReport['details'] = [];
    let upToDate = 0;
    let stale = 0;
    let missing = 0;

    for (const relPath of docPaths) {
      const title = titleFromPath(relPath);
      const absPath = path.join(REPO_ROOT, relPath);
      const existing = (await dbGet(
        `SELECT file_hash FROM knowledge_documents WHERE file_path = ? AND scope = 'system'`,
        [relPath]
      )) as any;

      let currentHash: string | null = null;
      let fileExists = true;
      try {
        const content = await fs.readFile(absPath, 'utf-8');
        currentHash = computeHash(content);
      } catch {
        fileExists = false;
      }

      if (!existing) {
        details.push({
          filePath: relPath,
          title,
          status: fileExists ? 'not_indexed' : 'missing_file',
          indexedHash: null,
          currentHash,
        });
        if (!fileExists) missing++;
      } else if (!fileExists) {
        details.push({
          filePath: relPath,
          title,
          status: 'missing_file',
          indexedHash: existing.file_hash,
          currentHash: null,
        });
        missing++;
      } else if (existing.file_hash !== currentHash) {
        details.push({
          filePath: relPath,
          title,
          status: 'stale',
          indexedHash: existing.file_hash,
          currentHash,
        });
        stale++;
      } else {
        details.push({
          filePath: relPath,
          title,
          status: 'up_to_date',
          indexedHash: existing.file_hash,
          currentHash,
        });
        upToDate++;
      }
    }

    return { totalDocs: docPaths.length, upToDate, stale, missing, details };
  }

  async listCoreDocs(): Promise<CoreDoc[]> {
    const rows = (await dbAll(
      `SELECT id, title, file_path, file_hash, version, scope, processing_status, chunk_count, last_indexed_at, created_at, updated_at
       FROM knowledge_documents WHERE scope = 'system' ORDER BY title ASC`,
      []
    )) as any[];

    return (rows || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      filePath: r.file_path,
      fileHash: r.file_hash,
      version: r.version,
      scope: r.scope,
      processingStatus: r.processing_status,
      chunkCount: r.chunk_count,
      lastIndexedAt: r.last_indexed_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getDocSnippets(docId: string): Promise<CoreDocSnippet[]> {
    const doc = (await dbGet(
      `SELECT id, title, file_path FROM knowledge_documents WHERE id = ? AND scope = 'system'`,
      [docId]
    )) as any;
    if (!doc) return [];

    const chunks = (await dbAll(
      `SELECT chunk_index, content, section_title FROM knowledge_chunks WHERE document_id = ? AND is_active = 1 ORDER BY chunk_index ASC`,
      [docId]
    )) as any[];

    return (chunks || []).map((c: any) => ({
      docId: doc.id,
      docTitle: doc.title,
      docSlug: slugify(doc.title),
      chunkIndex: c.chunk_index,
      content: c.content,
      sectionTitle: c.section_title,
    }));
  }

  async getSystemSnippets(
    query?: string,
    maxSnippets = 5,
    maxChars = 3000
  ): Promise<CoreDocSnippet[]> {
    let rows: any[] = [];

    if (query) {
      const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 2);
      if (tokens.length > 0) {
        const whereClauses = tokens.map(() => `LOWER(kc.content) LIKE ?`);
        const params = tokens.map((t) => `%${t}%`);
        rows = (await dbAll(
          `SELECT kc.chunk_index, kc.content, kc.section_title, kc.document_id,
                  kd.title AS doc_title, kd.file_path
           FROM knowledge_chunks kc
           JOIN knowledge_documents kd ON kc.document_id = kd.id
           WHERE kd.scope = 'system' AND kc.is_active = 1 AND (${whereClauses.join(' OR ')})
           ORDER BY kc.chunk_index ASC
           LIMIT ?`,
          [...params, maxSnippets * 2]
        )) as any[];
      }
    }

    if (!rows || rows.length === 0) {
      rows = (await dbAll(
        `SELECT kc.chunk_index, kc.content, kc.section_title, kc.document_id,
                kd.title AS doc_title, kd.file_path
         FROM knowledge_chunks kc
         JOIN knowledge_documents kd ON kc.document_id = kd.id
         WHERE kd.scope = 'system' AND kc.is_active = 1
         ORDER BY kd.title ASC, kc.chunk_index ASC
         LIMIT ?`,
        [maxSnippets]
      )) as any[];
    }

    const result: CoreDocSnippet[] = [];
    let totalChars = 0;

    for (const r of rows) {
      if (result.length >= maxSnippets) break;
      if (totalChars + r.content.length > maxChars) break;
      result.push({
        docId: r.document_id,
        docTitle: r.doc_title,
        docSlug: slugify(r.doc_title),
        chunkIndex: r.chunk_index,
        content: r.content,
        sectionTitle: r.section_title,
      });
      totalChars += r.content.length;
    }

    return result;
  }
}

export const coreDocsService = new CoreDocsService();
export default coreDocsService;
