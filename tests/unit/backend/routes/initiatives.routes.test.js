import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Initiatives Routes Tests
 * Tests for initiative management API endpoints
 * CRITICAL FOR ENTERPRISE INITIATIVE MANAGEMENT
 */

import initiativesRouter from '../../../../server/src/routes/initiatives.routes.ts';

describe('Initiatives Routes', () => {
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

        app.use('/api/initiatives', initiativesRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/initiatives', () => {
        it('should get initiatives for organization', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'initiative-1',
                        name: 'Digital Transformation',
                        project_id: 'project-1',
                        organization_id: 'test-org',
                        status: 'active'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/initiatives')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/initiatives', () => {
        it('should create new initiative', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ lastID: 1 }, null);
            });

            const initiativeData = {
                name: 'New Initiative',
                project_id: 'project-1',
                description: 'Initiative description'
            };

            const response = await request(app)
                .post('/api/initiatives')
                .send(initiativeData)
                .expect(201);

            expect(response.body.id).toBeDefined();
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/initiatives')
                .send({ name: '' })
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/initiatives/:id', () => {
        it('should get initiative by id', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'initiative-1',
                    name: 'Digital Transformation',
                    project_id: 'project-1',
                    organization_id: 'test-org'
                });
            });

            const response = await request(app)
                .get('/api/initiatives/initiative-1')
                .expect(200);

            expect(response.body.name).toBe('Digital Transformation');
        });

        it('should return 404 for non-existent initiative', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .get('/api/initiatives/non-existent')
                .expect(404);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('PUT /api/initiatives/:id', () => {
        it('should update initiative', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const updateData = {
                name: 'Updated Initiative',
                status: 'completed'
            };

            const response = await request(app)
                .put('/api/initiatives/initiative-1')
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('DELETE /api/initiatives/:id', () => {
        it('should delete initiative', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .delete('/api/initiatives/initiative-1')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/initiatives/:id/status', () => {
        it('should update initiative status', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const statusData = {
                status: 'completed',
                notes: 'Completed successfully'
            };

            const response = await request(app)
                .post('/api/initiatives/initiative-1/status')
                .send(statusData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });
});



