import { Router } from 'express';
import { z } from 'zod';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { attachV8Context } from '../../middleware/v8Auth.middleware.js';
import { caseWorkspaceHandler } from '../caseWorkspace/_shared/handler.js';
import { parseBody, parseParams } from '../caseWorkspace/_shared/validate.js';
import * as caseIntakeService from '../../services/caseWorkspace/caseIntakeService.js';
import {
  isTeresaTtsConfigured,
  synthesizeTeresaSpeech,
  TeresaTtsUnavailableError,
} from '../../services/ai/teresaTtsService.js';
import { resolveVoiceRuntime } from '../../services/ai/voiceRuntimeService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

function teresaMeta(extra?: Record<string, unknown>) {
  return { version: 'v10' as const, ...extra };
}

const TeresaTtsSchema = z.object({
  text: z.string().min(1).max(8_000),
  language: z.string().max(16).optional(),
  voiceName: z.string().max(64).optional(),
});

const TeresaVoiceEventSchema = z.object({
  eventName: z.enum([
    'voice_config_loaded',
    'voice_unavailable',
    'voice_start_attempt',
    'voice_started',
    'voice_error',
    'voice_stopped',
    'dictation_fallback_used',
    'tts_fallback_used',
  ]),
  status: z.enum(['idle', 'connecting', 'live', 'error']).optional(),
  unavailableReason: z.string().max(160).optional(),
  durationSeconds: z
    .number()
    .min(0)
    .max(24 * 60 * 60)
    .optional(),
});

router.get(
  '/voice-config',
  verifyToken,
  asyncHandler(async (req: any, res) => {
    // SSOT: shared voice runtime resolver (DB worker config + env fallback).
    // Worker-governed: an ACTIVE 'teresa' virtual worker (managed in the admin
    // panel) controls voice + persona/tone. Until that row is activated, the
    // resolver falls back to env (TERESA_VOICE_*), so voice never regresses.
    const runtime = await resolveVoiceRuntime({
      assistant: 'teresa',
      subjectKey: String(req.userId || req.user?.id || req.organizationId || 'unknown'),
      // A stale/not-yet-activated 'teresa' worker row must never silently kill
      // workspace voice — fall back to env (TERESA_VOICE_*) when it isn't active.
      fallbackToEnvWhenInactive: true,
    });
    const enabled = runtime.enabled;

    return res.json({
      assistant: 'teresa',
      surface: 'workspace_copilot',
      capability: 'voice',
      enabled,
      model: runtime.model,
      voiceName: runtime.voiceName || 'Kore',
      // Admin-configured persona/tone (frozen safety boundaries stay in code).
      persona: runtime.persona,
      tone: runtime.tone,
      session: enabled ? runtime.session : null,
      unavailableReason: runtime.unavailableReason,
      fallback: {
        dictation: 'browser_speech_or_text_input',
        tts: 'universal_voice_tts',
        textChat: true,
      },
      boundaries: {
        tenantDataAccess: 'authenticated_workspace_scope_only',
        silentActions: false,
        approvalRequiredForWrites: true,
      },
    });
  })
);

router.post(
  '/voice-event',
  verifyToken,
  asyncHandler(async (req: any, res) => {
    const parsed = TeresaVoiceEventSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid Teresa voice event',
        code: 'TERESA_VOICE_EVENT_INVALID',
        details: parsed.error.flatten(),
      });
    }

    logger.info('[TeresaVoice] event', {
      organizationId: req.organizationId || null,
      userId: req.userId || null,
      ...parsed.data,
    });

    return res.status(202).json({
      ok: true,
      assistant: 'teresa',
      surface: 'workspace_copilot',
      capability: 'voice',
    });
  })
);

/**
 * POST /api/v10/teresa/tts — Phase 1A unidirectional text-to-speech.
 * Accepts { text, language?, voiceName? } and returns an audio/wav body the
 * client plays back. Returns an honest 503 when no server Gemini key is present
 * (so the client never fakes success), and 422 for empty/unspeakable input.
 */
