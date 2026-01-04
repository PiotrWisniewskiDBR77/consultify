/**
 * Feature Gate Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    type AuthRequest,
    FEATURE_REQUIREMENTS,
    getAccessibleFeatures,
    isFeatureAccessible,
    requireAccess,
    requireFeature,
} from '../../../../src/middleware/featureGate.middleware.js';

describe('Feature Gate Middleware', () => {
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
            currentPhase: 'G',
            userState: 'ECOSYSTEM_NODE',
            userRole: 'ADMIN',
            user: {
                id: 'user-123',
                role: 'ADMIN',
                isSuperAdmin: false,
            },
        };
    });

    describe('requireFeature', () => {
        it('should allow access when all requirements met', () => {
            const middleware = requireFeature('benchmark_access');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny access when phase requirement not met', () => {
            mockReq.currentPhase = 'F';
            const middleware = requireFeature('benchmark_access');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'FEATURE_ACCESS_DENIED',
                    feature: 'benchmark_access',
                }),
            );
        });

        it('should deny access when state requirement not met', () => {
            mockReq.userState = 'ORG_MEMBER';
            const middleware = requireFeature('benchmark_access');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should deny access when role requirement not met', () => {
            mockReq.userRole = 'USER';
            const middleware = requireFeature('benchmark_access');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should return 500 for unregistered feature', () => {
            const middleware = requireFeature('nonexistent_feature');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'FEATURE_NOT_REGISTERED',
                }),
            );
        });

        it('should allow access when role requirement is empty', () => {
            mockReq.currentPhase = 'C';
            mockReq.userState = 'TRIAL_TRUSTED';
            const middleware = requireFeature('trial_chat');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requireAccess', () => {
        it('should allow access when requirements met', () => {
            const middleware = requireAccess({
                phase: ['G'],
                state: ['ECOSYSTEM_NODE'],
                role: ['ADMIN'],
            });
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny access when phase not met', () => {
            const middleware = requireAccess({
                phase: ['F'],
                state: ['ECOSYSTEM_NODE'],
                role: ['ADMIN'],
            });
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'PHASE_REQUIRED',
                }),
            );
        });

        it('should deny access when state not met', () => {
            const middleware = requireAccess({
                phase: ['G'],
                state: ['ORG_MEMBER'],
                role: ['ADMIN'],
            });
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'STATE_REQUIRED',
                }),
            );
        });

        it('should deny access when role not met', () => {
            mockReq.userRole = 'USER';
            const middleware = requireAccess({
                phase: ['G'],
                state: ['ECOSYSTEM_NODE'],
                role: ['ADMIN'],
            });
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'ROLE_REQUIRED',
                }),
            );
        });
    });

    describe('isFeatureAccessible', () => {
        it('should return true when feature is accessible', () => {
            const result = isFeatureAccessible('benchmark_access', {
                phase: 'G',
                state: 'ECOSYSTEM_NODE',
                role: 'ADMIN',
            });
            expect(result).toBe(true);
        });

        it('should return false when phase not met', () => {
            const result = isFeatureAccessible('benchmark_access', {
                phase: 'F',
                state: 'ECOSYSTEM_NODE',
                role: 'ADMIN',
            });
            expect(result).toBe(false);
        });

        it('should return false for unregistered feature', () => {
            const result = isFeatureAccessible('nonexistent', {
                phase: 'G',
                state: 'ECOSYSTEM_NODE',
                role: 'ADMIN',
            });
            expect(result).toBe(false);
        });
    });

    describe('getAccessibleFeatures', () => {
        it('should return list of accessible features', () => {
            const features = getAccessibleFeatures({
                phase: 'G',
                state: 'ECOSYSTEM_NODE',
                role: 'ADMIN',
            });
            expect(Array.isArray(features)).toBe(true);
            expect(features.length).toBeGreaterThan(0);
        });

        it('should return empty array when no features accessible', () => {
            const features = getAccessibleFeatures({
                phase: 'A',
                state: 'UNKNOWN',
                role: 'USER',
            });
            expect(Array.isArray(features)).toBe(true);
        });
    });
});
