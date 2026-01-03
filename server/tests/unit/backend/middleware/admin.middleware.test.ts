/**
 * Admin Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { verifyAdmin, checkPermission, setDependencies, type AuthRequest } from '../../../../src/middleware/admin.middleware.js';
import jwt from 'jsonwebtoken';

describe('Admin Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockJwt: typeof jwt;

    beforeEach(() => {
        mockNext = vi.fn();
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        mockJwt = {
            verify: vi.fn(),
        } as unknown as typeof jwt;

        setDependencies({
            jwt: mockJwt,
            config: { JWT_SECRET: 'test-secret' },
        });

        mockReq = {
            headers: {},
        };
    });

    describe('verifyAdmin', () => {
        it('should return 403 when no token provided', () => {
            verifyAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
        });

        it('should allow ADMIN role', () => {
            mockReq.headers = { authorization: 'Bearer admin-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'ADMIN', organizationId: 'org-123' });
            });

            verifyAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user?.role).toBe('ADMIN');
        });

        it('should allow SUPERADMIN role', () => {
            mockReq.headers = { authorization: 'Bearer superadmin-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'SUPERADMIN', organizationId: 'org-123' });
            });

            verifyAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user?.isSuperAdmin).toBe(true);
        });

        it('should reject non-admin roles', () => {
            mockReq.headers = { authorization: 'Bearer user-token' };
            (mockJwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation((_token, _secret, callback) => {
                callback(null, { id: 'user-123', role: 'USER', organizationId: 'org-123' });
            });

            verifyAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Admin privileges required' });
        });
    });

    describe('checkPermission', () => {
        it('should allow SUPERADMIN all permissions', () => {
            mockReq.userRole = 'SUPERADMIN';
            const middleware = checkPermission('org:create');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow ADMIN for admin permissions', () => {
            mockReq.userRole = 'ADMIN';
            const middleware = checkPermission('user:create');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny USER for admin permissions', () => {
            mockReq.userRole = 'USER';
            const middleware = checkPermission('org:create');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should allow :own permissions', () => {
            mockReq.userRole = 'USER';
            const middleware = checkPermission('task:update:own');
            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });
});



