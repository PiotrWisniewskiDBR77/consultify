/**
 * Trial Entry Guard Middleware Test
 * 
 * Tests for trial access restrictions.
 * 
 * @module tests/unit/backend/middleware/trialEntryGuard.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create trial entry guard middleware
const createTrialEntryGuard = (options = {}) => {
    const { premiumFeatures = ['ai_assistant', 'advanced_analytics', 'custom_reports'] } = options;

    return (req, res, next) => {
        // Skip if no organization or not on trial
        if (!req.organization || req.organization.plan !== 'trial') {
            return next();
        }

        // Check if trial has expired
        const trialExpiresAt = new Date(req.organization.trialExpiresAt);
        if (trialExpiresAt < new Date()) {
            return res.status(403).json({
                error: 'Trial expired',
                code: 'TRIAL_EXPIRED',
                expiredAt: req.organization.trialExpiresAt,
                upgradeUrl: '/billing/upgrade',
                message: 'Your trial has expired. Please upgrade to continue.'
            });
        }

        // Check if accessing premium features
        const requestedFeature = req.headers['x-feature'] || extractFeatureFromPath(req.path);
        if (requestedFeature && premiumFeatures.includes(requestedFeature)) {
            // Trial users can access premium features
            req.trialAccess = true;
            req.trialDaysRemaining = Math.max(0, Math.ceil((trialExpiresAt - new Date()) / (1000 * 60 * 60 * 24)));
        }

        return next();
    };
};

const extractFeatureFromPath = (path) => {
    if (path.includes('/ai/')) return 'ai_assistant';
    if (path.includes('/analytics/')) return 'advanced_analytics';
    if (path.includes('/reports/')) return 'custom_reports';
    return null;
};

describe('Trial Entry Guard Middleware', () => {
    let middleware;
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        middleware = createTrialEntryGuard();

        mockReq = {
            path: '/api/projects',
            headers: {},
            organization: {
                plan: 'trial',
                trialExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
            }
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };

        mockNext = vi.fn();
    });

    describe('Active Trial', () => {
        it('should allow access during active trial', () => {
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should set trial access info for premium features', () => {
            mockReq.path = '/api/ai/chat';

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.trialAccess).toBe(true);
            expect(mockReq.trialDaysRemaining).toBeGreaterThan(0);
        });
    });

    describe('Expired Trial', () => {
        it('should block access when trial expired', () => {
            mockReq.organization.trialExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Yesterday

            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'TRIAL_EXPIRED',
                    upgradeUrl: '/billing/upgrade'
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('Non-Trial Plans', () => {
        it('should skip for free plan', () => {
            mockReq.organization.plan = 'free';

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should skip for pro plan', () => {
            mockReq.organization.plan = 'pro';

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should skip when no organization', () => {
            delete mockReq.organization;

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });
});
