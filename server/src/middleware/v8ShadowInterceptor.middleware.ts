import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

import { recordShadowComparison } from '../services/v8/shadowModeService.js';
import Logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

const LOG_PREFIX = '[v8:shadow]';
const MAX_AUTH_HEADER_LENGTH = 8192;
const MAX_JWT_SEGMENT_LENGTH = 2048;
const MAX_ORG_ID_LENGTH = 256;
const MAX_V8_RESPONSE_TEXT_BYTES = 512_000;
const MAX_V8_RESPONSE_BODY_CHARS = 262_144;

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

const decodeOrgFromBearer = (authorization: unknown): string => {
  if (typeof authorization !== 'string' || authorization.length > MAX_AUTH_HEADER_LENGTH) return '';
  const trimmed = authorization.trim();
  if (!trimmed.startsWith('Bearer ')) return '';
  const token = trimmed.slice(7).trim();
  const segments = token.split('.');
  if (
    segments.length !== 3 ||
    segments.some((segment) => segment.length === 0 || segment.length > MAX_JWT_SEGMENT_LENGTH)
  ) {
    return '';
  }
  const decoded = jwt.decode(token) as { organizationId?: string } | string | null;
  if (!decoded || typeof decoded !== 'object') return '';
  return sanitizeOrgId((decoded as { organizationId?: unknown }).organizationId);
};

function clampShadowResponseBody(value: unknown): unknown {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') return value;
    if (serialized.length <= MAX_V8_RESPONSE_BODY_CHARS) return value;
    return {
      __shadowOversizedResponse: true,
      originalLength: serialized.length,
    };
  } catch {
    return {
      __shadowOversizedResponse: true,
      reason: 'non_serializable',
    };
  }
}

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
  if (!(req as AuthRequest & { v8ShadowMode?: boolean }).v8ShadowMode) {
    next();
    return;
  }

  let orgId = sanitizeOrgId(safeRead(() => req.organizationId, ''));
  const authorizationHeader = safeRead(() => req.headers.authorization, '');
  if (
    typeof authorizationHeader === 'string' &&
    authorizationHeader.length > MAX_AUTH_HEADER_LENGTH
  ) {
    next();
    return;
  }

  if (!orgId) {
    try {
      orgId = decodeOrgFromBearer(authorizationHeader);
    } catch {
      // ignore
    }
  }
  if (!orgId) {
    next();
    return;
  }

  const originalPath = req.path;
  const method = req.method;

  // Check if this route has a V8 shadow mapping
  const mapping = SHADOW_ROUTE_MAPPINGS.find(
    (m) => m.legacyPattern.test(originalPath) && m.method === method
  );

  if (!mapping) {
    next();
    return;
  }

  // Capture the legacy response
  const legacyStart = Date.now();
  if ((res as any).headersSent) {
    next();
    return;
  }
  const rawJson = safeRead(() => res.json, null);
  if (typeof rawJson !== 'function') {
    next();
    return;
  }
  const originalJson = (() => {
    try {
      return rawJson.bind(res);
    } catch {
      return (...args: unknown[]) => rawJson.apply(res, args as any);
    }
  })();
  let legacyBody: unknown = null;
  let legacyStatus = 200;

  res.json = function (body: unknown) {
    legacyBody = body;
    legacyStatus = res.statusCode;

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
      token: typeof authorizationHeader === 'string' ? authorizationHeader.trim() : '',
    }).catch((err: Error) => {
      Logger.warn(`${LOG_PREFIX} Shadow comparison failed: ${err.message}`);
    });

    const result = originalJson(body);
    res.json = originalJson as typeof res.json;
    return result;
  } as typeof res.json;

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
    const requestHeaders: Record<string, string> = {};
    if (params.token) {
      requestHeaders.Authorization = params.token;
    }
    if (params.method !== 'GET' && params.method !== 'HEAD') {
      requestHeaders['Content-Type'] = 'application/json';
    }
    const v8Res = await fetch(`${baseUrl}/api/v8${params.v8Path}`, {
      method: params.method,
      headers: requestHeaders,
    });

    v8Status = v8Res.status;
    try {
      const responseText = await v8Res.text();
      if (responseText.length > MAX_V8_RESPONSE_TEXT_BYTES) {
        v8Body = {
          __shadowTruncatedResponse: true,
          originalLength: responseText.length,
        };
      } else if (!responseText) {
        v8Body = null;
      } else {
        try {
          v8Body = JSON.parse(responseText);
        } catch {
          v8Body = responseText;
        }
      }
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
    legacyResponseBody: params.legacyBody,
    v8ResponseBody: clampShadowResponseBody(v8Body),
    comparisonMode: params.comparisonMode,
  });

  Logger.info(
    `${LOG_PREFIX} Comparison recorded: ${params.endpoint} legacy=${params.legacyStatus} v8=${v8Status}`
  );
}

export default v8ShadowInterceptor;
