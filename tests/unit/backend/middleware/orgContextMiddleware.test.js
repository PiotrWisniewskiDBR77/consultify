/**
 * Organization Context Middleware Tests
 * 
 * Tests for organization context resolution middleware:
 * - orgContextMiddleware (main middleware factory)
 * - resolveUserOrgAccess (utility)
 * - getUserOrganizations (utility)
 * 
 * NOTE: Tests SKIPPED due to Vitest/CJS mocking limitation.
 * vi.mock() does not intercept require() calls from server/ modules.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock database
vi.mock('../../../../server/database.js', () => ({
    default: {
        get: vi.fn(),
        all: vi.fn(),
        run: vi.fn(),
    }
}));

// Import after mocks
import db from '../../../../server/database.js';
import orgContextMiddleware from '../../../../server/middleware/orgContextMiddleware.js';

describe('Organization Context Middleware (DI Refactored)', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        vi.clearAllMocks();

        // Inject global db mock
        orgContextMiddleware.setDependencies({
            db: db
        });

        mockReq = {
            user: { id: 1, organization_id: 10 },
            headers: {},
            params: {},
            method: 'GET',
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

    // ===== Basic Functionality =====

    describe('basic functionality', () => {
        it('should return 401 when user is not authenticated and required=true', async () => {
            mockReq.user = null;

            const middleware = orgContextMiddleware({ required: true });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should set org to null and continue when user is not authenticated and required=false', async () => {
            mockReq.user = null;

            const middleware = orgContextMiddleware({ required: false });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.org).toBeNull();
            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should return 500 on database error', async () => {
            mockReq.params = { orgId: 1 };
            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                callback(new Error('Database connection failed'), null);
            });

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Internal error resolving organization context'
            });
        });
    });

    // ===== Org ID Resolution Priority =====

    describe('org ID resolution priority', () => {
        beforeEach(() => {
            // Setup successful member lookup
            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                if (sql.includes('organization_members')) {
                    callback(null, { id: 1, role: 'MEMBER', status: 'ACTIVE', permission_scope: '{}' });
                } else {
                    callback(null, null);
                }
            });
        });

        it('should use URL param as highest priority', async () => {
            mockReq.params = { orgId: 100 };
            mockReq.headers = { 'x-org-id': '200' };
            mockReq.user = { id: 1, organization_id: 300 };

            const middleware = orgContextMiddleware({ allowHeader: true });
            await middleware(mockReq, mockRes, mockNext);

            expect(db.get).toHaveBeenCalledWith(
                expect.any(String),
                [1, 100], // Should use URL param value
                expect.any(Function)
            );
        });

        it('should use header when URL param not provided and allowHeader=true', async () => {
            mockReq.params = {};
            mockReq.headers = { 'x-org-id': '200' };
            mockReq.user = { id: 1, organization_id: 300 };

            const middleware = orgContextMiddleware({ allowHeader: true });
            await middleware(mockReq, mockRes, mockNext);

            expect(db.get).toHaveBeenCalledWith(
                expect.any(String),
                [1, '200'],
                expect.any(Function)
            );
        });

        it('should NOT use header when allowHeader=false', async () => {
            mockReq.params = {};
            mockReq.headers = { 'x-org-id': '200' };
            mockReq.user = { id: 1, organization_id: 300 };
            mockReq.method = 'GET';

            const middleware = orgContextMiddleware({ allowHeader: false });
            await middleware(mockReq, mockRes, mockNext);

            expect(db.get).toHaveBeenCalledWith(
                expect.any(String),
                [1, 300], // Should fall back to user's org
                expect.any(Function)
            );
        });

        it('should use user default org for GET when no URL param or header', async () => {
            mockReq.params = {};
            mockReq.headers = {};
            mockReq.user = { id: 1, organization_id: 500 };
            mockReq.method = 'GET';

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(db.get).toHaveBeenCalledWith(
                expect.any(String),
                [1, 500],
                expect.any(Function)
            );
        });

        it('should use last_selected_org when organization_id not present', async () => {
            mockReq.params = {};
            mockReq.headers = {};
            mockReq.user = { id: 1, last_selected_org: 600 };
            mockReq.method = 'GET';

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(db.get).toHaveBeenCalledWith(
                expect.any(String),
                [1, 600],
                expect.any(Function)
            );
        });

        it('should use custom param name', async () => {
            mockReq.params = { customOrg: 999 };

            const middleware = orgContextMiddleware({ paramName: 'customOrg' });
            await middleware(mockReq, mockRes, mockNext);

            expect(db.get).toHaveBeenCalledWith(
                expect.any(String),
                [1, 999],
                expect.any(Function)
            );
        });

        it('should use custom header name', async () => {
            mockReq.params = {};
            mockReq.headers = { 'x-custom-org': '777' };

            const middleware = orgContextMiddleware({ allowHeader: true, headerName: 'x-custom-org' });
            await middleware(mockReq, mockRes, mockNext);

            expect(db.get).toHaveBeenCalledWith(
                expect.any(String),
                [1, '777'],
                expect.any(Function)
            );
        });
    });

    // ===== Write Operations (strictWrite) =====

    describe('write operations with strictWrite', () => {
        it('should require explicit orgId for POST when strictWrite=true', async () => {
            mockReq.params = {};
            mockReq.method = 'POST';
            mockReq.user = { id: 1, organization_id: 10 };

            const middleware = orgContextMiddleware({ strictWrite: true });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Organization context required',
                message: expect.stringContaining('Write operations require explicit')
            });
        });

        it('should require explicit orgId for PUT when strictWrite=true', async () => {
            mockReq.params = {};
            mockReq.method = 'PUT';

            const middleware = orgContextMiddleware({ strictWrite: true });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should require explicit orgId for PATCH when strictWrite=true', async () => {
            mockReq.params = {};
            mockReq.method = 'PATCH';

            const middleware = orgContextMiddleware({ strictWrite: true });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should require explicit orgId for DELETE when strictWrite=true', async () => {
            mockReq.params = {};
            mockReq.method = 'DELETE';

            const middleware = orgContextMiddleware({ strictWrite: true });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should allow user default for POST when strictWrite=false', async () => {
            mockReq.params = {};
            mockReq.method = 'POST';
            mockReq.user = { id: 1, organization_id: 10 };

            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                callback(null, { id: 1, role: 'ADMIN', status: 'ACTIVE', permission_scope: '{}' });
            });

            const middleware = orgContextMiddleware({ strictWrite: false });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should allow POST with explicit URL param even with strictWrite=true', async () => {
            mockReq.params = { orgId: 10 };
            mockReq.method = 'POST';

            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                callback(null, { id: 1, role: 'ADMIN', status: 'ACTIVE', permission_scope: '{}' });
            });

            const middleware = orgContextMiddleware({ strictWrite: true });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });
    });

    // ===== Membership Verification =====

    describe('membership verification', () => {
        it('should attach org context for valid member', async () => {
            mockReq.params = { orgId: 10 };

            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                if (sql.includes('organization_members')) {
                    callback(null, {
                        id: 1,
                        role: 'ADMIN',
                        status: 'ACTIVE',
                        permission_scope: '{"can_edit": true}'
                    });
                } else {
                    callback(null, null);
                }
            });

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.org).toEqual({
                id: 10,
                source: 'url_param',
                isMember: true,
                isConsultant: false,
                role: 'ADMIN',
                permissionScope: { can_edit: true },
                membershipId: 1
            });
            expect(mockReq.orgContext).toEqual(mockReq.org);
            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should check consultant link if not a member', async () => {
            mockReq.params = { orgId: 10 };

            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                if (sql.includes('organization_members')) {
                    callback(null, null); // Not a member
                } else if (sql.includes('consultant_org_links')) {
                    callback(null, {
                        id: 5,
                        status: 'ACTIVE',
                        permission_scope: '{"view_reports": true}'
                    });
                }
            });

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.org).toEqual({
                id: 10,
                source: 'url_param',
                isMember: false,
                isConsultant: true,
                role: 'CONSULTANT',
                permissionScope: { view_reports: true },
                membershipId: 5
            });
        });

        it('should return 403 when user has no access', async () => {
            mockReq.params = { orgId: 10 };

            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                callback(null, null); // No membership or consultant link found
            });

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Access denied',
                message: 'You do not have access to this organization.'
            });
        });

        it('should not find INACTIVE membership', async () => {
            mockReq.params = { orgId: 10 };

            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                // The SQL query includes status = 'ACTIVE', so inactive won't be returned
                callback(null, null);
            });

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    // ===== Required Option =====

    describe('required option', () => {
        it('should return 400 when org cannot be resolved and required=true', async () => {
            mockReq.params = {};
            mockReq.headers = {};
            mockReq.user = { id: 1 }; // No organization_id
            mockReq.method = 'GET';

            const middleware = orgContextMiddleware({ required: true });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Organization context required',
                message: 'Please specify organization via URL parameter.'
            });
        });

        it('should set org to null and continue when required=false', async () => {
            mockReq.params = {};
            mockReq.headers = {};
            mockReq.user = { id: 1 }; // No organization_id
            mockReq.method = 'GET';

            const middleware = orgContextMiddleware({ required: false });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.org).toBeNull();
            expect(mockNext).toHaveBeenCalledTimes(1);
        });
    });

    // ===== Permission Scope Parsing =====

    describe('permission scope parsing', () => {
        it('should parse JSON permission scope', async () => {
            mockReq.params = { orgId: 10 };

            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                if (sql.includes('organization_members')) {
                    callback(null, {
                        id: 1,
                        role: 'MEMBER',
                        status: 'ACTIVE',
                        permission_scope: '{"view": true, "edit": false, "permissions": ["read", "write"]}'
                    });
                } else {
                    callback(null, null);
                }
            });

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.org.permissionScope).toEqual({
                view: true,
                edit: false,
                permissions: ['read', 'write']
            });
        });

        it('should handle null permission_scope', async () => {
            mockReq.params = { orgId: 10 };

            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                if (sql.includes('organization_members')) {
                    callback(null, {
                        id: 1,
                        role: 'MEMBER',
                        status: 'ACTIVE',
                        permission_scope: null
                    });
                } else {
                    callback(null, null);
                }
            });

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.org.permissionScope).toEqual({});
        });

        it('should handle empty string permission_scope', async () => {
            mockReq.params = { orgId: 10 };

            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                if (sql.includes('organization_members')) {
                    callback(null, {
                        id: 1,
                        role: 'MEMBER',
                        status: 'ACTIVE',
                        permission_scope: ''
                    });
                } else {
                    callback(null, null);
                }
            });

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.org.permissionScope).toEqual({});
        });
    });

    // ===== Org Source Tracking =====

    describe('org source tracking', () => {
        beforeEach(() => {
            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                callback(null, { id: 1, role: 'MEMBER', status: 'ACTIVE', permission_scope: '{}' });
            });
        });

        it('should set source to url_param when from URL', async () => {
            mockReq.params = { orgId: 10 };

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.org.source).toBe('url_param');
        });

        it('should set source to header when from header', async () => {
            mockReq.params = {};
            mockReq.headers = { 'x-org-id': '20' };

            const middleware = orgContextMiddleware({ allowHeader: true });
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.org.source).toBe('header');
        });

        it('should set source to user_default when from user context', async () => {
            mockReq.params = {};
            mockReq.headers = {};
            mockReq.user = { id: 1, organization_id: 30 };
            mockReq.method = 'GET';

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockReq.org.source).toBe('user_default');
        });
    });

    // ===== Default Options =====

    describe('default options', () => {
        it('should use default options when none provided', async () => {
            mockReq.params = { orgId: 10 };

            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                callback(null, { id: 1, role: 'MEMBER', status: 'ACTIVE', permission_scope: '{}' });
            });

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should have allowHeader=false by default', async () => {
            mockReq.params = {};
            mockReq.headers = { 'x-org-id': '10' };
            mockReq.user = { id: 1 };
            mockReq.method = 'GET';

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            // Should not use header, so should fail to find org
            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should have strictWrite=true by default', async () => {
            mockReq.params = {};
            mockReq.method = 'POST';
            mockReq.user = { id: 1, organization_id: 10 };

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should have required=true by default', async () => {
            mockReq.params = {};
            mockReq.user = { id: 1 };
            mockReq.method = 'GET';

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });

    // ===== Method Case Handling =====

    describe('method case handling', () => {
        beforeEach(() => {
            vi.mocked(db.get).mockImplementation((sql, params, callback) => {
                callback(null, { id: 1, role: 'MEMBER', status: 'ACTIVE', permission_scope: '{}' });
            });
        });

        it('should handle lowercase method', async () => {
            mockReq.params = { orgId: 10 };
            mockReq.method = 'get';

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should handle undefined method (default to GET)', async () => {
            mockReq.params = { orgId: 10 };
            mockReq.method = undefined;

            const middleware = orgContextMiddleware();
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });
    });
});








