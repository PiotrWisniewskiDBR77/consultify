/**
 * API Logging Middleware — T113
 * Logs requests to api_logs table (no PII)
 */

import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

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
const stripRouteQueryAndFragment = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const hashIndex = value.indexOf('#');
  const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const queryIndex = withoutHash.indexOf('?');
  return queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
};

const readRequestPath = (req: Request): string =>
  normalizeOptionalString(safeRead(() => req.path, undefined)) ||
  normalizeOptionalString(stripRouteQueryAndFragment(safeRead(() => req.originalUrl, undefined))) ||
  normalizeOptionalString(stripRouteQueryAndFragment(safeRead(() => req.url, undefined))) ||
  '';

const readRequestMethod = (req: Request): string =>
  (normalizeOptionalString(safeRead(() => req.method, undefined)) || '').toUpperCase();
const capLoggedString = (value: string | null, maxChars: number): string | null =>
  typeof value === 'string' ? value.substring(0, maxChars) : null;

const safeGetHeader = (req: Request, header: string): string | undefined =>
  normalizeOptionalString(safeRead(() => req.get?.(header), undefined));

const safeGetResponseHeader = (res: Response, header: string): unknown =>
  safeRead(() => res.getHeader(header), undefined);

const safeSetResponseHeader = (res: Response, header: string, value: string): void => {
  safeRead(() => {
    res.setHeader(header, value);
    return true;
  }, false);
};
const isResponseCommitted = (res: Response): boolean =>
  safeRead(
    () =>
      Boolean(
        res.headersSent ||
          (res as Response & { writableEnded?: boolean; writableFinished?: boolean; finished?: boolean; destroyed?: boolean })
            .writableEnded === true ||
          (res as Response & { writableEnded?: boolean; writableFinished?: boolean; finished?: boolean; destroyed?: boolean })
            .writableFinished === true ||
          (res as Response & { writableEnded?: boolean; writableFinished?: boolean; finished?: boolean; destroyed?: boolean })
            .finished === true ||
          (res as Response & { writableEnded?: boolean; writableFinished?: boolean; finished?: boolean; destroyed?: boolean })
            .destroyed === true
      ),
    false
  );

const SKIP_PATH_PREFIXES = [
  '/api/health',
  '/api/system-health',
  '/api/llm/health',
  '/api/llm/providers/health',
  '/api/notifications',
  '/api/cloud/sources',
  '/favicon.ico',
  '/api/analytics/journey',
];

const RES_END_PATCHED = Symbol.for('consultify.apiLogging.endPatched');
const MAX_CORRELATION_ID_CHARS = 128;
const MAX_LOGGED_RESPONSE_TIME_MS = 86_400_000;
const MAX_LOGGED_METHOD_CHARS = 32;
const MAX_LOGGED_USER_ID_CHARS = 128;
const MAX_LOGGED_ORGANIZATION_ID_CHARS = 128;
const FALLBACK_CORRELATION_ID = '00000000-0000-4000-8000-000000000000';
const CORRELATION_ID_SAFE_PATTERN = /^[A-Za-z0-9._~-]+$/;
const sanitizeCorrelationId = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]+/g, '');
const sanitizeTelemetryText = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]+/g, '');
const coerceLoggedStatusCode = (raw: unknown): number => {
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(numeric)) return 200;
  const truncated = Math.trunc(numeric);
  if (truncated < 100) return 100;
  if (truncated > 999) return 999;
  return truncated;
};

