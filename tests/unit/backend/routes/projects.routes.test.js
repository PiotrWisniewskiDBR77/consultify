import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Projects Routes Tests
 * Tests for project management API endpoints
 * CRITICAL FOR ENTERPRISE PROJECT MANAGEMENT
 */

import projectsRouter from '../../../../server/src/routes/projects.routes.ts';

describe('Projects Routes', () => {
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

        app.use('/api/projects', projectsRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/projects', () => {
        it('should get projects for organization', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'project-1',
                        name: 'Test Project',
                        organization_id: 'test-org',
                        status: 'active'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/projects')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/projects', () => {
        it('should create new project', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ lastID: 1 }, null);
            });

            const projectData = {
                name: 'New Project',
                description: 'Project description'
            };

            const response = await request(app)
                .post('/api/projects')
                .send(projectData)
                .expect(201);

            expect(response.body.id).toBeDefined();
        });

        it('should validate project name', async () => {
            const response = await request(app)
                .post('/api/projects')
                .send({ name: '' })
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/projects/:id', () => {
        it('should get project by id', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'project-1',
                    name: 'Test Project',
                    organization_id: 'test-org'
                });
            });

            const response = await request(app)
                .get('/api/projects/project-1')
                .expect(200);

            expect(response.body.name).toBe('Test Project');
        });

        it('should return 404 for non-existent project', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .get('/api/projects/non-existent')
                .expect(404);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('PUT /api/projects/:id', () => {
        it('should update project', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const updateData = {
                name: 'Updated Project',
                status: 'completed'
            };

            const response = await request(app)
                .put('/api/projects/project-1')
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('DELETE /api/projects/:id', () => {
        it('should delete project', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .delete('/api/projects/project-1')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });
});
