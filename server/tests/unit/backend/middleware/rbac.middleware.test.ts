/**
 * RBAC Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    type AuthRequest,
    ORG_ROLE_HIERARCHY,
    requireConsultantScope,
    requireOrgAccess,
    requireOrgRole,
    requireOwnerOrSuperadmin,
} from '../../../../src/middleware/rbac.middleware.js';

describe('RBAC Middleware', () => {
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
            org: {
                id: 'org-123',
                isMember: true,
                isConsultant: false,
                role: 'ADMIN',
            },
        };
    });

    describe('requireOrgAccess', () => {
        it('should return 400 when org context missing', () => {
            mockReq.org = undefined;
            const middleware = requireOrgAccess();
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Missing organization context',
                }),
            );
        });

        it('should allow member when no roles required', () => {
            const middleware = requireOrgAccess();
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow member with matching role', () => {
            const middleware = requireOrgAccess({ roles: ['ADMIN', 'OWNER'] });
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny member with non-matching role', () => {
            mockReq.org!.role = 'MEMBER';
            const middleware = requireOrgAccess({ roles: ['ADMIN', 'OWNER'] });
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should allow consultant when allowed', () => {
            mockReq.org = {
                id: 'org-123',
                isMember: false,
                isConsultant: true,
                role: 'CONSULTANT',
                permissionScope: {
                    permissions: ['read:projects'],
                },
            };
            const middleware = requireOrgAccess({ allowConsultant: true });
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny consultant when not allowed', () => {
            mockReq.org = {
                id: 'org-123',
                isMember: false,
                isConsultant: true,
                role: 'CONSULTANT',
            };
            const middleware = requireOrgAccess({ allowConsultant: false });
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe('requireOrgRole', () => {
        it('should allow when role matches', () => {
            const middleware = requireOrgRole('ADMIN');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny when role does not match', () => {
            mockReq.org!.role = 'MEMBER';
            const middleware = requireOrgRole('ADMIN');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe('requireOwnerOrSuperadmin', () => {
        it('should allow OWNER', () => {
            mockReq.org!.role = 'OWNER';
            requireOwnerOrSuperadmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow SUPERADMIN', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'SUPERADMIN',
                isSuperAdmin: true,
            };
            requireOwnerOrSuperadmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny non-owner non-superadmin', () => {
            mockReq.org!.role = 'ADMIN';
            requireOwnerOrSuperadmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe('ORG_ROLE_HIERARCHY', () => {
        it('should have correct hierarchy values', () => {
            expect(ORG_ROLE_HIERARCHY.OWNER).toBe(4);
            expect(ORG_ROLE_HIERARCHY.ADMIN).toBe(3);
            expect(ORG_ROLE_HIERARCHY.MEMBER).toBe(2);
            expect(ORG_ROLE_HIERARCHY.CONSULTANT).toBe(1);
        });
    });
});


