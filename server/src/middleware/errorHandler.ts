/**
 * Error Handler Middleware
 * Enterprise-grade error handling with proper logging and responses
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError } from '../types';

interface ErrorResponse {
    success: false;
    error: string;
    code?: string;
    details?: Record<string, unknown>;
    stack?: string;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // Log error (in production, use proper logger)
    console.error(`[Error] ${req.method} ${req.path}:`, {
        message: err.message,
        stack: err.stack,
        correlationId: (req as unknown as { correlationId?: string }).correlationId
    });

    // Determine status code and response
    let statusCode = 500;
    let response: ErrorResponse = {
        success: false,
        error: 'Internal server error'
    };

    // Handle known error types
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        response = {
            success: false,
            error: err.message,
            code: err.code,
            details: err.details
        };
    } else if (err.name === 'ValidationError' || err.message.includes('validation')) {
        statusCode = 400;
        response = {
            success: false,
            error: err.message,
            code: 'VALIDATION_ERROR'
        };
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        response = {
            success: false,
            error: 'Invalid token',
            code: 'INVALID_TOKEN'
        };
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        response = {
            success: false,
            error: 'Token expired',
            code: 'TOKEN_EXPIRED'
        };
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
        statusCode = 503;
        response = {
            success: false,
            error: 'Service temporarily unavailable',
            code: 'SERVICE_UNAVAILABLE'
        };
    }

    // Include stack trace in development
    if (process.env.NODE_ENV !== 'production') {
        response.stack = err.stack;
    }

    // Send response
    res.status(statusCode).json(response);
};

/**
 * Not found handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.path} not found`,
        code: 'ROUTE_NOT_FOUND'
    });
};

/**
 * Request validation error handler (for Zod/Joi)
 */
export const validationErrorHandler = (
    errors: Array<{ path: string; message: string }>
): never => {
    throw new ValidationError('Validation failed', {
        errors: errors.reduce((acc, err) => {
            acc[err.path] = err.message;
            return acc;
        }, {} as Record<string, string>)
    });
};


