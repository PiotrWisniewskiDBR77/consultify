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
import { createInitiative } from '../../services/initiative/createInitiativeService.js';

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
    const { detectPatterns, scoreRubricV2 } =
      await import('../../services/ai/deepThinkingEvaluationService.js');

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

    const { pairwiseCompareDeepThinking } =
      await import('../../services/ai/deepThinkingEvaluationService.js');
    const result = pairwiseCompareDeepThinking({ a: A, b: B, language });
    return res.json({ success: true, result });
  })
);

/**
 * POST /api/ai/deep-thinking/save-decision
 * Save a Deep Thinking output as a decision/initiative in the org's decision memory.
 */
router.post(
  '/save-decision',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      sessionId,
      conversationId,
      content,
      type: saveType,
    } = (req.body || {}) as {
      sessionId?: string;
      conversationId?: string;
      content?: string;
      type?: 'decision' | 'initiative';
    };

    const text = String(content || '').trim();
    const sid = String(sessionId || '').trim();
    if (!text || !sid) return res.status(400).json({ error: 'content and sessionId are required' });

    // Extract structured data from the DT output
    const extractSection = (heading: RegExp, fallback = ''): string => {
      const match = text.match(new RegExp(`${heading.source}[\\s\\S]*?(?=\\n#{1,3}\\s|$)`, 'i'));
      return match ? match[0].replace(heading, '').trim().slice(0, 2000) : fallback;
    };

    const executiveSummary =
      extractSection(/#{1,3}\s*Executive\s+Summary/i) ||
      extractSection(/#{1,3}\s*Podsumowanie/i) ||
      text.slice(0, 500);

    const problemFraming =
      extractSection(/#{1,3}\s*Problem\s+(?:Framing|Definition)/i) ||
      extractSection(/#{1,3}\s*(?:Definicja|Kontekst)\s+Problemu/i);

    const recommendation = extractSection(/#{1,3}\s*Rekomendacja|Recommendation/i);

    const normalizedSaveType = String(saveType || 'decision').trim().toLowerCase();
    if (normalizedSaveType === 'initiative') {
      const sourceId = String(conversationId || sid).trim();
      const initiative = await createInitiative(
        req.organizationId!,
        {
          title: executiveSummary.slice(0, 255),
          description: text.slice(0, 20000),
          summary: recommendation || executiveSummary,
          sourceType: 'ai_chat_deep_thinking',
          sourceId,
          sourcePack: { sessionId: sid, conversationId: conversationId || null },
        },
        { actor: { id: req.userId! } }
      );
      return res.json({ success: true, initiativeId: initiative.id });
    }

    // Count options
    const optionMatches = text.match(/#{1,4}\s*(?:Option|Opcja|Path|Ścieżka)\s+\d/gi);
    const optionsCount = optionMatches ? optionMatches.length : 0;

    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();

    await dbRun(
      `INSERT INTO ai_decision_outcomes
        (id, organization_id, user_id, session_id, conversation_id,
         decision_summary, problem_framing, options_considered, chosen_option,
         recommendation_text, confidence_score, outcome_status, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.organizationId!,
        req.userId!,
        sid,
        conversationId || null,
        executiveSummary,
        problemFraming || null,
        JSON.stringify({ count: optionsCount }),
        null, // chosen option filled later by user
        recommendation || null,
        null, // confidence filled by outcome tracking
        'pending',
        JSON.stringify([saveType || 'decision', 'deep_thinking']),
      ]
    );

    // Also log as a metric event
    const { logDeepThinkingEvent } =
      await import('../../services/ai/deepThinkingMetricsService.js');
    await logDeepThinkingEvent({
      organizationId: req.organizationId!,
      userId: req.userId!,
      sessionId: sid,
      conversationId: conversationId || null,
      eventType: 'copied', // reuse "copied" event type for now; represents "saved"
      payload: { action: 'save_decision', decisionId: id, type: saveType || 'decision' },
    });

    return res.json({ success: true, decisionId: id });
  })
);

/**
 * GET /api/ai/deep-thinking/decisions
 * List AI decision outcomes for the organization (with optional search).
 * Used by Organization Memory to show past decision references.
 */
router.get(
  '/decisions',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(parseInt(String(req.query.limit || '20'), 10), 100);
    const search = String(req.query.search || '').trim();

    let query = `
      SELECT id, organization_id, user_id, session_id, conversation_id,
             decision_summary, problem_framing, options_considered, chosen_option,
             recommendation_text, confidence_score, outcome_status, outcome_notes,
             outcome_metrics, tags, industry_context,
             created_at, updated_at
      FROM ai_decision_outcomes
      WHERE organization_id = ?
    `;
    const params: any[] = [orgId];

    if (search) {
      query += ` AND (decision_summary LIKE ? OR recommendation_text LIKE ? OR problem_framing LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = (await dbAll(query, params).catch(() => [])) || [];

    const safeParse = (val: any, fallback: any = null) => {
      if (!val) return fallback;
      try {
        return JSON.parse(val);
      } catch {
        return fallback;
      }
    };

    return res.json({
      success: true,
      decisions: rows.map((r: any) => ({
        id: r.id,
        decisionSummary: r.decision_summary,
        problemFraming: r.problem_framing,
        optionsConsidered: safeParse(r.options_considered),
        chosenOption: r.chosen_option,
        recommendationText: r.recommendation_text,
        confidenceScore: r.confidence_score,
        outcomeStatus: r.outcome_status,
        outcomeNotes: r.outcome_notes,
        tags: safeParse(r.tags, []),
        industryContext: r.industry_context,
        conversationId: r.conversation_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  })
);

/**
 * GET /api/ai/deep-thinking/org-patterns
 * Fetch organization memory patterns (best practices, lessons learned).
 */
router.get(
  '/org-patterns',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(parseInt(String(req.query.limit || '20'), 10), 100);
    const memoryType = String(req.query.type || '').toUpperCase();

    let query = `
      SELECT id, organization_id, memory_type, title, content,
             applicability_score, usage_count, source_project_id,
             is_active, created_at, updated_at
      FROM organization_memory
      WHERE organization_id = ? AND is_active = 1
    `;
    const params: any[] = [orgId];

    if (memoryType) {
      query += ` AND memory_type = ?`;
      params.push(memoryType);
    }

    query += ` ORDER BY usage_count DESC, created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = (await dbAll(query, params).catch(() => [])) as any[];

    return res.json({
      success: true,
      patterns: rows.map((r: any) => ({
        id: r.id,
        type: r.memory_type,
        title: r.title,
        content: r.content,
        applicabilityScore: r.applicability_score,
        usageCount: r.usage_count,
        createdAt: r.created_at,
      })),
    });
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

    const { logDeepThinkingEvent } =
      await import('../../services/ai/deepThinkingMetricsService.js');
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
    await dbRun(`DELETE FROM ai_deep_thinking_metrics WHERE organization_id = ?`, [
      req.organizationId!,
    ]);
    return res.json({ success: true });
  })
);

export default router;
