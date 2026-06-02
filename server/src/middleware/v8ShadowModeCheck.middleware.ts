import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

import { isV8ShadowMode } from '../services/v8/featureFlagService.js';
import Logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

/**
 * Lightweight middleware that checks if shadow mode is active for the org
 * and sets `req.v8ShadowMode`. Designed to be mounted on legacy route
 * prefixes (e.g. `/api/ai`) BEFORE the shadow interceptor, so the
 * interceptor can decide whether to fire a V8 comparison.
 *
 * Unlike v8FeatureGate, this middleware NEVER blocks the request —
 * it only annotates it. If the check fails, shadow mode is silently off.
 *
 * Because this runs before verifyToken on legacy routes, it extracts
 * organizationId directly from the JWT without full auth validation.
 */
export async function v8ShadowModeCheck(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const MAX_AUTH_HEADER_LENGTH = 8192;
  const MAX_JWT_SEGMENT_LENGTH = 2048;
  const MAX_ORG_ID_LENGTH = 256;
  const safeRead = <T>(reader: () => T, fallback: T): T => {
    try {
      const value = reader();
      return value === undefined || value === null ? fallback : value;
    } catch {
      return fallback;
    }
  };
  const sanitizeOrgId = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_ORG_ID_LENGTH) return '';
    return trimmed;
  };

  let orgId = sanitizeOrgId(
    safeRead(() => req.organizationId, '') ||
      safeRead(() => (req as any).organizationId, '') ||
      safeRead(() => (req as any).user?.organizationId, '') ||
      safeRead(() => (req as any).user?.organization_id, '')
  );

  if (!orgId) {
    try {
      const authHeader = safeRead(() => req.headers.authorization, '');
      if (typeof authHeader === 'string' && authHeader.length <= MAX_AUTH_HEADER_LENGTH) {
        const trimmedHeader = authHeader.trim();
        if (trimmedHeader.startsWith('Bearer ')) {
          const token = trimmedHeader.slice(7).trim();
          const segments = token.split('.');
          if (
            segments.length === 3 &&
            segments.every(
              (segment) => segment.length > 0 && segment.length <= MAX_JWT_SEGMENT_LENGTH
            )
          ) {
            const decoded = jwt.decode(token) as { organizationId?: string } | string | null;
            if (decoded && typeof decoded === 'object') {
              orgId = sanitizeOrgId((decoded as { organizationId?: unknown }).organizationId);
            }
          }
        }
      }
    } catch {
      // ignore — shadow mode just won't fire
    }
  }

  if (!orgId) {
    (req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode = false;
    next();
    return;
  }

  try {
    (req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode = await isV8ShadowMode(orgId);
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : String(err)).replace(/\s+/g, ' ').trim();
    Logger.warn(`[v8:shadow-check] Failed shadow lookup orgId=${orgId} err=${msg}`);
    (req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode = false;
  }

  next();
}

export default v8ShadowModeCheck;
