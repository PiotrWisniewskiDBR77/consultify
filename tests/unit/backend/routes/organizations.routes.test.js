import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Organizations Routes Tests
 * Tests for organization management API endpoints
 * CRITICAL FOR ENTERPRISE MULTI-TENANCY
 */

import organizationsRouter from '../../../../server/src/routes/organizations.routes.ts';

describe('Organizations Routes', () => {
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

        app.use('/api/organizations', organizationsRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/organizations', () => {
        it('should get organization details', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'test-org',
                    name: 'Test Organization',
                    plan: 'enterprise',
                    status: 'active'
                });
            });

            const response = await request(app)
                .get('/api/organizations')
                .expect(200);

            expect(response.body.name).toBe('Test Organization');
        });
    });

    describe('PUT /api/organizations', () => {
        it('should update organization settings', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const updateData = {
                name: 'Updated Organization',
                settings: { timezone: 'UTC' }
            };

            const response = await request(app)
                .put('/api/organizations')
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/organizations/members', () => {
        it('should get organization members', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'user-1',
                        email: 'user1@test.com',
                        role: 'admin',
                        status: 'active'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/organizations/members')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/organizations/members', () => {
        it('should add member to organization', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ lastID: 1 }, null);
            });

            const memberData = {
                email: 'newmember@test.com',
                role: 'member'
            };

            const response = await request(app)
                .post('/api/organizations/members')
                .send(memberData)
                .expect(201);

            expect(response.body.invitationId).toBeDefined();
        });
    });

    describe('PUT /api/organizations/members/:userId', () => {
        it('should update member role', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const updateData = {
                role: 'admin'
            };

            const response = await request(app)
                .put('/api/organizations/members/user-1')
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('DELETE /api/organizations/members/:userId', () => {
        it('should remove member from organization', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .delete('/api/organizations/members/user-1')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/organizations/billing', () => {
        it('should get billing information', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    plan: 'enterprise',
                    seats_used: 15,
                    seats_limit: 50,
                    next_billing_date: '2025-02-01'
                });
            });

            const response = await request(app)
                .get('/api/organizations/billing')
                .expect(200);

            expect(response.body.plan).toBe('enterprise');
        });
    });
});
