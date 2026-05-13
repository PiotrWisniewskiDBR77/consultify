import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

import { isV8ShadowMode } from '../services/v8/featureFlagService.js';
import Logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const MAX_SHADOW_JWT_DECODE_CHARS = 8192;
const MAX_SHADOW_ORG_ID_CHARS = 256;
const MAX_SHADOW_AUTHORIZATION_HEADER_CHARS = 8256;
const MAX_SHADOW_ORG_SOURCE_READ_CHARS = 1024;
const isLikelyJwsCompact = (token: string): boolean => {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
};

const normalizeOptionalOrgCandidate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  if (value.length > MAX_SHADOW_ORG_SOURCE_READ_CHARS) return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

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
  let orgId =
    normalizeOptionalOrgCandidate(safeRead(() => req.organizationId, undefined)) ||
    normalizeOptionalOrgCandidate(safeRead(() => req.user?.organizationId, undefined)) ||
    normalizeOptionalOrgCandidate(
      safeRead(() => (req.user as { organization_id?: string } | undefined)?.organization_id, undefined)
    );

  if (!orgId) {
    try {
      const rawAuthHeader = safeRead(() => req.headers?.authorization, undefined as unknown);
      if (
        typeof rawAuthHeader === 'string' &&
        rawAuthHeader.length > MAX_SHADOW_AUTHORIZATION_HEADER_CHARS
      ) {
        (req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode = false;
        next();
        return;
      }
      const authHeader = normalizeOptionalString(rawAuthHeader);
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        if (
          token &&
          token.length <= MAX_SHADOW_JWT_DECODE_CHARS &&
          isLikelyJwsCompact(token)
        ) {
          const decodedRaw = jwt.decode(token);
          if (decodedRaw && typeof decodedRaw === 'object' && !Array.isArray(decodedRaw)) {
            const decoded = decodedRaw as
              | { organizationId?: string; organization_id?: string }
              | null;
            orgId =
              normalizeOptionalOrgCandidate(decoded?.organizationId) ||
              normalizeOptionalOrgCandidate(decoded?.organization_id);
          }
        }
      }
    } catch {
      // ignore — shadow mode just won't fire
    }
  }

  if (orgId && orgId.length > MAX_SHADOW_ORG_ID_CHARS) {
    (req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode = false;
    next();
    return;
  }

  if (!orgId) {
    (req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode = false;
    next();
    return;
  }

  try {
    (req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode = await isV8ShadowMode(orgId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    Logger.warn(`[v8:shadow-check] Failed to check shadow mode for ${orgId}: ${msg}`);
    (req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode = false;
  }

  next();
}

export default v8ShadowModeCheck;
