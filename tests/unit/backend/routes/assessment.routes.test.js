import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Assessment Routes Tests
 * Tests for assessment management API endpoints
 * CRITICAL FOR ENTERPRISE ASSESSMENT CAPABILITIES
 */

import assessmentRouter from '../../../../server/src/routes/assessment.routes.ts';

describe('Assessment Routes', () => {
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

        app.use('/api/assessments', assessmentRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/assessments', () => {
        it('should get assessments for organization', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'assessment-1',
                        project_id: 'project-1',
                        organization_id: 'test-org',
                        status: 'draft'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/assessments')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/assessments', () => {
        it('should create new assessment', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ lastID: 1 }, null);
            });

            const assessmentData = {
                project_id: 'project-1',
                framework: 'PMBOK'
            };

            const response = await request(app)
                .post('/api/assessments')
                .send(assessmentData)
                .expect(201);

            expect(response.body.id).toBeDefined();
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/assessments')
                .send({})
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/assessments/:id', () => {
        it('should get assessment by id', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'assessment-1',
                    project_id: 'project-1',
                    organization_id: 'test-org',
                    axis_scores: JSON.stringify([{ axis: 'Planning', asIs: 2, toBe: 5 }])
                });
            });

            const response = await request(app)
                .get('/api/assessments/assessment-1')
                .expect(200);

            expect(response.body.id).toBe('assessment-1');
            expect(response.body.axisScores).toBeDefined();
        });

        it('should return 404 for non-existent assessment', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .get('/api/assessments/non-existent')
                .expect(404);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('PUT /api/assessments/:id', () => {
        it('should update assessment', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const updateData = {
                status: 'completed',
                axis_scores: [{ axis: 'Planning', asIs: 3, toBe: 5 }]
            };

            const response = await request(app)
                .put('/api/assessments/assessment-1')
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/assessments/:id/finalize', () => {
        it('should finalize assessment', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .post('/api/assessments/assessment-1/finalize')
                .send({ confirmed: true })
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });
});



