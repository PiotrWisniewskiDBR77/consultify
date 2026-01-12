/**
 * Plan Limits Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    type AuthRequest,
    checkPlanLimit,
    PLAN_LIMITS,
    setDependencies,
} from '../../../../src/middleware/planLimits.middleware.js';

describe('Plan Limits Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockDb: {
        get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    };

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        mockDb = {
            get: vi.fn((_sql, _params, callback) => callback(null, null)),
        };
        setDependencies({ db: mockDb });

        mockReq = {
            user: {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
                organizationId: 'org-123',
            },
        };
    });

    describe('checkPlanLimit', () => {
        it('should return 403 when no organization found', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
            };
            const middleware = checkPlanLimit('max_projects');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'No organization found' });
        });

        it('should return 404 when organization not found in DB', async () => {
            mockDb.get = vi.fn((_sql, _params, callback) => callback(null, null));
            const middleware = checkPlanLimit('max_projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Organization not found' });
        });

        it('should allow when limit not reached', async () => {
            mockDb.get = vi.fn((sql, _params, callback) => {
                if (sql.includes('SELECT plan')) {
                    callback(null, { plan: 'pro', status: 'active' });
                } else if (sql.includes('SELECT COUNT(*)')) {
                    callback(null, { count: 5 }); // Below limit of 10
                } else {
                    callback(null, null);
                }
            });
            const middleware = checkPlanLimit('max_projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should block when limit reached', async () => {
            mockDb.get = vi.fn((sql, _params, callback) => {
                if (sql.includes('SELECT plan')) {
                    callback(null, { plan: 'pro', status: 'active' });
                } else if (sql.includes('SELECT COUNT(*)')) {
                    callback(null, { count: 10 }); // At limit
                } else {
                    callback(null, null);
                }
            });
            const middleware = checkPlanLimit('max_projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.stringContaining('Plan limit reached'),
                }),
            );
        });

        it('should treat trial as pro plan', async () => {
            mockDb.get = vi.fn((sql, _params, callback) => {
                if (sql.includes('SELECT plan')) {
                    callback(null, { plan: 'free', status: 'trial' });
                } else if (sql.includes('SELECT COUNT(*)')) {
                    callback(null, { count: 5 }); // Within pro limits
                } else {
                    callback(null, null);
                }
            });
            const middleware = checkPlanLimit('max_projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should check max_members limit', async () => {
            mockDb.get = vi.fn((sql, _params, callback) => {
                if (sql.includes('SELECT plan')) {
                    callback(null, { plan: 'free', status: 'active' });
                } else if (sql.includes('users WHERE organization_id')) {
                    callback(null, { count: 0 }); // Below limit of 1
                } else {
                    callback(null, null);
                }
            });
            const middleware = checkPlanLimit('max_members');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle database errors gracefully', async () => {
            mockDb.get = vi.fn((_sql, _params, callback) => {
                callback(new Error('DB error'), null);
            });
            const middleware = checkPlanLimit('max_projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
        });

        it('should allow when limit key not defined for plan', async () => {
            mockDb.get = vi.fn((sql, _params, callback) => {
                if (sql.includes('SELECT plan')) {
                    callback(null, { plan: 'free', status: 'active' });
                } else {
                    callback(null, null);
                }
            });
            // Use a limit key that doesn't exist in PLAN_LIMITS
            const middleware = checkPlanLimit('max_custom' as any);
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('PLAN_LIMITS', () => {
        it('should have limits for free plan', () => {
            expect(PLAN_LIMITS.free).toBeDefined();
            expect(PLAN_LIMITS.free.max_projects).toBe(1);
            expect(PLAN_LIMITS.free.max_members).toBe(1);
        });

        it('should have limits for pro plan', () => {
            expect(PLAN_LIMITS.pro).toBeDefined();
            expect(PLAN_LIMITS.pro.max_projects).toBe(10);
        });

        it('should have limits for enterprise plan', () => {
            expect(PLAN_LIMITS.enterprise).toBeDefined();
            expect(PLAN_LIMITS.enterprise.max_projects).toBe(9999);
        });
    });
});