router.post(
  '/tts',
  verifyToken,
  asyncHandler(async (req: any, res) => {
    const parsed = TeresaTtsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid Teresa TTS request',
        code: 'TERESA_TTS_INVALID',
        details: parsed.error.flatten(),
      });
    }

    if (!isTeresaTtsConfigured()) {
      return res.status(503).json({
        error: 'Teresa voice (read-aloud) is not configured on this server.',
        code: 'TERESA_TTS_UNAVAILABLE',
        reason: 'server_missing_gemini_live_key',
        recoverable: true,
      });
    }

    try {
      const result = await synthesizeTeresaSpeech({
        text: parsed.data.text,
        language: parsed.data.language ?? null,
        voiceName: parsed.data.voiceName ?? null,
      });
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Teresa-Voice', result.voiceName);
      return res.send(result.audio);
    } catch (error) {
      if (error instanceof TeresaTtsUnavailableError) {
        const status =
          error.reason === 'empty_input'
            ? 422
            : error.reason === 'server_missing_gemini_live_key'
              ? 503
              : 502;
        return res.status(status).json({
          error: error.message,
          code: 'TERESA_TTS_UNAVAILABLE',
          reason: error.reason,
          recoverable: true,
        });
      }
      logger.error('[TeresaTTS] route error', {
        message: error instanceof Error ? error.message : String(error),
      });
      return res.status(502).json({
        error: 'Teresa text-to-speech failed unexpectedly.',
        code: 'TERESA_TTS_FAILED',
        recoverable: true,
      });
    }
  })
);

// ---------------------------------------------------------------------------
// Case Intake — Teresa's work-order summary -> Case (R4-P1)
// ---------------------------------------------------------------------------
/**
 * R4-P1 FIX. This router (`/api/v10/teresa`, mounted unconditionally in
 * `Gateway.ts:1246` — the ONLY Teresa router `Gateway.ts` imports) is the
 * production Teresa surface. Before this block it contained voice-config /
 * voice-event / tts and NOT ONE occurrence of the word "case": a real Teresa
 * conversation had a working backend (`caseIntakeService` + the routes below
 * it mirrors) but no production HTTP path to reach it, so CW-CANON-03
 * ("conversation -> confirmation -> exactly one Case") was unreachable for a
 * real user even though `caseIntakeService` itself and its chat-route wiring
 * (`routes/v8/chat.routes.ts`, mounted at `/api/v8/chat`) both work — proven
 * live: POST .../case-intake/turn -> POST .../confirm -> 201, a real
 * `case_core` row, over curl.
 *
 * NOT A SECOND MECHANISM. These five routes are line-for-line the same
 * shape as the case-intake block already sitting, tested but unmounted, in
 * `routes/v8/teresa.routes.ts` (see `chatIntake.pg.test.ts`, which drives
 * that exact router and asserts a summary shown on the Teresa surface can be
 * confirmed on the chat surface and yields the SAME single Case — "Teresa
 * and chat are ONE intake, not two"). This block is that already-proven
 * twin, promoted onto the router `Gateway.ts` actually mounts, because this
 * packet's allowlist is `routes/v10/teresa.routes.ts` and does not include
 * `Gateway.ts` or `routes/v8/teresa.routes.ts`. Every guarantee — the digest
 * boundary, `informational chat creates zero Cases`, `confirm takes ONLY a
 * digest`, `exactly one Case via case_core`'s `UNIQUE(project_id)` +
 * `ON CONFLICT … DO NOTHING`, refresh/retry reusing rather than duplicating —
 * lives in `caseIntakeService` itself and is unchanged by which router calls
 * it.
 *
 * `attachV8Context` is applied per-route (not router-wide) because, unlike
 * `v8Router`, this router is mounted in `Gateway.ts` with no shared
 * context-attachment middleware — every other route above authenticates with
 * bare `verifyToken` and never touches `req.v8Context`. `caseWorkspaceHandler`
 * requires that context (`getV8Context` throws otherwise), so it is added
 * only to the routes that need it, immediately after `verifyToken`, matching
 * the production order used at `/api/v8/execution-control/manager`
 * (`Gateway.ts:1236`: `gatewayVerifyToken, requireV8OrgContext,
 * attachV8Context`) minus the explicit org-context pre-check, which
 * `attachV8Context` itself already performs (403 `V8_MISSING_ORG_CONTEXT`).
 */

const teresaClosureTypeEnum = z.enum([
  'DELIVERY_COMPLETED',
  'DECISION_COMPLETED',
  'IMPLEMENTATION_COMPLETED',
  'OUTCOME_VALIDATED',
  'COMPLETED_PARTIAL',
]);

/**
 * The three fields the human actually reads before clicking — goal, scope,
 * expected outcome — are required. Everything below them is governance
 * metadata that is nonetheless part of the digest, so the human confirms the
 * profile and the autonomy policy too, not just the prose.
 */
const teresaWorkOrderBody = z.object({
  projectId: z.string().trim().min(1),
  goal: z.string().min(1),
  scope: z.array(z.string()).min(1),
  expectedOutcome: z.string().min(1),
  constraints: z.array(z.string()).nullable().optional(),
  successCriteria: z.array(z.string()).nullable().optional(),
  contractedClosureType: teresaClosureTypeEnum,
  caseProfile: z.enum(['LIGHT', 'STANDARD', 'TRANSFORMATION', 'MONITORING']).nullable().optional(),
  governanceTier: z.enum(['LIGHTWEIGHT', 'STANDARD', 'CONTROLLED']).nullable().optional(),
  autonomyPolicy: z
    .enum(['ASK_EACH_ACTION', 'ASK_MATERIAL_ACTIONS', 'EXECUTE_APPROVED_PLAN'])
    .nullable()
    .optional(),
  sourceMessageId: z.string().trim().min(1).nullable().optional(),
});