function shouldSkipApiLog(pathname: string): boolean {
  return SKIP_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

// Disable DB logging when DISABLE_API_LOGGING=true or during automated tests.
// Test databases often omit non-critical observability tables like api_logs.
function isDbLoggingDisabled(): boolean {
  return process.env.DISABLE_API_LOGGING === 'true' || process.env.NODE_ENV === 'test';
}

export function apiLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const correlationIdRaw =
    normalizeOptionalString(safeRead(() => (req as any).correlationId, undefined)) ||
    safeGetHeader(req, 'X-Correlation-ID') ||
    safeRead(() => uuidv4(), FALLBACK_CORRELATION_ID);
  let correlationId = sanitizeCorrelationId(correlationIdRaw).slice(0, MAX_CORRELATION_ID_CHARS);
  if (!normalizeOptionalString(correlationId) || !CORRELATION_ID_SAFE_PATTERN.test(correlationId)) {
    const regenerated = safeRead(() => uuidv4(), FALLBACK_CORRELATION_ID);
    correlationId = sanitizeCorrelationId(regenerated).slice(0, MAX_CORRELATION_ID_CHARS);
  }
  safeRead(() => {
    (req as any).correlationId = correlationId;
    return true;
  }, false);
  if (!isResponseCommitted(res) && !safeGetResponseHeader(res, 'X-Correlation-ID')) {
    safeSetResponseHeader(res, 'X-Correlation-ID', correlationId);
  }

  const requestPath = readRequestPath(req);
  if (isDbLoggingDisabled() || shouldSkipApiLog(requestPath)) {
    next();
    return;
  }

  if (safeRead(() => Boolean((res as Response & { [RES_END_PATCHED]?: boolean })[RES_END_PATCHED]), false)) {
    next();
    return;
  }
  const markerApplied = safeRead(() => {
    Object.defineProperty(res, RES_END_PATCHED, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return true;
  }, false);
  if (!markerApplied) {
    next();
    return;
  }

  const originalEnd = res.end;
  if (typeof originalEnd !== 'function') {
    next();
    return;
  }
  if (isResponseCommitted(res)) {
    next();
    return;
  }
  let persisted = false;
  const persistApiLog = (): void => {
    if (persisted) return;
    const responseTime = Math.min(MAX_LOGGED_RESPONSE_TIME_MS, Math.max(0, Date.now() - start));
    const statusCode = coerceLoggedStatusCode(safeRead(() => res.statusCode, 200));
    const shouldPersist =
      readRequestMethod(req) !== 'GET' || statusCode >= 400 || responseTime >= 500;
    if (!shouldPersist) return;
    // Mark as persisted before assembly/writes to prevent duplicate insert attempts across end/finish handlers.
    persisted = true;
    const authReq = req as AuthRequest;
    const userId = normalizeOptionalString(safeRead(() => authReq.user?.id, undefined)) || null;
    const organizationId =
      normalizeOptionalString(
        safeRead(() => (req as Request & { organizationId?: string }).organizationId, undefined)
      ) ||
      normalizeOptionalString(safeRead(() => authReq.user?.organizationId, undefined)) ||
      normalizeOptionalString(
        safeRead(
          () => (authReq.user as { organization_id?: string } | undefined)?.organization_id,
          undefined
        )
      ) ||
      null;
    dbRun(
      `INSERT INTO api_logs (id, endpoint, method, status_code, response_time_ms, user_id, organization_id, correlation_id, error_message, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        safeRead(() => uuidv4(), FALLBACK_CORRELATION_ID),
        sanitizeTelemetryText(requestPath).substring(0, 255),
        readRequestMethod(req).substring(0, MAX_LOGGED_METHOD_CHARS),
        statusCode,
        responseTime,
        capLoggedString(userId, MAX_LOGGED_USER_ID_CHARS),
        capLoggedString(organizationId, MAX_LOGGED_ORGANIZATION_ID_CHARS),
        correlationId,
        statusCode >= 400
          ? (() => {
              const normalizedStatusMessage =
                normalizeOptionalString(safeRead(() => res.statusMessage, undefined)) || '';
              const cleanedStatusMessage = sanitizeTelemetryText(normalizedStatusMessage).trim();
              return cleanedStatusMessage ? cleanedStatusMessage.substring(0, 500) : null;
            })()
          : null,
      ]
    ).catch((err) => logger.warn('Failed to write api_log:', err));
  };
  res.end = function (this: Response, ...args: any[]) {
    try {
      persistApiLog();
    } catch {
      // Fail-open: observability must never break API responses.
    }
    return originalEnd.apply(res, args as any);
  } as any;
  safeRead(() => {
    if (typeof (res as Response & { once?: (event: string, listener: () => void) => unknown }).once !== 'function') {
      return false;
    }
    (res as Response & { once: (event: string, listener: () => void) => unknown }).once('finish', () => {
      safeRead(() => {
        persistApiLog();
        return true;
      }, false);
    });
    return true;
  }, false);
  next();
}

export default apiLoggingMiddleware;
