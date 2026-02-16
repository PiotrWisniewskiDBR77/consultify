/**
 * Error Handler Utility
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full TypeScript migration of errorHandler.js
 * Provides standardized error handling and Express middleware
 */

import type { NextFunction, Request, Response } from 'express';

import logger from './Logger.js';

/**
 * Standardized AppError Class
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  details: Record<string, unknown>;
  status: 'fail' | 'error';
  isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string = 'INTERNAL_ERROR',
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error types/codes
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  BAD_REQUEST: 'BAD_REQUEST',
} as const;

/**
 * Create standardized error response object (Legacy support)
 */
export function createError(
  code: string,
  message: string,
  details: Record<string, unknown> = {}
): { error: Record<string, unknown> } {
  return {
    error: {
      code,
      message,
      ...details,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Safely extract error message from various error types
 */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name || 'Unknown error';
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String(err.message) || 'Unknown error';
  }
  return 'Unknown error';
}

/**
 * Express error handler middleware
 */
export function errorHandlerMiddleware(
  err: Error & {
    statusCode?: number;
    status?: number | string;
    code?: string;
    details?: Record<string, unknown>;
  },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Safely extract error message
  const errorMessage = getErrorMessage(err);
  const errorStack = err instanceof Error ? err.stack : undefined;
  const errorName = err instanceof Error ? err.name : 'Error';

  // Standardize status code
  let statusCode = 500;
  if (err.statusCode) {
    statusCode = Number(err.statusCode);
  } else if (err.status) {
    statusCode = Number(err.status);
  }

  if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
    statusCode = 500;
  }

  err.statusCode = statusCode;
  const status = statusCode >= 500 ? 'error' : 'fail';

  // Log the error with comprehensive context
  if (err.statusCode >= 500) {
    logger.error(`[ErrorHandler] ${errorName}: ${errorMessage}`, {
      errorName,
      message: errorMessage,
      stack: errorStack,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id,
      statusCode: err.statusCode,
      code: err.code,
    });
  } else {
    logger.warn(`[ErrorHandler] ${errorName}: ${errorMessage}`, {
      errorName,
      message: errorMessage,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      code: err.code,
    });
  }

  // Development/test response
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    res.status(err.statusCode).json({
      status: status,
      error: {
        name: errorName,
        message: errorMessage,
        stack: errorStack,
        statusCode: err.statusCode,
        code: err.code,
        ...(err.details || {}),
      },
    });
    return;
  }

  // Production response
  // Treat as operational if it's explicitly marked OR if it has a 4xx status code (e.g. BodyParser)
  if ((err as AppError).isOperational || (err.statusCode && err.statusCode < 500)) {
    // Known operational error (AppError) or Client Error
    res.status(err.statusCode || 400).json({
      status: status,
      error: {
        code: err.code || 'ERROR',
        message: errorMessage,
        ...(err.details || {}),
        timestamp: new Date().toISOString(),
      },
    });
  } else {
    // Unknown programming/system error
    res.status(500).json({
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went very wrong!',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Async route wrapper to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Helper functions for common errors
 */
export function validationError(msg: string, fields?: Record<string, unknown>): AppError {
  return new AppError(msg, 400, ERROR_CODES.VALIDATION_ERROR, { fields });
}

export function notFoundError(resource: string, id?: string): AppError {
  return new AppError(`${resource} not found`, 404, ERROR_CODES.NOT_FOUND, { id });
}
