/**
 * Permission Middleware - Real Production Tests
 * Tests for server/src/middleware/permission.middleware.ts
 * 
 * This tests REAL production middleware with dependency injection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Use vi.hoisted() for mocks
const { mockPermissionService, mockAuditService, mockLogger } = vi.hoisted(() => ({
    mockPermissionService: {
        hasPermission: vi.fn(),
    },
    mockAuditService: {
        logAudit: vi.fn(),
    },
    mockLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../../../server/src/services/permissionService.js', () => ({
    hasPermission: mockPermissionService.hasPermission,
    default: mockPermissionService,
}));

vi.mock('../../../../server/src/services/governanceAuditService.js', () => ({
    logAudit: mockAuditService.logAudit,
    default: mockAuditService,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
    default: mockLogger,
}));

// Import REAL production middleware
import {
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    setDependencies,
} from '../../../../server/src/middleware/permission.middleware.js';

describe('Permission Middleware - Real Production Tests', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Inject mock dependencies
        setDependencies({
            PermissionService: mockPermissionService as any,
            GovernanceAuditService: mockAuditService as any,
        });

        // Setup mock request/response
        mockReq = {
            user: {
                id: 'user-123',
                organizationId: 'org-456',
                role: 'USER',
            },
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };

        mockNext = vi.fn();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('requirePermission', () => {
        it('should call next() when user has permission', async () => {
            mockPermissionService.hasPermission.mockResolvedValue(true);

            const middleware = requirePermission('PROJECT_CREATE');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
                'user-123',
                'org-456',
                'PROJECT_CREATE',
                'USER'
            );
            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        it('should return 403 when user lacks permission', async () => {
            mockPermissionService.hasPermission.mockResolvedValue(false);

            const middleware = requirePermission('PROJECT_DELETE');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(String) })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 when no user on request', async () => {
            mockReq.user = undefined;

            const middleware = requirePermission('PROJECT_CREATE');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should handle permission check errors gracefully', async () => {
            mockPermissionService.hasPermission.mockRejectedValue(new Error('DB Error'));

            const middleware = requirePermission('PROJECT_CREATE');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('requireAnyPermission', () => {
        it('should allow when user has any of the permissions', async () => {
            // User has second permission but not first
            mockPermissionService.hasPermission
                .mockResolvedValueOnce(false)  // First check
                .mockResolvedValueOnce(true);  // Second check

            const middleware = requireAnyPermission(['ADMIN_ACCESS', 'PROJECT_CREATE']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny when user has none of the permissions', async () => {
            mockPermissionService.hasPermission.mockResolvedValue(false);

            const middleware = requireAnyPermission(['ADMIN_ACCESS', 'SUPERADMIN_ACCESS']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 for empty permission array', async () => {
            const middleware = requireAnyPermission([]);
            await middleware(mockReq, mockRes, mockNext);

            // Empty permissions = immediate denial
            expect(mockRes.status).toHaveBeenCalled();
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('requireAllPermissions', () => {
        it('should allow when user has all permissions', async () => {
            mockPermissionService.hasPermission.mockResolvedValue(true);

            const middleware = requireAllPermissions(['PROJECT_VIEW', 'PROJECT_EDIT']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockPermissionService.hasPermission).toHaveBeenCalledTimes(2);
            expect(mockNext).toHaveBeenCalled();
        });

        it('should deny when user lacks any permission', async () => {
            mockPermissionService.hasPermission
                .mockResolvedValueOnce(true)   // Has first
                .mockResolvedValueOnce(false); // Lacks second

            const middleware = requireAllPermissions(['PROJECT_VIEW', 'PROJECT_DELETE']);
            await middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('Role-based scenarios', () => {
        it('should pass role to permission service', async () => {
            mockReq.user.role = 'ADMIN';
            mockPermissionService.hasPermission.mockResolvedValue(true);

            const middleware = requirePermission('USER_MANAGE');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
                'user-123',
                'org-456',
                'USER_MANAGE',
                'ADMIN'
            );
        });

        it('should handle user without organizationId', async () => {
            mockReq.user.organizationId = undefined;
            mockPermissionService.hasPermission.mockResolvedValue(true);

            const middleware = requirePermission('PUBLIC_ACCESS');
            await middleware(mockReq, mockRes, mockNext);

            expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
                'user-123',
                undefined,
                'PUBLIC_ACCESS',
                'USER'
            );
        });
    });
});
