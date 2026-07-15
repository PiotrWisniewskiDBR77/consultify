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

        const module = await import('../../../server/src/middleware/assessmentRBAC.js');
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

            // FIXED (2026-07-15, security): hasPermission() used to do
            // `permissions[normalizedRole] || permissions['VIEWER'] || []` — a
            // present-but-unrecognized role (typo, stale/renamed role, garbage
            // data like 'UNKNOWN_ROLE') silently fell through to VIEWER read
            // access instead of being denied. That was fail-open. It is now
            // fail-closed: any non-blank role string that doesn't match a
            // known role name gets ZERO permissions.
            it('should handle unknown role', () => {
                const user = { role: 'UNKNOWN_ROLE' };

                expect(hasPermission(user, 'read', 'assessment')).toBe(false);
                expect(hasPermission(user, 'create', 'assessment')).toBe(false);
            });

            it('should handle a role that is a typo of a real role', () => {
                const user = { role: 'ORG_ADMN' };

                expect(hasPermission(user, 'read', 'assessment')).toBe(false);
                expect(hasPermission(user, 'update', 'assessment')).toBe(false);
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
        // Removed (old behavior, intentionally superseded): these two asserted that
        // role matching was case- and whitespace-sensitive. Today's hasPermission()
        // deliberately normalizes roles (`.trim().toUpperCase()`) before matching —
        // 'org_admin' and ' ORG_ADMIN ' both resolve to 'ORG_ADMIN' and get
        // ORG_ADMIN's permissions. That's a reasonable hardening (tolerates role
        // string formatting drift) — not a bug, so not restored as skip/TODO.
        // - 'should handle case sensitivity in role names'
        // - 'should handle whitespace in role names'

        // RECONCILED (2026-07-15): the numeric-role case is the same
        // fail-open-to-VIEWER bug as 'should handle unknown role' above — a
        // non-string role is never legitimate and now fails closed (zero
        // permissions), see hasPermission() in assessmentRBAC.ts.
        //
        // The empty-string case is intentionally NOT changed to deny-all
        // here. An empty/whitespace-only role string is treated the same as
        // a genuinely missing role (blank/no role assigned yet) and defaults
        // to VIEWER — this is deliberate, pre-existing behavior that is
        // actively asserted elsewhere (see
        // tests/unit/backend/middleware/assessmentRBAC.middleware.test.ts,
        // 'maps messy role strings to permission keys in hasPermission',
        // which asserts `{ role: '   ' }` → read: true). Forcing empty
        // string to deny-all would contradict that active test. Flagged for
        // Piotr: do we want blank-role-as-VIEWER removed entirely, or kept
        // as the "no role assigned" default? Until decided, blank stays
        // VIEWER; only *unrecognized, non-blank* roles (typos/garbage/wrong
        // type) fail closed.
        it('should handle empty string role as blank/missing (VIEWER default, by design)', () => {
            const user = { role: '' };
            expect(hasPermission(user, 'create', 'assessment')).toBe(false);
            expect(hasPermission(user, 'read', 'assessment')).toBe(true);
        });

        it('should handle numeric role', () => {
            const user = { role: 123 };
            expect(hasPermission(user, 'read', 'assessment')).toBe(false);
            expect(hasPermission(user, 'create', 'assessment')).toBe(false);
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



















