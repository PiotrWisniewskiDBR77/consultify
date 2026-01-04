/**
 * Error Handler Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler, notFoundHandler, validationErrorHandler } from '../../../../src/middleware/errorHandler.js';
import {
    AppError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ValidationError,
} from '../../../../src/types/index.js';

describe('Error Handler Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let originalEnv: string | undefined;

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        mockReq = {
            method: 'GET',
            path: '/test',
            correlationId: 'test-correlation-id',
        } as Partial<Request>;
        originalEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
        if (originalEnv) {
            process.env.NODE_ENV = originalEnv;
        }
    });

    describe('errorHandler', () => {
        it('should handle generic Error with 500 status', () => {
            const error = new Error('Generic error');
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Internal server error',
            });
        });

        it('should handle AppError with custom status code', () => {
            const error = new AppError('Custom error', 400, 'CUSTOM_ERROR');
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Custom error',
                code: 'CUSTOM_ERROR',
            });
        });

        it('should handle ValidationError', () => {
            const error = new ValidationError('Validation failed', { field: 'error' });
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: { field: 'error' },
            });
        });

        it('should handle error with validation in message', () => {
            const error = new Error('validation failed');
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'validation failed',
                code: 'VALIDATION_ERROR',
            });
        });

        it('should handle JsonWebTokenError', () => {
            const error = new Error('Invalid token');
            error.name = 'JsonWebTokenError';
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid token',
                code: 'INVALID_TOKEN',
            });
        });

        it('should handle TokenExpiredError', () => {
            const error = new Error('Token expired');
            error.name = 'TokenExpiredError';
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Token expired',
                code: 'TOKEN_EXPIRED',
            });
        });

        it('should handle connection errors', () => {
            const error = new Error('ECONNREFUSED');
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(503);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Service temporarily unavailable',
                code: 'SERVICE_UNAVAILABLE',
            });
        });

        it('should include stack trace in development', () => {
            process.env.NODE_ENV = 'development';
            const error = new Error('Test error');
            error.stack = 'Error: Test error\n    at test.js:1:1';
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            const jsonCall = (mockRes.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(jsonCall.stack).toBeDefined();
        });

        it('should not include stack trace in production', () => {
            process.env.NODE_ENV = 'production';
            const error = new Error('Test error');
            error.stack = 'Error: Test error\n    at test.js:1:1';
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            const jsonCall = (mockRes.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(jsonCall.stack).toBeUndefined();
        });
    });

    describe('notFoundHandler', () => {
        it('should return 404 with route information', () => {
            notFoundHandler(mockReq as Request, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Route GET /test not found',
                code: 'ROUTE_NOT_FOUND',
            });
        });
    });

    describe('validationErrorHandler', () => {
        it('should throw ValidationError with formatted errors', () => {
            const errors = [
                { path: 'email', message: 'Invalid email' },
                { path: 'password', message: 'Password too short' },
            ];

            expect(() => {
                validationErrorHandler(errors);
            }).toThrow(ValidationError);

            try {
                validationErrorHandler(errors);
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationError);
                expect((error as ValidationError).details).toEqual({
                    email: 'Invalid email',
                    password: 'Password too short',
                });
            }
        });
    });
});
