/**
 * Error Handler Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler, notFoundHandler, validationErrorHandler } from '../../../../src/middleware/errorHandler.js';
import { AppError, ValidationError } from '../../../../src/types/index.js';

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

    // Verification check for Import/Circular Dependency issue
    it('should have AppError defined', () => {
        expect(AppError).toBeDefined();
        // Since we are mocking dependencies or in an environment where circular dependencies might fail,
        // we check if the constructor works.
        const err = new AppError(500, 'test');
        expect(err).toBeInstanceOf(AppError);
    });

    describe('errorHandler', () => {
        it('should handle generic Error with 500 status', () => {
            const error = new Error('Generic error');
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: 'Internal server error',
                }),
            );
        });

        it('should handle AppError with custom status code', () => {
            const error = new AppError(400, 'Custom error', 'CUSTOM_ERROR');
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: 'Custom error',
                    code: 'CUSTOM_ERROR',
                }),
            );
        });

        it('should handle ValidationError', () => {
            const error = new ValidationError('Validation failed', { field: 'error' });
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                }),
            );
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
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    code: 'ROUTE_NOT_FOUND',
                }),
            );
        });
    });

    describe('validationErrorHandler', () => {
        it('should throw ValidationError', () => {
            const errors = [{ path: 'field', message: 'error' }];
            expect(() => validationErrorHandler(errors)).toThrow(ValidationError);
        });
    });
});
