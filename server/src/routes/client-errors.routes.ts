/**
 * Client Error Telemetry Endpoint (#24b)
 *
 * Receives app-level crash reports from the frontend ErrorBoundary
 * (POST /api/errors) and records them server-side so "Crash diagnostics
 * could not be delivered" stops being the default outcome.
 *
 * Intentionally:
 *  - unauthenticated (crashes can happen before/around auth)
 *  - best-effort + payload-capped (never throws back at the client)
 *  - log-only sink (no DB write) to stay dependency-free; swap the logger
 *    call for an observability pipeline when one is wired.
 */

import { Request, Response, Router } from 'express';

import logger from '../utils/Logger.js';

const router = Router();

const MAX_FIELD = 8_000;

const clamp = (value: unknown, max = MAX_FIELD): string | null => {
  if (typeof value !== 'string') return null;
  return value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
};

/**
 * POST /api/errors
 * Body: { message, stack?, componentStack?, url?, userAgent? }
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const correlationId =
      (req as Request & { correlationId?: string }).correlationId ||
      req.get('X-Correlation-ID') ||
      null;

    logger.error('[ClientError] App-level crash reported', {
      message: clamp(body.message, 500) || 'unknown',
      stack: clamp(body.stack),
      componentStack: clamp(body.componentStack),
      url: clamp(body.url, 500) || req.get('Referer') || null,
      userAgent: clamp(body.userAgent, 500) || req.get('User-Agent') || null,
      correlationId,
      receivedAt: new Date().toISOString(),
    });

    // 204: delivered, nothing to return.
    res.status(204).end();
  } catch (error) {
    // Telemetry must never become a second failure surface.
    logger.warn('[ClientError] Failed to record client crash report', error);
    res.status(202).json({ status: 'accepted-with-warning' });
  }
});

export default router;
