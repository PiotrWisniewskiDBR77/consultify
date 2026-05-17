import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import verifyToken, { requireOrganization } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

/**
 * Teresa realtime voice configuration for authenticated app surfaces.
 *
 * Security: the API key must NOT be embedded in the frontend bundle.
 * We expose it only to authenticated users and rely on standard cookie/session auth.
 */
const router = Router();

const normalizeTelemetryField = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const isPlaceholderApiKey = (value: string): boolean =>
  value.startsWith('sk-demo-') ||
  value.toLowerCase().includes('placeholder') ||
  value === 'YOUR_GEMINI_API_KEY_HERE' ||
  value === 'YOUR_OPENAI_API_KEY_HERE';

const stripInvisibleFormatting = (value: string): string =>
  value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

const resolveVoiceApiKey = (): string => {
  const candidates = [process.env.GEMINI_API_KEY, process.env.GOOGLE_AI_API_KEY];
  for (const rawCandidate of candidates) {
    const candidate = stripInvisibleFormatting(String(rawCandidate || ''));
    if (!candidate || isPlaceholderApiKey(candidate)) {
      continue;
    }
    return candidate;
  }
  return '';
};

const TELEMETRY_FIELD_MAX_LENGTH = 256;
const capTelemetryField = (value: string): string =>
  value.length > TELEMETRY_FIELD_MAX_LENGTH ? value.slice(0, TELEMETRY_FIELD_MAX_LENGTH) : value;

router.use(verifyToken);
router.use(requireOrganization);

router.get(
  '/voice-config',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const apiKey = resolveVoiceApiKey();
    const voiceName = stripInvisibleFormatting(String(process.env.TERESA_VOICE_NAME || '')) || null;
    const enabled = Boolean(apiKey);

    return res
      .status(200)
      .set('Cache-Control', 'no-store')
      .set('Pragma', 'no-cache')
      .json({
        enabled,
        apiKey: enabled ? apiKey : null,
        voiceName,
      });
  })
);

/**
 * Optional telemetry seam for Teresa voice lifecycle.
 * Kept intentionally lightweight and non-blocking.
 */
router.post(
  '/voice-event',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};

    const event = capTelemetryField(normalizeTelemetryField(body.event));
    const sessionId = capTelemetryField(normalizeTelemetryField(body.sessionId));

    logger.info('[V10 Teresa Voice] Event received', {
      event: event || 'unknown',
      hasSessionId: Boolean(sessionId),
      userId: req.userId || req.user?.id || null,
      organizationId: req.organizationId || req.user?.organizationId || null,
    });

    return res.status(202).json({
      accepted: true,
      event: event || 'unknown',
    });
  })
);

export default router;
