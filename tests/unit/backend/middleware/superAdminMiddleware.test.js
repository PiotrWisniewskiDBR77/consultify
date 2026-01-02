/**
 * Super Admin Middleware Tests
 * 
 * Tests for super admin authentication middleware:
 * - verifySuperAdmin
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock jsonwebtoken
// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
    default: {
        verify: vi.fn()
    },
    verify: vi.fn()
}));

// Import after mocking
import verifySuperAdmin from '../../../../server/middleware/superAdminMiddleware.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_this_in_production';

describe('Super Admin Middleware (DI Refactored)', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    let mockDb;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDb = {
            get: vi.fn().mockImplementation((sql, params, cb) => cb(null, null)), // Default no user
        };

        // Inject dependencies using the global mocked jwt AND mock db
        verifySuperAdmin.setDependencies({
            jwt: jwt,
            db: mockDb
        });

        mockReq = {
            headers: {},
            user: null,
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };

        mockNext = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ===== Token Validation =====

    describe('token validation', () => {
        it('should return 403 when no authorization header is provided', () => {
            mockReq.headers = {};

            verifySuperAdmin(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 403 when authorization header is null', () => {
            mockReq.headers = { authorization: null };

            verifySuperAdmin(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should return 403 when authorization header is empty string', () => {
            mockReq.headers = { authorization: '' };

            verifySuperAdmin(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should extract token after "Bearer " prefix', () => {
            mockReq.headers = { authorization: 'Bearer my-superadmin-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, { id: 1, role: 'SUPERADMIN' });
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);

            expect(jwt.verify).toHaveBeenCalledWith(
                'my-superadmin-token',
                JWT_SECRET,
                expect.any(Function)
            );
        });

        it('should return 401 for invalid token', () => {
            mockReq.headers = { authorization: 'Bearer invalid-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(new Error('Invalid token'), null);
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 for expired token', () => {
            mockReq.headers = { authorization: 'Bearer expired-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                const error = new Error('jwt expired');
                error.name = 'TokenExpiredError';
                callback(error, null);
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should return 401 for malformed token', () => {
            mockReq.headers = { authorization: 'Bearer malformed.token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(new Error('jwt malformed'), null);
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });
    });

    // ===== Role Verification =====

    // ===== Role Verification =====

    describe('role verification', () => {
        it('should allow SUPERADMIN role', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, { id: 1, role: 'SUPERADMIN' });
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10)); // Allow async callback to finish

            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(mockReq.user).toEqual({ id: 1, role: 'SUPERADMIN' });
        });

        it('should allow SUPER_ADMIN role (alternative format)', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, { id: 2, role: 'SUPER_ADMIN' });
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(mockReq.user).toEqual({ id: 2, role: 'SUPER_ADMIN' });
        });

        it('should deny ADMIN role', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, { id: 3, role: 'ADMIN' });
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Requires Super Admin privileges' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should deny USER role', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, { id: 4, role: 'USER' });
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should deny OWNER role', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, { id: 5, role: 'OWNER' });
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should deny when role is undefined', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, { id: 6 }); // No role property
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should deny when role is null', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, { id: 7, role: null });
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should deny when role is empty string', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, { id: 8, role: '' });
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    // ===== Request Population =====

    describe('request population', () => {
        it('should populate req.user with decoded token', () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            const decodedToken = {
                id: 100,
                role: 'SUPERADMIN',
                email: 'superadmin@example.com',
                name: 'Super Admin'
            };

            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, decodedToken);
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);

            expect(mockReq.user).toEqual(decodedToken);
        });

        it('should preserve all decoded token properties', () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            const decodedToken = {
                id: 101,
                role: 'SUPERADMIN',
                email: 'admin@test.com',
                organization_id: 999,
                iat: 1234567890,
                exp: 9999999999,
                customField: 'customValue'
            };

            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, decodedToken);
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);

            expect(mockReq.user).toEqual(decodedToken);
            expect(mockReq.user.customField).toBe('customValue');
        });
    });

    // ===== Edge Cases =====

    describe('edge cases', () => {
        it('should handle token with only space after Bearer', () => {
            mockReq.headers = { authorization: 'Bearer ' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(new Error('jwt must be provided'), null);
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);

            // Should attempt to verify empty string, which will fail
            expect(jwt.verify).toHaveBeenCalled();
        });

        it('should handle role with different casing (lowercase)', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, { id: 1, role: 'superadmin' }); // lowercase
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            // Current implementation is case-sensitive, so lowercase should fail
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should handle role with mixed casing', async () => {
            mockReq.headers = { authorization: 'Bearer valid-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, { id: 1, role: 'SuperAdmin' }); // Mixed case
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should not modify original headers', async () => {
            const originalHeaders = { authorization: 'Bearer my-token' };
            mockReq.headers = { ...originalHeaders };

            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(null, { id: 1, role: 'SUPERADMIN' });
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockReq.headers).toEqual(originalHeaders);
        });
    });

    // ===== Security Tests =====

    describe('security', () => {
        it('should not expose JWT_SECRET in error responses', () => {
            mockReq.headers = { authorization: 'Bearer invalid-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(new Error('Secret mismatch'), null);
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);

            // Check that response doesn't contain secret
            const jsonCall = mockRes.json.mock.calls[0][0];
            expect(JSON.stringify(jsonCall)).not.toContain(JWT_SECRET);
            expect(JSON.stringify(jsonCall)).not.toContain('secret');
        });

        it('should not expose token in error responses', () => {
            mockReq.headers = { authorization: 'Bearer my-sensitive-token' };
            vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                callback(new Error('Invalid token'), null);
            });

            verifySuperAdmin(mockReq, mockRes, mockNext);

            const jsonCall = mockRes.json.mock.calls[0][0];
            expect(JSON.stringify(jsonCall)).not.toContain('my-sensitive-token');
        });
    });
});
