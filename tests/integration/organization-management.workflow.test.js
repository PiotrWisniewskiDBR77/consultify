/**
 * Organization Management Integration Tests
 *
 * End-to-end workflow tests for organization lifecycle management
 * CRITICAL FOR ENTERPRISE MULTI-TENANCY VALIDATION
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupStandardTest } from '../helpers/unifiedMockSetup.js';

// Import route modules
import organizationsRouter from '../../../server/src/routes/organizations.routes.ts';
import usersRouter from '../../../server/src/routes/users.routes.ts';

describe('Organization Management Workflow Integration', () => {
    let app;
    let mocks;
    let testOrgId;
    let testUserId;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks = setupStandardTest();

        // Setup test IDs
        testOrgId = 'org-integration-test';
        testUserId = 'user-integration-test';

        app = express();
        app.use(express.json());

        // Mock authentication middleware for all routes
        app.use((req, res, next) => {
            req.user = { id: testUserId, organizationId: testOrgId };
            req.organizationId = testOrgId;
            next();
        });

        // Mount routes
        app.use('/api/organizations', organizationsRouter);
        app.use('/api/users', usersRouter);

        // Setup successful database responses by default
        mocks.db.run.mockImplementation(function(sql, params, callback) {
            if (callback) callback.call({ lastID: 1, changes: 1 }, null);
        });

        mocks.db.get.mockImplementation((sql, params, callback) => {
            if (sql.includes('organizations') && sql.includes('WHERE id = ?')) {
                callback(null, {
                    id: testOrgId,
                    name: 'Integration Test Org',
                    description: 'Test organization for integration tests',
                    plan: 'enterprise',
                    status: 'active',
                    created_at: new Date().toISOString()
                });
            } else if (sql.includes('users') && sql.includes('WHERE id = ?')) {
                callback(null, {
                    id: testUserId,
                    email: 'test@example.com',
                    first_name: 'Test',
                    last_name: 'User',
                    role: 'admin',
                    organization_id: testOrgId
                });
            } else {
                callback(null, null);
            }
        });

        mocks.db.all.mockImplementation((sql, params, callback) => {
            if (sql.includes('organization_members') || sql.includes('users WHERE organization_id')) {
                callback(null, [{
                    id: testUserId,
                    email: 'test@example.com',
                    first_name: 'Test',
                    last_name: 'User',
                    role: 'admin',
                    organization_id: testOrgId
                }]);
            } else {
                callback(null, []);
            }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Complete Organization Lifecycle', () => {
        it('should create organization, add users, and manage permissions', async () => {
            // Step 1: Get current organizations (should return empty for new user)
            mocks.db.all.mockImplementationOnce((sql, params, callback) => {
                callback(null, []); // No organizations initially
            });

            let response = await request(app)
                .get('/api/organizations/current')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);

            // Step 2: Create new organization
            const orgData = {
                name: 'Workflow Test Organization',
                description: 'Created during integration test'
            };

            response = await request(app)
                .post('/api/organizations')
                .send(orgData)
                .expect(201);

            expect(response.body.id).toBeDefined();
            const newOrgId = response.body.id;

            // Step 3: Get organization details
            response = await request(app)
                .get(`/api/organizations/${newOrgId}`)
                .expect(200);

            expect(response.body.organization.id).toBe(newOrgId);
            expect(response.body.organization.name).toBe(orgData.name);

            // Step 4: Get organization members (should include creator)
            response = await request(app)
                .get(`/api/organizations/${newOrgId}/members`)
                .expect(200);

            expect(response.body.members).toBeDefined();
            expect(Array.isArray(response.body.members)).toBe(true);

            // Step 5: Add another user to organization
            const newUserData = {
                userId: 'user-new-member',
                role: 'member'
            };

            response = await request(app)
                .post(`/api/organizations/${newOrgId}/members`)
                .send(newUserData)
                .expect(201);

            expect(response.body.member.userId).toBe(newUserData.userId);
            expect(response.body.member.role).toBe(newUserData.role);

            // Step 6: Update member role
            const roleUpdate = { role: 'admin' };

            response = await request(app)
                .patch(`/api/organizations/${newOrgId}/members/user-new-member/role`)
                .send(roleUpdate)
                .expect(200);

            expect(response.body.message).toContain('updated');

            // Step 7: Update organization settings
            const orgUpdate = {
                name: 'Updated Organization Name',
                description: 'Updated description'
            };

            response = await request(app)
                .put(`/api/organizations/${newOrgId}`)
                .send(orgUpdate)
                .expect(200);

            expect(response.body.message).toContain('updated');

            // Step 8: Verify all changes persisted
            response = await request(app)
                .get(`/api/organizations/${newOrgId}`)
                .expect(200);

            expect(response.body.organization.name).toBe(orgUpdate.name);
        });

        it('should handle organization not found scenarios', async () => {
            const nonExistentId = 'org-non-existent';

            // Mock database to return null for organization queries
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            // Try to get non-existent organization
            const response = await request(app)
                .get(`/api/organizations/${nonExistentId}`)
                .expect(404);

            expect(response.body.error).toBe('Organization not found');
        });

        it('should prevent unauthorized access to other organizations', async () => {
            const otherOrgId = 'org-other-organization';

            // Mock database to return organization belonging to different user
            mocks.db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organizations') && params[0] === otherOrgId) {
                    callback(null, {
                        id: otherOrgId,
                        name: 'Other Org',
                        organization_id: 'org-different-owner'
                    });
                } else {
                    callback(null, null);
                }
            });

            // Try to access organization not owned by user
            const response = await request(app)
                .get(`/api/organizations/${otherOrgId}`)
                .expect(404);

            expect(response.body.error).toBe('Organization not found');
        });
    });

    describe('User Management Integration', () => {
        it('should manage users within organization context', async () => {
            // Step 1: Get all users in organization
            let response = await request(app)
                .get('/api/users')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);

            // Step 2: Get specific user details
            response = await request(app)
                .get(`/api/users/${testUserId}`)
                .expect(200);

            expect(response.body.email).toBe('test@example.com');

            // Step 3: Update user profile
            const updateData = {
                first_name: 'Updated',
                last_name: 'TestUser'
            };

            response = await request(app)
                .put(`/api/users/${testUserId}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Step 4: Try to access non-existent user
            response = await request(app)
                .get('/api/users/user-non-existent')
                .expect(404);

            expect(response.body.error).toBeDefined();
        });

        it('should validate user data integrity', async () => {
            // Test invalid user update
            const invalidUpdate = {
                first_name: '', // Invalid: empty name
                email: 'invalid-email' // Invalid: bad email format
            };

            const response = await request(app)
                .put(`/api/users/${testUserId}`)
                .send(invalidUpdate)
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('Cross-Entity Relationships', () => {
        it('should maintain referential integrity between organizations and users', async () => {
            // Create organization
            const orgData = { name: 'Relationship Test Org' };

            let response = await request(app)
                .post('/api/organizations')
                .send(orgData)
                .expect(201);

            const orgId = response.body.id;

            // Add user to organization
            const memberData = {
                userId: 'user-relationship-test',
                role: 'member'
            };

            response = await request(app)
                .post(`/api/organizations/${orgId}/members`)
                .send(memberData)
                .expect(201);

            // Verify user appears in organization members
            response = await request(app)
                .get(`/api/organizations/${orgId}/members`)
                .expect(200);

            const memberFound = response.body.members.some(member =>
                member.id === memberData.userId
            );
            expect(memberFound).toBe(true);

            // Remove user from organization
            response = await request(app)
                .delete(`/api/organizations/${orgId}/members/user-relationship-test`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should handle cascading updates', async () => {
            // Test that organization updates don't break user relationships
            const orgId = testOrgId;
            const updateData = { name: 'Cascading Update Test' };

            // Update organization
            await request(app)
                .put(`/api/organizations/${orgId}`)
                .send(updateData)
                .expect(200);

            // Verify users still accessible
            const response = await request(app)
                .get('/api/users')
                .expect(200);

            expect(response.body.length).toBeGreaterThan(0);

            // Verify organization members still work
            const membersResponse = await request(app)
                .get(`/api/organizations/${orgId}/members`)
                .expect(200);

            expect(Array.isArray(membersResponse.body.members)).toBe(true);
        });
    });

    describe('Error Recovery and Resilience', () => {
        it('should handle database connection failures gracefully', async () => {
            // Mock database failure
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(new Error('Database connection lost'), null);
            });

            const response = await request(app)
                .get('/api/organizations/current')
                .expect(500);

            expect(response.body.error).toBeDefined();
        });

        it('should handle partial failures in multi-step operations', async () => {
            // Mock success for organization creation but failure for member addition
            let callCount = 0;
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                callCount++;
                if (callCount === 1) { // Organization creation succeeds
                    callback.call({ lastID: 1, changes: 1 }, null);
                } else { // Member addition fails
                    callback.call({ changes: 0 }, new Error('Member addition failed'));
                }
            });

            // Organization creation should succeed
            const orgResponse = await request(app)
                .post('/api/organizations')
                .send({ name: 'Error Recovery Test' })
                .expect(201);

            expect(orgResponse.body.id).toBeDefined();

            // Member addition should fail gracefully
            const memberResponse = await request(app)
                .post(`/api/organizations/${orgResponse.body.id}/members`)
                .send({ userId: 'user-test', role: 'member' })
                .expect(500);

            expect(memberResponse.body.error).toBeDefined();
        });

        it('should validate input data at all levels', async () => {
            const invalidData = {
                name: null, // Invalid
                description: 123 // Invalid type
            };

            const response = await request(app)
                .post('/api/organizations')
                .send(invalidData)
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('Performance and Load', () => {
        it('should handle concurrent organization operations', async () => {
            const operations = [
                request(app).get('/api/organizations/current'),
                request(app).get('/api/users'),
                request(app).get(`/api/organizations/${testOrgId}/members`)
            ];

            const responses = await Promise.all(operations);

            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });

        it('should maintain response times under load', async () => {
            const startTime = Date.now();

            // Perform multiple operations
            await Promise.all([
                request(app).get('/api/organizations/current'),
                request(app).get('/api/users'),
                request(app).post('/api/organizations').send({ name: 'Load Test Org' })
            ]);

            const totalTime = Date.now() - startTime;
            expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
        });
    });
});


