/**
 * Project Quota Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enforceProjectQuota, setDependencies } from '../../../../src/middleware/projectQuota.middleware.js';

describe('Project Quota Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockUsageService: {
        checkProjectQuota: (projectId: string) => Promise<{
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
        };
        mockUsageService = {
            checkProjectQuota: vi.fn().mockResolvedValue({
                allowed: true,
                used: 1000,
                limit: 10000,
                percentage: 10,
            }),
        };

        setDependencies({ usageService: mockUsageService });

        mockReq = {
            body: { project_id: 'project-123' },
            query: {},
        };
    });

    describe('enforceProjectQuota', () => {
        it('should allow when quota not exceeded', async () => {
            await enforceProjectQuota(mockReq as Request, mockRes as Response, mockNext);

            expect(mockUsageService.checkProjectQuota).toHaveBeenCalledWith('project-123');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should skip check when no project specified', async () => {
            mockReq.body = {};
            mockReq.query = {};
            await enforceProjectQuota(mockReq as Request, mockRes as Response, mockNext);

            expect(mockUsageService.checkProjectQuota).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should use projectId from query when body not present', async () => {
            mockReq.body = {};
            mockReq.query = { projectId: 'project-456' };
            await enforceProjectQuota(mockReq as Request, mockRes as Response, mockNext);

            expect(mockUsageService.checkProjectQuota).toHaveBeenCalledWith('project-456');
        });

        it('should block when quota exceeded', async () => {
            mockUsageService.checkProjectQuota = vi.fn().mockResolvedValue({
                allowed: false,
                used: 10000,
                limit: 10000,
                percentage: 100,
            });
            await enforceProjectQuota(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Project storage quota exceeded',
                    code: 'PROJECT_STORAGE_EXCEEDED',
                }),
            );
        });

        it('should handle errors gracefully', async () => {
            mockUsageService.checkProjectQuota = vi.fn().mockRejectedValue(new Error('Service error'));
            await enforceProjectQuota(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
        });
    });
});


