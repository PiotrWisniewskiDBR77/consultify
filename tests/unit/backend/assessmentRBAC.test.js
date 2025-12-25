/**
 * Unit Tests: Assessment RBAC Middleware
 * Complete test coverage for role-based access control
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Assessment RBAC Middleware', () => {
    let assessmentRBAC;
    let hasPermission;

    beforeEach(async () => {
        vi.resetModules();

        const module = await import('../../../server/middleware/assessmentRBAC.js');
        assessmentRBAC = module.assessmentRBAC;
        hasPermission = module.hasPermission;
    });

    // =========================================================================
    // hasPermission TESTS
    // =========================================================================

    describe('hasPermission', () => {
        describe('SUPER_ADMIN role', () => {
            it('should have all permissions', () => {
                const user = { role: 'SUPER_ADMIN' };

                expect(hasPermission(user, 'create', 'assessment')).toBe(true);
                expect(hasPermission(user, 'read', 'assessment')).toBe(true);
                expect(hasPermission(user, 'update', 'assessment')).toBe(true);
                expect(hasPermission(user, 'delete', 'assessment')).toBe(true);
                expect(hasPermission(user, 'export', 'assessment')).toBe(true);
                expect(hasPermission(user, 'any_action', 'any_resource')).toBe(true);
            });
        });

        describe('ORG_ADMIN role', () => {
            const user = { role: 'ORG_ADMIN' };

            it('should have create permission', () => {
                expect(hasPermission(user, 'create', 'assessment')).toBe(true);
            });

            it('should have read permission', () => {
                expect(hasPermission(user, 'read', 'assessment')).toBe(true);
            });

            it('should have update permission', () => {
                expect(hasPermission(user, 'update', 'assessment')).toBe(true);
            });

            it('should have delete permission', () => {
                expect(hasPermission(user, 'delete', 'assessment')).toBe(true);
            });

            it('should have export permission', () => {
                expect(hasPermission(user, 'export', 'assessment')).toBe(true);
            });
        });

        describe('PROJECT_MANAGER role', () => {
            const user = { role: 'PROJECT_MANAGER' };

            it('should have create permission', () => {
                expect(hasPermission(user, 'create', 'assessment')).toBe(true);
            });

            it('should have read permission', () => {
                expect(hasPermission(user, 'read', 'assessment')).toBe(true);
            });

            it('should have update permission', () => {
                expect(hasPermission(user, 'update', 'assessment')).toBe(true);
            });

            it('should NOT have delete permission', () => {
                expect(hasPermission(user, 'delete', 'assessment')).toBe(false);
            });

            it('should have export permission', () => {
                expect(hasPermission(user, 'export', 'assessment')).toBe(true);
            });
        });

        describe('CONSULTANT role', () => {
            const user = { role: 'CONSULTANT' };

            it('should have create permission', () => {
                expect(hasPermission(user, 'create', 'assessment')).toBe(true);
            });

            it('should have read permission', () => {
                expect(hasPermission(user, 'read', 'assessment')).toBe(true);
            });

            it('should NOT have update permission', () => {
                expect(hasPermission(user, 'update', 'assessment')).toBe(false);
            });

            it('should NOT have delete permission', () => {
                expect(hasPermission(user, 'delete', 'assessment')).toBe(false);
            });

            it('should have export permission', () => {
                expect(hasPermission(user, 'export', 'assessment')).toBe(true);
            });
        });

        describe('VIEWER role', () => {
            const user = { role: 'VIEWER' };

            it('should have read permission only', () => {
                expect(hasPermission(user, 'read', 'assessment')).toBe(true);
            });

            it('should NOT have create permission', () => {
                expect(hasPermission(user, 'create', 'assessment')).toBe(false);
            });

            it('should NOT have update permission', () => {
                expect(hasPermission(user, 'update', 'assessment')).toBe(false);
            });

            it('should NOT have delete permission', () => {
                expect(hasPermission(user, 'delete', 'assessment')).toBe(false);
            });

            it('should NOT have export permission', () => {
                expect(hasPermission(user, 'export', 'assessment')).toBe(false);
            });
        });

        describe('Unknown/Missing role', () => {
            it('should default to VIEWER permissions when role is missing', () => {
                const user = {};

                expect(hasPermission(user, 'read', 'assessment')).toBe(true);
                expect(hasPermission(user, 'create', 'assessment')).toBe(false);
            });

            it('should handle undefined role', () => {
                const user = { role: undefined };

                expect(hasPermission(user, 'read', 'assessment')).toBe(true);
                expect(hasPermission(user, 'create', 'assessment')).toBe(false);
            });

            it('should handle null role', () => {
                const user = { role: null };

                expect(hasPermission(user, 'read', 'assessment')).toBe(true);
            });

            it('should handle unknown role', () => {
                const user = { role: 'UNKNOWN_ROLE' };

                expect(hasPermission(user, 'read', 'assessment')).toBe(false);
                expect(hasPermission(user, 'create', 'assessment')).toBe(false);
            });
        });
    });

    // =========================================================================
    // assessmentRBAC Middleware TESTS
    // =========================================================================

    describe('assessmentRBAC middleware', () => {
        let mockReq;
        let mockRes;
        let mockNext;
        let statusMock;
        let jsonMock;

        beforeEach(() => {
            jsonMock = vi.fn();
            statusMock = vi.fn().mockReturnValue({ json: jsonMock });
            mockRes = { status: statusMock, json: jsonMock };
            mockNext = vi.fn();
        });

        describe('Authentication checks', () => {
            it('should return 401 when user is not authenticated', () => {
                mockReq = { user: undefined };

                const middleware = assessmentRBAC('read');
                middleware(mockReq, mockRes, mockNext);

                expect(statusMock).toHaveBeenCalledWith(401);
                expect(jsonMock).toHaveBeenCalledWith({ error: 'Authentication required' });
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('should return 401 when user is null', () => {
                mockReq = { user: null };

                const middleware = assessmentRBAC('read');
                middleware(mockReq, mockRes, mockNext);

                expect(statusMock).toHaveBeenCalledWith(401);
                expect(mockNext).not.toHaveBeenCalled();
            });
        });

        describe('Authorization checks', () => {
            it('should call next() when user has permission', () => {
                mockReq = {
                    user: { id: 'user-1', role: 'ORG_ADMIN' }
                };

                const middleware = assessmentRBAC('update');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalled();
                expect(statusMock).not.toHaveBeenCalled();
            });

            it('should return 403 when user lacks permission', () => {
                mockReq = {
                    user: { id: 'user-1', role: 'VIEWER' }
                };

                const middleware = assessmentRBAC('update');
                middleware(mockReq, mockRes, mockNext);

                expect(statusMock).toHaveBeenCalledWith(403);
                expect(jsonMock).toHaveBeenCalledWith({
                    error: 'Insufficient permissions',
                    required: 'assessment:update',
                    userRole: 'VIEWER'
                });
                expect(mockNext).not.toHaveBeenCalled();
            });
        });

        describe('Action-specific tests', () => {
            const testCases = [
                { action: 'create', role: 'CONSULTANT', shouldPass: true },
                { action: 'create', role: 'VIEWER', shouldPass: false },
                { action: 'read', role: 'VIEWER', shouldPass: true },
                { action: 'update', role: 'PROJECT_MANAGER', shouldPass: true },
                { action: 'update', role: 'CONSULTANT', shouldPass: false },
                { action: 'delete', role: 'ORG_ADMIN', shouldPass: true },
                { action: 'delete', role: 'PROJECT_MANAGER', shouldPass: false },
                { action: 'export', role: 'CONSULTANT', shouldPass: true },
                { action: 'export', role: 'VIEWER', shouldPass: false }
            ];

            testCases.forEach(({ action, role, shouldPass }) => {
                it(`${role} ${shouldPass ? 'should' : 'should NOT'} have ${action} permission`, () => {
                    mockReq = { user: { id: 'user-1', role } };

                    const middleware = assessmentRBAC(action);
                    middleware(mockReq, mockRes, mockNext);

                    if (shouldPass) {
                        expect(mockNext).toHaveBeenCalled();
                    } else {
                        expect(statusMock).toHaveBeenCalledWith(403);
                    }
                });
            });
        });

        describe('SUPER_ADMIN bypass', () => {
            it('should allow SUPER_ADMIN for any action', () => {
                mockReq = {
                    user: { id: 'admin-1', role: 'SUPER_ADMIN' }
                };

                const actions = ['create', 'read', 'update', 'delete', 'export'];

                actions.forEach(action => {
                    const middleware = assessmentRBAC(action);
                    mockNext.mockClear();
                    middleware(mockReq, mockRes, mockNext);
                    expect(mockNext).toHaveBeenCalled();
                });
            });
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================

    describe('Edge cases', () => {
        it('should handle case sensitivity in role names', () => {
            // Roles are case-sensitive - lowercase should not match
            const user = { role: 'org_admin' };
            expect(hasPermission(user, 'create', 'assessment')).toBe(false);
        });

        it('should handle whitespace in role names', () => {
            const user = { role: ' ORG_ADMIN ' };
            expect(hasPermission(user, 'create', 'assessment')).toBe(false);
        });

        it('should handle empty string role', () => {
            const user = { role: '' };
            expect(hasPermission(user, 'create', 'assessment')).toBe(false);
            expect(hasPermission(user, 'read', 'assessment')).toBe(false);
        });

        it('should handle numeric role', () => {
            const user = { role: 123 };
            expect(hasPermission(user, 'read', 'assessment')).toBe(false);
        });
    });

    // =========================================================================
    // Permission Matrix Validation
    // =========================================================================

    describe('Permission Matrix Validation', () => {
        const permissionMatrix = {
            SUPER_ADMIN: { create: true, read: true, update: true, delete: true, export: true },
            ORG_ADMIN: { create: true, read: true, update: true, delete: true, export: true },
            PROJECT_MANAGER: { create: true, read: true, update: true, delete: false, export: true },
            CONSULTANT: { create: true, read: true, update: false, delete: false, export: true },
            VIEWER: { create: false, read: true, update: false, delete: false, export: false }
        };

        Object.entries(permissionMatrix).forEach(([role, permissions]) => {
            describe(`${role} permissions`, () => {
                Object.entries(permissions).forEach(([action, expected]) => {
                    it(`${action}: ${expected}`, () => {
                        const user = { role };
                        expect(hasPermission(user, action, 'assessment')).toBe(expected);
                    });
                });
            });
        });
    });
});

