/**
 * Project Quota Middleware Test
 * 
 * Tests for project quota enforcement middleware.
 * 
 * @module tests/unit/backend/middleware/projectQuotaMiddleware.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create project quota middleware
const createProjectQuotaMiddleware = (quotaLimits = {}) => {
    const {
        free: freeLimit = 3,
        pro: proLimit = 25,
        enterprise: enterpriseLimit = Infinity
    } = quotaLimits;

    const planLimits = { free: freeLimit, pro: proLimit, enterprise: enterpriseLimit };

    // Mock project count store
    const projectCounts = new Map();

    return {
        middleware: (req, res, next) => {
            // Only apply to POST /api/projects (create project)
            if (req.method !== 'POST' || !req.path.match(/^\/api\/projects\/?$/)) {
                return next();
            }

            if (!req.user || !req.user.organizationId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const plan = req.organization?.plan || 'free';
            const limit = planLimits[plan] || planLimits.free;
            const currentCount = projectCounts.get(req.user.organizationId) || 0;

            if (currentCount >= limit) {
                return res.status(403).json({
                    error: 'Project quota exceeded',
                    code: 'QUOTA_EXCEEDED',
                    currentCount,
                    limit,
                    plan,
                    upgradeUrl: plan !== 'enterprise' ? '/billing/upgrade' : null
                });
            }

            // Increment count after successful creation (in afterware)
            req.quotaInfo = { currentCount, limit, plan };
            return next();
        },

        setProjectCount: (orgId, count) => {
            projectCounts.set(orgId, count);
        },

        incrementCount: (orgId) => {
            const current = projectCounts.get(orgId) || 0;
            projectCounts.set(orgId, current + 1);
        },

        getCount: (orgId) => projectCounts.get(orgId) || 0,

        reset: () => projectCounts.clear()
    };
};

describe('Project Quota Middleware', () => {
    let quotaService;
    let middleware;
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        quotaService = createProjectQuotaMiddleware();
        middleware = quotaService.middleware;
        quotaService.reset();

        mockReq = {
            method: 'POST',
            path: '/api/projects',
            user: { id: 'user-1', organizationId: 'org-1' },
            organization: { plan: 'free' }
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };

        mockNext = vi.fn();
    });

    describe('Within Quota', () => {
        it('should allow project creation within free limit', () => {
            quotaService.setProjectCount('org-1', 2);

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.quotaInfo).toEqual(
                expect.objectContaining({
                    currentCount: 2,
                    limit: 3,
                    plan: 'free'
                })
            );
        });

        it('should allow project creation for pro plan', () => {
            mockReq.organization.plan = 'pro';
            quotaService.setProjectCount('org-1', 20);

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.quotaInfo.limit).toBe(25);
        });
    });

    describe('Quota Exceeded', () => {
        it('should block when free quota exceeded', () => {
            quotaService.setProjectCount('org-1', 3);

            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'QUOTA_EXCEEDED',
                    currentCount: 3,
                    limit: 3,
                    upgradeUrl: '/billing/upgrade'
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should block when pro quota exceeded', () => {
            mockReq.organization.plan = 'pro';
            quotaService.setProjectCount('org-1', 25);

            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    limit: 25
                })
            );
        });
    });

    describe('Enterprise Plan', () => {
        it('should allow unlimited projects for enterprise', () => {
            mockReq.organization.plan = 'enterprise';
            quotaService.setProjectCount('org-1', 1000);

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Non-Create Requests', () => {
        it('should skip for GET requests', () => {
            mockReq.method = 'GET';
            quotaService.setProjectCount('org-1', 100);

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should skip for other paths', () => {
            mockReq.path = '/api/tasks';
            quotaService.setProjectCount('org-1', 100);

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });
});
