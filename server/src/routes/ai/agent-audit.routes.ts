/**
 * Agent Audit Layer Routes (Post-DeepThinking)
 *
 * Endpoints:
 * - POST /api/ai/agent-audit/suggest  (pre-DT)  -> suggested agents set (manual approval)
 * - POST /api/ai/agent-audit/review   (post-DT) -> agent reviews + orchestrator verdict
 * - GET  /api/ai/agent-audit/agents   -> registry list (UI support)
 */
import { Router } from 'express';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  acceptAgentAuditRun,
  createAgentAuditRun,
  getAgentAuditRun,
} from '../../services/ai/agentAudit/agentAuditStore.js';
import { AGENTS } from '../../services/ai/agentAudit/agentRegistry.js';
import { runAgentAudit, suggestAgents } from '../../services/ai/agentAudit/orchestratorService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import {
  AgentAuditAcceptRunRequestSchema,
  AgentAuditReviewRequestSchema,
  AgentAuditSuggestRequestSchema,
} from '../../validators/ai.validators.js';

const router = Router();

router.use(verifyToken);

router.get(
  '/metrics',
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: any, res) => {
    const period = String(req.query?.period || '24h');
    let timeFilter: string;
    switch (period) {
      case '1h':
        timeFilter = "datetime('now', '-1 hour')";
        break;
      case '24h':
        timeFilter = "datetime('now', '-24 hours')";
        break;
      case '7d':
        timeFilter = "datetime('now', '-7 days')";
        break;
      case '30d':
        timeFilter = "datetime('now', '-30 days')";
        break;
      default:
        timeFilter = "datetime('now', '-24 hours')";
    }

    const counts = (await dbAll(
      `
        SELECT event_type, COUNT(*) as count
        FROM ai_agent_audit_metrics
        WHERE organization_id = ?
          AND created_at > ${timeFilter}
        GROUP BY event_type
      `,
      [req.organizationId!]
    ).catch(() => [])) as Array<{ event_type?: string; count?: number }>;

    const map = new Map<string, number>();
    for (const row of counts) map.set(String(row.event_type || ''), Number(row.count || 0));

    const started = map.get('run_started') || 0;
    const completed = map.get('run_completed') || 0;
    const accepted = map.get('run_accepted') || 0;
    const loopTriggered = map.get('loop_triggered') || 0;
    const loopIteration = map.get('loop_iteration') || 0;

    // Aggregate simple KPIs from run_completed payloads (JS-side for compatibility)
    const rows = (await dbAll(
      `
        SELECT payload_json as "payloadJson"
        FROM ai_agent_audit_metrics
        WHERE organization_id = ?
          AND event_type = 'run_completed'
          AND created_at > ${timeFilter}
        ORDER BY created_at DESC
        LIMIT 500
      `,
      [req.organizationId!]
    ).catch(() => [])) as Array<{ payloadJson?: string | null }>;

    let conflictRateSum = 0;
    let conflictRateN = 0;
    const gatesCount: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const qualityCount: Record<string, number> = { PASS: 0, PASS_WITH_RISKS: 0, FAIL: 0 };

    for (const r of rows || []) {
      let payload: any = null;
      try {
        payload = r.payloadJson ? JSON.parse(String(r.payloadJson)) : null;
      } catch {
        payload = null;
      }
      if (!payload) continue;

      const q = String(payload?.qualityStatus || '').trim();
      if (q && Object.prototype.hasOwnProperty.call(qualityCount, q)) qualityCount[q] += 1;

      const gates = Array.isArray(payload?.gatesTriggered) ? payload.gatesTriggered : [];
      for (const g of gates) {
        const gg = String(g || '').trim();
        if (gg && Object.prototype.hasOwnProperty.call(gatesCount, gg)) gatesCount[gg] += 1;
      }

      const cr = payload?.kpis?.conflictRate;
      if (typeof cr === 'number' && Number.isFinite(cr)) {
        conflictRateSum += cr;
        conflictRateN += 1;
      }
    }

    const avgConflictRate = conflictRateN > 0 ? conflictRateSum / conflictRateN : 0;

    // Counts of source usage from completed payloads (SQLite json_extract if available)
    const aggregates = (await dbGet(
      `
        SELECT
          AVG(CAST(json_extract(payload_json, '$.kpis.sourcesCounts.dt_section') AS REAL)) as avg_dt_sources,
          AVG(CAST(json_extract(payload_json, '$.kpis.sourcesCounts.kb_snippet') AS REAL)) as avg_kb_sources,
          AVG(CAST(json_extract(payload_json, '$.kpis.sourcesCounts.web_source') AS REAL)) as avg_web_sources
        FROM ai_agent_audit_metrics
        WHERE organization_id = ?
          AND event_type = 'run_completed'
          AND created_at > ${timeFilter}
      `,
      [req.organizationId!]
    ).catch(() => ({ avg_dt_sources: null, avg_kb_sources: null, avg_web_sources: null }))) as {
      avg_dt_sources?: number | null;
      avg_kb_sources?: number | null;
      avg_web_sources?: number | null;
    };

    return res.json({
      success: true,
      period,
      metrics: {
        started,
        completed,
        accepted,
        loopTriggered,
        loopIteration,
        acceptRate: completed > 0 ? accepted / completed : 0,
        loopTriggeredRate: completed > 0 ? loopTriggered / completed : 0,
        avgConflictRate: Math.round(avgConflictRate * 1000) / 1000,
        gatesCount,
        qualityCount,
        avgSources: {
          dt_section: aggregates.avg_dt_sources ?? null,
          kb_snippet: aggregates.avg_kb_sources ?? null,
          web_source: aggregates.avg_web_sources ?? null,
        },
      },
    });
  })
);

