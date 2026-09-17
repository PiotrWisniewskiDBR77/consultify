import type { NextFunction, Request, Response } from 'express';

import { isChatImagesEnabled } from '../../config/FeatureFlags.js';

export type LegacyChatImageGateResult = {
  status: 404 | 422;
  body: { code: 'CHAT_IMAGES_DISABLED' | 'CHAT_IMAGES_UNSUPPORTED_ON_LEGACY_CHAT'; error: string };
};

/**
 * The legacy orchestrator route has no multimodal transport. Inspect the raw
 * body before validateBody strips unknown fields, and fail explicitly rather
 * than silently discarding an image.
 */
export function getLegacyChatImageGateResult(
  rawBody: unknown,
  imagesEnabled: boolean
): LegacyChatImageGateResult | null {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) return null;
  const body = rawBody as Record<string, unknown>;
  const context =
    body.context && typeof body.context === 'object' && !Array.isArray(body.context)
      ? (body.context as Record<string, unknown>)
      : {};
  const candidates = [body.chatImages, body.images, context.chatImages, context.images];
  const hasImages = candidates.some(
    (candidate) => Array.isArray(candidate) && candidate.length > 0
  );
  if (!hasImages) return null;

  if (!imagesEnabled) {
    return {
      status: 404,
      body: { code: 'CHAT_IMAGES_DISABLED', error: 'CHAT_IMAGES_DISABLED' },
    };
  }
  return {
    status: 422,
    body: {
      code: 'CHAT_IMAGES_UNSUPPORTED_ON_LEGACY_CHAT',
      error: 'CHAT_IMAGES_UNSUPPORTED_ON_LEGACY_CHAT',
    },
  };
}

export function guardLegacyChatImages(req: Request, res: Response, next: NextFunction) {
  const blocked = getLegacyChatImageGateResult(req.body, isChatImagesEnabled());
  if (blocked) return res.status(blocked.status).json(blocked.body);
  return next();
}
