/**
 * Smart Follow-up Routes
 *
 * Wires the previously-orphaned smartFollowupService (server/src/services/ai/smartFollowupService.ts)
 * to an opt-in endpoint. Generates 2-3 contextual follow-up question suggestions after an AI
 * response, using a lightweight LLM call when possible and a heuristic fallback otherwise.
 *
 * NOT hooked into the main chat pipeline (server/src/routes/ai.routes.ts, ~9k lines) — that file
 * is frozen per mandate. This is a standalone, client-opt-in endpoint the chat UI can call
 * after it renders an AI response.
 *
 * INTEGRATOR: mount this in server/src/routes/ai/index.ts:
 *   import smartFollowupRoutes from './smart-followup.routes.js';
 *   ...
 *   router.use('/smart-followup', smartFollowupRoutes);
 * Resulting path: POST /api/ai/smart-followup
 */
import { Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { smartFollowupService } from '../../services/ai/smartFollowupService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

// ==================== LLM ADAPTER ====================
// smartFollowupService expects an OpenAI-shaped client (client.chat.completions.create).
// Rather than instantiate a raw provider SDK here (which would bypass the org's configured
// tier/provider and the flakiness safeguards baked into AIPipeline), this adapter forwards
// the call through the shared AIPipeline with dedicatedSystemPrompt so the service's exact
// system instruction (strict JSON output) is preserved.
//
// organizationId/userId travel as extra (non-wire) fields on the `create()` call params
// (added in smartFollowupService.ts) rather than via closure/module state, because the
// service is a singleton — a closure-captured tenant id would create a cross-tenant race
// under concurrent requests.
let adapterInstalled = false;

function ensureLlmAdapterInstalled(): void {
  if (adapterInstalled) return;
  adapterInstalled = true;

  smartFollowupService.setLLMClient({
    chat: {
      completions: {
        create: async (params: {
          messages: Array<{ role: string; content: string }>;
          temperature?: number;
          organizationId?: string;
          userId?: string;
        }) => {
          const { organizationId, userId } = params;
          if (!organizationId || !userId) {
            // Should not happen — generateSuggestions() gates the LLM path on both being set.
            throw new Error('smart-followup LLM adapter requires organizationId and userId');
          }

          const systemMsg = params.messages.find((m) => m.role === 'system')?.content || '';
          const userMsg = params.messages.find((m) => m.role === 'user')?.content || '';

          const { AIPipeline } = await import('../../services/ai/AIPipeline.js');
          const pipeline = AIPipeline.getInstance();
          const result = await pipeline.process({
            capability: 'chat',
            userId,
            organizationId,
            prompt: userMsg,
            options: {
              temperature: params.temperature ?? 0.7,
              selectedTier: 'BUDGET',
              dedicatedSystemPrompt: true,
              systemInstruction: systemMsg,
            },
          });

          return {
            choices: [{ message: { content: result?.content || '' } }],
          };
        },
      },
    },
  });
}

// ==================== VALIDATORS ====================

const SmartFollowupBodySchema = z.object({
  question: z.string().min(1).max(2000),
  response: z.string().min(1).max(8000),
  screenContext: z.string().max(200).optional(),
  language: z.enum(['en', 'pl', 'de', 'ar', 'ja', 'es']).optional(),
});

// ==================== GENERATE SUGGESTIONS ====================

router.use(verifyToken);
router.use(aiRateLimiter);

/**
 * POST /api/ai/smart-followup
 * Body: { question, response, screenContext?, language? }
 * Returns: { suggestions: FollowupSuggestion[] }
 */
router.post(
  '/',
  validateBody(SmartFollowupBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { question, response, screenContext, language } = req.body;

    try {
      ensureLlmAdapterInstalled();

      const suggestions = await smartFollowupService.generateSuggestions({
        question,
        response,
        screenContext,
        language,
        organizationId: req.organizationId,
        userId: req.userId,
      });

      return res.json({ suggestions });
    } catch (err: any) {
      // H6.4 fail-soft: follow-up suggestions are a non-critical AI enrichment
      // (podpowiedzi) on top of an already-delivered chat response — degrade to
      // an empty suggestion list instead of a 500 that would surface as a UI error
      // for something the user never explicitly asked for.
      logger.warn('[SmartFollowup] Generate degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ suggestions: [], degraded: true });
    }
  })
);

export default router;
