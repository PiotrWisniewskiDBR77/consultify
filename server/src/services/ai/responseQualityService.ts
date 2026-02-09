/**
 * Response Quality Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Aggregates quality metrics, produces trends, recommendations.
 */
import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

class ResponseQualityServiceImpl {
  async getAggregate(orgId: string, days = 30) {
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
    try {
      const rows = (await dbAll(
        `SELECT AVG(relevance) as ar, AVG(groundedness) as ag, AVG(completeness) as ac, AVG(coherence) as ah, AVG(overall_score) as ao, COUNT(*) as t FROM ai_quality_metrics WHERE organization_id=? AND created_at>?`,
        [orgId, cutoff]
      )) as any[];
      const r = rows?.[0] || {};
      return {
        period: `${days}d`,
        organizationId: orgId,
        avgRelevance: rnd(r.ar || 0),
        avgGroundedness: rnd(r.ag || 0),
        avgCompleteness: rnd(r.ac || 0),
        avgCoherence: rnd(r.ah || 0),
        avgOverall: rnd(r.ao || 0),
        totalResponses: r.t || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (e) {
      logger.debug(`[ResponseQuality] ${(e as Error).message}`);
      return {
        period: `${days}d`,
        organizationId: orgId,
        avgRelevance: 0,
        avgGroundedness: 0,
        avgCompleteness: 0,
        avgCoherence: 0,
        avgOverall: 0,
        totalResponses: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getTrends(orgId: string, days = 30) {
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
    try {
      const rows = (await dbAll(
        `SELECT DATE(created_at) as d, AVG(overall_score) as ao, COUNT(*) as c FROM ai_quality_metrics WHERE organization_id=? AND created_at>? GROUP BY DATE(created_at) ORDER BY d ASC`,
        [orgId, cutoff]
      )) as any[];
      const pts = (rows || []).map((r: any) => ({
        date: r.d,
        avgOverall: rnd(r.ao || 0),
        count: r.c || 0,
      }));
      let dir: 'improving' | 'stable' | 'declining' | 'insufficient_data' = 'insufficient_data';
      if (pts.length >= 7) {
        const h1 = pts.slice(0, Math.floor(pts.length / 2)),
          h2 = pts.slice(Math.floor(pts.length / 2));
        const a1 = h1.reduce((s, d) => s + d.avgOverall, 0) / h1.length,
          a2 = h2.reduce((s, d) => s + d.avgOverall, 0) / h2.length;
        if (a2 - a1 > 0.05) dir = 'improving';
        else if (a2 - a1 < -0.05) dir = 'declining';
        else dir = 'stable';
      }
      return { dataPoints: pts, direction: dir, period: `${days}d` };
    } catch {
      return { dataPoints: [], direction: 'insufficient_data' as const, period: `${days}d` };
    }
  }

  async getRecommendations(orgId: string) {
    const agg = await this.getAggregate(orgId, 30);
    const recs: Array<{ area: string; issue: string; suggestion: string; priority: string }> = [];
    if (agg.totalResponses < 10)
      return [
        {
          area: 'data',
          issue: 'Insufficient data',
          suggestion: 'Collect more feedback',
          priority: 'medium',
        },
      ];
    if (agg.avgRelevance < 0.6)
      recs.push({
        area: 'relevance',
        issue: `Low relevance (${agg.avgRelevance})`,
        suggestion: 'Review prompt templates for topic understanding',
        priority: 'high',
      });
    if (agg.avgGroundedness < 0.5)
      recs.push({
        area: 'groundedness',
        issue: `Low groundedness (${agg.avgGroundedness})`,
        suggestion: 'Improve RAG quality, add cite-sources instruction',
        priority: 'high',
      });
    if (agg.avgCompleteness < 0.5)
      recs.push({
        area: 'completeness',
        issue: `Low completeness (${agg.avgCompleteness})`,
        suggestion: 'Add structured response requirements',
        priority: 'medium',
      });
    return recs;
  }

  async getHealthCheck() {
    try {
      const a = await this.getAggregate('__global__', 1);
      let s: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (a.avgOverall < 0.3) s = 'unhealthy';
      else if (a.avgOverall < 0.5) s = 'degraded';
      return {
        status: s,
        message: s === 'healthy' ? 'Quality OK' : `Score ${a.avgOverall}`,
        details: { avgOverall: a.avgOverall, total: a.totalResponses },
      };
    } catch {
      return { status: 'healthy' as const, message: 'No data yet', details: {} };
    }
  }
}

function rnd(n: number) {
  return Math.round(n * 100) / 100;
}
export const responseQualityService = new ResponseQualityServiceImpl();
export default responseQualityService;
export { ResponseQualityServiceImpl };
