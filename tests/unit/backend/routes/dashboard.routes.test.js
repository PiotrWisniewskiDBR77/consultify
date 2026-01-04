import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Dashboard Routes Tests
 * Tests for dashboard data API endpoints
 * CRITICAL FOR ENTERPRISE DASHBOARD FUNCTIONALITY
 */

import dashboardRouter from '../../../../server/src/routes/dashboard.routes.ts';

describe('Dashboard Routes', () => {
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

        app.use('/api/dashboard', dashboardRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/dashboard/overview', () => {
        it('should get dashboard overview data', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    total_users: 25,
                    active_projects: 5,
                    completed_tasks: 150,
                    pending_invitations: 3
                });
            });

            const response = await request(app)
                .get('/api/dashboard/overview')
                .expect(200);

            expect(response.body.total_users).toBeDefined();
            expect(response.body.active_projects).toBeDefined();
        });
    });

    describe('GET /api/dashboard/metrics', () => {
        it('should get dashboard metrics', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { metric: 'task_completion_rate', value: 85 },
                    { metric: 'project_velocity', value: 12 }
                ]);
            });

            const response = await request(app)
                .get('/api/dashboard/metrics')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/dashboard/recent-activity', () => {
        it('should get recent activity data', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'activity-1',
                        type: 'task_completed',
                        description: 'Task completed',
                        timestamp: '2025-01-01T10:00:00Z'
                    }
                ]);
            });

            const response = await request(app)
                .get('/api/dashboard/recent-activity')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/dashboard/charts/:chartType', () => {
        it('should get chart data for specific type', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { period: '2025-01', value: 25 },
                    { period: '2025-02', value: 30 }
                ]);
            });

            const response = await request(app)
                .get('/api/dashboard/charts/task-completion')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should handle invalid chart type', async () => {
            const response = await request(app)
                .get('/api/dashboard/charts/invalid-type')
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('GET /api/dashboard/widgets/:widgetId', () => {
        it('should get widget configuration', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'widget-1',
                    type: 'kpi',
                    config: { title: 'Total Tasks', value: 150 }
                });
            });

            const response = await request(app)
                .get('/api/dashboard/widgets/widget-1')
                .expect(200);

            expect(response.body.type).toBe('kpi');
        });

        it('should return 404 for non-existent widget', async () => {
            mocks.db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .get('/api/dashboard/widgets/non-existent')
                .expect(404);

            expect(response.body.error).toBeDefined();
        });
    });
});

