/**
 * RAG Metrics Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Tracks RAG pipeline quality: retrieval latency, groundedness, chunk utilization.
 */
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface RAGMetrics {
  queryId: string;
  timestamp: string;
  retrievalLatencyMs: number;
  generationLatencyMs: number;
  totalLatencyMs: number;
  chunksRetrieved: number;
  chunksUsed: number;
  chunkUtilization: number;
  estimatedPrecision: number;
  estimatedGroundedness: number;
}

class RAGMetricsServiceImpl {
  private buffer: RAGMetrics[] = [];

  record(input: {
    queryId: string;
    query: string;
    response: string;
    chunks: Array<{ text: string; score?: number; used?: boolean }>;
    retrievalLatencyMs: number;
    generationLatencyMs: number;
  }): RAGMetrics {
    const used = input.chunks.filter((c) => c.used !== false && (c.score ?? 1) > 0.3).length;
    const util = input.chunks.length > 0 ? used / input.chunks.length : 0;
    const ground = this.estimateGroundedness(input.response, input.chunks);
    const prec =
      input.chunks.length > 0
        ? input.chunks.filter((c) => (c.score ?? 0) > 0.5).length / input.chunks.length
        : 0;

    const m: RAGMetrics = {
      queryId: input.queryId,
      timestamp: new Date().toISOString(),
      retrievalLatencyMs: input.retrievalLatencyMs,
      generationLatencyMs: input.generationLatencyMs,
      totalLatencyMs: input.retrievalLatencyMs + input.generationLatencyMs,
      chunksRetrieved: input.chunks.length,
      chunksUsed: used,
      chunkUtilization: rnd(util),
      estimatedPrecision: rnd(prec),
      estimatedGroundedness: rnd(ground),
    };
    this.buffer.push(m);
    if (this.buffer.length >= 100)
      this.flush().catch(() => {
        /* ignore */
      });
    logger.debug(
      `[RAGMetrics] ground=${m.estimatedGroundedness} chunks=${used}/${input.chunks.length}`
    );
    return m;
  }

  recordError(queryId: string, error: string): void {
    logger.warn(`[RAGMetrics] Error ${queryId}: ${error}`);
  }

  async getHealthReport(hours = 24) {
    const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
    try {
      const rows = (await dbAll(
        `SELECT AVG(retrieval_latency_ms) as al, AVG(groundedness) as ag, AVG(chunk_utilization) as au, COUNT(*) as t FROM rag_metrics WHERE created_at > ?`,
        [cutoff]
      )) as any[];
      const row = rows?.[0] || {};
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if ((row.ag || 0) < 0.3) status = 'unhealthy';
      else if ((row.ag || 0) < 0.5) status = 'degraded';
      return {
        status,
        avgRetrievalLatencyMs: Math.round(row.al || 0),
        avgGroundedness: rnd(row.ag || 0),
        avgChunkUtilization: rnd(row.au || 0),
        totalQueries: row.t || 0,
        period: `${hours}h`,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'healthy' as const,
        avgRetrievalLatencyMs: 0,
        avgGroundedness: 0,
        avgChunkUtilization: 0,
        totalQueries: 0,
        period: `${hours}h`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private estimateGroundedness(resp: string, chunks: Array<{ text: string }>): number {
    if (!chunks.length) return 0.5;
    const ct = chunks.map((c) => c.text.toLowerCase()).join(' ');
    const sents = resp.split(/[.!?]\s+/).filter((s) => s.length > 15);
    if (!sents.length) return 0.5;
    let g = 0;
    for (const s of sents) {
      const w = s
        .toLowerCase()
        .split(/\s+/)
        .filter((x) => x.length > 3);
      if (w.filter((x) => ct.includes(x)).length / Math.max(w.length, 1) > 0.25) g++;
    }
    return g / sents.length;
  }

  private async flush() {
    const batch = this.buffer.splice(0);
    for (const m of batch) {
      try {
        await dbRun(
          `INSERT INTO rag_metrics (query_id,retrieval_latency_ms,generation_latency_ms,total_latency_ms,chunks_retrieved,chunks_used,chunk_utilization,precision_estimate,groundedness,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [
            m.queryId,
            m.retrievalLatencyMs,
            m.generationLatencyMs,
            m.totalLatencyMs,
            m.chunksRetrieved,
            m.chunksUsed,
            m.chunkUtilization,
            m.estimatedPrecision,
            m.estimatedGroundedness,
            m.timestamp,
          ]
        );
      } catch {
        /* ignore */
      }
    }
  }
}

function rnd(n: number) {
  return Math.round(n * 100) / 100;
}
export const ragMetricsService = new RAGMetricsServiceImpl();
export default ragMetricsService;
export { RAGMetricsServiceImpl };
