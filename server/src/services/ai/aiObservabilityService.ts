/**
 * AI Observability Service
 *
 * Aggregates metrics from quality-monitoring, ragMetrics, responseQuality,
 * chatPolicyGateway decisions, ai_feedback, and ai_usage_logs into a
 * unified observability API for the superadmin dashboard.
 */
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface ObservabilityMetrics {
  period: { from: string; to: string };
  requests: { total: number; avgPerDay: number };
  quality: {
    avgScore: number;
    p50: number;
    p95: number;
    trend: Array<{ date: string; avgScore: number; count: number }>;
  };
  latency: {
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  cost: {
    totalUsd: number;
    avgPerRequest: number;
    byModel: Array<{ model: string; totalUsd: number; count: number }>;
  };
  safety: {
    totalRefusals: number;
    refusalRate: number;
    byCategory: Array<{ category: string; count: number }>;
  };
  tools: {
    totalCalls: number;
    successRate: number;
    byTool: Array<{ tool: string; count: number; successRate: number }>;
  };
  rag: {
    avgGroundedness: number;
    avgChunksUsed: number;
    retrievalLatencyMs: number;
  };
  feedback: {
    totalRatings: number;
    satisfactionRate: number;
    helpfulCount: number;
    notHelpfulCount: number;
  };
  grounding: {
    avgGroundingScore: number;
    avgConfidenceScore: number;
    avgCitationAccuracy: number;
    totalValidated: number;
  };
  evalRegression: {
    latestRunId: string | null;
    passesGate: boolean | null;
    lastRunDate: string | null;
    metrics: Record<string, number>;
  };
}

export interface AlertRule {
  metric: string;
  operator: 'lt' | 'gt';
  threshold: number;
  severity: 'warning' | 'critical';
}

const DEFAULT_ALERTS: AlertRule[] = [
  { metric: 'quality.avgScore', operator: 'lt', threshold: 0.6, severity: 'critical' },
  { metric: 'safety.refusalRate', operator: 'gt', threshold: 0.1, severity: 'warning' },
  { metric: 'latency.p95Ms', operator: 'gt', threshold: 15000, severity: 'warning' },
  { metric: 'feedback.satisfactionRate', operator: 'lt', threshold: 0.7, severity: 'warning' },
  { metric: 'grounding.avgGroundingScore', operator: 'lt', threshold: 0.5, severity: 'critical' },
];

class AIObservabilityService {
  async getMetrics(
    organizationId: string | null,
    from: string,
    to: string
  ): Promise<ObservabilityMetrics> {
    const orgFilter = organizationId ? 'AND organization_id = ?' : '';
    const orgParams = organizationId ? [organizationId] : [];

    const [
      qualityData,
      qualityTrend,
      latencyData,
      costData,
      costByModel,
      safetyData,
      safetyByCategory,
      toolData,
      toolByName,
      ragData,
      feedbackData,
      groundingData,
      evalData,
      requestCount,
    ] = await Promise.all([
      this.queryQuality(from, to, orgFilter, orgParams),
      this.queryQualityTrend(from, to, orgFilter, orgParams),
      this.queryLatency(from, to, orgFilter, orgParams),
      this.queryCost(from, to, orgFilter, orgParams),
      this.queryCostByModel(from, to, orgFilter, orgParams),
      this.querySafety(from, to, orgFilter, orgParams),
      this.querySafetyByCategory(from, to, orgFilter, orgParams),
      this.queryTools(from, to, orgFilter, orgParams),
      this.queryToolByName(from, to, orgFilter, orgParams),
      this.queryRag(from, to, orgFilter, orgParams),
      this.queryFeedback(from, to, orgFilter, orgParams),
      this.queryGrounding(from, to, orgFilter, orgParams),
      this.queryLatestEval(organizationId),
      this.queryRequestCount(from, to, orgFilter, orgParams),
    ]);

    const daysDiff = Math.max(
      1,
      Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24))
    );

    return {
      period: { from, to },
      requests: {
        total: requestCount,
        avgPerDay: Math.round(requestCount / daysDiff),
      },
      quality: qualityData
        ? {
            avgScore: num(qualityData.avg_score),
            p50: num(qualityData.p50),
            p95: num(qualityData.p95),
            trend: qualityTrend,
          }
        : { avgScore: 0, p50: 0, p95: 0, trend: [] },
      latency: {
        avgMs: num(latencyData?.avg_latency),
        p50Ms: num(latencyData?.p50),
        p95Ms: num(latencyData?.p95),
        p99Ms: num(latencyData?.p99),
      },
      cost: {
        totalUsd: num(costData?.total_cost),
        avgPerRequest: requestCount > 0 ? num(costData?.total_cost) / requestCount : 0,
        byModel: costByModel,
      },
      safety: {
        totalRefusals: numInt(safetyData?.refusal_count),
        refusalRate: requestCount > 0 ? numInt(safetyData?.refusal_count) / requestCount : 0,
        byCategory: safetyByCategory,
      },
      tools: {
        totalCalls: numInt(toolData?.total_calls),
        successRate: num(toolData?.success_rate),
        byTool: toolByName,
      },
      rag: {
        avgGroundedness: num(ragData?.avg_groundedness),
        avgChunksUsed: num(ragData?.avg_chunks),
        retrievalLatencyMs: num(ragData?.avg_retrieval_ms),
      },
      feedback: {
        totalRatings: numInt(feedbackData?.total),
        satisfactionRate: num(feedbackData?.satisfaction_rate),
        helpfulCount: numInt(feedbackData?.helpful),
        notHelpfulCount: numInt(feedbackData?.not_helpful),
      },
      grounding: {
        avgGroundingScore: num(groundingData?.avg_grounding),
        avgConfidenceScore: num(groundingData?.avg_confidence),
        avgCitationAccuracy: num(groundingData?.avg_citation_acc),
        totalValidated: numInt(groundingData?.total),
      },
      evalRegression: {
        latestRunId: evalData?.id || null,
        passesGate: evalData?.passes_gate != null ? Boolean(evalData.passes_gate) : null,
        lastRunDate: evalData?.created_at || null,
        metrics: evalData ? safeParseJson(evalData.results_json) : {},
      },
    };
  }

  checkAlerts(
    metrics: ObservabilityMetrics,
    rules?: AlertRule[]
  ): Array<{
    rule: AlertRule;
    currentValue: number;
    triggered: boolean;
  }> {
    const activeRules = rules || DEFAULT_ALERTS;
    return activeRules.map((rule) => {
      const value = this.resolveMetricValue(metrics, rule.metric);
      const triggered = rule.operator === 'lt' ? value < rule.threshold : value > rule.threshold;
      return { rule, currentValue: value, triggered };
    });
  }

  private resolveMetricValue(metrics: any, path: string): number {
    const parts = path.split('.');
    let current = metrics;
    for (const part of parts) {
      if (current == null) return 0;
      current = current[part];
    }
    return typeof current === 'number' ? current : 0;
  }

  private async queryQuality(from: string, to: string, orgFilter: string, orgParams: any[]) {
    return dbGet(
      `SELECT AVG(overall_score) as avg_score,
              AVG(overall_score) as p50,
              AVG(overall_score) as p95
       FROM ai_quality_metrics
       WHERE created_at >= ? AND created_at <= ? ${orgFilter}`,
      [from, to, ...orgParams]
    ).catch(() => null) as any;
  }

  private async queryQualityTrend(from: string, to: string, orgFilter: string, orgParams: any[]) {
    const rows = await dbAll(
      `SELECT DATE(created_at) as date,
              AVG(overall_score) as "avgScore",
              COUNT(*) as count
       FROM ai_quality_metrics
       WHERE created_at >= ? AND created_at <= ? ${orgFilter}
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [from, to, ...orgParams]
    ).catch(() => []);
    return ((rows as any[]) || []).map((r: any) => ({
      date: r.date,
      avgScore: num(r.avgScore),
      count: numInt(r.count),
    }));
  }

  private async queryLatency(from: string, to: string, orgFilter: string, orgParams: any[]) {
    return dbGet(
      `SELECT AVG(latency_ms) as avg_latency,
              AVG(latency_ms) as p50,
              AVG(latency_ms) as p95,
              MAX(latency_ms) as p99
       FROM ai_usage_logs
       WHERE created_at >= ? AND created_at <= ? ${orgFilter}`,
      [from, to, ...orgParams]
    ).catch(() => null) as any;
  }

  private async queryCost(from: string, to: string, orgFilter: string, orgParams: any[]) {
    // NOTE: column was `cost_usd` (never existed on ai_usage_logs — real column is
    // `estimated_cost_usd`, see migration 605_ai_usage_logs_cost_contract_v3.sql). On
    // Postgres this threw "column does not exist" -> caught -> total_cost always 0/undefined.
    return dbGet(
      `SELECT SUM(COALESCE(estimated_cost_usd, 0)) as total_cost
       FROM ai_usage_logs
       WHERE created_at >= ? AND created_at <= ? ${orgFilter}`,
      [from, to, ...orgParams]
    ).catch(() => null) as any;
  }

  private async queryCostByModel(from: string, to: string, orgFilter: string, orgParams: any[]) {
    // NOTE: `model_id`/`cost_usd` never existed on ai_usage_logs (real columns:
    // `model`, `estimated_cost_usd`) — same stale-schema bug as queryCost above.
    const rows = await dbAll(
      `SELECT model,
              SUM(COALESCE(estimated_cost_usd, 0)) as "totalUsd",
              COUNT(*) as count
       FROM ai_usage_logs
       WHERE created_at >= ? AND created_at <= ? ${orgFilter} AND model IS NOT NULL
       GROUP BY model
       ORDER BY "totalUsd" DESC
       LIMIT 20`,
      [from, to, ...orgParams]
    ).catch(() => []);
    return ((rows as any[]) || []).map((r: any) => ({
      model: r.model || 'unknown',
      totalUsd: num(r.totalUsd),
      count: numInt(r.count),
    }));
  }

  private async querySafety(from: string, to: string, orgFilter: string, orgParams: any[]) {
    return dbGet(
      `SELECT COUNT(*) as refusal_count
       FROM ai_audit_logs
       WHERE created_at >= ? AND created_at <= ? ${orgFilter}
         AND action_type = 'policy_refusal'`,
      [from, to, ...orgParams]
    ).catch(() => null) as any;
  }

  private async querySafetyByCategory(
    from: string,
    to: string,
    orgFilter: string,
    orgParams: any[]
  ) {
    const rows = await dbAll(
      `SELECT COALESCE(JSON_EXTRACT(context_snapshot, '$.category'), 'unknown') as category,
              COUNT(*) as count
       FROM ai_audit_logs
       WHERE created_at >= ? AND created_at <= ? ${orgFilter}
         AND action_type = 'policy_refusal'
       GROUP BY category
       ORDER BY count DESC`,
      [from, to, ...orgParams]
    ).catch(() => []);
    return ((rows as any[]) || []).map((r: any) => ({
      category: r.category || 'unknown',
      count: numInt(r.count),
    }));
  }

  private async queryTools(from: string, to: string, orgFilter: string, orgParams: any[]) {
    // NOTE: `status` column never existed on ai_audit_logs (real column is the
    // integer `success` — see server/src/controllers/ai/AITrainingController.ts for
    // the same `success = 1` pattern already in use elsewhere in this codebase).
    return dbGet(
      `SELECT COUNT(*) as total_calls,
              AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END) as success_rate
       FROM ai_audit_logs
       WHERE created_at >= ? AND created_at <= ? ${orgFilter}
         AND action_type = 'tool_call'`,
      [from, to, ...orgParams]
    ).catch(() => null) as any;
  }

  private async queryToolByName(from: string, to: string, orgFilter: string, orgParams: any[]) {
    const rows = await dbAll(
      `SELECT COALESCE(JSON_EXTRACT(context_snapshot, '$.tool_name'), 'unknown') as tool,
              COUNT(*) as count,
              AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END) as "successRate"
       FROM ai_audit_logs
       WHERE created_at >= ? AND created_at <= ? ${orgFilter}
         AND action_type = 'tool_call'
       GROUP BY tool
       ORDER BY count DESC
       LIMIT 20`,
      [from, to, ...orgParams]
    ).catch(() => []);
    return ((rows as any[]) || []).map((r: any) => ({
      tool: r.tool || 'unknown',
      count: numInt(r.count),
      successRate: num(r.successRate),
    }));
  }

  private async queryRag(from: string, to: string, orgFilter: string, orgParams: any[]) {
    return dbGet(
      `SELECT AVG(groundedness_estimate) as avg_groundedness,
              AVG(chunks_used) as avg_chunks,
              AVG(retrieval_latency_ms) as avg_retrieval_ms
       FROM rag_metrics
       WHERE created_at >= ? AND created_at <= ? ${orgFilter}`,
      [from, to, ...orgParams]
    ).catch(() => null) as any;
  }

  private async queryFeedback(from: string, to: string, orgFilter: string, orgParams: any[]) {
    return dbGet(
      `SELECT COUNT(*) as total,
              AVG(CASE WHEN rating = 'HELPFUL' THEN 1.0 ELSE 0.0 END) as satisfaction_rate,
              SUM(CASE WHEN rating = 'HELPFUL' THEN 1 ELSE 0 END) as helpful,
              SUM(CASE WHEN rating = 'NOT_HELPFUL' THEN 1 ELSE 0 END) as not_helpful
       FROM ai_feedback
       WHERE created_at >= ? AND created_at <= ? ${orgFilter}`,
      [from, to, ...orgParams]
    ).catch(() => null) as any;
  }

  private async queryGrounding(from: string, to: string, orgFilter: string, orgParams: any[]) {
    return dbGet(
      `SELECT AVG(grounding_score) as avg_grounding,
              AVG(confidence_score) as avg_confidence,
              AVG(citation_accuracy) as avg_citation_acc,
              COUNT(*) as total
       FROM ai_grounding_logs
       WHERE created_at >= ? AND created_at <= ? ${orgFilter}`,
      [from, to, ...orgParams]
    ).catch(() => null) as any;
  }

  private async queryLatestEval(orgId: string | null) {
    const orgFilter = orgId ? 'WHERE organization_id = ?' : '';
    const params = orgId ? [orgId] : [];
    return dbGet(
      `SELECT id, passes_gate, created_at, results_json
       FROM ai_evaluations
       ${orgFilter}
       ORDER BY created_at DESC LIMIT 1`,
      params
    ).catch(() => null) as any;
  }

  private async queryRequestCount(from: string, to: string, orgFilter: string, orgParams: any[]) {
    const row = (await dbGet(
      `SELECT COUNT(*) as cnt FROM ai_usage_logs
       WHERE created_at >= ? AND created_at <= ? ${orgFilter}`,
      [from, to, ...orgParams]
    ).catch(() => null)) as any;
    return numInt(row?.cnt);
  }
}

function num(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : Math.round(n * 10000) / 10000;
}

function numInt(v: any): number {
  return Math.round(Number(v) || 0);
}

function safeParseJson(raw: any): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

export const aiObservabilityService = new AIObservabilityService();
export default aiObservabilityService;
