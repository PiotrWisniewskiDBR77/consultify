import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    requireOrgAccess,
    requireRole,
    requireOrgMember,
    requireOrgRole,
    requireOrgRoleOrHigher,
    requireConsultantScope,
    requireOwnerOrSuperadmin,
    ORG_ROLE_HIERARCHY
} from '../../../../server/middleware/rbac';

describe('RBAC Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {};
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
        vi.clearAllMocks();
    });

    describe('requireOrgAccess', () => {
        it('should return 400 if org context is missing', () => {
            const middleware = requireOrgAccess();
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Missing organization context',
                message: 'Organization context must be resolved before access check.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should allow any member when no roles specified', () => {
            req.org = {
                id: 1,
                isMember: true,
                role: 'MEMBER'
            };

            const middleware = requireOrgAccess();
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should allow member with correct role', () => {
            req.org = {
                id: 1,
                isMember: true,
                role: 'ADMIN'
            };

            const middleware = requireOrgAccess({ roles: ['ADMIN', 'OWNER'] });
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny member with insufficient role', () => {
            req.org = {
                id: 1,
                isMember: true,
                role: 'MEMBER'
            };

            const middleware = requireOrgAccess({ roles: ['ADMIN', 'OWNER'] });
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Insufficient role',
                message: 'This action requires one of: ADMIN, OWNER',
                yourRole: 'MEMBER'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should allow consultant when allowConsultant is true and no permissions required', () => {
            req.org = {
                id: 1,
                isConsultant: true,
                permissionScope: {}
            };

            const middleware = requireOrgAccess({ allowConsultant: true });
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny consultant when allowConsultant is false', () => {
            req.org = {
                id: 1,
                isConsultant: true
            };

            const middleware = requireOrgAccess({ allowConsultant: false });
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Access denied',
                message: 'This resource is not accessible to consultants.'
            });
        });

        it('should allow consultant with required permissions', () => {
            req.org = {
                id: 1,
                isConsultant: true,
                permissionScope: {
                    permissions: ['VIEW_INITIATIVES', 'EDIT_INITIATIVES']
                }
            };

            const middleware = requireOrgAccess({
                allowConsultant: true,
                consultantPermissions: ['VIEW_INITIATIVES']
            });
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should allow consultant with boolean permission flags', () => {
            req.org = {
                id: 1,
                isConsultant: true,
                permissionScope: {
                    can_view_initiatives: true
                }
            };

            const middleware = requireOrgAccess({
                allowConsultant: true,
                consultantPermissions: ['can_view_initiatives']
            });
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny consultant with insufficient permissions', () => {
            req.org = {
                id: 1,
                isConsultant: true,
                permissionScope: {
                    permissions: ['VIEW_INITIATIVES']
                }
            };

            const middleware = requireOrgAccess({
                allowConsultant: true,
                consultantPermissions: ['VIEW_INITIATIVES', 'DELETE_INITIATIVES']
            });
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Insufficient consultant scope',
                message: 'Required permissions: VIEW_INITIATIVES, DELETE_INITIATIVES',
                yourPermissions: ['VIEW_INITIATIVES']
            });
        });

        it('should deny when neither member nor consultant', () => {
            req.org = {
                id: 1
            };

            const middleware = requireOrgAccess();
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Access denied',
                message: 'You do not have access to this organization.'
            });
        });
    });

    describe('requireRole', () => {
        it('should return 401 if user is not authenticated', () => {
            const middleware = requireRole(['ADMIN']);
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        });

        it('should allow user with correct role', () => {
            req.user = { role: 'ADMIN' };

            const middleware = requireRole(['ADMIN', 'OWNER']);
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny user with incorrect role', () => {
            req.user = { role: 'MEMBER' };

            const middleware = requireRole(['ADMIN', 'OWNER']);
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Forbidden',
                message: 'This action requires one of the following roles: ADMIN, OWNER',
                yourRole: 'MEMBER'
            });
        });
    });

    describe('requireOrgMember', () => {
        it('should return 400 if org context is missing', () => {
            const middleware = requireOrgMember();
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing organization context' });
        });

        it('should allow member', () => {
            req.org = {
                id: 1,
                isMember: true
            };

            const middleware = requireOrgMember();
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny consultant', () => {
            req.org = {
                id: 1,
                isConsultant: true
            };

            const middleware = requireOrgMember();
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Access denied',
                message: 'This action requires organization membership (consultants excluded).'
            });
        });
    });

    describe('requireOrgRole', () => {
        it('should return 400 if org context is missing', () => {
            const middleware = requireOrgRole(['ADMIN']);
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing organization context' });
        });

        it('should deny consultant', () => {
            req.org = {
                id: 1,
                isConsultant: true
            };

            const middleware = requireOrgRole(['ADMIN']);
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Access denied',
                message: 'Organization membership required.'
            });
        });

        it('should allow member with correct role', () => {
            req.org = {
                id: 1,
                isMember: true,
                role: 'ADMIN'
            };

            const middleware = requireOrgRole(['ADMIN', 'OWNER']);
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny member with incorrect role', () => {
            req.org = {
                id: 1,
                isMember: true,
                role: 'MEMBER'
            };

            const middleware = requireOrgRole(['ADMIN', 'OWNER']);
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Insufficient role',
                message: 'Required: ADMIN, OWNER',
                yourRole: 'MEMBER'
            });
        });
    });

    describe('requireOrgRoleOrHigher', () => {
        it('should return 400 if org context is missing', () => {
            const middleware = requireOrgRoleOrHigher('ADMIN');
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing organization context' });
        });

        it('should allow OWNER when ADMIN is required', () => {
            req.org = {
                id: 1,
                role: 'OWNER'
            };

            const middleware = requireOrgRoleOrHigher('ADMIN');
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should allow ADMIN when ADMIN is required', () => {
            req.org = {
                id: 1,
                role: 'ADMIN'
            };

            const middleware = requireOrgRoleOrHigher('ADMIN');
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny MEMBER when ADMIN is required', () => {
            req.org = {
                id: 1,
                role: 'MEMBER'
            };

            const middleware = requireOrgRoleOrHigher('ADMIN');
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Insufficient role',
                message: 'Requires ADMIN or higher.',
                yourRole: 'MEMBER'
            });
        });
    });

    describe('requireConsultantScope', () => {
        it('should return 400 if org context is missing', () => {
            const middleware = requireConsultantScope(['VIEW_INITIATIVES']);
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing organization context' });
        });

        it('should allow non-consultant (member)', () => {
            req.org = {
                id: 1,
                isMember: true
            };

            const middleware = requireConsultantScope(['VIEW_INITIATIVES']);
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should allow consultant with required permissions', () => {
            req.org = {
                id: 1,
                isConsultant: true,
                permissionScope: {
                    permissions: ['VIEW_INITIATIVES', 'EDIT_INITIATIVES']
                }
            };

            const middleware = requireConsultantScope(['VIEW_INITIATIVES']);
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny consultant with insufficient permissions', () => {
            req.org = {
                id: 1,
                isConsultant: true,
                permissionScope: {
                    permissions: ['VIEW_INITIATIVES']
                }
            };

            const middleware = requireConsultantScope(['VIEW_INITIATIVES', 'DELETE_INITIATIVES']);
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Insufficient consultant scope',
                message: 'Required: VIEW_INITIATIVES, DELETE_INITIATIVES'
            });
        });
    });

    describe('requireOwnerOrSuperadmin', () => {
        it('should return 401 if user is not authenticated', () => {
            const middleware = requireOwnerOrSuperadmin();
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        });

        it('should allow SUPERADMIN', () => {
            req.user = { role: 'SUPERADMIN' };

            const middleware = requireOwnerOrSuperadmin();
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should allow org OWNER', () => {
            req.user = { role: 'USER' };
            req.org = {
                id: 1,
                isMember: true,
                role: 'OWNER'
            };

            const middleware = requireOwnerOrSuperadmin();
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny non-owner member', () => {
            req.user = { role: 'USER' };
            req.org = {
                id: 1,
                isMember: true,
                role: 'ADMIN'
            };

            const middleware = requireOwnerOrSuperadmin();
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Forbidden',
                message: 'This action requires organization owner or superadmin privileges.'
            });
        });

        it('should deny consultant', () => {
            req.user = { role: 'USER' };
            req.org = {
                id: 1,
                isConsultant: true
            };

            const middleware = requireOwnerOrSuperadmin();
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('ORG_ROLE_HIERARCHY', () => {
        it('should have correct role hierarchy', () => {
            expect(ORG_ROLE_HIERARCHY.OWNER).toBe(4);
            expect(ORG_ROLE_HIERARCHY.ADMIN).toBe(3);
            expect(ORG_ROLE_HIERARCHY.MEMBER).toBe(2);
            expect(ORG_ROLE_HIERARCHY.CONSULTANT).toBe(1);
        });
    });
});

