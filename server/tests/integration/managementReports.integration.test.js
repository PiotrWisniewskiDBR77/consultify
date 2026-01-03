/**
 * Integration Tests for Management Reports API
 * 
 * Tests the complete API endpoints for management reports
 * including generation, approval workflows, versioning, and export.
 */

const request = require('supertest');
const app = require('../../app');
const db = require('../../database');
const { v4: uuidv4 } = require('uuid');

// Test data
const testOrganization = {
    id: uuidv4(),
    name: 'Test Organization'
};

const testUser = {
    id: uuidv4(),
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    organization_id: testOrganization.id,
    role: 'ADMIN'
};

const testProject = {
    id: uuidv4(),
    name: 'Test Project',
    organization_id: testOrganization.id,
    status: 'ACTIVE'
};

let authToken;

// Helper to create auth token
const generateAuthToken = (user) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { id: user.id, email: user.email, organization_id: user.organization_id, role: user.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
    );
};

beforeAll(async () => {
    // Setup test data
    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(
                `INSERT OR REPLACE INTO organizations (id, name) VALUES (?, ?)`,
                [testOrganization.id, testOrganization.name]
            );
            db.run(
                `INSERT OR REPLACE INTO users (id, email, first_name, last_name, organization_id, role) VALUES (?, ?, ?, ?, ?, ?)`,
                [testUser.id, testUser.email, testUser.first_name, testUser.last_name, testUser.organization_id, testUser.role]
            );
            db.run(
                `INSERT OR REPLACE INTO projects (id, name, organization_id, status) VALUES (?, ?, ?, ?)`,
                [testProject.id, testProject.name, testProject.organization_id, testProject.status],
                (err) => err ? reject(err) : resolve()
            );
        });
    });

    authToken = generateAuthToken(testUser);
});

afterAll(async () => {
    // Cleanup test data
    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`DELETE FROM management_report_comments WHERE report_id IN (SELECT id FROM management_reports WHERE organization_id = ?)`, [testOrganization.id]);
            db.run(`DELETE FROM management_report_audit_log WHERE report_id IN (SELECT id FROM management_reports WHERE organization_id = ?)`, [testOrganization.id]);
            db.run(`DELETE FROM management_report_versions WHERE report_id IN (SELECT id FROM management_reports WHERE organization_id = ?)`, [testOrganization.id]);
            db.run(`DELETE FROM management_report_approvals WHERE report_id IN (SELECT id FROM management_reports WHERE organization_id = ?)`, [testOrganization.id]);
            db.run(`DELETE FROM management_reports WHERE organization_id = ?`, [testOrganization.id]);
            db.run(`DELETE FROM projects WHERE id = ?`, [testProject.id]);
            db.run(`DELETE FROM users WHERE id = ?`, [testUser.id]);
            db.run(`DELETE FROM organizations WHERE id = ?`, [testOrganization.id], (err) => err ? reject(err) : resolve());
        });
    });
});

