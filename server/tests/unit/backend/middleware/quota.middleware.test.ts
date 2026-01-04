/**
 * Quota Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    type AuthRequest,
    enforceStorageQuota,
    enforceTokenQuota,
    setDependencies,
} from '../../../../src/middleware/quota.middleware.js';

describe('Quota Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockUsageService: {
        checkQuota: (
            orgId: string,
            type: 'token' | 'storage',
        ) => Promise<{
            allowed: boolean;
            used: number;
            limit: number;
            percentage: number;
        }>;
    };

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            set: vi.fn().mockReturnThis(),
        };
        mockUsageService = {
            checkQuota: vi.fn().mockResolvedValue({
                allowed: true,
                used: 1000,
                limit: 10000,
                percentage: 10,
            }),
        };

        setDependencies({ usageService: mockUsageService });

        mockReq = {
            user: {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
                organizationId: 'org-123',
            },
            path: '/api/ai/chat',
            body: {},
        };
    });

    describe('enforceTokenQuota', () => {
        it('should allow when quota not exceeded', async () => {
            await enforceTokenQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockUsageService.checkQuota).toHaveBeenCalledWith('org-123', 'token');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should block when quota exceeded', async () => {
            mockUsageService.checkQuota = vi.fn().mockResolvedValue({
                allowed: false,
                used: 10000,
                limit: 10000,
                percentage: 100,
            });
            await enforceTokenQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Token quota exceeded',
                    code: 'QUOTA_EXCEEDED',
                }),
            );
        });

        it('should return 401 when no organization', async () => {
            mockReq.user = {
                id: 'user-123',
                role: 'user',
                isSuperAdmin: false,
            };
            await enforceTokenQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should set warning header when approaching limit', async () => {
            mockUsageService.checkQuota = vi.fn().mockResolvedValue({
                allowed: true,
                used: 8500,
                limit: 10000,
                percentage: 85,
            });
            await enforceTokenQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.set).toHaveBeenCalledWith('X-Quota-Warning', 'true');
            expect(mockRes.set).toHaveBeenCalledWith('X-Quota-Percentage', '85');
        });

        it('should allow request on quota check failure', async () => {
            mockUsageService.checkQuota = vi.fn().mockRejectedValue(new Error('Service error'));
            await enforceTokenQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('enforceStorageQuota', () => {
        it('should allow when quota not exceeded', async () => {
            await enforceStorageQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockUsageService.checkQuota).toHaveBeenCalledWith('org-123', 'storage');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should block when storage quota exceeded', async () => {
            mockUsageService.checkQuota = vi.fn().mockResolvedValue({
                allowed: false,
                used: 1000000000,
                limit: 1000000000,
                percentage: 100,
            });
            await enforceStorageQuota(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Storage quota exceeded',
                    code: 'STORAGE_QUOTA_EXCEEDED',
                }),
            );
        });
    });
});


