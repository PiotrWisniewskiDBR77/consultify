import type { NextFunction, Request, Response } from 'express';

import { AppError, ValidationError } from '../types/index.js';

type HandlerError = Error & {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
};

function classifyError(err: HandlerError): {
  statusCode: number;
  error: string;
  code: string;
  details?: Record<string, unknown>;
} {
  if (err instanceof AppError || err.statusCode) {
    return {
      statusCode: err.statusCode || 500,
      error: err.message,
      code: err.code || 'ERROR',
      details: err.details,
    };
  }

  if (err.name === 'JsonWebTokenError') {
    return { statusCode: 401, error: 'Invalid token', code: 'INVALID_TOKEN' };
  }

  if (err.name === 'TokenExpiredError') {
    return { statusCode: 401, error: 'Token expired', code: 'TOKEN_EXPIRED' };
  }

  if (/validation/i.test(err.name) || /validation/i.test(err.message)) {
    return { statusCode: 400, error: err.message, code: 'VALIDATION_ERROR' };
  }

  if (/ECONNREFUSED|ETIMEDOUT|ECONNRESET/i.test(err.message)) {
    return { statusCode: 503, error: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' };
  }

  return { statusCode: 500, error: 'Internal server error', code: 'INTERNAL_ERROR' };
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

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    body.stack = err.stack;
  }

  res.status(classified.statusCode).json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
}

export function validationErrorHandler(errors: Array<{ path: string; message: string }>): never {
  const details = errors.reduce<Record<string, string>>((acc, item) => {
    acc[item.path] = item.message;
    return acc;
  }, {});

  throw new ValidationError('Validation failed', { errors: details });
}
