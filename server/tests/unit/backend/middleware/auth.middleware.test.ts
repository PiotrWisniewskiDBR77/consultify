/**
 * Auth Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    type AuthRequest,
    optionalAuth,
    requireOrganization,
    requirePermission,
    requireRole,
    requireSuperAdmin,
    setDependencies,
    verifyToken,
} from '../../../../src/middleware/auth.middleware.js';

describe('Auth Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockJwt: typeof jwt;
    let mockDbGet: ReturnType<typeof vi.fn>;
    let mockPermissionService: {
        can: (user: unknown, capability: string, context?: unknown) => boolean;
    };

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        mockJwt = {
            verify: vi.fn(),
        } as unknown as typeof jwt;

        mockDbGet = vi.fn().mockResolvedValue(null);

        mockPermissionService = {
            can: vi.fn().mockReturnValue(true),
        };

        setDependencies({
            jwt: mockJwt,
            config: { JWT_SECRET: 'test-secret' },
            dbGet: mockDbGet as any,
            PermissionService: mockPermissionService,
        });

        mockReq = {
            headers: {},
            body: {},
            query: {},
        };
    });

    describe('verifyToken', () => {
        it('should return 403 when no token provided', async () => {
            await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should extract token from Authorization header with Bearer prefix', async () => {
            mockReq.headers = { authorization: 'Bearer test-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'team_member', name: 'Test User' });
            });

            await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockJwt.verify).toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should extract token from Authorization header without Bearer prefix', async () => {
            mockReq.headers = { authorization: 'test-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'team_member', name: 'Test User' });
            });

            await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockJwt.verify).toHaveBeenCalled();
        });

        it('should extract token from body', async () => {
            mockReq.body = { token: 'body-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'team_member', name: 'Test User' });
            });

            await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockJwt.verify).toHaveBeenCalled();
        });

        it('should extract token from query', async () => {
            mockReq.query = { token: 'query-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'team_member', name: 'Test User' });
            });

            await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockJwt.verify).toHaveBeenCalled();
        });

        it('should return 401 when token is expired', async () => {
            mockReq.headers = { authorization: 'Bearer expired-token' };
            const expiredError = new Error('Token expired');
            expiredError.name = 'TokenExpiredError';
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(expiredError, null);
            });

            await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 when token is invalid', async () => {
            mockReq.headers = { authorization: 'Bearer invalid-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(new Error('Invalid token'), null);
            });

            await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        });

        it('should attach user to request when token is valid', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            const decoded = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                role: 'administrator',
                organizationId: 'org-123',
                isSuperAdmin: false,
            };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, decoded);
            });

            await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.user).toBeDefined();
            expect(mockReq.user?.id).toBe('user-123');
            expect(mockReq.userId).toBe('user-123');
            expect(mockReq.organizationId).toBe('org-123');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should check token revocation when jti is present', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            const decoded = {
                id: 'user-123',
                jti: 'token-jti-123',
                iat: Math.floor(Date.now() / 1000),
            };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, decoded);
            });

            await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockDbGet).toHaveBeenCalled();
        });

        it('should reject revoked token', async () => {
            mockReq.headers = { authorization: 'Bearer revoked-token' };
            const decoded = {
                id: 'user-123',
                jti: 'revoked-jti',
            };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, decoded);
            });
            mockDbGet.mockResolvedValue({ jti: 'revoked-jti' });

            await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token has been revoked' });
        });

        it('should bypass auth in test mode when enabled', async () => {
            const originalEnv = process.env.NODE_ENV;
            const originalBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
            process.env.NODE_ENV = 'test';
            process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

            await verifyToken(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.user).toBeDefined();
            expect(mockReq.user?.id).toBe('test-user-id');
            expect(mockNext).toHaveBeenCalled();

            process.env.NODE_ENV = originalEnv;
            if (originalBypass) {
                process.env.ENABLE_TEST_AUTH_BYPASS = originalBypass;
            } else {
                delete process.env.ENABLE_TEST_AUTH_BYPASS;
            }
        });
    });

    describe('optionalAuth', () => {
        it('should continue without user when no token', async () => {
            await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user).toBeUndefined();
        });

        it('should attach user when valid token provided', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'team_member', name: 'Test User' });
            });

            await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockReq.user).toBeDefined();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should continue without user when token is invalid', async () => {
            mockReq.headers = { authorization: 'Bearer invalid-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(new Error('Invalid'), null);
            });

            await optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requireRole', () => {
        it('should return 401 when user not authenticated', () => {
            const middleware = requireRole('administrator');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        });

        it('should return 403 when user role not in required roles', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'team_member',
                name: 'Test User',
                email: 'test@example.com',
                organizationId: 'org-123',
                isSuperAdmin: false,
            };
            const middleware = requireRole('administrator', 'project_manager');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
        });

        it('should allow access when user role matches', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'administrator',
                name: 'Test Admin',
                email: 'admin@example.com',
                organizationId: 'org-123',
                isSuperAdmin: false,
            };
            const middleware = requireRole('administrator', 'project_manager');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requireSuperAdmin', () => {
        it('should return 401 when user not authenticated', () => {
            requireSuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should return 403 when user is not super admin', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'administrator',
                name: 'Test Admin',
                email: 'admin@example.com',
                organizationId: 'org-123',
                isSuperAdmin: false,
            };
            requireSuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Super admin access required' });
        });

        it('should allow access when user is super admin', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'administrator',
                name: 'Super Admin',
                email: 'super@example.com',
                organizationId: 'org-123',
                isSuperAdmin: true,
            };
            requireSuperAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requireOrganization', () => {
        it('should return 403 when organizationId not present', () => {
            requireOrganization(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Organization context required' });
        });

        it('should allow access when organizationId is present', () => {
            mockReq.organizationId = 'org-123';
            requireOrganization(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('requirePermission', () => {
        it('should return 401 when user not authenticated', () => {
            const middleware = requirePermission('read:projects');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should return 403 when user lacks permission', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'team_member',
                name: 'Test User',
                email: 'test@example.com',
                organizationId: 'org-123',
                isSuperAdmin: false,
            };
            mockReq.can = vi.fn().mockReturnValue(false);
            const middleware = requirePermission('read:projects');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should allow access when user has permission', () => {
            mockReq.user = {
                id: 'user-123',
                role: 'team_member',
                name: 'Test User',
                email: 'test@example.com',
                organizationId: 'org-123',
                isSuperAdmin: false,
            };
            mockReq.can = vi.fn().mockReturnValue(true);
            const middleware = requirePermission('read:projects');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });
});



