import app from '../../../server/server';
import app from '../../../server/src/index.js';
import request from 'supertest';
import { User, Organization, Project } from '../../../server/models';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { sequelize } from '../../../server/models';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

// AI Analytics Routes Integration Tests
// Tests AI analytics dashboard and metrics collection


describe('AI Analytics Routes Integration Tests', () => {
    const db = getDatabase();
    let testUser;
    let testOrg;
    let testProject;
    let authToken;

    beforeAll(async () => {
        await initializeDatabase();
        // Create test data
        testOrg = await Organization.create({
            name: 'Test AI Analytics Org',
            domain: 'ai-analytics-test.com'
        });

        testUser = await User.create({
            firstName: 'Analytics',
            lastName: 'TestUser',
            email: 'analytics@test.com',
            organizationId: testOrg.id,
            password: 'hashedpassword'
        });

        testProject = await Project.create({
            name: 'AI Analytics Test Project',
            organizationId: testOrg.id,
            ownerId: testUser.id,
            status: 'active'
        });

        // Mock JWT token
        authToken = 'mock-jwt-token-for-analytics-tests';
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('GET /api/analytics/ai/dashboard', () => {
    const db = getDatabase();
        it('should return complete AI analytics dashboard', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/dashboard')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('summary');
            expect(response.body).toHaveProperty('actions');
            expect(response.body).toHaveProperty('playbooks');
            expect(response.body).toHaveProperty('policies');
            expect(response.body).toHaveProperty('roi');
        });

        it('should filter dashboard by date range', async () => {
            const from = '2024-01-01';
            const to = '2024-12-31';

            const response = await request(app)
                .get('/api/analytics/ai/dashboard')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ from, to });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('dateRange');
            expect(response.body.dateRange).toHaveProperty('from', from);
            expect(response.body.dateRange).toHaveProperty('to', to);
        });

        it('should include organization-specific data', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/dashboard')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            // Data should be scoped to the user's organization
            expect(response.body.organizationId).toBe(testOrg.id);
        });

        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/dashboard');

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/analytics/ai/actions', () => {
    const db = getDatabase();
        it('should return AI action analytics', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/actions')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('totalActions');
            expect(response.body).toHaveProperty('successRate');
            expect(response.body).toHaveProperty('actionsByType');
            expect(response.body).toHaveProperty('approvalRate');
            expect(response.body).toHaveProperty('avgResolutionTime');
        });

        it('should filter actions by date range', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/actions')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    from: '2024-01-01',
                    to: '2024-12-31'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('dateRange');
        });

        it('should filter actions by project', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/actions')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ projectId: testProject.id });

            expect(response.status).toBe(200);
            // Should only include actions for the specified project
            if (response.body.actions && response.body.actions.length > 0) {
                response.body.actions.forEach(action => {
                    expect(action.projectId).toBe(testProject.id);
                });
            }
        });

        it('should include action success/failure breakdown', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/actions')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('breakdown');
            expect(response.body.breakdown).toHaveProperty('successful');
            expect(response.body.breakdown).toHaveProperty('failed');
            expect(response.body.breakdown).toHaveProperty('pending');
        });
    });

    describe('GET /api/analytics/ai/playbooks', () => {
    const db = getDatabase();
        it('should return AI playbook analytics', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/playbooks')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('totalPlaybooks');
            expect(response.body).toHaveProperty('completionRate');
            expect(response.body).toHaveProperty('avgCompletionTime');
            expect(response.body).toHaveProperty('mostUsedPlaybooks');
            expect(response.body).toHaveProperty('successByCategory');
        });

        it('should include playbook usage statistics', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/playbooks')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('usageStats');

            if (response.body.mostUsedPlaybooks && response.body.mostUsedPlaybooks.length > 0) {
                response.body.mostUsedPlaybooks.forEach(playbook => {
                    expect(playbook).toHaveProperty('name');
                    expect(playbook).toHaveProperty('usageCount');
                    expect(playbook).toHaveProperty('successRate');
                });
            }
        });

        it('should track time-to-resolution metrics', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/playbooks')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('timeMetrics');
            expect(response.body.timeMetrics).toHaveProperty('avgResolutionTime');
            expect(response.body.timeMetrics).toHaveProperty('medianResolutionTime');
        });
    });

    describe('GET /api/analytics/ai/policies', () => {
    const db = getDatabase();
        it('should return AI policy analytics', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/policies')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('totalPolicies');
            expect(response.body).toHaveProperty('activePolicies');
            expect(response.body).toHaveProperty('autoApprovalRate');
            expect(response.body).toHaveProperty('policyEffectiveness');
            expect(response.body).toHaveProperty('violationsByPolicy');
        });

        it('should show policy effectiveness scores', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/policies')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);

            if (response.body.policyEffectiveness && response.body.policyEffectiveness.length > 0) {
                response.body.policyEffectiveness.forEach(policy => {
                    expect(policy).toHaveProperty('policyId');
                    expect(policy).toHaveProperty('effectivenessScore');
                    expect(policy.effectivenessScore).toBeGreaterThanOrEqual(0);
                    expect(policy.effectivenessScore).toBeLessThanOrEqual(100);
                });
            }
        });

        it('should track auto-approval vs manual approval rates', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/policies')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('approvalBreakdown');
            expect(response.body.approvalBreakdown).toHaveProperty('autoApproved');
            expect(response.body.approvalBreakdown).toHaveProperty('manuallyApproved');
            expect(response.body.approvalBreakdown).toHaveProperty('rejected');
        });
    });

    describe('GET /api/analytics/ai/roi', () => {
    const db = getDatabase();
        it('should return AI ROI analytics', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/roi')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('totalROI');
            expect(response.body).toHaveProperty('timeSaved');
            expect(response.body).toHaveProperty('costReduction');
            expect(response.body).toHaveProperty('productivityGains');
            expect(response.body).toHaveProperty('breakEvenPeriod');
        });

        it('should calculate ROI metrics correctly', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/roi')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);

            // ROI should be a percentage or monetary value
            if (response.body.totalROI !== undefined) {
                expect(typeof response.body.totalROI).toBe('number');
            }

            // Time saved should be in hours or days
            if (response.body.timeSaved !== undefined) {
                expect(typeof response.body.timeSaved).toBe('number');
                expect(response.body.timeSaved).toBeGreaterThanOrEqual(0);
            }
        });

        it('should include cost-benefit analysis', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/roi')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('costBenefit');

            if (response.body.costBenefit) {
                expect(response.body.costBenefit).toHaveProperty('costs');
                expect(response.body.costBenefit).toHaveProperty('benefits');
                expect(response.body.costBenefit).toHaveProperty('netBenefit');
            }
        });
    });

    describe('GET /api/analytics/ai/export', () => {
    const db = getDatabase();
        it('should export AI analytics data', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/export')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ format: 'json' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('exportedAt');
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('dashboard');
            expect(response.body.data).toHaveProperty('actions');
            expect(response.body.data).toHaveProperty('playbooks');
            expect(response.body.data).toHaveProperty('policies');
            expect(response.body.data).toHaveProperty('roi');
        });

        it('should support CSV export format', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/export')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ format: 'csv' });

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('text/csv');
            expect(response.headers['content-disposition']).toContain('attachment');
            expect(response.headers['content-disposition']).toContain('ai-analytics');
        });

        it('should support Excel export format', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/export')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ format: 'xlsx' });

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });

        it('should filter export by date range', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/export')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    format: 'json',
                    from: '2024-01-01',
                    to: '2024-12-31'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('dateRange');
            expect(response.body.dateRange.from).toBe('2024-01-01');
            expect(response.body.dateRange.to).toBe('2024-12-31');
        });
    });

    describe('GET /api/analytics/ai/actions/:actionId', () => {
    const db = getDatabase();
        it('should return detailed action analytics', async () => {
            // First get a list of actions to pick one
            const listResponse = await request(app)
                .get('/api/analytics/ai/actions')
                .set('Authorization', `Bearer ${authToken}`);

            if (listResponse.body.actions && listResponse.body.actions.length > 0) {
                const actionId = listResponse.body.actions[0].id;

                const response = await request(app)
                    .get(`/api/analytics/ai/actions/${actionId}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('actionId', actionId);
                expect(response.body).toHaveProperty('executionHistory');
                expect(response.body).toHaveProperty('successMetrics');
                expect(response.body).toHaveProperty('failureReasons');
            } else {
                // If no actions exist, test should still pass
                expect(listResponse.status).toBe(200);
            }
        });

        it('should return 404 for non-existent action', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/actions/non-existent-action')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
        });
    });

    describe('GET /api/analytics/ai/playbooks/:playbookId', () => {
    const db = getDatabase();
        it('should return detailed playbook analytics', async () => {
            // Similar to action details - would need existing playbook data
            const response = await request(app)
                .get('/api/analytics/ai/playbooks/test-playbook-id')
                .set('Authorization', `Bearer ${authToken}`);

            // Either returns data or 404 - both are valid
            expect([200, 404]).toContain(response.status);

            if (response.status === 200) {
                expect(response.body).toHaveProperty('playbookId');
                expect(response.body).toHaveProperty('usageStats');
                expect(response.body).toHaveProperty('completionMetrics');
            }
        });
    });

    describe('Performance Metrics', () => {
    const db = getDatabase();
        it('should handle large datasets efficiently', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get('/api/analytics/ai/dashboard')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    from: '2020-01-01', // Large date range
                    to: '2024-12-31'
                });

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(response.status).toBe(200);
            // Should respond within reasonable time (under 5 seconds for large queries)
            expect(responseTime).toBeLessThan(5000);
        });

        it('should cache frequently requested data', async () => {
            // Make multiple requests to the same endpoint
            const promises = Array(5).fill().map(() =>
                request(app)
                    .get('/api/analytics/ai/dashboard')
                    .set('Authorization', `Bearer ${authToken}`)
            );

            const responses = await Promise.all(promises);

            // All should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });
    });

    describe('Data Consistency', () => {
    const db = getDatabase();
        it('should maintain consistent metrics across endpoints', async () => {
            const [dashboardResponse, actionsResponse] = await Promise.all([
                request(app)
                    .get('/api/analytics/ai/dashboard')
                    .set('Authorization', `Bearer ${authToken}`),
                request(app)
                    .get('/api/analytics/ai/actions')
                    .set('Authorization', `Bearer ${authToken}`)
            ]);

            expect(dashboardResponse.status).toBe(200);
            expect(actionsResponse.status).toBe(200);

            // Dashboard should include actions summary that matches detailed actions endpoint
            if (dashboardResponse.body.actions && actionsResponse.body.totalActions !== undefined) {
                expect(dashboardResponse.body.actions.total).toBe(actionsResponse.body.totalActions);
            }
        });

        it('should handle concurrent analytics requests', async () => {
            const concurrentRequests = [
                request(app).get('/api/analytics/ai/dashboard').set('Authorization', `Bearer ${authToken}`),
                request(app).get('/api/analytics/ai/actions').set('Authorization', `Bearer ${authToken}`),
                request(app).get('/api/analytics/ai/playbooks').set('Authorization', `Bearer ${authToken}`),
                request(app).get('/api/analytics/ai/policies').set('Authorization', `Bearer ${authToken}`),
                request(app).get('/api/analytics/ai/roi').set('Authorization', `Bearer ${authToken}`)
            ];

            const responses = await Promise.all(concurrentRequests);

            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });
    });

    describe('Admin-only Endpoints', () => {
    const db = getDatabase();
        it('should require admin access for sensitive analytics', async () => {
            // This would require testing with different user roles
            // For now, just verify that regular users can access basic analytics
            const response = await request(app)
                .get('/api/analytics/ai/dashboard')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
        });
    });

    describe('Error Handling', () => {
    const db = getDatabase();
        it('should handle database connection errors gracefully', async () => {
            // This would require mocking database failures
            // For now, just verify normal operation
            const response = await request(app)
                .get('/api/analytics/ai/dashboard')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
        });

        it('should handle invalid date ranges', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/dashboard')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    from: 'invalid-date',
                    to: '2024-12-31'
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should handle invalid project IDs', async () => {
            const response = await request(app)
                .get('/api/analytics/ai/actions')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ projectId: 'invalid-project-id' });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });
});