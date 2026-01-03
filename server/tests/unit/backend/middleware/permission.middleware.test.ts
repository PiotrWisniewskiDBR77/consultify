/**
 * Permission Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requirePermission, requireAnyPermission, requireAllPermissions, setDependencies, type AuthRequest } from '../../../../src/middleware/permission.middleware.js';

describe('Permission Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockPermissionService: {
        hasPermission: (userId: string, orgId: string | undefined, permissionKey: string, userRole?: string) => Promise<boolean>;
    };

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        mockPermissionService = {
            hasPermission: vi.fn().mockResolvedValue(true),
        };

        setDependencies({
            PermissionService: mockPermissionService,
            GovernanceAuditService: {
                logAudit: vi.fn().mockResolvedValue(undefined),
            },
        });

        mockReq = {
            userId: 'user-123',
            organizationId: 'org-123',
            userRole: 'ADMIN',
            user: {
                id: 'user-123',
                role: 'ADMIN',
                isSuperAdmin: false,
                organizationId: 'org-123',
            },
        };
    });

    describe('requirePermission', () => {
        it('should allow when permission granted', async () => {
            const middleware = requirePermission('read:projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
                'user-123',
                'org-123',
                'read:projects',
                'ADMIN'
            );
            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny when permission not granted', async () => {
            mockPermissionService.hasPermission = vi.fn().mockResolvedValue(false);
            const middleware = requirePermission('write:projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Permission denied',
                    required: 'write:projects',
                })
            );
        });

        it('should return 401 when user not authenticated', async () => {
            mockReq.userId = undefined;
            mockReq.user = undefined;
            const middleware = requirePermission('read:projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should handle service errors gracefully', async () => {
            mockPermissionService.hasPermission = vi.fn().mockRejectedValue(new Error('Service error'));
            const middleware = requirePermission('read:projects');
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
        });
    });

    describe('requireAnyPermission', () => {
        it('should allow when any permission granted', async () => {
            mockPermissionService.hasPermission = vi.fn()
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true);
            const middleware = requireAnyPermission(['read:projects', 'write:projects']);
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny when no permissions granted', async () => {
            mockPermissionService.hasPermission = vi.fn().mockResolvedValue(false);
            const middleware = requireAnyPermission(['read:projects', 'write:projects']);
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe('requireAllPermissions', () => {
        it('should allow when all permissions granted', async () => {
            mockPermissionService.hasPermission = vi.fn().mockResolvedValue(true);
            const middleware = requireAllPermissions(['read:projects', 'write:projects']);
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny when any permission missing', async () => {
            mockPermissionService.hasPermission = vi.fn()
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false);
            const middleware = requireAllPermissions(['read:projects', 'write:projects']);
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    missing: ['write:projects'],
                })
            );
        });
    });
});



