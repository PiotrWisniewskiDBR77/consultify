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

// Use hoisted mock for DbPromise
const { mockGet } = vi.hoisted(() => {
    return {
        mockGet: vi.fn(),
    };
});

vi.mock('../../../../src/utils/DbPromise.js', () => ({
    get: mockGet,
}));

describe('Plan Limits Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        // Reset and default mock
        mockGet.mockReset();
        mockGet.mockResolvedValue(null);

        // setDependencies is not needed for db since we mock module,
        // but we can call it to satisfy any other dependencies if updated later.
        setDependencies({});

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
        it('should return 403 when no organization found', async () => {
            mockReq.user = {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
                // No organizationId
            };
            const middleware = checkPlanLimit('max_projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'No organization found' });
        });

        it('should return 404 when organization not found in DB', async () => {
            mockGet.mockResolvedValue(null);
            const middleware = checkPlanLimit('max_projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Organization not found' });
        });

        it('should allow when limit not reached', async () => {
            mockGet.mockImplementation((sql: string) => {
                if (sql.includes('SELECT plan')) {
                    return Promise.resolve({ plan: 'pro', status: 'active' });
                } else if (sql.includes('SELECT COUNT(*)')) {
                    return Promise.resolve({ count: 5 }); // Below pro limit (10)
                }
                return Promise.resolve(null);
            });
            const middleware = checkPlanLimit('max_projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should block when limit reached', async () => {
            mockGet.mockImplementation((sql: string) => {
                if (sql.includes('SELECT plan')) {
                    return Promise.resolve({ plan: 'pro', status: 'active' });
                } else if (sql.includes('SELECT COUNT(*)')) {
                    return Promise.resolve({ count: 10 }); // At/Over pro limit (10)
                }
                return Promise.resolve(null);
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
            mockGet.mockImplementation((sql: string) => {
                if (sql.includes('SELECT plan')) {
                    return Promise.resolve({ plan: 'free', status: 'trial' });
                } else if (sql.includes('SELECT COUNT(*)')) {
                    return Promise.resolve({ count: 5 }); // Within pro limits (trial = pro)
                }
                return Promise.resolve(null);
            });
            const middleware = checkPlanLimit('max_projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should check max_members limit', async () => {
            mockGet.mockImplementation((sql: string) => {
                if (sql.includes('SELECT plan')) {
                    return Promise.resolve({ plan: 'free', status: 'active' });
                } else if (sql.includes('users WHERE organization_id')) {
                    return Promise.resolve({ count: 0 }); // Below free limit (1)
                }
                return Promise.resolve(null);
            });
            const middleware = checkPlanLimit('max_members');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle database errors gracefully', async () => {
            mockGet.mockRejectedValue(new Error('DB error'));
            const middleware = checkPlanLimit('max_projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
        });

        it('should allow when limit key not defined for plan', async () => {
            mockGet.mockImplementation((sql: string) => {
                if (sql.includes('SELECT plan')) {
                    return Promise.resolve({ plan: 'free', status: 'active' });
                }
                return Promise.resolve(null);
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



