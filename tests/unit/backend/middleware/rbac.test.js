/**
 * RBAC Middleware Tests
 * 
 * Tests for role-based access control middleware:
 * - requireOrgAccess (primary unified guard)
 * - requireRole (global role check)
 * - requireOrgMember
 * - requireOrgRole
 * - requireOrgRoleOrHigher
 * - requireConsultantScope
 * - requireOwnerOrSuperadmin
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import RBAC middleware
import {
    requireOrgAccess,
    requireRole,
    requireOrgMember,
    requireOrgRole,
    requireOrgRoleOrHigher,
    requireConsultantScope,
    requireOwnerOrSuperadmin,
    ORG_ROLE_HIERARCHY
} from '../../../../server/middleware/rbac.js';

describe('RBAC Middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        vi.clearAllMocks();

        mockReq = {
            user: null,
            org: null,
            headers: {},
            body: {},
            params: {},
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

    // ===== ORG_ROLE_HIERARCHY Tests =====

    describe('ORG_ROLE_HIERARCHY', () => {
        it('should have correct hierarchy levels', () => {
            expect(ORG_ROLE_HIERARCHY.OWNER).toBe(4);
            expect(ORG_ROLE_HIERARCHY.ADMIN).toBe(3);
            expect(ORG_ROLE_HIERARCHY.MEMBER).toBe(2);
            expect(ORG_ROLE_HIERARCHY.CONSULTANT).toBe(1);
        });

        it('should have OWNER higher than ADMIN', () => {
            expect(ORG_ROLE_HIERARCHY.OWNER).toBeGreaterThan(ORG_ROLE_HIERARCHY.ADMIN);
        });
    });

    // ===== requireOrgAccess Tests (Primary Guard) =====

    describe('requireOrgAccess', () => {
        describe('when org context is missing', () => {
            it('should return 400 when req.org is null', () => {
                mockReq.org = null;

                const middleware = requireOrgAccess();
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockRes.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        error: 'Missing organization context'
                    })
                );
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('should return 400 when req.org.id is undefined', () => {
                mockReq.org = { isMember: true };

                const middleware = requireOrgAccess();
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(400);
                expect(mockNext).not.toHaveBeenCalled();
            });
        });

        describe('for organization members', () => {
            beforeEach(() => {
                mockReq.org = {
                    id: 1,
                    isMember: true,
                    isConsultant: false,
                    role: 'MEMBER'
                };
            });

            it('should allow access when no specific roles required', () => {
                const middleware = requireOrgAccess();
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
                expect(mockRes.status).not.toHaveBeenCalled();
            });

            it('should allow access when user role is in allowed list', () => {
                mockReq.org.role = 'ADMIN';

                const middleware = requireOrgAccess({ roles: ['ADMIN', 'OWNER'] });
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('should deny access when user role is not in allowed list', () => {
                mockReq.org.role = 'MEMBER';

                const middleware = requireOrgAccess({ roles: ['ADMIN', 'OWNER'] });
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        error: 'Insufficient role',
                        yourRole: 'MEMBER'
                    })
                );
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('should allow OWNER to access when only OWNER is required', () => {
                mockReq.org.role = 'OWNER';

                const middleware = requireOrgAccess({ roles: ['OWNER'] });
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });
        });

        describe('for consultants', () => {
            beforeEach(() => {
                mockReq.org = {
                    id: 1,
                    isMember: false,
                    isConsultant: true,
                    role: 'CONSULTANT',
                    permissionScope: {
                        permissions: ['view_initiatives', 'edit_reports'],
                        can_view_assessments: true
                    }
                };
            });

            it('should allow consultant access when no specific permissions required', () => {
                const middleware = requireOrgAccess({ allowConsultant: true });
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('should deny consultant access when allowConsultant is false', () => {
                const middleware = requireOrgAccess({ allowConsultant: false });
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        error: 'Access denied',
                        message: 'This resource is not accessible to consultants.'
                    })
                );
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('should allow consultant with required permissions in array', () => {
                const middleware = requireOrgAccess({
                    consultantPermissions: ['view_initiatives']
                });
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('should allow consultant with boolean permission flag', () => {
                const middleware = requireOrgAccess({
                    consultantPermissions: ['can_view_assessments']
                });
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(1);
            });

            it('should deny consultant missing required permissions', () => {
                const middleware = requireOrgAccess({
                    consultantPermissions: ['admin_access', 'delete_users']
                });
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        error: 'Insufficient consultant scope'
                    })
                );
            });

            it('should require all permissions when multiple specified', () => {
                const middleware = requireOrgAccess({
                    consultantPermissions: ['view_initiatives', 'admin_access']
                });
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
            });
        });

        describe('when no valid access type', () => {
            it('should deny access when neither member nor consultant', () => {
                mockReq.org = {
                    id: 1,
                    isMember: false,
                    isConsultant: false
                };

                const middleware = requireOrgAccess();
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        error: 'Access denied',
                        message: 'You do not have access to this organization.'
                    })
                );
            });
        });
    });

    // ===== requireRole Tests (Global) =====

    describe('requireRole', () => {
        it('should return 401 when user is not authenticated', () => {
            mockReq.user = null;

            const middleware = requireRole(['ADMIN']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Authentication required'
            });
        });

        it('should allow user with matching role', () => {
            mockReq.user = { id: 1, role: 'ADMIN' };

            const middleware = requireRole(['ADMIN', 'SUPERADMIN']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should deny user without matching role', () => {
            mockReq.user = { id: 1, role: 'USER' };

            const middleware = requireRole(['ADMIN', 'SUPERADMIN']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Forbidden',
                    yourRole: 'USER'
                })
            );
        });

        it('should allow SUPERADMIN for admin-only routes', () => {
            mockReq.user = { id: 1, role: 'SUPERADMIN' };

            const middleware = requireRole(['ADMIN', 'SUPERADMIN']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });
    });

    // ===== requireOrgMember Tests =====

    describe('requireOrgMember', () => {
        it('should return 400 when org context is missing', () => {
            mockReq.org = null;

            const middleware = requireOrgMember();
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should allow organization members', () => {
            mockReq.org = { id: 1, isMember: true };

            const middleware = requireOrgMember();
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should deny consultants', () => {
            mockReq.org = { id: 1, isMember: false, isConsultant: true };

            const middleware = requireOrgMember();
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('consultants excluded')
                })
            );
        });
    });

    // ===== requireOrgRole Tests =====

    describe('requireOrgRole', () => {
        it('should return 400 when org context is missing', () => {
            mockReq.org = null;

            const middleware = requireOrgRole(['ADMIN']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should deny non-members', () => {
            mockReq.org = { id: 1, isMember: false, role: 'CONSULTANT' };

            const middleware = requireOrgRole(['ADMIN']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should allow member with matching role', () => {
            mockReq.org = { id: 1, isMember: true, role: 'ADMIN' };

            const middleware = requireOrgRole(['ADMIN', 'OWNER']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should deny member without matching role', () => {
            mockReq.org = { id: 1, isMember: true, role: 'MEMBER' };

            const middleware = requireOrgRole(['ADMIN', 'OWNER']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Insufficient role',
                    yourRole: 'MEMBER'
                })
            );
        });
    });

    // ===== requireOrgRoleOrHigher Tests =====

    describe('requireOrgRoleOrHigher', () => {
        it('should return 400 when org context is missing', () => {
            mockReq.org = null;

            const middleware = requireOrgRoleOrHigher('ADMIN');
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should allow user with exactly minimum role', () => {
            mockReq.org = { id: 1, role: 'ADMIN' };

            const middleware = requireOrgRoleOrHigher('ADMIN');
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should allow user with higher role', () => {
            mockReq.org = { id: 1, role: 'OWNER' };

            const middleware = requireOrgRoleOrHigher('ADMIN');
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should deny user with lower role', () => {
            mockReq.org = { id: 1, role: 'MEMBER' };

            const middleware = requireOrgRoleOrHigher('ADMIN');
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Insufficient role',
                    message: 'Requires ADMIN or higher.',
                    yourRole: 'MEMBER'
                })
            );
        });

        it('should handle unknown roles with level 0', () => {
            mockReq.org = { id: 1, role: 'UNKNOWN_ROLE' };

            const middleware = requireOrgRoleOrHigher('MEMBER');
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    // ===== requireConsultantScope Tests =====

    describe('requireConsultantScope', () => {
        it('should return 400 when org context is missing', () => {
            mockReq.org = null;

            const middleware = requireConsultantScope(['view_reports']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should allow non-consultants to pass through', () => {
            mockReq.org = { id: 1, isConsultant: false, isMember: true };

            const middleware = requireConsultantScope(['view_reports']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should allow consultant with required permission in array', () => {
            mockReq.org = {
                id: 1,
                isConsultant: true,
                permissionScope: {
                    permissions: ['view_reports', 'edit_reports']
                }
            };

            const middleware = requireConsultantScope(['view_reports']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should allow consultant with boolean permission flag', () => {
            mockReq.org = {
                id: 1,
                isConsultant: true,
                permissionScope: {
                    can_view_reports: true
                }
            };

            const middleware = requireConsultantScope(['can_view_reports']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should deny consultant missing permissions', () => {
            mockReq.org = {
                id: 1,
                isConsultant: true,
                permissionScope: {
                    permissions: ['view_reports']
                }
            };

            const middleware = requireConsultantScope(['delete_reports']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Insufficient consultant scope'
                })
            );
        });

        it('should handle single permission as string', () => {
            mockReq.org = {
                id: 1,
                isConsultant: true,
                permissionScope: {
                    permissions: ['view_reports']
                }
            };

            const middleware = requireConsultantScope('view_reports');
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should require all permissions when multiple specified', () => {
            mockReq.org = {
                id: 1,
                isConsultant: true,
                permissionScope: {
                    permissions: ['view_reports']
                }
            };

            const middleware = requireConsultantScope(['view_reports', 'edit_reports']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should handle empty permission scope', () => {
            mockReq.org = {
                id: 1,
                isConsultant: true,
                permissionScope: null
            };

            const middleware = requireConsultantScope(['view_reports']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    // ===== requireOwnerOrSuperadmin Tests =====

    describe('requireOwnerOrSuperadmin', () => {
        it('should return 401 when user is not authenticated', () => {
            mockReq.user = null;

            const middleware = requireOwnerOrSuperadmin();
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Authentication required'
            });
        });

        it('should allow global SUPERADMIN', () => {
            mockReq.user = { id: 1, role: 'SUPERADMIN' };
            mockReq.org = { id: 1, isMember: true, role: 'MEMBER' };

            const middleware = requireOwnerOrSuperadmin();
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should allow organization OWNER', () => {
            mockReq.user = { id: 1, role: 'USER' };
            mockReq.org = { id: 1, isMember: true, role: 'OWNER' };

            const middleware = requireOwnerOrSuperadmin();
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should deny ADMIN who is not OWNER', () => {
            mockReq.user = { id: 1, role: 'USER' };
            mockReq.org = { id: 1, isMember: true, role: 'ADMIN' };

            const middleware = requireOwnerOrSuperadmin();
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Forbidden',
                    message: expect.stringContaining('owner or superadmin')
                })
            );
        });

        it('should deny consultant even with full permissions', () => {
            mockReq.user = { id: 1, role: 'USER' };
            mockReq.org = {
                id: 1,
                isMember: false,
                isConsultant: true,
                role: 'CONSULTANT'
            };

            const middleware = requireOwnerOrSuperadmin();
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should deny regular member', () => {
            mockReq.user = { id: 1, role: 'USER' };
            mockReq.org = { id: 1, isMember: true, role: 'MEMBER' };

            const middleware = requireOwnerOrSuperadmin();
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    // ===== Edge Cases =====

    describe('Edge Cases', () => {
        it('should handle undefined permissions array gracefully', () => {
            mockReq.org = {
                id: 1,
                isConsultant: true,
                permissionScope: {}
            };

            const middleware = requireConsultantScope(['view_reports']);
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should handle empty roles array', () => {
            mockReq.org = { id: 1, isMember: true, role: 'MEMBER' };

            const middleware = requireOrgAccess({ roles: [] });
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should handle null roles option', () => {
            mockReq.org = { id: 1, isMember: true, role: 'MEMBER' };

            const middleware = requireOrgAccess({ roles: null });
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });
    });
});
