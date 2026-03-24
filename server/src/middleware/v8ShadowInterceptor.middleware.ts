import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

import type { AuthRequest } from './auth.middleware.js';
import { recordShadowComparison } from '../services/v8/shadowModeService.js';
import Logger from '../utils/Logger.js';

const LOG_PREFIX = '[v8:shadow]';

interface ShadowRouteMapping {
  legacyPattern: RegExp;
  v8Path: string;
  method: string;
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
  },
  {
    legacyPattern: /^\/health$/,
    v8Path: '/health',
    method: 'GET',
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

  let orgId = req.organizationId;
  if (!orgId) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const decoded = jwt.decode(authHeader.slice(7)) as { organizationId?: string } | null;
        orgId = decoded?.organizationId;
      }
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
    (m) => m.legacyPattern.test(originalPath) && m.method === method,
  );

  if (!mapping) {
    next();
    return;
  }

  // Capture the legacy response
  const legacyStart = Date.now();
  const originalJson = res.json.bind(res);
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
      legacyBody,
      legacyStatus,
      legacyTimeMs: Date.now() - legacyStart,
      token: req.headers.authorization || '',
    }).catch((err: Error) => {
      Logger.warn(`${LOG_PREFIX} Shadow comparison failed: ${err.message}`);
    });

    return originalJson(body);
  } as typeof res.json;

  next();
}

async function callV8AndRecord(params: {
  orgId: string;
  endpoint: string;
  method: string;
  v8Path: string;
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
    const v8Res = await fetch(`${baseUrl}/api/v8${params.v8Path}`, {
      method: params.method,
      headers: {
        Authorization: params.token,
        'Content-Type': 'application/json',
      },
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
    legacyResponseBody: params.legacyBody,
    v8ResponseBody: v8Body,
  });

  Logger.info(`${LOG_PREFIX} Comparison recorded: ${params.endpoint} legacy=${params.legacyStatus} v8=${v8Status}`);
}

export default v8ShadowInterceptor;
