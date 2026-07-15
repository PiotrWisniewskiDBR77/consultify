/**
 * AI Trust & Quality Routes
 *
 * Wires three previously-orphaned "trust/quality" AI engines as opt-in,
 * on-demand endpoints. NONE of these are hooked into the chat pipeline —
 * that decision (when/whether to auto-run grounding validation or offer
 * an expert panel inline in a conversation) is a separate product/design
 * session, not part of this wiring pass.
 *
 * Engines wired here:
 *  1. outputGroundingService — POST /grounding/validate
 *     Validates an AI response against provided context chunks (claim
 *     extraction + grounding score + hallucination-signal flags).
 *     DB-backed (best-effort persistence to `ai_grounding_logs`).
 *
 *     ⚠️ MIGRATION STATUS: `ai_grounding_logs` is defined in
 *     server/migrations/671_enterprise_ai_eval_golden_sets.sql, which is
 *     ALREADY checked into the repo — but its filename does not match the
 *     auto-run migration regex used by DatabaseInitializer.runTablePlatformMigrations
 *     (`/^(7\d{2}|\d{8})_.*\.sql$/`, server/src/database/DatabaseInitializer.ts:3198).
 *     A "671_" prefix does NOT match that pattern, so this migration is
 *     NOT applied automatically on boot. It must be run manually against
 *     TROLLEY (shared demo/staging DB) via:
 *       tsx server/scripts/migrate.postgres.ts --only 671_enterprise_ai_eval_golden_sets.sql
 *     before persistence will actually land any rows. Verify against the
 *     live DB first (e.g. `SELECT to_regclass('ai_grounding_logs')`) —
 *     do NOT assume from the presence of the file. Endpoint below works
 *     regardless: outputGroundingService.persistLog() already fails soft
 *     (.catch → logger.debug) if the table is missing, so validation
 *     still returns a result even without the migration applied.
 *
 *  2. expertPanelService — POST /expert-panel/analyze
 *     Runs 3 sequential/parallel LLM calls (structural analyst +
 *     devil's advocate in parallel, then a synthesis pass) — real cost
 *     per request (~1500+1500+4000 max_tokens budget across gpt-4o-mini
 *     x2 + gpt-4o x1).
 *
 *     ⚠️ COST / PROVIDER-BYPASS WARNING: expertPanelService does NOT use
 *     the shared llmService abstraction (cost tracking, circuit breaker,
 *     org model routing, BYOK). It imports the `openai` SDK directly and
 *     reads `process.env.OPENAI_API_KEY`, hardcoding 'gpt-4o-mini' /
 *     'gpt-4o'. If that env var is unset, every expert call silently
 *     degrades to "[Expert X unavailable]" / empty synthesis — the
 *     endpoint still returns 200. This is a pre-existing property of the
 *     orphaned service, not something fixed by this wiring pass (out of
 *     scope: rewiring an engine's LLM plumbing). Flagged for a product
 *     decision on whether to route this through llmService before wider
 *     rollout.
 *
 *     No org-tier enforcement pattern exists elsewhere in the codebase
 *     for gating a "PREMIUM" *feature* (the `tier` field seen throughout
 *     ai.routes.ts / ai_user_tiers is a client-selected LLM quality/cost
 *     tier, not a billing-plan gate). Per instructions, gating this
 *     multi-call/expensive endpoint on admin role until a real
 *     tier-enforcement mechanism exists — see CLAUDE.md decision log.
 *
 *  3. scenarioStressTestService — POST /scenario-stress-test/run,
 *     POST /scenario-stress-test/quick-sensitivity,
 *     GET /scenario-stress-test/default-variables
 *     Pure computation (no LLM, no DB) — Monte-Carlo-style what-if
 *     sensitivity/robustness analysis over decision options. Safe to
 *     expose to any authenticated org member.
 *
 * ─────────────────────────────────────────────────────────────────────
 * INTEGRATION NOTE FOR THE MOUNTING STEP (do not self-mount — this repo
 * uses a dedicated integration step, see commit f5e5763b77
 * "Merge branch 'wire-routes-mount' into integrate-wiring-fala3", to
 * avoid concurrent robotnik branches conflicting on the shared barrel
 * files). To activate these endpoints, the integrator adds:
 *
 *   // server/src/routes/ai/index.ts
 *   import aiTrustRoutes from './ai-trust.routes.js';
 *   ...
 *   router.use('/trust', aiTrustRoutes);
 *
 * Resulting public paths (mounted under /api/ai via Gateway.ts:428
 * `app.use('/api/ai', aiDomainRoutes)`):
 *   POST /api/ai/trust/grounding/validate
 *   POST /api/ai/trust/expert-panel/analyze
 *   GET  /api/ai/trust/expert-panel/should-trigger
 *   POST /api/ai/trust/scenario-stress-test/run
 *   POST /api/ai/trust/scenario-stress-test/quick-sensitivity
 *   GET  /api/ai/trust/scenario-stress-test/default-variables
 * ─────────────────────────────────────────────────────────────────────
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import expertPanelService from '../../services/ai/expertPanelService.js';
import outputGroundingService from '../../services/ai/outputGroundingService.js';
import {
  COMMON_SCENARIO_VARIABLES,
  type DecisionOption,
  quickSensitivityCheck,
  runStressTest,
  type ScenarioVariable,
} from '../../services/ai/scenarioStressTestService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

router.use(verifyToken);

// ==========================================
// 1. OUTPUT GROUNDING
// ==========================================

/**
 * POST /api/ai/trust/grounding/validate
 * Validate an AI response's claims against supplied context chunks.
 * Not part of the chat pipeline — call on demand (e.g. "check this answer").
 */
