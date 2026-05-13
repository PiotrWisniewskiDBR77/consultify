import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

import { recordShadowComparison } from '../services/v8/shadowModeService.js';
import Logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

const LOG_PREFIX = '[v8:shadow]';

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
const SHADOW_V8_FETCH_TIMEOUT_MS = 10_000;
const MAX_SHADOW_COMPARISON_JSON_CHARS = 256_000;
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

const readMethod = (req: AuthRequest): string =>
  normalizeOptionalString(safeRead(() => req.method, undefined)) || '';

const readPath = (req: AuthRequest): string =>
  normalizeOptionalString(safeRead(() => req.path, undefined)) ||
  normalizeOptionalString(safeRead(() => req.originalUrl, undefined)) ||
  '';

const clampBodyForShadowRecord = (
  comparisonMode: ShadowRouteMapping['comparisonMode'] | undefined,
  value: unknown
): unknown => {
  if (comparisonMode === 'exact-json') return value;
  try {
    const serialized = JSON.stringify(value ?? null);
    if (serialized.length <= MAX_SHADOW_COMPARISON_JSON_CHARS) return value ?? null;
    return {
      __shadowOversizedResponse: true,
      approxSerializedBytes: serialized.length,
      preview: serialized.slice(0, 2048),
    };
  } catch {
    return { __shadowNonSerializableResponse: true };
  }
};

interface ShadowRouteMapping {
  legacyPattern: RegExp;
  v8Path: string;
  method: string;
  comparisonMode?: 'exact-json' | 'health-status' | 'status-only';
}

/**
 * Legacy API path → V8 path under `/api/v8`.
 * Phase 1 (Tranche 04): first real mappings — read-only GET endpoints only.
 * POST/mutation mappings will be added after shadow pass proves stability.
 */
const SHADOW_ROUTE_MAPPINGS: ShadowRouteMapping[] = [
  {
    legacyPattern: /^\/context$/,
    v8Path: '/ai-core/environment',
    method: 'GET',
    comparisonMode: 'status-only',
  },
  {
    legacyPattern: /^\/health$/,
    v8Path: '/health',
    method: 'GET',
    comparisonMode: 'health-status',
  },
];

/**
 * Shadow mode interceptor middleware.
 * When shadow mode is active for the org, this middleware:
 * 1. Lets the legacy request proceed normally (user always gets legacy response)
 * 2. In the background, calls the V8 equivalent
 * 3. Records the comparison via shadowModeService
 *
 * This middleware should be mounted AFTER auth but BEFORE legacy route handlers.
 * It does NOT block or delay the legacy response.
 */
