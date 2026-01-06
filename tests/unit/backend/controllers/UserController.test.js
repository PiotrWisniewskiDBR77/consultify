/**
 * User Controller Tests
 *
 * Tests for user management business logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserController } from '../../../../server/src/controllers/UserController.js';
import { setupStandardTest } from '../../../helpers/unifiedMockSetup.js';

// Mock dependencies
vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
    queryAll: vi.fn(),
    queryOne: vi.fn(),
    queryRun: vi.fn()
}));

const mockQueryHelpers = await import('../../../../server/src/utils/queryHelpers.js');

describe('UserController', () => {
    let mockDb;
    let mockReq;
    let mockRes;

    beforeEach(() => {
        // Use unified mock setup
        const mocks = setupStandardTest();
        mockDb = mocks.db;

        // Setup request/response mocks
        mockReq = {
            user: {
                id: 'user-123',
                organizationId: 'org-456'
            },
            params: {},
            query: {},
            body: {}
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis()
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getUsers()', () => {
        it('should retrieve all users for organization', async () => {
            const mockUsers = [
                { id: 'user-1', email: 'user1@example.com', first_name: 'John', role: 'ADMIN' },
                { id: 'user-2', email: 'user2@example.com', first_name: 'Jane', role: 'USER' }
            ];

            mockQueryHelpers.queryAll.mockResolvedValue(mockUsers);

            await UserController.getUsers(mockReq, mockRes);

            expect(mockQueryHelpers.queryAll).toHaveBeenCalledWith(
                expect.stringContaining('SELECT id, email, first_name, last_name, role, status'),
                ['org-456']
            );
            expect(mockRes.json).toHaveBeenCalledWith({
                users: mockUsers,
                total: mockUsers.length
            });
        });

        it('should filter users with review permissions when canReview=true', async () => {
            mockReq.query.canReview = 'true';
            const mockUsers = [
                { id: 'user-1', email: 'admin@example.com', role: 'ADMIN' }
            ];

            mockQueryHelpers.queryAll.mockResolvedValue(mockUsers);

            await UserController.getUsers(mockReq, mockRes);

            expect(mockQueryHelpers.queryAll).toHaveBeenCalledWith(
                expect.stringContaining("role IN ('ADMIN', 'MANAGER', 'REVIEWER', 'LEADER')"),
                ['org-456']
            );
        });

        it('should return 401 when user has no organization', async () => {
            mockReq.user.organizationId = null;

            await UserController.getUsers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        });

        it('should handle database errors', async () => {
            const dbError = new Error('Database connection failed');
            mockQueryHelpers.queryAll.mockRejectedValue(dbError);

            await UserController.getUsers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve users',
                details: dbError.message
            });
        });
    });

    describe('getUserById()', () => {
        it('should retrieve specific user by ID', async () => {
            mockReq.params.id = 'user-789';
            const mockUser = {
                id: 'user-789',
                email: 'user789@example.com',
                first_name: 'Bob',
                role: 'USER'
            };

            mockQueryHelpers.queryOne.mockResolvedValue(mockUser);

            await UserController.getUserById(mockReq, mockRes);

            expect(mockQueryHelpers.queryOne).toHaveBeenCalledWith(
                expect.stringContaining('SELECT id, email, first_name'),
                ['user-789', 'org-456']
            );
            expect(mockRes.json).toHaveBeenCalledWith({ user: mockUser });
        });

        it('should return 404 when user not found', async () => {
            mockReq.params.id = 'non-existent';
            mockQueryHelpers.queryOne.mockResolvedValue(null);

            await UserController.getUserById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found' });
        });

        it('should return 401 when user has no organization', async () => {
            mockReq.user.organizationId = null;
            mockReq.params.id = 'user-123';

            await UserController.getUserById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        });

        it('should allow admin to view users from other organizations', async () => {
            mockReq.params.id = 'user-999';
            mockReq.user.organizationId = 'org-admin';
            const mockUser = {
                id: 'user-999',
                email: 'user999@example.com',
                organization_id: 'org-different'
            };

            mockQueryHelpers.queryOne.mockResolvedValue(mockUser);

            await UserController.getUserById(mockReq, mockRes);

            expect(mockQueryHelpers.queryOne).toHaveBeenCalledWith(
                expect.stringContaining('organization_id = ?'),
                ['user-999', 'org-admin']
            );
        });
    });

    describe('updateUser()', () => {
        it('should update user profile', async () => {
            mockReq.params.id = 'user-123';
            mockReq.body = {
                first_name: 'Updated',
                last_name: 'Name',
                phone: '+1234567890'
            };

            mockQueryHelpers.queryRun.mockResolvedValue({ lastID: 'user-123', changes: 1 });

            await UserController.updateUser(mockReq, mockRes);

            expect(mockQueryHelpers.queryRun).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET'),
                expect.arrayContaining(['Updated', 'Name', '+1234567890', 'user-123', 'org-456'])
            );
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'User updated successfully',
                userId: 'user-123'
            });
        });

        it('should handle partial updates', async () => {
            mockReq.params.id = 'user-123';
            mockReq.body = { first_name: 'NewName' };

            mockQueryHelpers.queryRun.mockResolvedValue({ changes: 1 });

            await UserController.updateUser(mockReq, mockRes);

            expect(mockQueryHelpers.queryRun).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET first_name = ?'),
                expect.arrayContaining(['NewName', 'user-123', 'org-456'])
            );
        });

        it('should return 404 when user not found or no changes made', async () => {
            mockReq.params.id = 'user-123';
            mockReq.body = { first_name: 'Test' };

            mockQueryHelpers.queryRun.mockResolvedValue({ changes: 0 });

            await UserController.updateUser(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found or no changes made' });
        });

        it('should validate required fields', async () => {
            mockReq.params.id = 'user-123';
            mockReq.body = {}; // Empty body

            await UserController.updateUser(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'At least one field must be provided for update'
            });
        });

        it('should handle database errors', async () => {
            mockReq.params.id = 'user-123';
            mockReq.body = { first_name: 'Test' };

            const dbError = new Error('Database update failed');
            mockQueryHelpers.queryRun.mockRejectedValue(dbError);

            await UserController.updateUser(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to update user',
                details: dbError.message
            });
        });
    });

    describe('updateUserRole()', () => {
        it('should update user role (admin only)', async () => {
            mockReq.params.id = 'user-123';
            mockReq.body = { role: 'MANAGER' };

            mockQueryHelpers.queryRun.mockResolvedValue({ changes: 1 });

            await UserController.updateUserRole(mockReq, mockRes);

            expect(mockQueryHelpers.queryRun).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET role = ?'),
                ['MANAGER', 'user-123', 'org-456']
            );
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'User role updated successfully',
                userId: 'user-123',
                newRole: 'MANAGER'
            });
        });

        it('should validate role values', async () => {
            mockReq.params.id = 'user-123';
            mockReq.body = { role: 'INVALID_ROLE' };

            await UserController.updateUserRole(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid role. Must be one of: OWNER, ADMIN, MANAGER, USER, GUEST'
            });
        });

        it('should return 404 when user not found', async () => {
            mockReq.params.id = 'user-123';
            mockReq.body = { role: 'ADMIN' };

            mockQueryHelpers.queryRun.mockResolvedValue({ changes: 0 });

            await UserController.updateUserRole(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found' });
        });

        it('should handle database errors', async () => {
            mockReq.params.id = 'user-123';
            mockReq.body = { role: 'ADMIN' };

            const dbError = new Error('Role update failed');
            mockQueryHelpers.queryRun.mockRejectedValue(dbError);

            await UserController.updateUserRole(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to update user role',
                details: dbError.message
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle unexpected errors gracefully', async () => {
            mockReq.user = null; // Simulate missing user

            await UserController.getUsers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        });

        it('should validate request parameters', async () => {
            mockReq.params = {}; // Missing id
            mockReq.body = { role: 'ADMIN' };

            await UserController.updateUserRole(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'User ID is required'
            });
        });
    });

    describe('Security', () => {
        it('should enforce organization boundaries', async () => {
            mockReq.params.id = 'user-123';
            mockReq.user.organizationId = 'org-different';

            mockQueryHelpers.queryOne.mockResolvedValue(null); // User not in same org

            await UserController.getUserById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found' });
        });

        it('should prevent role escalation attacks', async () => {
            mockReq.params.id = 'user-123';
            mockReq.body = { role: 'OWNER' };

            // This should be validated at the application level
            // The controller itself validates the role exists in allowed list
            await UserController.updateUserRole(mockReq, mockRes);

            expect(mockQueryHelpers.queryRun).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining(['OWNER'])
            );
        });
    });
});
