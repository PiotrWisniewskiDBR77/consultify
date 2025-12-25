import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    auditAction
} from '../../../../server/middleware/permissionMiddleware';

// Mock services
vi.mock('../../../../server/services/permissionService', () => ({
    default: {
        hasPermission: vi.fn()
    },
    hasPermission: vi.fn()
}));

vi.mock('../../../../server/services/governanceAuditService', () => ({
    default: {
        logAudit: vi.fn()
    },
    logAudit: vi.fn()
}));

const PermissionService = require('../../../../server/services/permissionService');
const GovernanceAuditService = require('../../../../server/services/governanceAuditService');

describe('Permission Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            userId: 1,
            organizationId: 100,
            userRole: 'ADMIN'
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            statusCode: 200
        };
        next = vi.fn();
        vi.clearAllMocks();
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

            PermissionService.hasPermission.mockResolvedValue(true);

            const middleware = requirePermission('VIEW_INITIATIVES');
            await middleware(req, res, next);

            expect(PermissionService.hasPermission).toHaveBeenCalledWith(
                2,
                100,
                'VIEW_INITIATIVES',
                'MEMBER'
            );
            expect(next).toHaveBeenCalled();
        });

        it('should allow access when permission is granted', async () => {
            PermissionService.hasPermission.mockResolvedValue(true);

            const middleware = requirePermission('VIEW_INITIATIVES');
            await middleware(req, res, next);

            expect(PermissionService.hasPermission).toHaveBeenCalledWith(
                1,
                100,
                'VIEW_INITIATIVES',
                'ADMIN'
            );
            expect(req.permissionChecked).toBe('VIEW_INITIATIVES');
            expect(next).toHaveBeenCalled();
        });

        it('should deny access when permission is not granted', async () => {
            PermissionService.hasPermission.mockResolvedValue(false);

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
            PermissionService.hasPermission.mockRejectedValue(new Error('Database error'));

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
            PermissionService.hasPermission
                .mockResolvedValueOnce(false) // First permission denied
                .mockResolvedValueOnce(true); // Second permission granted

            const middleware = requireAnyPermission(['VIEW_INITIATIVES', 'EDIT_INITIATIVES']);
            await middleware(req, res, next);

            expect(PermissionService.hasPermission).toHaveBeenCalledTimes(2);
            expect(req.permissionChecked).toBe('EDIT_INITIATIVES');
            expect(next).toHaveBeenCalled();
        });

        it('should deny access when all permissions are denied', async () => {
            PermissionService.hasPermission.mockResolvedValue(false);

            const middleware = requireAnyPermission(['VIEW_INITIATIVES', 'EDIT_INITIATIVES']);
            await middleware(req, res, next);

            expect(PermissionService.hasPermission).toHaveBeenCalledTimes(2);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Permission denied',
                requiredAny: ['VIEW_INITIATIVES', 'EDIT_INITIATIVES'],
                code: 'PERMISSION_DENIED'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should stop checking after first permission is granted', async () => {
            PermissionService.hasPermission.mockResolvedValueOnce(true);

            const middleware = requireAnyPermission(['VIEW_INITIATIVES', 'EDIT_INITIATIVES', 'DELETE_INITIATIVES']);
            await middleware(req, res, next);

            expect(PermissionService.hasPermission).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalled();
        });

        it('should return 500 on service error', async () => {
            PermissionService.hasPermission.mockRejectedValue(new Error('Database error'));

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
            PermissionService.hasPermission.mockResolvedValue(true);

            const middleware = requireAllPermissions(['VIEW_INITIATIVES', 'EDIT_INITIATIVES']);
            await middleware(req, res, next);

            expect(PermissionService.hasPermission).toHaveBeenCalledTimes(2);
            expect(req.permissionChecked).toEqual(['VIEW_INITIATIVES', 'EDIT_INITIATIVES']);
            expect(next).toHaveBeenCalled();
        });

        it('should deny access when any permission is missing', async () => {
            PermissionService.hasPermission
                .mockResolvedValueOnce(true) // First permission granted
                .mockResolvedValueOnce(false); // Second permission denied

            const middleware = requireAllPermissions(['VIEW_INITIATIVES', 'EDIT_INITIATIVES']);
            await middleware(req, res, next);

            expect(PermissionService.hasPermission).toHaveBeenCalledTimes(2);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Permission denied',
                missing: ['EDIT_INITIATIVES'],
                code: 'PERMISSION_DENIED'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should list all missing permissions', async () => {
            PermissionService.hasPermission.mockResolvedValue(false);

            const middleware = requireAllPermissions(['VIEW_INITIATIVES', 'EDIT_INITIATIVES', 'DELETE_INITIATIVES']);
            await middleware(req, res, next);

            expect(res.json).toHaveBeenCalledWith({
                error: 'Permission denied',
                missing: ['VIEW_INITIATIVES', 'EDIT_INITIATIVES', 'DELETE_INITIATIVES'],
                code: 'PERMISSION_DENIED'
            });
        });

        it('should return 500 on service error', async () => {
            PermissionService.hasPermission.mockRejectedValue(new Error('Database error'));

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
        it('should log audit on successful response', async () => {
            GovernanceAuditService.logAudit.mockResolvedValue();

            const middleware = auditAction({
                action: 'CREATE',
                resourceType: 'INITIATIVE',
                getResourceId: (req, data) => data?.id || null
            });

            await middleware(req, res, next);
            expect(next).toHaveBeenCalled();

            // Simulate successful response
            const originalJson = res.json;
            res.json = vi.fn().mockReturnValue(res);
            res.statusCode = 200;

            await res.json({ id: 123, success: true });

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(GovernanceAuditService.logAudit).toHaveBeenCalledWith({
                actorId: 1,
                actorRole: 'ADMIN',
                orgId: 100,
                action: 'CREATE',
                resourceType: 'INITIATIVE',
                resourceId: 123,
                before: null,
                after: { id: 123, success: true },
                correlationId: undefined
            });
        });

        it('should not log audit on error response', async () => {
            const middleware = auditAction({
                action: 'CREATE',
                resourceType: 'INITIATIVE'
            });

            await middleware(req, res, next);

            res.statusCode = 400;
            res.json({ error: 'Bad request' });

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(GovernanceAuditService.logAudit).not.toHaveBeenCalled();
        });

        it('should use correlation ID from request header', async () => {
            req.get = vi.fn().mockReturnValue('correlation-123');
            req.correlationId = 'correlation-123';

            const middleware = auditAction({
                action: 'UPDATE',
                resourceType: 'INITIATIVE'
            });

            await middleware(req, res, next);
            res.statusCode = 200;
            res.json({ success: true });

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(GovernanceAuditService.logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    correlationId: 'correlation-123'
                })
            );
        });

        it('should handle audit logging errors gracefully', async () => {
            GovernanceAuditService.logAudit.mockRejectedValue(new Error('Audit service error'));

            const middleware = auditAction({
                action: 'DELETE',
                resourceType: 'INITIATIVE'
            });

            await middleware(req, res, next);
            res.statusCode = 200;
            
            // Should not throw
            await expect(res.json({ success: true })).resolves.toBeDefined();
        });

        it('should use custom getResourceId function', async () => {
            const getResourceId = vi.fn().mockReturnValue(456);

            const middleware = auditAction({
                action: 'CREATE',
                resourceType: 'PROJECT',
                getResourceId
            });

            await middleware(req, res, next);
            res.statusCode = 200;
            res.json({ id: 123 });

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(getResourceId).toHaveBeenCalledWith(req, { id: 123 });
            expect(GovernanceAuditService.logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    resourceId: 456
                })
            );
        });
    });
});

