/**
 * Permission Middleware Tests
 * 
 * Tests for database-backed permission checking middleware:
 * - requirePermission
 * - requireAnyPermission
 * - requireAllPermissions
 * - auditAction
 * 
 * NOTE: Tests SKIPPED due to Vitest/CJS mocking limitation.
 * vi.mock() does not intercept require() calls from server/ modules.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../../../server/services/permissionService', () => ({
    default: {
        hasPermission: vi.fn()
    }
}));

vi.mock('../../../../server/services/governanceAuditService', () => ({
    default: {
        logAudit: vi.fn()
    }
}));

// Import after mocks
import PermissionService from '../../../../server/services/permissionService';
import GovernanceAuditService from '../../../../server/services/governanceAuditService';
import {
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    auditAction,
    setDependencies
} from '../../../../server/middleware/permissionMiddleware.js';

describe('Permission Middleware (DI Refactored)', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        vi.clearAllMocks();

        // Inject global service mocks
        setDependencies({
            PermissionService: PermissionService,
            GovernanceAuditService: GovernanceAuditService
        });

        mockReq = {
            user: { id: 1, role: 'ADMIN', organization_id: 10 },
            userId: 1,
            organizationId: 10,
            userRole: 'ADMIN',
            headers: {},
            body: {},
            params: {},
            get: vi.fn((header) => mockReq.headers[header.toLowerCase()]),
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            statusCode: 200,
        };

        mockNext = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ===== requirePermission Tests =====

    describe('requirePermission', () => {
        describe('authentication', () => {
            it('should return 401 when userId is not present', async () => {
                mockReq.userId = null;
                mockReq.user = null;

                const middleware = requirePermission('PLAYBOOK_PUBLISH');
                await middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('should extract userId from req.user when req.userId is missing', async () => {
                mockReq.userId = null;
                mockReq.userRole = null;
                mockReq.user = { id: 5, role: 'USER' };
                vi.mocked(PermissionService.hasPermission).mockResolvedValue(true);

                const middleware = requirePermission('VIEW_REPORTS');
                await middleware(mockReq, mockRes, mockNext);

                expect(PermissionService.hasPermission).toHaveBeenCalledWith(
                    5,
                    expect.any(Number),
                    'VIEW_REPORTS',
                    expect.any(String)
                );
            });
        });

        describe('when user has permission', () => {
            it('should call next() and continue', async () => {
                vi.mocked(PermissionService.hasPermission).mockResolvedValue(true);

                const middleware = requirePermission('PLAYBOOK_PUBLISH');
                await middleware(mockReq, mockRes, mockNext);

                expect(PermissionService.hasPermission).toHaveBeenCalledWith(
                    1,
                    10,
                    'PLAYBOOK_PUBLISH',
                    'ADMIN'
                );
                expect(mockNext).toHaveBeenCalledTimes(1);
                expect(mockReq.permissionChecked).toBe('PLAYBOOK_PUBLISH');
            });

            it('should pass correct parameters to PermissionService', async () => {
                vi.mocked(PermissionService.hasPermission).mockResolvedValue(true);

                mockReq.userId = 42;
                mockReq.organizationId = 100;
                mockReq.userRole = 'SUPERADMIN';

                const middleware = requirePermission('ADMIN_ACCESS');
                await middleware(mockReq, mockRes, mockNext);

                expect(PermissionService.hasPermission).toHaveBeenCalledWith(
                    42,
                    100,
                    'ADMIN_ACCESS',
                    'SUPERADMIN'
                );
            });
        });

        describe('when user lacks permission', () => {
            it('should return 403 with permission denied', async () => {
                vi.mocked(PermissionService.hasPermission).mockResolvedValue(false);

                const middleware = requirePermission('DELETE_USERS');
                await middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Permission denied',
                    required: 'DELETE_USERS',
                    code: 'PERMISSION_DENIED'
                });
                expect(mockNext).not.toHaveBeenCalled();
            });
        });

        describe('error handling', () => {
            it('should return 500 when PermissionService throws', async () => {
                vi.mocked(PermissionService.hasPermission).mockRejectedValue(
                    new Error('Database connection failed')
                );

                const middleware = requirePermission('VIEW_REPORTS');
                await middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({
                    error: 'Permission check failed',
                    code: 'PERMISSION_ERROR'
                });
                expect(mockNext).not.toHaveBeenCalled();
            });
        });
    });

    // ===== requireAnyPermission Tests =====

    describe('requireAnyPermission', () => {
        it('should return 401 when user is not authenticated', async () => {
            mockReq.userId = null;
            mockReq.user = null;

            const middleware = requireAnyPermission(['EDIT', 'VIEW']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should allow access when user has first permission', async () => {
            vi.mocked(PermissionService.hasPermission).mockResolvedValue(true);

            const middleware = requireAnyPermission(['VIEW_REPORTS', 'EDIT_REPORTS']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(mockReq.permissionChecked).toBe('VIEW_REPORTS');
        });

        it('should allow access when user has second permission', async () => {
            vi.mocked(PermissionService.hasPermission)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true);

            const middleware = requireAnyPermission(['VIEW_REPORTS', 'EDIT_REPORTS']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(mockReq.permissionChecked).toBe('EDIT_REPORTS');
        });

        it('should deny access when user has none of the permissions', async () => {
            vi.mocked(PermissionService.hasPermission).mockResolvedValue(false);

            const middleware = requireAnyPermission(['VIEW_REPORTS', 'EDIT_REPORTS', 'DELETE_REPORTS']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Permission denied',
                requiredAny: ['VIEW_REPORTS', 'EDIT_REPORTS', 'DELETE_REPORTS'],
                code: 'PERMISSION_DENIED'
            });
        });

        it('should check permissions in order', async () => {
            const callOrder = [];
            vi.mocked(PermissionService.hasPermission).mockImplementation(async (userId, orgId, perm) => {
                callOrder.push(perm);
                return perm === 'THIRD';
            });

            const middleware = requireAnyPermission(['FIRST', 'SECOND', 'THIRD']);
            await middleware(mockReq, mockRes, mockNext);

            expect(callOrder).toEqual(['FIRST', 'SECOND', 'THIRD']);
        });

        it('should handle error during permission check', async () => {
            vi.mocked(PermissionService.hasPermission).mockRejectedValue(new Error('DB error'));

            const middleware = requireAnyPermission(['VIEW', 'EDIT']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
        });
    });

    // ===== requireAllPermissions Tests =====

    describe('requireAllPermissions', () => {
        it('should return 401 when user is not authenticated', async () => {
            mockReq.userId = null;
            mockReq.user = null;

            const middleware = requireAllPermissions(['EDIT', 'VIEW']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should allow access when user has all permissions', async () => {
            vi.mocked(PermissionService.hasPermission).mockResolvedValue(true);

            const middleware = requireAllPermissions(['VIEW_REPORTS', 'EDIT_REPORTS', 'DELETE_REPORTS']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(mockReq.permissionChecked).toEqual(['VIEW_REPORTS', 'EDIT_REPORTS', 'DELETE_REPORTS']);
        });

        it('should deny access when user is missing one permission', async () => {
            mockReq.userRole = null; // Reset
            mockReq.organizationId = null; // Reset
            mockReq.user = { id: 1, role: 'ADMIN', organization_id: 10 };

            vi.mocked(PermissionService.hasPermission)
                .mockResolvedValueOnce(true)  // VIEW_REPORTS
                .mockResolvedValueOnce(false) // EDIT_REPORTS
                .mockResolvedValueOnce(true); // DELETE_REPORTS

            const middleware = requireAllPermissions(['VIEW_REPORTS', 'EDIT_REPORTS', 'DELETE_REPORTS']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Permission denied',
                missing: ['EDIT_REPORTS'],
                code: 'PERMISSION_DENIED'
            });
        });

        it('should report all missing permissions', async () => {
            mockReq.userRole = null; // Reset
            mockReq.organizationId = null; // Reset
            mockReq.user = { id: 1, role: 'ADMIN', organization_id: 10 };

            vi.mocked(PermissionService.hasPermission)
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            const middleware = requireAllPermissions(['VIEW', 'EDIT', 'DELETE']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Permission denied',
                missing: ['EDIT', 'DELETE'],
                code: 'PERMISSION_DENIED'
            });
        });

        it('should deny access when user has no permissions', async () => {
            vi.mocked(PermissionService.hasPermission).mockResolvedValue(false);

            const middleware = requireAllPermissions(['VIEW', 'EDIT']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Permission denied',
                missing: ['VIEW', 'EDIT'],
                code: 'PERMISSION_DENIED'
            });
        });

        it('should handle error during permission check', async () => {
            vi.mocked(PermissionService.hasPermission).mockRejectedValue(new Error('DB error'));

            const middleware = requireAllPermissions(['VIEW', 'EDIT']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
        });
    });

    // ===== auditAction Tests =====

    describe('auditAction', () => {
        it('should call next() immediately', async () => {
            const middleware = auditAction({
                action: 'CREATE',
                resourceType: 'REPORT'
            });

            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should audit on successful response (2xx)', async () => {
            vi.mocked(GovernanceAuditService.logAudit).mockResolvedValue(undefined);

            const middleware = auditAction({
                action: 'CREATE',
                resourceType: 'REPORT',
                getResourceId: (req, data) => data?.id,
                getAfter: (req, data) => data
            });

            await middleware(mockReq, mockRes, mockNext);

            // Simulate route handler calling res.json()
            mockRes.statusCode = 201;
            await mockRes.json({ id: 123, name: 'Test Report' });

            expect(GovernanceAuditService.logAudit).toHaveBeenCalledWith({
                actorId: 1,
                actorRole: 'ADMIN',
                orgId: 10,
                action: 'CREATE',
                resourceType: 'REPORT',
                resourceId: 123,
                before: null,
                after: { id: 123, name: 'Test Report' },
                correlationId: undefined
            });
        });

        it('should not audit on error response (4xx/5xx)', async () => {
            const middleware = auditAction({
                action: 'DELETE',
                resourceType: 'USER'
            });

            await middleware(mockReq, mockRes, mockNext);

            // Simulate error response
            mockRes.statusCode = 404;
            await mockRes.json({ error: 'Not found' });

            expect(GovernanceAuditService.logAudit).not.toHaveBeenCalled();
        });

        it('should use correlation ID from header', async () => {
            mockReq.headers = { 'x-correlation-id': 'corr-12345' };
            mockReq.correlationId = undefined;
            // Mock the get method for headers
            mockReq.get = vi.fn((header) => {
                if (header === 'X-Correlation-Id') return 'corr-12345';
                return undefined;
            });

            const middleware = auditAction({
                action: 'UPDATE',
                resourceType: 'PROJECT'
            });

            await middleware(mockReq, mockRes, mockNext);

            mockRes.statusCode = 200;
            await mockRes.json({ success: true });

            expect(GovernanceAuditService.logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    correlationId: 'corr-12345'
                })
            );
        });

        it('should include before state when provided', async () => {
            const beforeState = { name: 'Old Name', status: 'active' };

            const middleware = auditAction({
                action: 'UPDATE',
                resourceType: 'INITIATIVE',
                getBefore: () => beforeState,
                getAfter: (req, data) => data
            });

            await middleware(mockReq, mockRes, mockNext);

            mockRes.statusCode = 200;
            await mockRes.json({ name: 'New Name', status: 'active' });

            expect(GovernanceAuditService.logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    before: beforeState,
                    after: { name: 'New Name', status: 'active' }
                })
            );
        });

        it('should not fail request if audit fails', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            vi.mocked(GovernanceAuditService.logAudit).mockRejectedValue(new Error('Audit failed'));

            const middleware = auditAction({
                action: 'DELETE',
                resourceType: 'TASK'
            });

            await middleware(mockReq, mockRes, mockNext);

            mockRes.statusCode = 200;

            // Should not throw
            await expect(mockRes.json({ success: true })).resolves.not.toThrow;

            consoleSpy.mockRestore();
        });

        it('should extract resource ID using custom function', async () => {
            const middleware = auditAction({
                action: 'READ',
                resourceType: 'ASSESSMENT',
                getResourceId: (req) => req.params.assessmentId
            });

            mockReq.params = { assessmentId: 'assess-456' };
            console.log('[TestDebug] calling middleware');
            await middleware(mockReq, mockRes, mockNext);
            console.log('[TestDebug] middleware returned. mockRes.json is type:', typeof mockRes.json);

            mockRes.statusCode = 200;
            await mockRes.json({ data: {} });

            expect(GovernanceAuditService.logAudit).toHaveBeenCalledWith(
                expect.objectContaining({
                    resourceId: 'assess-456'
                })
            );
        });
    });

    // ===== Edge Cases =====

    describe('Edge Cases', () => {
        it('should handle undefined organization_id', async () => {
            mockReq.organizationId = undefined;
            mockReq.userRole = null;
            mockReq.user = { id: 1, role: 'USER' };
            vi.mocked(PermissionService.hasPermission).mockResolvedValue(true);

            const middleware = requirePermission('VIEW');
            await middleware(mockReq, mockRes, mockNext);

            expect(PermissionService.hasPermission).toHaveBeenCalledWith(
                1,
                undefined,
                'VIEW',
                'USER'
            );
        });

        it('should handle empty permissions array in requireAnyPermission', async () => {
            const middleware = requireAnyPermission([]);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should handle empty permissions array in requireAllPermissions', async () => {
            const middleware = requireAllPermissions([]);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(mockReq.permissionChecked).toEqual([]);
        });
    });
});
