import type { NextFunction, Request, Response } from 'express';

import { AppError, ValidationError } from '../types/index.js';

type HandlerError = Error & {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
};

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

function classifyError(err: HandlerError): {
  statusCode: number;
  error: string;
  code: string;
  details?: Record<string, unknown>;
} {
  const errorName = safeRead(() => err.name, '');
  const errorMessage = safeRead(() => err.message, '');

  if (err instanceof AppError || err.statusCode) {
    return {
      statusCode: err.statusCode || 500,
      error: errorMessage || 'Application error',
      code: err.code || 'ERROR',
      details: err.details,
    };
  }

  if (errorName === 'JsonWebTokenError') {
    return { statusCode: 401, error: 'Invalid token', code: 'INVALID_TOKEN' };
  }

  if (errorName === 'TokenExpiredError') {
    return { statusCode: 401, error: 'Token expired', code: 'TOKEN_EXPIRED' };
  }

  if (/validation/i.test(errorName) || /validation/i.test(errorMessage)) {
    return { statusCode: 400, error: errorMessage || 'Validation failed', code: 'VALIDATION_ERROR' };
  }

  if (/ECONNREFUSED|ETIMEDOUT|ECONNRESET/i.test(errorMessage)) {
    return { statusCode: 503, error: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' };
  }

  return { statusCode: 500, error: 'Internal server error', code: 'INTERNAL_ERROR' };
}

function sanitizeHttpStatus(statusCode: number): number {
  if (!Number.isFinite(statusCode)) return 500;
  const normalized = Math.trunc(statusCode);
  if (normalized < 100 || normalized > 599) return 500;
  return normalized;
}

export function errorHandler(
  err: HandlerError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const classified = classifyError(err);
  const body: Record<string, unknown> = {
    success: false,
    error: classified.error,
    code: classified.code,
  };

  if (classified.details !== undefined) {
    body.details = classified.details;
  }

  const stack = safeRead(() => err.stack, undefined as unknown as string | undefined);
  if (process.env.NODE_ENV !== 'production' && stack) {
    body.stack = stack;
  }
  const statusCode = sanitizeHttpStatus(classified.statusCode);
  const responseWriteBlocked =
    safeRead(() => res.headersSent, false) || safeRead(() => res.writableEnded, false);
  if (responseWriteBlocked) {
    return;
  }
  try {
    res.status(statusCode).json(body);
  } catch {
    // Last-resort guard: never throw from global error handler.
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  const method = safeRead(() => req.method, 'UNKNOWN');
  const path = safeRead(() => req.path, safeRead(() => req.originalUrl, 'unknown'));
  const responseWriteBlocked =
    safeRead(() => res.headersSent, false) || safeRead(() => res.writableEnded, false);
  if (responseWriteBlocked) return;
  try {
    res.status(404).json({
      success: false,
      error: `Route ${method} ${path} not found`,
      code: 'ROUTE_NOT_FOUND',
    });
  } catch {
    // Last-resort guard: never throw from not-found handler.
  }
}

export function validationErrorHandler(errors: Array<{ path: string; message: string }>): never {
  const details = errors.reduce<Record<string, string>>((acc, item) => {
    acc[item.path] = item.message;
    return acc;
  }, {});

  throw new ValidationError('Validation failed', { errors: details });
}
