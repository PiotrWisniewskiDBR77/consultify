/**
 * Retrieval Feedback Loop Service
 *
 * Captures explicit and implicit signals about retrieval quality,
 * enables reranking tuning based on feedback, and tracks document
 * freshness with TTL warnings.
 */
import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface RetrievalFeedback {
  chunkId: string;
  documentId?: string;
  signal: 'cited' | 'unused' | 'unhelpful' | 'helpful' | 'outdated';
  feedbackType: 'explicit' | 'implicit';
}

export interface DocumentFreshness {
  documentId: string;
  documentName: string;
  lastUpdated: string;
  ageDays: number;
  freshnessStatus: 'fresh' | 'aging' | 'stale' | 'expired';
  warning?: string;
}

const FRESHNESS_THRESHOLDS = {
  aging: 90,
  stale: 180,
  expired: 365,
};

class RetrievalFeedbackService {
  async recordExplicitFeedback(input: {
    organizationId: string;
    conversationId: string;
    userId: string;
    feedback: RetrievalFeedback[];
  }): Promise<void> {
    for (const fb of input.feedback) {
      await dbRun(
        `INSERT INTO rag_retrieval_feedback
          (id, organization_id, conversation_id, user_id, chunk_id, document_id,
           feedback_type, signal, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'explicit', ?, datetime('now'))`,
        [
          randomUUID(),
          input.organizationId,
          input.conversationId,
          input.userId,
          fb.chunkId,
          fb.documentId || null,
          fb.signal,
        ]
      ).catch((err) => logger.debug(`[RetrievalFeedback] Record skipped: ${err?.message}`));
    }
  }

  async recordImplicitFeedback(input: {
    organizationId: string;
    conversationId: string;
    userId?: string;
    retrievedChunkIds: string[];
    citedChunkIds: string[];
  }): Promise<void> {
    const cited = new Set(input.citedChunkIds);

    for (const chunkId of input.retrievedChunkIds) {
      const signal = cited.has(chunkId) ? 'cited' : 'unused';
      await dbRun(
        `INSERT INTO rag_retrieval_feedback
          (id, organization_id, conversation_id, user_id, chunk_id,
           feedback_type, signal, created_at)
         VALUES (?, ?, ?, ?, ?, 'implicit', ?, datetime('now'))`,
        [
          randomUUID(),
          input.organizationId,
          input.conversationId,
          input.userId || null,
          chunkId,
          signal,
        ]
      ).catch((err) =>
        logger.debug(`[RetrievalFeedback] Implicit record skipped: ${err?.message}`)
      );
    }
  }

  async getChunkQualityScores(
    organizationId: string,
    chunkIds: string[]
  ): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    if (!chunkIds.length) return scores;

    const placeholders = chunkIds.map(() => '?').join(',');
    const rows = (await dbAll(
      `SELECT chunk_id,
              SUM(CASE WHEN signal = 'cited' THEN 1.0
                       WHEN signal = 'helpful' THEN 1.5
                       WHEN signal = 'unused' THEN -0.3
                       WHEN signal = 'unhelpful' THEN -1.0
                       WHEN signal = 'outdated' THEN -0.5
                       ELSE 0 END) as quality_score,
              COUNT(*) as feedback_count
       FROM rag_retrieval_feedback
       WHERE organization_id = ? AND chunk_id IN (${placeholders})
       GROUP BY chunk_id`,
      [organizationId, ...chunkIds]
    ).catch(() => [])) as any[];

    for (const row of rows || []) {
      const normalizedScore = Math.max(
        0,
        Math.min(
          1,
          0.5 + (Number(row.quality_score) / Math.max(Number(row.feedback_count), 1)) * 0.3
        )
      );
      scores.set(row.chunk_id, Math.round(normalizedScore * 10000) / 10000);
    }

    for (const id of chunkIds) {
      if (!scores.has(id)) scores.set(id, 0.5);
    }

    return scores;
  }

  async rerankWithFeedback(
    organizationId: string,
    chunks: Array<{ id: string; score: number; content: string }>
  ): Promise<Array<{ id: string; score: number; content: string; feedbackBoost: number }>> {
    const chunkIds = chunks.map((c) => c.id);
    const qualityScores = await this.getChunkQualityScores(organizationId, chunkIds);

    return chunks
      .map((chunk) => {
        const feedbackScore = qualityScores.get(chunk.id) || 0.5;
        const boost = (feedbackScore - 0.5) * 0.2;
        return {
          ...chunk,
          score: chunk.score + boost,
          feedbackBoost: boost,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  async checkDocumentFreshness(organizationId: string): Promise<DocumentFreshness[]> {
    const rows = (await dbAll(
      `SELECT id, name, updated_at, created_at
       FROM knowledge_documents
       WHERE organization_id = ?
       ORDER BY updated_at ASC`,
      [organizationId]
    ).catch(() => [])) as any[];

    const now = Date.now();

    return (rows || []).map((doc: any) => {
      const lastUpdated = doc.updated_at || doc.created_at;
      const ageDays = Math.floor((now - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24));

      let freshnessStatus: DocumentFreshness['freshnessStatus'] = 'fresh';
      let warning: string | undefined;

      if (ageDays >= FRESHNESS_THRESHOLDS.expired) {
        freshnessStatus = 'expired';
        warning = `Document is ${ageDays} days old and may contain outdated information`;
      } else if (ageDays >= FRESHNESS_THRESHOLDS.stale) {
        freshnessStatus = 'stale';
        warning = `Document has not been updated in ${ageDays} days`;
      } else if (ageDays >= FRESHNESS_THRESHOLDS.aging) {
        freshnessStatus = 'aging';
        warning = `Document is ${ageDays} days old — consider reviewing for accuracy`;
      }

      return {
        documentId: doc.id,
        documentName: doc.name || 'Unnamed',
        lastUpdated,
        ageDays,
        freshnessStatus,
        warning,
      };
    });
  }

  async getFeedbackStats(organizationId: string): Promise<{
    totalFeedback: number;
    citedRate: number;
    unhelpfulRate: number;
    topUnhelpfulDocuments: Array<{ documentId: string; unhelpfulCount: number }>;
  }> {
    const totalRow = (await dbGet(
      `SELECT COUNT(*) as total,
              AVG(CASE WHEN signal = 'cited' THEN 1.0 ELSE 0.0 END) as cited_rate,
              AVG(CASE WHEN signal = 'unhelpful' THEN 1.0 ELSE 0.0 END) as unhelpful_rate
       FROM rag_retrieval_feedback
       WHERE organization_id = ?`,
      [organizationId]
    ).catch(() => null)) as any;

    const topUnhelpful = (await dbAll(
      `SELECT document_id, COUNT(*) as unhelpful_count
       FROM rag_retrieval_feedback
       WHERE organization_id = ? AND signal = 'unhelpful' AND document_id IS NOT NULL
       GROUP BY document_id
       ORDER BY unhelpful_count DESC
       LIMIT 10`,
      [organizationId]
    ).catch(() => [])) as any[];

    return {
      totalFeedback: Number(totalRow?.total) || 0,
      citedRate: Number(totalRow?.cited_rate) || 0,
      unhelpfulRate: Number(totalRow?.unhelpful_rate) || 0,
      topUnhelpfulDocuments: (topUnhelpful || []).map((r: any) => ({
        documentId: r.document_id,
        unhelpfulCount: Number(r.unhelpful_count),
      })),
    };
  }
}

export const retrievalFeedbackService = new RetrievalFeedbackService();
export default retrievalFeedbackService;
