/**
 * Error Handler Utility
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full TypeScript migration of errorHandler.js
 * Provides standardized error handling and Express middleware
 */

import type { NextFunction, Request, Response } from 'express';

import logger from './Logger.ts';

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
        details: Record<string, unknown> = {},
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
    details: Record<string, unknown> = {},
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
 * Express error handler middleware
 */
export function errorHandlerMiddleware(
    err: Error & { statusCode?: number; status?: string; code?: string; details?: Record<string, unknown> },
    req: Request,
    res: Response,
    _next: NextFunction,
): void {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log the error
    if (err.statusCode >= 500) {
        logger.error(`[ErrorHandler] ${err.message}`, {
            stack: err.stack,
            path: req.path,
            method: req.method,
            userId: (req as any).user?.id,
        });
    } else {
        logger.warn(`[ErrorHandler] ${err.message}`, {
            statusCode: err.statusCode,
            path: req.path,
        });
    }

    // Development response
    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack,
        });
        return;
    }

    // Production response
    // Treat as operational if it's explicitly marked OR if it has a 4xx status code (e.g. BodyParser)
    if ((err as AppError).isOperational || (err.statusCode && err.statusCode < 500)) {
        // Known operational error (AppError) or Client Error
        res.status(err.statusCode || 400).json({
            status: err.status,
            error: {
                code: err.code || 'ERROR',
                message: err.message,
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
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void,
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