describe('Management Reports API', () => {
    let createdReportId;

    describe('POST /api/management-reports/generate', () => {
        it('should generate a team meeting report for a project', async () => {
            const response = await request(app)
                .post('/api/management-reports/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reportType: 'TEAM_MEETING',
                    scope: 'PROJECT',
                    projectId: testProject.id,
                    organizationId: testOrganization.id,
                    periodDays: 7,
                    aiEnhancement: false
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.report).toBeDefined();
            expect(response.body.report.reportType).toBe('TEAM_MEETING');
            expect(response.body.report.scope).toBe('PROJECT');
            expect(response.body.report.status).toBe('DRAFT');

            createdReportId = response.body.report.id;
        });

        it('should generate a steering committee report for portfolio', async () => {
            const response = await request(app)
                .post('/api/management-reports/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reportType: 'STEERING_COMMITTEE',
                    scope: 'PORTFOLIO',
                    organizationId: testOrganization.id,
                    periodDays: 30,
                    aiEnhancement: false
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.report.reportType).toBe('STEERING_COMMITTEE');
            expect(response.body.report.scope).toBe('PORTFOLIO');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/management-reports/generate')
                .send({
                    reportType: 'TEAM_MEETING',
                    scope: 'PORTFOLIO',
                    organizationId: testOrganization.id
                });

            expect(response.status).toBe(401);
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/management-reports/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reportType: 'INVALID_TYPE'
                });

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/management-reports/:id', () => {
        it('should retrieve a report by ID', async () => {
            const response = await request(app)
                .get(`/api/management-reports/${createdReportId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.report.id).toBe(createdReportId);
        });

        it('should return 404 for non-existent report', async () => {
            const response = await request(app)
                .get('/api/management-reports/non-existent-id')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
        });
    });

    describe('GET /api/management-reports/history', () => {
        it('should return paginated report history', async () => {
            const response = await request(app)
                .get('/api/management-reports/history')
                .query({ organizationId: testOrganization.id, limit: 10, offset: 0 })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.reports)).toBe(true);
            expect(response.body.total).toBeDefined();
        });

        it('should filter by report type', async () => {
            const response = await request(app)
                .get('/api/management-reports/history')
                .query({ 
                    organizationId: testOrganization.id,
                    reportType: 'TEAM_MEETING'
                })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            response.body.reports.forEach(report => {
                expect(report.reportType).toBe('TEAM_MEETING');
            });
        });
    });

    describe('Approval Workflow', () => {
        let approvalReportId;

        beforeAll(async () => {
            // Create a report with approval required
            const response = await request(app)
                .post('/api/management-reports/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reportType: 'STEERING_COMMITTEE',
                    scope: 'PORTFOLIO',
                    organizationId: testOrganization.id,
                    periodDays: 30,
                    requiresApproval: true,
                    approvalConfig: {
                        levels: [
                            { level: 1, role: 'MANAGER', required: true }
                        ]
                    }
                });

            approvalReportId = response.body.report.id;
        });

        it('should submit report for approval', async () => {
            const response = await request(app)
                .post(`/api/management-reports/${approvalReportId}/submit`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should get approval status', async () => {
            const response = await request(app)
                .get(`/api/management-reports/${approvalReportId}/approval-status`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.status).toBeDefined();
        });

        it('should approve report', async () => {
            const response = await request(app)
                .post(`/api/management-reports/${approvalReportId}/approve`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ comment: 'Looks good!' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should get pending approvals for user', async () => {
            const response = await request(app)
                .get('/api/management-reports/pending-approvals')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.pending)).toBe(true);
        });
    });

    describe('Version Management', () => {
        it('should get report versions', async () => {
            const response = await request(app)
                .get(`/api/management-reports/${createdReportId}/versions`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.versions)).toBe(true);
        });

        it('should get specific version', async () => {
            const response = await request(app)
                .get(`/api/management-reports/${createdReportId}/versions/1`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.version).toBeDefined();
        });

        it('should compare versions', async () => {
            // First generate another version by updating the report
            await request(app)
                .patch(`/api/management-reports/${createdReportId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Updated Title' });

            const response = await request(app)
                .get(`/api/management-reports/${createdReportId}/versions/compare`)
                .query({ v1: 1, v2: 2 })
                .set('Authorization', `Bearer ${authToken}`);

            // May return 200 or 400 depending on if v2 exists
            expect([200, 400, 404]).toContain(response.status);
        });
    });

    describe('Comments', () => {
        let commentId;

        it('should add a comment to report', async () => {
            const response = await request(app)
                .post(`/api/management-reports/${createdReportId}/comments`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    sectionId: 'executiveSummary',
                    content: 'This section needs more detail.'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.comment).toBeDefined();
            expect(response.body.comment.content).toBe('This section needs more detail.');

            commentId = response.body.comment.id;
        });

        it('should get comments for report', async () => {
            const response = await request(app)
                .get(`/api/management-reports/${createdReportId}/comments`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.comments)).toBe(true);
            expect(response.body.comments.length).toBeGreaterThan(0);
        });

        it('should update a comment', async () => {
            const response = await request(app)
                .patch(`/api/management-reports/${createdReportId}/comments/${commentId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ content: 'Updated comment content' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.comment.content).toBe('Updated comment content');
        });

        it('should resolve a comment', async () => {
            const response = await request(app)
                .patch(`/api/management-reports/${createdReportId}/comments/${commentId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ isResolved: true });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.comment.isResolved).toBe(true);
        });

        it('should delete a comment', async () => {
            const response = await request(app)
                .delete(`/api/management-reports/${createdReportId}/comments/${commentId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('Audit Log', () => {
        it('should get audit log for report', async () => {
            const response = await request(app)
                .get(`/api/management-reports/${createdReportId}/audit-log`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.log) || response.body.log === undefined).toBe(true);
        });

        it('should filter audit log by action', async () => {
            const response = await request(app)
                .get(`/api/management-reports/${createdReportId}/audit-log`)
                .query({ action: 'CREATED' })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
        });
    });

    describe('Lock/Finalize', () => {
        let finalizeReportId;

        beforeAll(async () => {
            // Create and approve a report for finalization
            const genResponse = await request(app)
                .post('/api/management-reports/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reportType: 'TEAM_MEETING',
                    scope: 'PROJECT',
                    projectId: testProject.id,
                    organizationId: testOrganization.id,
                    periodDays: 7,
                    requiresApproval: false
                });

            finalizeReportId = genResponse.body.report.id;
        });

        it('should finalize a report', async () => {
            const response = await request(app)
                .post(`/api/management-reports/${finalizeReportId}/finalize`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.report.status).toBe('FINAL');
        });

        it('should prevent editing finalized report', async () => {
            const response = await request(app)
                .patch(`/api/management-reports/${finalizeReportId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Attempt to update' });

            expect(response.status).toBe(400);
        });

        it('should unlock report with admin privileges', async () => {
            const response = await request(app)
                .post(`/api/management-reports/${finalizeReportId}/unlock`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ reason: 'Correction needed' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.report.status).toBe('DRAFT');
        });
    });

    describe('Export', () => {
        it('should generate PDF export', async () => {
            const response = await request(app)
                .get(`/api/management-reports/${createdReportId}/pdf`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 202]).toContain(response.status);
        });

        it('should generate PPTX export', async () => {
            const response = await request(app)
                .get(`/api/management-reports/${createdReportId}/pptx`)
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 202]).toContain(response.status);
        });

        it('should create share link', async () => {
            const response = await request(app)
                .post(`/api/management-reports/${createdReportId}/share`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ expiresInDays: 7 });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.shareUrl).toBeDefined();
            expect(response.body.expiresAt).toBeDefined();
        });
    });

    describe('Analytics', () => {
        it('should get usage analytics', async () => {
            const response = await request(app)
                .get('/api/management-reports/analytics/usage')
                .query({ organizationId: testOrganization.id })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should get report types breakdown', async () => {
            const response = await request(app)
                .get('/api/management-reports/analytics/types')
                .query({ organizationId: testOrganization.id })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('Bulk Operations', () => {
        it('should export multiple reports as ZIP', async () => {
            const response = await request(app)
                .post('/api/management-reports/bulk-export')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reportIds: [createdReportId],
                    format: 'pdf'
                });

            expect([200, 202]).toContain(response.status);
        });
    });
});