export function v8ShadowInterceptor(req: AuthRequest, res: Response, next: NextFunction): void {
  // Only intercept if shadow mode is active for this org
  if (!safeRead(() => (req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode, false)) {
    next();
    return;
  }

  const rawAuthorizationHeader = safeRead(() => req.headers?.authorization, undefined as unknown);
  if (
    typeof rawAuthorizationHeader === 'string' &&
    rawAuthorizationHeader.length > MAX_SHADOW_AUTHORIZATION_HEADER_CHARS
  ) {
    next();
    return;
  }

  let orgId =
    normalizeOptionalOrgCandidate(safeRead(() => req.organizationId, undefined)) ||
    normalizeOptionalOrgCandidate(safeRead(() => req.user?.organizationId, undefined)) ||
    normalizeOptionalOrgCandidate(
      safeRead(() => (req.user as { organization_id?: string } | undefined)?.organization_id, undefined)
    );
  if (!orgId) {
    try {
      const authHeader = normalizeOptionalString(safeRead(() => req.headers?.authorization, undefined));
      if (authHeader?.startsWith('Bearer ')) {
        const rawToken = authHeader.slice(7).trim();
        if (
          rawToken &&
          rawToken.length <= MAX_SHADOW_JWT_DECODE_CHARS &&
          isLikelyJwsCompact(rawToken)
        ) {
          const decodedRaw = jwt.decode(rawToken);
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
      // ignore
    }
  }
  if (!orgId) {
    next();
    return;
  }
  if (orgId.length > MAX_SHADOW_ORG_ID_CHARS) {
    next();
    return;
  }
  const authorizationHeader =
    normalizeOptionalString(safeRead(() => req.headers?.authorization, undefined)) || '';
  if (authorizationHeader.length > MAX_SHADOW_AUTHORIZATION_HEADER_CHARS) {
    next();
    return;
  }

  const originalPath = readPath(req);
  const method = readMethod(req);

  // Check if this route has a V8 shadow mapping
  const mapping = SHADOW_ROUTE_MAPPINGS.find(
    (m) => m.legacyPattern.test(originalPath) && m.method === method
  );

  if (!mapping) {
    next();
    return;
  }

  if (safeRead(() => res.headersSent, false)) {
    next();
    return;
  }

  // Capture the legacy response
  const legacyStart = Date.now();
  const originalJson = safeRead(() => res.json.bind(res), null as unknown as Response['json']);
  if (!originalJson) {
    next();
    return;
  }
  let legacyBody: unknown = null;
  let legacyStatus = safeRead(() => res.statusCode, 200);

  try {
    res.json = function (body: unknown) {
      legacyBody = body;
      legacyStatus = safeRead(() => res.statusCode, 200);

      // Fire-and-forget: call V8 endpoint and record comparison
      void callV8AndRecord({
        orgId,
        endpoint: originalPath,
        method,
        v8Path: mapping.v8Path,
        comparisonMode: mapping.comparisonMode,
        legacyBody,
        legacyStatus,
        legacyTimeMs: Date.now() - legacyStart,
        token: authorizationHeader,
      }).catch((err: Error) => {
        Logger.warn(`${LOG_PREFIX} Shadow comparison failed: ${err.message}`);
      });

      try {
        return originalJson(body);
      } finally {
        res.json = originalJson;
      }
    } as typeof res.json;
  } catch {
    // fail-open: shadow instrumentation must never block legacy response flow
  }

  next();
}

async function callV8AndRecord(params: {
  orgId: string;
  endpoint: string;
  method: string;
  v8Path: string;
  comparisonMode?: 'exact-json' | 'health-status' | 'status-only';
  legacyBody: unknown;
  legacyStatus: number;
  legacyTimeMs: number;
  token: string;
}): Promise<void> {
  const v8Start = Date.now();
  let v8Status = 500;
  let v8Body: unknown = null;

  try {
    // Internal call to V8 endpoint (same process, via HTTP)
    const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
    const v8Headers: Record<string, string> = {
      Authorization: params.token,
    };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(params.method.toUpperCase())) {
      v8Headers['Content-Type'] = 'application/json';
    }
    const v8Res = await fetch(`${baseUrl}/api/v8${params.v8Path}`, {
      method: params.method,
      headers: v8Headers,
      signal: AbortSignal.timeout(SHADOW_V8_FETCH_TIMEOUT_MS),
    });

    v8Status = v8Res.status;
    try {
      v8Body = await v8Res.json();
    } catch {
      v8Body = null;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    Logger.warn(`${LOG_PREFIX} V8 call failed: ${message}`);
    v8Body = { error: message };
  }

  const v8TimeMs = Date.now() - v8Start;

  await recordShadowComparison({
    organizationId: params.orgId,
    endpoint: params.endpoint,
    method: params.method,
    legacyStatusCode: params.legacyStatus,
    v8StatusCode: v8Status,
    legacyResponseTimeMs: params.legacyTimeMs,
    v8ResponseTimeMs: v8TimeMs,
    legacyResponseBody: clampBodyForShadowRecord(params.comparisonMode, params.legacyBody),
    v8ResponseBody: clampBodyForShadowRecord(params.comparisonMode, v8Body),
    comparisonMode: params.comparisonMode,
  });

  Logger.info(
    `${LOG_PREFIX} Comparison recorded: ${params.endpoint} legacy=${params.legacyStatus} v8=${v8Status}`
  );
}

export default v8ShadowInterceptor;
