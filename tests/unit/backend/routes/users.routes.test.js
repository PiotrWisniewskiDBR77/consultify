import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Users Routes Tests
 * Tests for user management API endpoints
 * CRITICAL FOR ENTERPRISE USER MANAGEMENT
 */

import usersRouter from '../../../../server/src/routes/users.routes.ts';

describe('Users Routes', () => {
    let app;
    let mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks = setupStandardTest();

        app = express();
        app.use(express.json());

        // Mock auth middleware
        app.use((req, res, next) => {
            req.user = { id: 'test-user', organizationId: 'test-org' };
            req.organizationId = 'test-org';
            next();
        });

        app.use('/api/users', usersRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/users', () => {
        it('should get users for organization', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'user-1',
                        email: 'user1@test.com',
                        first_name: 'John',
                        last_name: 'Doe',
                        organization_id: 'test-org'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/users')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/users/:id', () => {
        it('should get user by id', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'user-1',
                    email: 'user1@test.com',
                    first_name: 'John',
                    last_name: 'Doe',
                    organization_id: 'test-org'
                });
            });

            const response = await request(app)
                .get('/api/users/user-1')
                .expect(200);

            expect(response.body.email).toBe('user1@test.com');
        });

        it('should return 404 for non-existent user', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .get('/api/users/non-existent')
                .expect(404);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('PUT /api/users/:id', () => {
        it('should update user profile', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const updateData = {
                first_name: 'Jane',
                last_name: 'Smith'
            };

            const response = await request(app)
                .put('/api/users/user-1')
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('DELETE /api/users/:id', () => {
        it('should deactivate user', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .delete('/api/users/user-1')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/users/invite', () => {
        it('should invite new user', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ lastID: 1 }, null);
            });

            const inviteData = {
                email: 'newuser@test.com',
                first_name: 'New',
                last_name: 'User'
            };

            const response = await request(app)
                .post('/api/users/invite')
                .send(inviteData)
                .expect(201);

            expect(response.body.invitationId).toBeDefined();
        });

        it('should validate email format', async () => {
            const response = await request(app)
                .post('/api/users/invite')
                .send({ email: 'invalid-email' })
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });
});
