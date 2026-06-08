import { Router } from 'express';
import { z } from 'zod';

import { verifyToken } from '../../middleware/auth.middleware.js';
import {
  isTeresaTtsConfigured,
  synthesizeTeresaSpeech,
  TeresaTtsUnavailableError,
} from '../../services/ai/teresaTtsService.js';
import { resolveVoiceRuntime } from '../../services/ai/voiceRuntimeService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

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
    const runtime = await resolveVoiceRuntime({
      assistant: 'teresa',
      subjectKey: String(req.userId || req.user?.id || req.organizationId || 'unknown'),
      // Teresa workspace voice is governed by deployment env (TERESA_VOICE_*),
      // not the public worker catalog. A stray worker row must not disable it.
      enableSource: 'env',
    });
    const enabled = runtime.enabled;

    return res.json({
      assistant: 'teresa',
      surface: 'workspace_copilot',
      capability: 'voice',
      enabled,
      model: runtime.model,
      voiceName: runtime.voiceName || 'Kore',
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

export default router;
