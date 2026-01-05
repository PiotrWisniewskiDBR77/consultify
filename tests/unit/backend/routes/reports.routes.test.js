import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Reports Routes Tests
 * Tests report generation and data export API endpoints
 * CRITICAL FOR ENTERPRISE REPORTING CAPABILITIES
 */

import reportsRouter from '../../../../server/src/routes/reports.routes.ts';

describe('Reports Routes', () => {
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

        app.use('/api/reports', reportsRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/reports/project/:projectId', () => {
        it('should generate project report', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'project-1',
                    name: 'Digital Transformation',
                    status: 'active',
                    progress: 75
                });
            });

            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'task-1', title: 'Task 1', status: 'completed' },
                    { id: 'task-2', title: 'Task 2', status: 'in_progress' }
                ]);
            });

            const response = await request(app)
                .get('/api/reports/project/project-1')
                .expect(200);

            expect(response.body.project).toBeDefined();
            expect(response.body.tasks).toBeDefined();
        });

        it('should return 404 for non-existent project', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .get('/api/reports/project/non-existent')
                .expect(404);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/reports/assessment/:assessmentId', () => {
        it('should generate assessment report', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'assessment-1',
                    project_id: 'project-1',
                    status: 'completed',
                    axis_scores: JSON.stringify([{ axis: 'Planning', asIs: 2, toBe: 5 }])
                });
            });

            const response = await request(app)
                .get('/api/reports/assessment/assessment-1')
                .expect(200);

            expect(response.body.assessment).toBeDefined();
            expect(response.body.axisScores).toBeDefined();
        });
    });

    describe('GET /api/reports/organization/summary', () => {
        it('should generate organization summary report', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    total_users: 25,
                    active_projects: 5,
                    completed_tasks: 150,
                    average_completion_time: 7.5
                });
            });

            const response = await request(app)
                .get('/api/reports/organization/summary')
                .expect(200);

            expect(response.body.total_users).toBeDefined();
            expect(response.body.active_projects).toBeDefined();
        });
    });

    describe('POST /api/reports/export', () => {
        it('should export data in specified format', async () => {
            const exportData = {
                type: 'projects',
                format: 'csv',
                filters: { status: 'active' }
            };

            const response = await request(app)
                .post('/api/reports/export')
                .send(exportData)
                .expect(200);

            expect(response.body.exportId).toBeDefined();
            expect(response.headers['content-type']).toContain('csv');
        });

        it('should support PDF export', async () => {
            const exportData = {
                type: 'assessment',
                format: 'pdf',
                assessmentId: 'assessment-1'
            };

            const response = await request(app)
                .post('/api/reports/export')
                .send(exportData)
                .expect(200);

            expect(response.body.exportId).toBeDefined();
        });

        it('should validate export format', async () => {
            const exportData = {
                type: 'projects',
                format: 'invalid'
            };

            const response = await request(app)
                .post('/api/reports/export')
                .send(exportData)
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/reports/scheduled', () => {
        it('should get scheduled reports', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'report-1',
                        name: 'Weekly Progress Report',
                        schedule: 'weekly',
                        next_run: '2025-01-08T09:00:00Z',
                        active: true
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/reports/scheduled')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/reports/scheduled', () => {
        it('should create scheduled report', async () => {
            mocks.db.run.mockImplementation(function(sql, params, callback) {
                if (callback) callback.call({ lastID: 1 }, null);
            });

            const scheduleData = {
                name: 'Monthly Assessment Report',
                type: 'assessment',
                schedule: 'monthly',
                recipients: ['admin@test.com'],
                filters: { project_id: 'project-1' }
            };

            const response = await request(app)
                .post('/api/reports/scheduled')
                .send(scheduleData)
                .expect(201);

            expect(response.body.reportId).toBeDefined();
        });

        it('should validate schedule parameters', async () => {
            const invalidData = {
                name: 'Invalid Report',
                type: 'invalid-type'
            };

            const response = await request(app)
                .post('/api/reports/scheduled')
                .send(invalidData)
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/reports/templates', () => {
        it('should get available report templates', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'template-1',
                        name: 'Project Status Template',
                        type: 'project',
                        description: 'Standard project status report'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/reports/templates')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/reports/history', () => {
        it('should get report generation history', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'gen-1',
                        report_type: 'project',
                        status: 'completed',
                        generated_at: '2025-01-01T10:00:00Z',
                        download_url: '/downloads/report-1.pdf'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/reports/history')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });
});