const teresaConversationParams = z.object({ conversationId: z.string().trim().min(1) });

const teresaConfirmBody = z.object({
  confirmedDigest: z
    .string()
    .trim()
    .regex(/^sha256:[0-9a-f]{64}$/, 'confirmedDigest must be sha256:<64 hex chars>'),
});

/**
 * POST /case-intake/conversations/:conversationId/summary
 *
 * "Here is exactly what I understood you want." Records that this summary was
 * SHOWN and returns it with its digest. Creates ZERO Cases and ZERO Runs.
 * 200, not 201 — nothing was created.
 */
router.post(
  '/case-intake/conversations/:conversationId/summary',
  verifyToken,
  attachV8Context,
  caseWorkspaceHandler(async (req, res, actor) => {
    const { conversationId } = parseParams(teresaConversationParams, req.params);
    const workOrder = parseBody(teresaWorkOrderBody, req.body);

    const proposal = await caseIntakeService.proposeConversationWorkOrder({
      conversationId,
      workOrder: { ...workOrder, organizationId: actor.organizationId },
      proposedByActorId: actor.actorUserId,
      correlationId: actor.correlationId,
    });

    res.status(200).json({
      data: {
        conversationId,
        // The digested object, not the request body.
        workOrder: proposal.workOrder,
        workOrderId: proposal.workOrderId,
        workOrderDigest: proposal.workOrderDigest,
        alreadyProposed: proposal.alreadyProposed,
        runStartPolicy: proposal.runStartPolicy,
        caseCreated: false,
        runCreated: false,
      },
      meta: teresaMeta({ action: 'case_intake_work_order_proposed' }),
    });
  })
);

/** GET /case-intake/conversations/:conversationId/work-order — current summary. */
router.get(
  '/case-intake/conversations/:conversationId/work-order',
  verifyToken,
  attachV8Context,
  caseWorkspaceHandler(async (req, res, actor) => {
    const { conversationId } = parseParams(teresaConversationParams, req.params);
    const current = await caseIntakeService.getCurrentConversationWorkOrder({
      conversationId,
      organizationId: actor.organizationId,
      actorUserId: actor.actorUserId,
    });
    res.status(200).json({ data: current, meta: teresaMeta({ action: 'case_intake_current' }) });
  })
);

/**
 * POST /case-intake/conversations/:conversationId/confirm
 * 201 when this call created the Case, 200 on any reuse (refresh, retry, race).
 */
router.post(
  '/case-intake/conversations/:conversationId/confirm',
  verifyToken,
  attachV8Context,
  caseWorkspaceHandler(async (req, res, actor) => {
    const { conversationId } = parseParams(teresaConversationParams, req.params);
    const body = parseBody(teresaConfirmBody, req.body);

    const result = await caseIntakeService.confirmConversationWorkOrder({
      conversationId,
      organizationId: actor.organizationId,
      confirmedDigest: body.confirmedDigest,
      confirmedByActorId: actor.actorUserId,
      correlationId: actor.correlationId,
    });

    res.status(result.caseCreated ? 201 : 200).json({
      data: result,
      meta: teresaMeta({ action: 'case_intake_work_order_confirmed' }),
    });
  })
);

/** GET /case-intake/conversations/:conversationId/case — conversation -> Case. */
router.get(
  '/case-intake/conversations/:conversationId/case',
  verifyToken,
  attachV8Context,
  caseWorkspaceHandler(async (req, res, actor) => {
    const { conversationId } = parseParams(teresaConversationParams, req.params);
    const link = await caseIntakeService.findCaseForConversation({
      conversationId,
      organizationId: actor.organizationId,
      actorUserId: actor.actorUserId,
    });
    res.status(200).json({ data: link, meta: teresaMeta({ action: 'case_intake_link' }) });
  })
);

/** GET /case-intake/cases/:caseId/conversation — Case -> conversation. */
router.get(
  '/case-intake/cases/:caseId/conversation',
  verifyToken,
  attachV8Context,
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ caseId: z.string().trim().min(1) }), req.params);
    const link = await caseIntakeService.findConversationForCase(params.caseId, actor.actorUserId);
    res.status(200).json({ data: link, meta: teresaMeta({ action: 'case_intake_link' }) });
  })
);

export default router;