router.post(
  '/grounding/validate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { response, contextChunks, conversationId, messageId } = (req.body || {}) as {
      response?: string;
      contextChunks?: string[];
      conversationId?: string;
      messageId?: string;
    };

    const text = String(response || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'response is required' });
    }
    if (contextChunks !== undefined && !Array.isArray(contextChunks)) {
      return res.status(400).json({ error: 'contextChunks must be an array of strings' });
    }

    const result = await outputGroundingService.validate({
      response: text,
      contextChunks: Array.isArray(contextChunks) ? contextChunks.map(String) : [],
      conversationId: conversationId ? String(conversationId) : undefined,
      messageId: messageId ? String(messageId) : undefined,
      userId: req.userId,
      organizationId: req.organizationId,
    });

    return res.json({ success: true, result });
  })
);

// ==========================================
// 2. EXPERT PANEL (LLM cost — rate-limited + admin-gated)
// ==========================================

/**
 * GET /api/ai/trust/expert-panel/should-trigger?question=...
 * Cheap heuristic check (no LLM call) — lets a client decide whether to
 * offer the (costly) expert panel for a given question.
 */
router.get(
  '/expert-panel/should-trigger',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const question = String(req.query.question || '').trim();
    if (!question) {
      return res.status(400).json({ error: 'question query param is required' });
    }
    const shouldTrigger = expertPanelService.isComplexStrategicQuestion(question);
    return res.json({ success: true, shouldTrigger });
  })
);

/**
 * POST /api/ai/trust/expert-panel/analyze
 * Runs the multi-model expert panel (structural analyst + devil's
 * advocate in parallel, then a synthesis pass). Real LLM cost per call
 * — see file header warning re: provider bypass + admin gating.
 */
router.post(
  '/expert-panel/analyze',
  requireRole('super_admin', 'admin'),
  aiRateLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { question, context, language } = (req.body || {}) as {
      question?: string;
      context?: string;
      language?: string;
    };

    const q = String(question || '').trim();
    if (!q) {
      return res.status(400).json({ error: 'question is required' });
    }

    logger.info(
      `[ai-trust] expert-panel/analyze org=${req.organizationId} user=${req.userId} qlen=${q.length}`
    );

    const result = await expertPanelService.analyze({
      question: q,
      context: context ? String(context).slice(0, 8000) : undefined,
      organizationId: req.organizationId,
      userId: req.userId,
      language,
    });

    return res.json({ success: true, result });
  })
);

// ==========================================
// 3. SCENARIO STRESS TEST (pure computation — no LLM, no DB)
// ==========================================

/**
 * GET /api/ai/trust/scenario-stress-test/default-variables
 * Returns the built-in scenario variable library (demand/cost/timeline/
 * competition) so a client can build a stress-test request without
 * hardcoding the defaults.
 */
router.get(
  '/scenario-stress-test/default-variables',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({ success: true, variables: COMMON_SCENARIO_VARIABLES });
  })
);

/**
 * POST /api/ai/trust/scenario-stress-test/run
 * Run decision options through a set of what-if scenarios; returns
 * robustness ranking + sensitivity analysis + a recommendation.
 */
router.post(
  '/scenario-stress-test/run',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { options, variables, generateCombinations } = (req.body || {}) as {
      options?: DecisionOption[];
      variables?: ScenarioVariable[];
      generateCombinations?: boolean;
    };

    if (!Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'options must be a non-empty array' });
    }
    for (const opt of options) {
      if (!opt?.id || !opt?.name || typeof opt?.baseOutcome !== 'number') {
        return res
          .status(400)
          .json({ error: 'each option requires id, name, and numeric baseOutcome' });
      }
    }
    if (variables !== undefined && !Array.isArray(variables)) {
      return res.status(400).json({ error: 'variables must be an array when provided' });
    }

    const summary = runStressTest({
      options,
      variables: Array.isArray(variables) ? variables : undefined,
      generateCombinations: Boolean(generateCombinations),
    });

    return res.json({ success: true, summary });
  })
);

/**
 * POST /api/ai/trust/scenario-stress-test/quick-sensitivity
 * Single-variable sensitivity sweep for one decision option.
 */
router.post(
  '/scenario-stress-test/quick-sensitivity',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { option, variableName, range, steps } = (req.body || {}) as {
      option?: DecisionOption;
      variableName?: string;
      range?: [number, number];
      steps?: number;
    };

    if (!option?.id || !option?.name || typeof option?.baseOutcome !== 'number') {
      return res.status(400).json({ error: 'option requires id, name, and numeric baseOutcome' });
    }
    if (!variableName || typeof variableName !== 'string') {
      return res.status(400).json({ error: 'variableName is required' });
    }
    if (
      !Array.isArray(range) ||
      range.length !== 2 ||
      typeof range[0] !== 'number' ||
      typeof range[1] !== 'number'
    ) {
      return res.status(400).json({ error: 'range must be a [number, number] tuple' });
    }

    const results = quickSensitivityCheck({
      option,
      variableName,
      range,
      steps: typeof steps === 'number' ? steps : undefined,
    });

    return res.json({ success: true, results });
  })
);

export default router;
