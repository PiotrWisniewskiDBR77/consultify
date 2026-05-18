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

function shouldSkipApiLog(pathname: string): boolean {
  return SKIP_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

// Disable DB logging when DISABLE_API_LOGGING=true (avoids slow INSERT on remote DB)
const DB_LOGGING_DISABLED = process.env.DISABLE_API_LOGGING === 'true';
const END_PATCHED_SYMBOL = Symbol.for('consultify.apiLogging.endPatched');
const CORRELATION_ID_MAX_LENGTH = 128;
const ENDPOINT_MAX_LENGTH = 255;
const METHOD_MAX_LENGTH = 32;
const STATUS_MESSAGE_MAX_LENGTH = 500;
const USER_ID_MAX_LENGTH = 128;
const ORG_ID_MAX_LENGTH = 128;
const RESPONSE_TIME_MAX_MS = 86_400_000;

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._~-]+$/;

function safeNow(): number {
  try {
    const now = Date.now();
    return Number.isFinite(now) ? now : 0;
  } catch {
    return 0;
  }
}

function safeValue<T>(reader: () => T, fallback: T): T {
  try {
    const value = reader();
    return value === undefined || value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function sanitizeString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  let cleaned = '';
  for (const char of value) {
    const code = char.codePointAt(0);
    if (typeof code !== 'number') continue;
    if ((code >= 0 && code <= 31) || code === 127) continue;
    cleaned += char;
    if (cleaned.length >= maxLength) break;
  }
  return cleaned;
}

function sanitizeEndpoint(value: unknown): string {
  const raw = sanitizeString(value, ENDPOINT_MAX_LENGTH * 2);
  const noQuery = raw.split('?')[0] ?? '';
  const noFragment = noQuery.split('#')[0] ?? '';
  return noFragment.slice(0, ENDPOINT_MAX_LENGTH);
}

function sanitizeCorrelationId(value: unknown): string {
  const normalized = sanitizeString(value, CORRELATION_ID_MAX_LENGTH).trim();
  if (!normalized || !SAFE_CORRELATION_ID.test(normalized)) return '';
  return normalized;
}

function safeUuid(): string {
  try {
    return uuidv4();
  } catch {
    return '00000000-0000-4000-8000-000000000000';
  }
}

function tryWarn(...args: unknown[]): void {
  try {
    (logger as any).warn?.(...args);
  } catch {
    // Never surface logger failures to request lifecycle.
  }
}

function resolveCorrelationId(req: Request): string {
  const existing = sanitizeCorrelationId(safeValue(() => (req as any).correlationId, ''));
  if (existing) return existing;

  const headerValue = safeValue(() => req.get('X-Correlation-ID'), '');
  const fromHeader = sanitizeCorrelationId(headerValue);
  if (fromHeader) return fromHeader;

  return safeUuid();
}

function coerceStatusCode(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 200;
}

function computeResponseTime(start: number): number {
  const diff = safeNow() - start;
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.min(diff, RESPONSE_TIME_MAX_MS);
}

export function apiLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = safeNow();
  const correlationId = resolveCorrelationId(req);
  (req as any).correlationId = correlationId;
  if (!(res as any).headersSent) {
    const hasHeader = safeValue(() => res.getHeader('X-Correlation-ID'), undefined);
    if (!hasHeader) {
      try {
        res.setHeader('X-Correlation-ID', correlationId);
      } catch {
        // Ignore header write failures.
      }
    }
  }

  const endpoint = sanitizeEndpoint(
    safeValue(
      () => req.path,
      safeValue(() => (req as any).originalUrl, '')
    )
  );

  if (DB_LOGGING_DISABLED || shouldSkipApiLog(endpoint)) {
    next();
    return;
  }

  if ((res as any).writableEnded || ((res as any).headersSent && !(res as any).writable)) {
    next();
    return;
  }

  if (typeof (res as any).end !== 'function') {
    next();
    return;
  }

  if ((res as any)[END_PATCHED_SYMBOL]) {
    next();
    return;
  }

  try {
    Object.defineProperty(res, END_PATCHED_SYMBOL, {
      value: true,
      enumerable: false,
      configurable: true,
    });
  } catch {
    next();
    return;
  }

  const originalEnd = res.end;
  const boundOriginalEnd = (() => {
    try {
      return originalEnd.bind(res);
    } catch {
      return (...args: any[]) => originalEnd.apply(res, args as any);
    }
  })();

  let persisted = false;
  const persistOnce = () => {
    if (persisted) return;
    persisted = true;

    const statusCode = coerceStatusCode(safeValue(() => res.statusCode, 200));
    const responseTime = computeResponseTime(start);
    const shouldPersist =
      safeValue(() => req.method, 'GET') !== 'GET' || statusCode >= 400 || responseTime >= 500;

    if (!shouldPersist) {
      return;
    }

    let userId: string | null = null;
    let organizationId: string | null = null;
    try {
      const authReq = req as AuthRequest;
      userId = sanitizeString(authReq.user?.id, USER_ID_MAX_LENGTH) || null;
      organizationId = sanitizeString(authReq.user?.organizationId, ORG_ID_MAX_LENGTH) || null;
    } catch {
      userId = null;
      organizationId = null;
    }
    if (!organizationId) {
      organizationId =
        sanitizeString(
          safeValue(() => (req as any).organizationId, ''),
          ORG_ID_MAX_LENGTH
        ) || null;
    }

    dbRun(
      `INSERT INTO api_logs (id, endpoint, method, status_code, response_time_ms, user_id, organization_id, correlation_id, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        safeUuid(),
        endpoint,
        sanitizeString(
          safeValue(() => req.method, ''),
          METHOD_MAX_LENGTH
        ),
        statusCode,
        responseTime,
        userId,
        organizationId,
        correlationId,
        statusCode >= 400
          ? sanitizeString(
              safeValue(() => res.statusMessage, ''),
              STATUS_MESSAGE_MAX_LENGTH
            ) || null
          : null,
      ]
    ).catch((err) => tryWarn('Failed to write api_log:', err));
  };

  if (typeof (res as any).once === 'function') {
    try {
      (res as any).once('finish', persistOnce);
      (res as any).once('close', persistOnce);
    } catch {
      // ignore listener errors
    }
  }

  res.end = function (this: Response, ...args: any[]) {
    try {
      persistOnce();
    } catch (err) {
      tryWarn('Failed to write api_log:', err);
    }
    return boundOriginalEnd(...args);
  } as any;
  next();
}

export default apiLoggingMiddleware;
