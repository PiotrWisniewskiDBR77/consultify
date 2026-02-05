/**
 * Deep Thinking Ops Routes (Enterprise MVP)
 *
 * Internal/admin endpoints for:
 * - evaluating outputs (DoD + N/P patterns + rubric)
 * - pairwise comparisons (A vs B) without rewarding length
 * - operational metrics (events + aggregation)
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();

router.post(
  '/evaluate',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { text, language } = (req.body || {}) as { text?: string; language?: string };
    const input = String(text || '').trim();
    if (!input) return res.status(400).json({ error: 'text is required' });

    const { validateDeepThinkingDoD } = await import('../../services/ai/deepThinkingQuality.js');
    const {
      detectPatterns,
      scoreRubricV2,
    } = await import('../../services/ai/deepThinkingEvaluationService.js');

    const dod = validateDeepThinkingDoD(input, language);
    const rubric = scoreRubricV2(input, language);
    const patterns = detectPatterns(input, language);

    return res.json({ success: true, dod, rubric, patterns });
  })
);

router.post(
  '/pairwise',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { a, b, language } = (req.body || {}) as { a?: string; b?: string; language?: string };
    const A = String(a || '').trim();
    const B = String(b || '').trim();
    if (!A || !B) return res.status(400).json({ error: 'a and b are required' });

    const { pairwiseCompareDeepThinking } = await import(
      '../../services/ai/deepThinkingEvaluationService.js'
    );
    const result = pairwiseCompareDeepThinking({ a: A, b: B, language });
    return res.json({ success: true, result });
  })
);

/**
 * POST /api/ai/deep-thinking/events
 * Client-side metrics events (e.g. user copied output)
 */
router.post(
  '/events',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { eventType, sessionId, conversationId, payload } = (req.body || {}) as {
      eventType?: string;
      sessionId?: string;
      conversationId?: string;
      payload?: Record<string, unknown>;
    };

    const et = String(eventType || '').trim();
    const sid = String(sessionId || '').trim();
    if (!et || !sid) return res.status(400).json({ error: 'eventType and sessionId are required' });

    const allowed = new Set(['copied']);
    if (!allowed.has(et)) return res.status(400).json({ error: 'unsupported eventType' });

    const { logDeepThinkingEvent } = await import('../../services/ai/deepThinkingMetricsService.js');
    await logDeepThinkingEvent({
      organizationId: req.organizationId!,
      userId: req.userId!,
      sessionId: sid,
      conversationId: conversationId || null,
      eventType: 'copied',
      payload: payload || null,
    });

    return res.json({ success: true });
  })
);

/**
 * GET /api/ai/deep-thinking/metrics?period=24h
 * Aggregated operational metrics.
 */
router.get(
  '/metrics',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
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

    // Started/completed/aborted/force_depth/copied counts
    const counts = (await dbAll(
      `
        SELECT event_type, COUNT(*) as count
        FROM ai_deep_thinking_metrics
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
    const aborted = map.get('run_aborted') || 0;
    const forceDepth = map.get('force_depth') || 0;
    const copied = map.get('copied') || 0;

    // DoD pass rate and avg options from completed payloads
    const aggregates = (await dbGet(
      `
        SELECT
          AVG(CASE WHEN json_extract(payload_json, '$.dod.ok') = 1 THEN 1.0 ELSE 0.0 END) as dod_pass_rate,
          AVG(CAST(json_extract(payload_json, '$.optionsCount') AS REAL)) as avg_options
        FROM ai_deep_thinking_metrics
        WHERE organization_id = ?
          AND event_type = 'run_completed'
          AND created_at > ${timeFilter}
      `,
      [req.organizationId!]
    ).catch(() => ({ dod_pass_rate: null, avg_options: null }))) as {
      dod_pass_rate?: number | null;
      avg_options?: number | null;
    };

    const abortRate = started > 0 ? aborted / started : 0;
    const forceDepthRate = completed > 0 ? forceDepth / completed : 0;

    return res.json({
      success: true,
      period,
      metrics: {
        started,
        completed,
        aborted,
        copied,
        dodPassRate: aggregates.dod_pass_rate ?? null,
        abortRate,
        forceDepthRate,
        avgOptions: aggregates.avg_options ?? null,
        reuseSignals: {
          copied,
        },
      },
    });
  })
);

/**
 * POST /api/ai/deep-thinking/metrics/reset (dev/admin)
 * Not exposed by default; kept for local testing.
 */
router.post(
  '/metrics/reset',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun(`DELETE FROM ai_deep_thinking_metrics WHERE organization_id = ?`, [req.organizationId!]);
    return res.json({ success: true });
  })
);

export default router;

