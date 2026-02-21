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

const SKIP_PATHS = ['/api/health', '/favicon.ico', '/api/analytics/journey'];

export function apiLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const correlationId = uuidv4();
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  if (SKIP_PATHS.some(p => req.path.startsWith(p))) { next(); return; }

  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const responseTime = Date.now() - start;
    const authReq = req as AuthRequest;
    dbRun(
      `INSERT INTO api_logs (id, endpoint, method, status_code, response_time_ms, user_id, organization_id, correlation_id, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [uuidv4(), req.path.substring(0, 255), req.method, res.statusCode, responseTime,
       authReq.user?.id || null, authReq.user?.organizationId || null, correlationId,
       res.statusCode >= 400 ? (res.statusMessage || '').substring(0, 500) : null]
    ).catch(err => logger.warn('Failed to write api_log:', err));
    return originalEnd.apply(this, args as any);
  } as any;
  next();
}

export default apiLoggingMiddleware;
