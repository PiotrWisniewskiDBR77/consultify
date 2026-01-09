/**
 * Plan Limits Middleware Test
 * 
 * Tests for plan-based feature limits middleware.
 * 
 * @module tests/unit/backend/middleware/planLimits.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create plan limits middleware
const createPlanLimitsMiddleware = (featureLimits = {}) => {
    const defaultLimits = {
        free: {
            maxUsers: 5,
            maxProjects: 3,
            maxStorage: 1 * 1024 * 1024 * 1024, // 1GB
            features: ['basic_analytics']
        },
        pro: {
            maxUsers: 50,
            maxProjects: 25,
            maxStorage: 50 * 1024 * 1024 * 1024, // 50GB
            features: ['basic_analytics', 'advanced_analytics', 'ai_assistant', 'custom_reports']
        },
        enterprise: {
            maxUsers: Infinity,
            maxProjects: Infinity,
            maxStorage: Infinity,
            features: ['basic_analytics', 'advanced_analytics', 'ai_assistant', 'custom_reports', 'api_access', 'sso', 'audit_logs']
        }
    };

    const limits = { ...defaultLimits, ...featureLimits };

    return (req, res, next) => {
        const plan = req.organization?.plan || 'free';
        const planLimits = limits[plan] || limits.free;

        // Attach limits to request for downstream use
        req.planLimits = planLimits;
        req.currentPlan = plan;

        // Check feature access
        const requestedFeature = req.headers['x-feature'];
        if (requestedFeature && !planLimits.features.includes(requestedFeature)) {
            return res.status(403).json({
                error: 'Feature not available',
                code: 'FEATURE_NOT_AVAILABLE',
                feature: requestedFeature,
                plan,
                upgradeUrl: plan !== 'enterprise' ? '/billing/upgrade' : null,
                availableIn: Object.keys(limits).filter(p =>
                    limits[p].features.includes(requestedFeature)
                )
            });
        }

        return next();
    };
};

describe('Plan Limits Middleware', () => {
    let middleware;
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        middleware = createPlanLimitsMiddleware();

        mockReq = {
            headers: {},
            organization: { plan: 'free' }
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };

        mockNext = vi.fn();
    });

    describe('Plan Limits Attachment', () => {
        it('should attach plan limits to request', () => {
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.planLimits).toBeDefined();
            expect(mockReq.currentPlan).toBe('free');
        });

        it('should use correct limits for pro plan', () => {
            mockReq.organization.plan = 'pro';

            middleware(mockReq, mockRes, mockNext);

            expect(mockReq.planLimits.maxProjects).toBe(25);
            expect(mockReq.planLimits.maxUsers).toBe(50);
        });

        it('should use unlimited for enterprise', () => {
            mockReq.organization.plan = 'enterprise';

            middleware(mockReq, mockRes, mockNext);

            expect(mockReq.planLimits.maxProjects).toBe(Infinity);
        });
    });

    describe('Feature Access', () => {
        it('should allow basic_analytics for free plan', () => {
            mockReq.headers['x-feature'] = 'basic_analytics';

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should block ai_assistant for free plan', () => {
            mockReq.headers['x-feature'] = 'ai_assistant';

            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'FEATURE_NOT_AVAILABLE',
                    feature: 'ai_assistant',
                    availableIn: expect.arrayContaining(['pro', 'enterprise'])
                })
            );
        });

        it('should allow ai_assistant for pro plan', () => {
            mockReq.organization.plan = 'pro';
            mockReq.headers['x-feature'] = 'ai_assistant';

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow all features for enterprise', () => {
            mockReq.organization.plan = 'enterprise';
            mockReq.headers['x-feature'] = 'sso';

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Default Plan', () => {
        it('should default to free when no organization', () => {
            delete mockReq.organization;

            middleware(mockReq, mockRes, mockNext);

            expect(mockReq.currentPlan).toBe('free');
        });
    });
});
