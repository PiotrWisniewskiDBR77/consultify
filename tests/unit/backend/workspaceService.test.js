/**
 * Workspace Service Unit Tests
 * 
 * Tests for workspace management.
 * 
 * @module tests/unit/backend/workspaceService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create workspace service implementation
const createWorkspaceService = () => {
    const workspaces = new Map();
    const members = new Map();

    return {
        // Create workspace
        create: async (data) => {
            if (!data.name || !data.organizationId) {
                throw new Error('Name and organization ID required');
            }

            const id = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const workspace = {
                id,
                name: data.name,
                description: data.description || '',
                organizationId: data.organizationId,
                type: data.type || 'project',
                visibility: data.visibility || 'private',
                createdBy: data.createdBy,
                settings: data.settings || {},
                createdAt: new Date().toISOString()
            };

            workspaces.set(id, workspace);
            members.set(id, [{ userId: data.createdBy, role: 'owner', joinedAt: workspace.createdAt }]);
            return workspace;
        },

        // Get workspace by ID
        getById: async (id) => {
            return workspaces.get(id) || null;
        },

        // List workspaces for organization
        listByOrganization: async (organizationId) => {
            return Array.from(workspaces.values())
                .filter(w => w.organizationId === organizationId);
        },

        // List workspaces for user
        listByUser: async (userId) => {
            const userWorkspaces = [];
            for (const [wsId, memberList] of members.entries()) {
                if (memberList.some(m => m.userId === userId)) {
                    const ws = workspaces.get(wsId);
                    if (ws) userWorkspaces.push(ws);
                }
            }
            return userWorkspaces;
        },

        // Update workspace
        update: async (id, updates) => {
            const workspace = workspaces.get(id);
            if (!workspace) throw new Error('Workspace not found');

            const updated = { ...workspace, ...updates, updatedAt: new Date().toISOString() };
            workspaces.set(id, updated);
            return updated;
        },

        // Delete workspace
        delete: async (id) => {
            members.delete(id);
            return workspaces.delete(id);
        },

        // Add member
        addMember: async (workspaceId, userId, role = 'member') => {
            const workspace = workspaces.get(workspaceId);
            if (!workspace) throw new Error('Workspace not found');

            const memberList = members.get(workspaceId) || [];

            if (memberList.some(m => m.userId === userId)) {
                throw new Error('User already a member');
            }

            const member = {
                userId,
                role,
                joinedAt: new Date().toISOString()
            };

            memberList.push(member);
            members.set(workspaceId, memberList);
            return member;
        },

        // Remove member
        removeMember: async (workspaceId, userId) => {
            const memberList = members.get(workspaceId) || [];
            const index = memberList.findIndex(m => m.userId === userId);

            if (index === -1) throw new Error('User not a member');
            if (memberList[index].role === 'owner') throw new Error('Cannot remove owner');

            memberList.splice(index, 1);
            members.set(workspaceId, memberList);
            return true;
        },

        // Update member role
        updateMemberRole: async (workspaceId, userId, newRole) => {
            const memberList = members.get(workspaceId) || [];
            const member = memberList.find(m => m.userId === userId);

            if (!member) throw new Error('User not a member');

            member.role = newRole;
            members.set(workspaceId, memberList);
            return member;
        },

        // Get members
        getMembers: async (workspaceId) => {
            return members.get(workspaceId) || [];
        },

        // Check if user is member
        isMember: async (workspaceId, userId) => {
            const memberList = members.get(workspaceId) || [];
            return memberList.some(m => m.userId === userId);
        },

        // Get user's role in workspace
        getUserRole: async (workspaceId, userId) => {
            const memberList = members.get(workspaceId) || [];
            const member = memberList.find(m => m.userId === userId);
            return member?.role || null;
        },

        // Clear for testing
        clear: () => {
            workspaces.clear();
            members.clear();
        }
    };
};

describe('WorkspaceService', () => {
    let workspaceService;

    beforeEach(() => {
        workspaceService = createWorkspaceService();
    });

    describe('Workspace CRUD', () => {
        it('should create a workspace', async () => {
            const workspace = await workspaceService.create({
                name: 'Project Alpha',
                organizationId: 'org-1',
                createdBy: 'user-1'
            });

            expect(workspace.id).toBeDefined();
            expect(workspace.name).toBe('Project Alpha');
            expect(workspace.visibility).toBe('private');
        });

        it('should require name and organization', async () => {
            await expect(workspaceService.create({}))
                .rejects.toThrow('Name and organization ID required');
        });

        it('should get workspace by ID', async () => {
            const created = await workspaceService.create({
                name: 'Test Workspace',
                organizationId: 'org-1',
                createdBy: 'user-1'
            });

            const workspace = await workspaceService.getById(created.id);
            expect(workspace.name).toBe('Test Workspace');
        });

        it('should update workspace', async () => {
            const created = await workspaceService.create({
                name: 'Original Name',
                organizationId: 'org-1',
                createdBy: 'user-1'
            });

            const updated = await workspaceService.update(created.id, {
                name: 'Updated Name',
                description: 'New description'
            });

            expect(updated.name).toBe('Updated Name');
            expect(updated.description).toBe('New description');
        });

        it('should delete workspace', async () => {
            const created = await workspaceService.create({
                name: 'Delete Me',
                organizationId: 'org-1',
                createdBy: 'user-1'
            });

            await workspaceService.delete(created.id);
            const workspace = await workspaceService.getById(created.id);
            expect(workspace).toBeNull();
        });
    });

    describe('Member Management', () => {
        let workspace;

        beforeEach(async () => {
            workspace = await workspaceService.create({
                name: 'Team Workspace',
                organizationId: 'org-1',
                createdBy: 'owner-1'
            });
        });

        it('should add creator as owner', async () => {
            const members = await workspaceService.getMembers(workspace.id);

            expect(members).toHaveLength(1);
            expect(members[0].userId).toBe('owner-1');
            expect(members[0].role).toBe('owner');
        });

        it('should add member', async () => {
            await workspaceService.addMember(workspace.id, 'user-2', 'editor');

            const members = await workspaceService.getMembers(workspace.id);
            expect(members).toHaveLength(2);

            const newMember = members.find(m => m.userId === 'user-2');
            expect(newMember.role).toBe('editor');
        });

        it('should prevent duplicate membership', async () => {
            await workspaceService.addMember(workspace.id, 'user-2');

            await expect(workspaceService.addMember(workspace.id, 'user-2'))
                .rejects.toThrow('User already a member');
        });

        it('should remove member', async () => {
            await workspaceService.addMember(workspace.id, 'user-2');
            await workspaceService.removeMember(workspace.id, 'user-2');

            const members = await workspaceService.getMembers(workspace.id);
            expect(members.some(m => m.userId === 'user-2')).toBe(false);
        });

        it('should not allow removing owner', async () => {
            await expect(workspaceService.removeMember(workspace.id, 'owner-1'))
                .rejects.toThrow('Cannot remove owner');
        });

        it('should update member role', async () => {
            await workspaceService.addMember(workspace.id, 'user-2', 'viewer');

            const updated = await workspaceService.updateMemberRole(workspace.id, 'user-2', 'admin');

            expect(updated.role).toBe('admin');
        });
    });

    describe('Membership Queries', () => {
        it('should check membership', async () => {
            const ws1 = await workspaceService.create({
                name: 'Workspace 1',
                organizationId: 'org-1',
                createdBy: 'user-1'
            });
            await workspaceService.addMember(ws1.id, 'user-2');

            const isMember = await workspaceService.isMember(ws1.id, 'user-2');
            const isNotMember = await workspaceService.isMember(ws1.id, 'user-3');

            expect(isMember).toBe(true);
            expect(isNotMember).toBe(false);
        });

        it('should get user role', async () => {
            const ws1 = await workspaceService.create({
                name: 'Workspace 1',
                organizationId: 'org-1',
                createdBy: 'user-1'
            });
            await workspaceService.addMember(ws1.id, 'user-2');

            const ownerRole = await workspaceService.getUserRole(ws1.id, 'user-1');
            const memberRole = await workspaceService.getUserRole(ws1.id, 'user-2');
            const noRole = await workspaceService.getUserRole(ws1.id, 'user-3');

            expect(ownerRole).toBe('owner');
            expect(memberRole).toBe('member');
            expect(noRole).toBeNull();
        });

        it('should list workspaces for user', async () => {
            const ws1 = await workspaceService.create({
                name: 'Workspace 1',
                organizationId: 'org-1',
                createdBy: 'user-1'
            });
            await workspaceService.addMember(ws1.id, 'user-2');

            await workspaceService.create({
                name: 'Workspace 2',
                organizationId: 'org-1',
                createdBy: 'user-2'
            });

            const user2Workspaces = await workspaceService.listByUser('user-2');

            expect(user2Workspaces).toHaveLength(2); // member of ws1, owner of ws2
        });
    });

    describe('Organization Listing', () => {
        it('should list workspaces by organization', async () => {
            await workspaceService.create({ name: 'WS1', organizationId: 'org-1', createdBy: 'u1' });
            await workspaceService.create({ name: 'WS2', organizationId: 'org-1', createdBy: 'u1' });
            await workspaceService.create({ name: 'WS3', organizationId: 'org-2', createdBy: 'u1' });

            const org1Workspaces = await workspaceService.listByOrganization('org-1');

            expect(org1Workspaces).toHaveLength(2);
            expect(org1Workspaces.every(w => w.organizationId === 'org-1')).toBe(true);
        });
    });
});
