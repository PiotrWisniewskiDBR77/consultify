/**
 * @vitest-environment node
 * Permission Middleware Tests - Fixed for CJS interop using vi.doMock
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Permission Middleware', () => {
    let req, res, next;
    let mockHasPermission;
    let mockLogAudit;
    let requirePermission, requireAnyPermission, requireAllPermissions, auditAction;

    beforeEach(async () => {
        // Reset module registry before mocking
        vi.resetModules();

        // Create fresh mocks before each test
        mockHasPermission = vi.fn();
        mockLogAudit = vi.fn();

        // Mock the services using vi.doMock (after resetModules)
        vi.doMock('../../../../server/services/permissionService', () => ({
            default: { hasPermission: mockHasPermission },
            hasPermission: mockHasPermission
        }));

        vi.doMock('../../../../server/services/governanceAuditService', () => ({
            default: { logAudit: mockLogAudit },
            logAudit: mockLogAudit
        }));

        // Import the middleware AFTER mocks are set up
        const middleware = await import('../../../../server/middleware/permissionMiddleware');
        requirePermission = middleware.requirePermission;
        requireAnyPermission = middleware.requireAnyPermission;
        requireAllPermissions = middleware.requireAllPermissions;
        auditAction = middleware.auditAction;

        req = {
            userId: 1,
            organizationId: 100,
            userRole: 'ADMIN',
            get: vi.fn().mockReturnValue(null)
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            statusCode: 200
        };
        next = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.doUnmock('../../../../server/services/permissionService');
        vi.doUnmock('../../../../server/services/governanceAuditService');
    });

    describe('requirePermission', () => {
        it('should return 401 if userId is missing', async () => {
            delete req.userId;
            delete req.user;

            const middleware = requirePermission('VIEW_INITIATIVES');
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should use req.user.id if userId is not present', async () => {
            delete req.userId;
            req.user = { id: 2, organization_id: 100, role: 'MEMBER' };

            mockHasPermission.mockResolvedValue(true);

            const middleware = requirePermission('VIEW_INITIATIVES');
            await middleware(req, res, next);

            expect(mockHasPermission).toHaveBeenCalledWith(
                2,
                100,
                'VIEW_INITIATIVES',
                'MEMBER'
            );
            expect(next).toHaveBeenCalled();
        });

        it('should allow access when permission is granted', async () => {
            mockHasPermission.mockResolvedValue(true);

            const middleware = requirePermission('VIEW_INITIATIVES');
            await middleware(req, res, next);

            expect(mockHasPermission).toHaveBeenCalledWith(
                1,
                100,
                'VIEW_INITIATIVES',
                'ADMIN'
            );
            expect(req.permissionChecked).toBe('VIEW_INITIATIVES');
            expect(next).toHaveBeenCalled();
        });

        it('should deny access when permission is not granted', async () => {
            mockHasPermission.mockResolvedValue(false);

            const middleware = requirePermission('DELETE_INITIATIVES');
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Permission denied',
                required: 'DELETE_INITIATIVES',
                code: 'PERMISSION_DENIED'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 500 on service error', async () => {
            mockHasPermission.mockRejectedValue(new Error('Database error'));

            const middleware = requirePermission('VIEW_INITIATIVES');
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Permission check failed',
                code: 'PERMISSION_ERROR'
            });
        });
    });

    describe('requireAnyPermission', () => {
        it('should return 401 if userId is missing', async () => {
            delete req.userId;
            delete req.user;

            const middleware = requireAnyPermission(['VIEW_INITIATIVES', 'EDIT_INITIATIVES']);
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        });

        it('should allow access when any permission is granted', async () => {
            mockHasPermission
                .mockResolvedValueOnce(false) // First permission denied
                .mockResolvedValueOnce(true); // Second permission granted

            const middleware = requireAnyPermission(['VIEW_INITIATIVES', 'EDIT_INITIATIVES']);
            await middleware(req, res, next);

            expect(mockHasPermission).toHaveBeenCalledTimes(2);
            expect(req.permissionChecked).toBe('EDIT_INITIATIVES');
            expect(next).toHaveBeenCalled();
        });

        it('should deny access when all permissions are denied', async () => {
            mockHasPermission.mockResolvedValue(false);

            const middleware = requireAnyPermission(['VIEW_INITIATIVES', 'EDIT_INITIATIVES']);
            await middleware(req, res, next);

            expect(mockHasPermission).toHaveBeenCalledTimes(2);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Permission denied',
                requiredAny: ['VIEW_INITIATIVES', 'EDIT_INITIATIVES'],
                code: 'PERMISSION_DENIED'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should stop checking after first permission is granted', async () => {
            mockHasPermission.mockResolvedValueOnce(true);

            const middleware = requireAnyPermission(['VIEW_INITIATIVES', 'EDIT_INITIATIVES', 'DELETE_INITIATIVES']);
            await middleware(req, res, next);

            expect(mockHasPermission).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalled();
        });

        it('should return 500 on service error', async () => {
            mockHasPermission.mockRejectedValue(new Error('Database error'));

            const middleware = requireAnyPermission(['VIEW_INITIATIVES']);
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Permission check failed',
                code: 'PERMISSION_ERROR'
            });
        });
    });

    describe('requireAllPermissions', () => {
        it('should return 401 if userId is missing', async () => {
            delete req.userId;
            delete req.user;

            const middleware = requireAllPermissions(['VIEW_INITIATIVES', 'EDIT_INITIATIVES']);
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        });

        it('should allow access when all permissions are granted', async () => {
            mockHasPermission.mockResolvedValue(true);

            const middleware = requireAllPermissions(['VIEW_INITIATIVES', 'EDIT_INITIATIVES']);
            await middleware(req, res, next);

            expect(mockHasPermission).toHaveBeenCalledTimes(2);
            expect(req.permissionChecked).toEqual(['VIEW_INITIATIVES', 'EDIT_INITIATIVES']);
            expect(next).toHaveBeenCalled();
        });

        it('should deny access when any permission is missing', async () => {
            mockHasPermission
                .mockResolvedValueOnce(true) // First permission granted
                .mockResolvedValueOnce(false); // Second permission denied

            const middleware = requireAllPermissions(['VIEW_INITIATIVES', 'EDIT_INITIATIVES']);
            await middleware(req, res, next);

            expect(mockHasPermission).toHaveBeenCalledTimes(2);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Permission denied',
                missing: ['EDIT_INITIATIVES'],
                code: 'PERMISSION_DENIED'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should list all missing permissions', async () => {
            mockHasPermission.mockResolvedValue(false);

            const middleware = requireAllPermissions(['VIEW_INITIATIVES', 'EDIT_INITIATIVES', 'DELETE_INITIATIVES']);
            await middleware(req, res, next);

            expect(res.json).toHaveBeenCalledWith({
                error: 'Permission denied',
                missing: ['VIEW_INITIATIVES', 'EDIT_INITIATIVES', 'DELETE_INITIATIVES'],
                code: 'PERMISSION_DENIED'
            });
        });

        it('should return 500 on service error', async () => {
            mockHasPermission.mockRejectedValue(new Error('Database error'));

            const middleware = requireAllPermissions(['VIEW_INITIATIVES']);
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Permission check failed',
                code: 'PERMISSION_ERROR'
            });
        });
    });

    describe('auditAction', () => {
        it('should call next immediately and set up audit hook', async () => {
            const middleware = auditAction({
                action: 'CREATE',
                resourceType: 'INITIATIVE',
                getResourceId: (req, data) => data?.id || null
            });

            await middleware(req, res, next);
            expect(next).toHaveBeenCalled();
            // res.json should now be wrapped
            expect(typeof res.json).toBe('function');
        });

        it('should log audit when res.json is called with 2xx status', async () => {
            mockLogAudit.mockResolvedValue(undefined);

            const middleware = auditAction({
                action: 'CREATE',
                resourceType: 'INITIATIVE',
                getResourceId: (req, data) => data?.id || null
            });

            await middleware(req, res, next);

            // Now call res.json which triggers the audit
            res.statusCode = 200;
            await res.json({ id: 123, success: true });

            // Wait for async audit to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockLogAudit).toHaveBeenCalledWith({
                actorId: 1,
                actorRole: 'ADMIN',
                orgId: 100,
                action: 'CREATE',
                resourceType: 'INITIATIVE',
                resourceId: 123,
                before: null,
                after: null,
                correlationId: null
            });
        });

        it('should not log audit on error response (4xx)', async () => {
            const middleware = auditAction({
                action: 'CREATE',
                resourceType: 'INITIATIVE'
            });

            await middleware(req, res, next);

            res.statusCode = 400;
            await res.json({ error: 'Bad request' });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockLogAudit).not.toHaveBeenCalled();
        });

        it('should use correlation ID from request', async () => {
            mockLogAudit.mockResolvedValue(undefined);
            req.correlationId = 'correlation-123';

            const middleware = auditAction({
                action: 'UPDATE',
                resourceType: 'INITIATIVE'
            });

            await middleware(req, res, next);
            res.statusCode = 200;
            await res.json({ success: true });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockLogAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    correlationId: 'correlation-123'
                })
            );
        });

        it('should handle audit logging errors gracefully', async () => {
            mockLogAudit.mockRejectedValue(new Error('Audit service error'));

            const middleware = auditAction({
                action: 'DELETE',
                resourceType: 'INITIATIVE'
            });

            await middleware(req, res, next);
            res.statusCode = 200;

            // Should not throw even if audit fails
            const result = await res.json({ success: true });
            expect(result).toBeDefined();
        });

        it('should use custom getResourceId function', async () => {
            mockLogAudit.mockResolvedValue(undefined);
            const getResourceId = vi.fn().mockReturnValue(456);

            const middleware = auditAction({
                action: 'CREATE',
                resourceType: 'PROJECT',
                getResourceId
            });

            await middleware(req, res, next);
            res.statusCode = 200;
            await res.json({ id: 123 });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(getResourceId).toHaveBeenCalledWith(req, { id: 123 });
            expect(mockLogAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    resourceId: 456
                })
            );
        });
    });
});

