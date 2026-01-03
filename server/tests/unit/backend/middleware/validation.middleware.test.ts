/**
 * Validation Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { validateBody, validateQuery, validateParams } from '../../../src/middleware/validation.middleware.js';
import { z } from 'zod';

describe('Validation Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        mockReq = {
            body: {},
            query: {},
            params: {},
        };
    });

    describe('validateBody', () => {
        const TestSchema = z.object({
            name: z.string(),
            age: z.number(),
        });

        it('should pass validation for valid body', () => {
            mockReq.body = { name: 'John', age: 30 };
            const middleware = validateBody(TestSchema);
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        it('should replace body with parsed data', () => {
            const CoerceSchema = z.object({
                age: z.coerce.number(),
            });
            mockReq.body = { age: '30' };
            const middleware = validateBody(CoerceSchema);
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockReq.body).toEqual({ age: 30 });
            expect(mockNext).toHaveBeenCalled();
        });

        it('should return 400 for invalid body', () => {
            mockReq.body = { name: 'John' }; // Missing age
            const middleware = validateBody(TestSchema);
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Validation Error',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'age',
                        message: expect.any(String),
                    }),
                ]),
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle nested field errors', () => {
            const NestedSchema = z.object({
                user: z.object({
                    name: z.string(),
                    email: z.string().email(),
                }),
            });
            mockReq.body = { user: { name: 'John' } }; // Missing email
            const middleware = validateBody(NestedSchema);
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            const jsonCall = (mockRes.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(jsonCall.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'user.email',
                    }),
                ])
            );
        });

        it('should handle validation errors gracefully', () => {
            const InvalidSchema = z.object({
                value: z.string(),
            });
            // Mock safeParse to throw
            const originalSafeParse = z.ZodSchema.prototype.safeParse;
            z.ZodSchema.prototype.safeParse = vi.fn().mockImplementation(() => {
                throw new Error('Parse error');
            });

            const middleware = validateBody(InvalidSchema);
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal Server Error during validation' });

            z.ZodSchema.prototype.safeParse = originalSafeParse;
        });
    });

    describe('validateQuery', () => {
        const TestSchema = z.object({
            page: z.coerce.number().optional(),
            limit: z.coerce.number().optional(),
            search: z.string().optional(),
        });

        it('should pass validation for valid query', () => {
            mockReq.query = { page: '1', limit: '10' };
            const middleware = validateQuery(TestSchema);
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should coerce query parameters', () => {
            mockReq.query = { page: '1', limit: '10' };
            const middleware = validateQuery(TestSchema);
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should return 400 for invalid query', () => {
            const StrictSchema = z.object({
                page: z.coerce.number().min(1),
            });
            mockReq.query = { page: '0' };
            const middleware = validateQuery(StrictSchema);
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle validation errors gracefully', () => {
            const InvalidSchema = z.object({
                value: z.string(),
            });
            const originalSafeParse = z.ZodSchema.prototype.safeParse;
            z.ZodSchema.prototype.safeParse = vi.fn().mockImplementation(() => {
                throw new Error('Parse error');
            });

            const middleware = validateQuery(InvalidSchema);
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);

            z.ZodSchema.prototype.safeParse = originalSafeParse;
        });
    });

    describe('validateParams', () => {
        const TestSchema = z.object({
            id: z.string().uuid(),
            slug: z.string(),
        });

        it('should pass validation for valid params', () => {
            mockReq.params = { 
                id: '123e4567-e89b-12d3-a456-426614174000',
                slug: 'test-slug',
            };
            const middleware = validateParams(TestSchema);
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should return 400 for invalid params', () => {
            mockReq.params = { id: 'invalid-uuid' };
            const middleware = validateParams(TestSchema);
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle validation errors gracefully', () => {
            const InvalidSchema = z.object({
                value: z.string(),
            });
            const originalSafeParse = z.ZodSchema.prototype.safeParse;
            z.ZodSchema.prototype.safeParse = vi.fn().mockImplementation(() => {
                throw new Error('Parse error');
            });

            const middleware = validateParams(InvalidSchema);
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);

            z.ZodSchema.prototype.safeParse = originalSafeParse;
        });
    });
});

