import { Router } from 'express';
import { z } from 'zod';

import { verifyToken } from '../../middleware/auth.middleware.js';
import {
  mintGeminiLiveEphemeralToken,
  resolveGeminiLiveServerKey,
} from '../../services/ai/geminiLiveTokenService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

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
    const hasServerKey = Boolean(resolveGeminiLiveServerKey());
    const voiceName = String(process.env.TERESA_VOICE_NAME || 'Kore').trim() || 'Kore';
    const model =
      String(process.env.TERESA_VOICE_MODEL || '').trim() ||
      'gemini-2.5-flash-native-audio-preview-09-2025';
    const enabledByFlag =
      String(process.env.TERESA_VOICE_ENABLED || 'true').toLowerCase() !== 'false';
    const session =
      hasServerKey && enabledByFlag
        ? await mintGeminiLiveEphemeralToken({
            assistant: 'teresa',
            subjectKey: String(req.userId || req.user?.id || req.organizationId || 'unknown'),
          })
        : null;
    const enabled = Boolean(session) && enabledByFlag;

    return res.json({
      assistant: 'teresa',
      surface: 'workspace_copilot',
      capability: 'voice',
      enabled,
      model,
      voiceName,
      session: enabled ? session : null,
      unavailableReason: enabled
        ? null
        : !enabledByFlag
          ? 'server_disabled'
          : hasServerKey
            ? 'server_voice_proxy_required'
            : 'server_missing_gemini_live_key',
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

export default router;