router.get(
  '/agents',
  asyncHandler(async (_req, res) => {
    return res.json({
      success: true,
      agents: AGENTS.map((a) => ({
        id: a.id,
        kind: a.kind,
        version: (a as any).version || '1',
        displayName: a.displayName,
        description: a.description,
        defaultRiskAreas: a.defaultRiskAreas,
      })),
    });
  })
);

router.post(
  '/suggest',
  validateBody(AgentAuditSuggestRequestSchema),
  asyncHandler(async (req: any, res) => {
    const body = req.body as any;
    const set = suggestAgents({
      decisionContext: body.decisionContext,
      userIntent: body.userIntent,
      language: body.language,
      maxAgents: body.maxAgents,
    });
    return res.json({ success: true, suggested: set });
  })
);

router.post(
  '/review',
  validateBody(AgentAuditReviewRequestSchema),
  asyncHandler(async (req: any, res) => {
    const body = req.body as any;
    const result = await runAgentAudit({
      organizationId: req.organizationId!,
      userId: req.userId!,
      conversationId: body?.conversationId || null,
      decisionContext: body.decisionContext,
      deepThinkingReport: body.deepThinkingReport,
      agentIds: body.agentIds,
      userIntent: body.userIntent,
      language: body.language,
      webSearchEnabled: body.webSearchEnabled,
      selectedTier: body.selectedTier,
      selectedModelId: body.selectedModelId,
      loopIteration: body.loopIteration,
    });

    // Persist run for transparency/history
    try {
      await createAgentAuditRun({
        id: result.orchestratorRunId,
        organizationId: req.organizationId!,
        userId: req.userId!,
        conversationId: body?.conversationId || null,
        dtSessionId: body?.dtSessionId || null,
        userIntent: String(body?.userIntent || 'validate'),
        loopIteration: Number(body?.loopIteration || 1),
        decisionContext: body?.decisionContext || null,
        selectedAgentIds: body?.agentIds || [],
        verdict: result.verdict || null,
        reviews: (result.reviews || []).map((r: any) => ({
          agentId: String(r.agentId || ''),
          overreach: r.overreach || null,
          review: r,
        })),
      });
    } catch {
      // best-effort; do not fail the request
    }

    return res.json({ success: true, ...result });
  })
);

router.get(
  '/runs/:runId',
  asyncHandler(async (req: any, res) => {
    const runId = String(req.params?.runId || '').trim();
    if (!runId) return res.status(400).json({ error: 'runId is required' });
    const run = await getAgentAuditRun({ runId, organizationId: req.organizationId! });
    if (!run) return res.status(404).json({ error: 'run not found' });
    return res.json({ success: true, run });
  })
);

router.post(
  '/runs/:runId/accept',
  validateBody(AgentAuditAcceptRunRequestSchema),
  asyncHandler(async (req: any, res) => {
    const runId = String(req.params?.runId || '').trim();
    if (!runId) return res.status(400).json({ error: 'runId is required' });
    await acceptAgentAuditRun({
      runId,
      organizationId: req.organizationId!,
      userId: req.userId!,
      note: String(req.body?.note || '').trim() || null,
    });
    const run = await getAgentAuditRun({ runId, organizationId: req.organizationId! });
    return res.json({ success: true, run });
  })
);

export default router;
