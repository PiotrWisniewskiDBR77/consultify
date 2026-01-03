/**
 * Demo Guard Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { demoGuard, type AuthRequest } from '../../../../src/middleware/demoGuard.middleware.js';

describe('Demo Guard Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        mockReq = {
            method: 'GET',
            originalUrl: '/api/test',
            query: {},
            body: {},
            params: {},
        };
    });

    describe('Non-demo users', () => {
        it('should allow non-demo users', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
            };
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow when user is undefined', () => {
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Demo users - Safe methods', () => {
        beforeEach(() => {
            mockReq.user = {
                id: 'demo-user',
                role: 'user',
                isSuperAdmin: false,
                isDemo: true,
                organizationId: 'demo-org',
            };
        });

        it('should allow GET requests', () => {
            mockReq.method = 'GET';
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow OPTIONS requests', () => {
            mockReq.method = 'OPTIONS';
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow HEAD requests', () => {
            mockReq.method = 'HEAD';
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Demo users - Allowed paths', () => {
        beforeEach(() => {
            mockReq.user = {
                id: 'demo-user',
                role: 'user',
                isSuperAdmin: false,
                isDemo: true,
                organizationId: 'demo-org',
            };
            mockReq.method = 'POST';
        });

        it('should allow /api/auth/logout', () => {
            mockReq.originalUrl = '/api/auth/logout';
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow /api/ai/chat', () => {
            mockReq.originalUrl = '/api/ai/chat';
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow /api/ai/stream', () => {
            mockReq.originalUrl = '/api/ai/stream';
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Demo users - Cross-tenant protection', () => {
        beforeEach(() => {
            mockReq.user = {
                id: 'demo-user',
                role: 'user',
                isSuperAdmin: false,
                isDemo: true,
                organizationId: 'demo-org',
            };
        });

        it('should block cross-tenant access via query', () => {
            mockReq.query = { organizationId: 'other-org' };
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'DEMO_BLOCKED',
                    action: 'ISOLATION_VIOLATION',
                })
            );
        });

        it('should block cross-tenant access via body', () => {
            mockReq.body = { organizationId: 'other-org' };
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should block cross-tenant access via params', () => {
            mockReq.params = { organizationId: 'other-org' };
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe('Demo users - Blocked operations', () => {
        beforeEach(() => {
            mockReq.user = {
                id: 'demo-user',
                role: 'user',
                isSuperAdmin: false,
                isDemo: true,
                organizationId: 'demo-org',
            };
        });

        it('should block POST requests to non-allowed paths', () => {
            mockReq.method = 'POST';
            mockReq.originalUrl = '/api/projects';
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'DEMO_BLOCKED',
                    isDemoRestriction: true,
                })
            );
        });

        it('should block PUT requests', () => {
            mockReq.method = 'PUT';
            mockReq.originalUrl = '/api/projects/123';
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should block DELETE requests', () => {
            mockReq.method = 'DELETE';
            mockReq.originalUrl = '/api/projects/123';
            demoGuard(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });
});



