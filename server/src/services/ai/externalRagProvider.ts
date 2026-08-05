import { randomUUID } from 'node:crypto';

import { run as dbRun } from '../../utils/DbPromise.js';
import { knowledgeIndexer } from './knowledgeIndexer.js';

export interface ExternalRagDocument {
  docKey: string;
  title: string;
  organizationId?: string | null;
  projectId?: string | null;
  chunks: Array<{
    chunkIndex: number;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface ExternalRagProvider {
  providerId: string;
  supportsSync: boolean;
  upsertDocument(document: ExternalRagDocument): Promise<{ externalDocumentId?: string | null }>;
  deleteDocument(docKey: string): Promise<void>;
  search(
    query: string,
    options?: { organizationId?: string | null; projectId?: string | null; limit?: number }
  ): Promise<
    Array<{ docKey: string; chunkText: string; score: number; metadata?: Record<string, unknown> }>
  >;
}

const EXTERNAL_RAG_SOURCE_TYPE = 'external_rag_case';

function toDocPath(docKey: string): string {
  return `external-rag/${encodeURIComponent(String(docKey || '').trim())}`;
}

class KnowledgeIndexerRagProvider implements ExternalRagProvider {
  providerId = 'knowledge_indexer';
  supportsSync = true;
  private readyPromise: Promise<void> | null = null;

  private async ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        await knowledgeIndexer.initialize();
      })();
    }
    await this.readyPromise;
  }

  async upsertDocument(
    document: ExternalRagDocument
  ): Promise<{ externalDocumentId?: string | null }> {
    await this.ensureReady();

    const filepath = toDocPath(document.docKey);
    const existing = await knowledgeIndexer.getDocByPath(filepath);
    const docId = existing?.id || randomUUID();

    if (existing?.id) {
      await dbRun('DELETE FROM knowledge_chunks WHERE doc_id = ?', [existing.id], {
        fallback: false,
      } as any);
      await dbRun('DELETE FROM knowledge_docs WHERE id = ?', [existing.id], {
        fallback: false,
      } as any);
    }

    await knowledgeIndexer.insertDocument({
      id: docId,
      filename: document.title || document.docKey,
      filepath,
      sourceType: EXTERNAL_RAG_SOURCE_TYPE,
      // ★ M01-055: organizationId must land in the real `knowledge_docs.organization_id`
      // column (not only in JSON metadata below) so org-scoped queries/filters actually work.
      organizationId: document.organizationId ?? null,
      chunkCount: document.chunks.length,
      metadata: {
        docKey: document.docKey,
        title: document.title,
        organizationId: document.organizationId ?? null,
        projectId: document.projectId ?? null,
      },
    } as any);

    for (const chunk of document.chunks) {
      await knowledgeIndexer.insertChunk({
        id: randomUUID(),
        docId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: await knowledgeIndexer.generateEmbedding(chunk.content),
        metadata: {
          docKey: document.docKey,
          title: document.title,
          organizationId: document.organizationId ?? null,
          projectId: document.projectId ?? null,
          ...(chunk.metadata || {}),
        },
      } as any);
    }

    return { externalDocumentId: docId };
  }

  async deleteDocument(docKey: string): Promise<void> {
    await this.ensureReady();
    const existing = await knowledgeIndexer.getDocByPath(toDocPath(docKey));
    if (!existing?.id) return;
    await dbRun('DELETE FROM knowledge_chunks WHERE doc_id = ?', [existing.id], {
      fallback: false,
    } as any);
    await dbRun('DELETE FROM knowledge_docs WHERE id = ?', [existing.id], {
      fallback: false,
    } as any);
  }

  async search(
    query: string,
    options?: { organizationId?: string | null; projectId?: string | null; limit?: number }
  ): Promise<
    Array<{ docKey: string; chunkText: string; score: number; metadata?: Record<string, unknown> }>
  > {
    await this.ensureReady();
    const matches = await knowledgeIndexer.search(query, {
      limit: options?.limit ?? 5,
      sourceTypes: [EXTERNAL_RAG_SOURCE_TYPE],
    });

    return matches
      .filter((match) => {
        const metadata = (match.metadata || {}) as Record<string, unknown>;
        if (options?.organizationId && metadata.organizationId !== options.organizationId)
          return false;
        if (options?.projectId && metadata.projectId !== options.projectId) return false;
        return true;
      })
      .map((match) => {
        const metadata = (match.metadata || {}) as Record<string, unknown>;
        return {
          docKey: String(metadata.docKey || ''),
          chunkText: match.content,
          score: match.similarity,
          metadata,
        };
      });
  }
}

export const externalRagProvider: ExternalRagProvider = new KnowledgeIndexerRagProvider();
