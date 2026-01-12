/**
 * Admin Middleware Tests
 * 
 * Tests for admin authentication and permission middleware:
 * - verifyAdmin
 * - checkPermission
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock jsonwebtoken - kept to prevent side effects, though we inject it
vi.mock('jsonwebtoken', () => ({
    default: {
        verify: vi.fn()
    },
    verify: vi.fn()
}));

// Import after mocking
import { verifyAdmin, checkPermission, setDependencies } from '../../../../server/middleware/adminMiddleware.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_this_in_production';

describe('Admin Middleware (DI Refactored)', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    // Mock JWT object that we will inject
    beforeEach(() => {
        vi.clearAllMocks();

        // Inject dependencies using the imported mocked jwt
        // This ensures the tests that set implementations on jwt.verify work correctly
        setDependencies({
            jwt: jwt
        });

        // Also update the global mock for consistency in existing tests that might rely on it implicitly 
        // (though we replaced them to use mockJwt in the test body usually)
        // Actually, better to just update tests to expect calls on mockJwt or use vi.mocked(mockJwt.verify)

        mockReq = {
            headers: {},
            user: null,
            userId: null,
            userRole: null,
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

    // ===== verifyAdmin Tests =====

    describe('verifyAdmin', () => {
        describe('token validation', () => {
            it('should return 403 when no token is provided', () => {
                mockReq.headers = {};

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('should accept token from authorization header', () => {
                mockReq.headers = { authorization: 'Bearer valid-token' };
                vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                    callback(null, { id: 1, role: 'ADMIN' });
                });

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(jwt.verify).toHaveBeenCalledWith(
                    'valid-token',
                    JWT_SECRET,
                    expect.any(Function)
                );
            });

            it('should accept token from x-access-token header', () => {
                mockReq.headers = { 'x-access-token': 'valid-token' };
                vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                    callback(null, { id: 1, role: 'ADMIN' });
                });

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(jwt.verify).toHaveBeenCalled();
            });

            it('should strip "Bearer " prefix from token', () => {
                mockReq.headers = { authorization: 'Bearer my-jwt-token' };
                vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                    callback(null, { id: 1, role: 'ADMIN' });
                });

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(jwt.verify).toHaveBeenCalledWith(
                    'my-jwt-token',
                    JWT_SECRET,
                    expect.any(Function)
                );
            });

            it('should handle token without "Bearer " prefix', () => {
                mockReq.headers = { authorization: 'raw-token' };
                vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                    callback(null, { id: 1, role: 'ADMIN' });
                });

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(jwt.verify).toHaveBeenCalledWith(
                    'raw-token',
                    JWT_SECRET,
                    expect.any(Function)
                );
            });

            it('should return 401 for invalid token', () => {
                mockReq.headers = { authorization: 'Bearer invalid-token' };
                vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                    callback(new Error('Invalid token'), null);
                });

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
            });

            it('should return 401 for expired token', () => {
                mockReq.headers = { authorization: 'Bearer expired-token' };
                vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                    const error = new Error('Token expired');
                    error.name = 'TokenExpiredError';
                    callback(error, null);
                });

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(401);
            });
        });

        describe('role verification', () => {
            it('should allow ADMIN role', () => {
                mockReq.headers = { authorization: 'Bearer valid-token' };
                vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                    callback(null, { id: 1, role: 'ADMIN' });
                });

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
                expect(mockReq.user).toEqual({ id: 1, role: 'ADMIN' });
                expect(mockReq.userId).toBe(1);
                expect(mockReq.userRole).toBe('ADMIN');
            });

            it('should allow SUPERADMIN role', () => {
                mockReq.headers = { authorization: 'Bearer valid-token' };
                vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                    callback(null, { id: 2, role: 'SUPERADMIN' });
                });

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
                expect(mockReq.userRole).toBe('SUPERADMIN');
            });

            it('should deny USER role', () => {
                mockReq.headers = { authorization: 'Bearer valid-token' };
                vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                    callback(null, { id: 3, role: 'USER' });
                });

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith({ error: 'Admin privileges required' });
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('should deny MEMBER role', () => {
                mockReq.headers = { authorization: 'Bearer valid-token' };
                vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                    callback(null, { id: 4, role: 'MEMBER' });
                });

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
            });

            it('should deny when role is undefined', () => {
                mockReq.headers = { authorization: 'Bearer valid-token' };
                vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                    callback(null, { id: 5 }); // No role
                });

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
            });
        });

        describe('request population', () => {
            it('should populate req.user, req.userId, and req.userRole', () => {
                mockReq.headers = { authorization: 'Bearer valid-token' };
                const decodedToken = {
                    id: 42,
                    role: 'ADMIN',
                    email: 'admin@example.com',
                    organization_id: 10
                };

                vi.mocked(jwt.verify).mockImplementation((token, secret, callback) => {
                    callback(null, decodedToken);
                });

                verifyAdmin(mockReq, mockRes, mockNext);

                expect(mockReq.user).toEqual(decodedToken);
                expect(mockReq.userId).toBe(42);
                expect(mockReq.userRole).toBe('ADMIN');
            });
        });
    });

    // ===== checkPermission Tests =====

    describe('checkPermission', () => {
        describe('SUPERADMIN permissions', () => {
            beforeEach(() => {
                mockReq.userRole = 'SUPERADMIN';
                mockReq.user = { role: 'SUPERADMIN' };
            });

            it('should allow all organization permissions', () => {
                const permissions = ['org:create', 'org:read', 'org:update', 'org:delete'];

                for (const perm of permissions) {
                    const middleware = checkPermission(perm);
                    middleware(mockReq, mockRes, mockNext);
                }

                expect(mockNext).toHaveBeenCalledTimes(permissions.length);
            });

            it('should allow all user permissions', () => {
                const permissions = ['user:create', 'user:read', 'user:update', 'user:delete', 'user:reset_password'];

                mockNext.mockClear();
                for (const perm of permissions) {
                    const middleware = checkPermission(perm);
                    middleware(mockReq, mockRes, mockNext);
                }

                expect(mockNext).toHaveBeenCalledTimes(permissions.length);
            });

            it('should allow connectors:manage', () => {
                const middleware = checkPermission('connectors:manage');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('should allow settings:global', () => {
                const middleware = checkPermission('settings:global');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });
        });

        describe('ADMIN permissions', () => {
            beforeEach(() => {
                mockReq.userRole = 'ADMIN';
                mockReq.user = { role: 'ADMIN' };
            });

            it('should allow user management permissions', () => {
                const permissions = ['user:create', 'user:read', 'user:update', 'user:delete'];

                for (const perm of permissions) {
                    const middleware = checkPermission(perm);
                    middleware(mockReq, mockRes, mockNext);
                }

                expect(mockNext).toHaveBeenCalledTimes(permissions.length);
            });

            it('should allow project and task permissions', () => {
                const permissions = ['project:create', 'project:read', 'project:update', 'project:delete', 'task:assign'];

                mockNext.mockClear();
                for (const perm of permissions) {
                    const middleware = checkPermission(perm);
                    middleware(mockReq, mockRes, mockNext);
                }

                expect(mockNext).toHaveBeenCalledTimes(permissions.length);
            });

            it('should deny org:create (SUPERADMIN only)', () => {
                const middleware = checkPermission('org:create');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Permission denied',
                    required: 'org:create',
                    role: 'ADMIN'
                });
            });

            it('should deny settings:global (SUPERADMIN only)', () => {
                const middleware = checkPermission('settings:global');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
            });

            it('should allow settings:org', () => {
                const middleware = checkPermission('settings:org');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('should allow connectors:manage', () => {
                const middleware = checkPermission('connectors:manage');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });
        });

        describe('USER permissions', () => {
            beforeEach(() => {
                mockReq.userRole = 'USER';
                mockReq.user = { role: 'USER' };
            });

            it('should allow project:read', () => {
                const middleware = checkPermission('project:read');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('should allow task:create and task:read', () => {
                mockNext.mockClear();

                checkPermission('task:create')(mockReq, mockRes, mockNext);
                checkPermission('task:read')(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(2);
            });

            it('should allow task:update:own', () => {
                const middleware = checkPermission('task:update:own');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('should allow task:delete:own', () => {
                const middleware = checkPermission('task:delete:own');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('should allow settings:own', () => {
                const middleware = checkPermission('settings:own');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('should deny project:create', () => {
                const middleware = checkPermission('project:create');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
            });

            it('should deny user management permissions', () => {
                const deniedPermissions = ['user:create', 'user:update', 'user:delete'];

                for (const perm of deniedPermissions) {
                    mockRes.status.mockClear();
                    const middleware = checkPermission(perm);
                    middleware(mockReq, mockRes, mockNext);
                    expect(mockRes.status).toHaveBeenCalledWith(403);
                }
            });

            it('should deny task:assign', () => {
                const middleware = checkPermission('task:assign');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
            });
        });

        describe(':own permission handling', () => {
            beforeEach(() => {
                mockReq.userRole = 'USER';
            });

            it('should grant :own permission when user has base permission', () => {
                // USER has task:update:own - should match task:update:own request
                const middleware = checkPermission('task:update:own');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('should grant :own permission when user has full permission', () => {
                // ADMIN has task:update - should also match task:update:own
                mockReq.userRole = 'ADMIN';

                const middleware = checkPermission('task:update:own');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });
        });

        describe('unknown roles', () => {
            it('should deny all permissions for unknown role', () => {
                mockReq.userRole = 'UNKNOWN_ROLE';

                const middleware = checkPermission('project:read');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
            });

            it('should deny all permissions when role is undefined', () => {
                mockReq.userRole = undefined;
                mockReq.user = {};

                const middleware = checkPermission('project:read');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
            });
        });

        describe('role extraction', () => {
            it('should use req.userRole if available', () => {
                mockReq.userRole = 'ADMIN';
                mockReq.user = { role: 'USER' }; // Different role in user object

                const middleware = checkPermission('user:create');
                middleware(mockReq, mockRes, mockNext);

                // Should use ADMIN from userRole, which has user:create
                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('should fall back to req.user.role if userRole not set', () => {
                mockReq.userRole = undefined;
                mockReq.user = { role: 'ADMIN' };

                const middleware = checkPermission('user:create');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });
        });
    });

    // ===== Edge Cases =====

    describe('Edge Cases', () => {
        it('should handle null headers object', () => {
            mockReq.headers = null;

            // verifyAdmin checks for token first
            expect(() => verifyAdmin(mockReq, mockRes, mockNext)).not.toThrow();
        });

        it('should handle permission with special characters', () => {
            mockReq.userRole = 'SUPERADMIN';

            const middleware = checkPermission('some:complex:permission');
            middleware(mockReq, mockRes, mockNext);

            // SUPERADMIN doesn't have this, should deny
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should handle empty permission string', () => {
            mockReq.userRole = 'ADMIN';

            const middleware = checkPermission('');
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });
});
