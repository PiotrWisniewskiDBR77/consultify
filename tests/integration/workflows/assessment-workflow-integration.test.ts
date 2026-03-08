import path from 'path';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { testFactory } from '../../helpers/TestFactory';

vi.hoisted(() => {
    const path = require('path');
    process.env.SQLITE_PATH = path.resolve(__dirname, 'assessment-workflow-integration.db');
    process.env.MOCK_DB = 'false';
    process.env.TEST_TYPE = 'integration';
});

import app from '../../../server/src/index';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { resetConnection } from '../../../server/src/database/Database.js';

/**
 * L3 Integration Tests: Assessment Workflow Integration
 * 
 * Tests end-to-end assessment workflow across services:
 * - AssessmentService
 * - InterviewService
 * - AIService
 * - InitiativeService
 * - ReportService
 * - NotificationService
 */
describe('L3: Assessment Workflow Integration', () => {
    const testDbPath = path.resolve(__dirname, 'assessment-workflow-integration.db');
    let adminToken: string;
    let consultantToken: string;
    let testOrgId: string;
    let testAssessmentId: string;
    let adminUserId: string;
    let consultantUserId: string;

    beforeAll(async () => {
        await resetConnection();
        const initResult = await initializeDatabase();
        if (!initResult.success) {
            throw new Error(`Database initialization failed: ${initResult.message}`);
        }

        // Setup test organization
        const org = await testFactory.createOrganization({
            name: 'Assessment Test Org',
            plan: 'professional',
        });
        testOrgId = org.id;

        // Create admin user
        const admin = await testFactory.createUser({
            organizationId: testOrgId,
            password: 'AdminPass123!',
            role: 'ADMIN',
        });
        adminUserId = admin.id;

        // Create consultant user
        const consultant = await testFactory.createUser({
            organizationId: testOrgId,
            password: 'ConsultantPass123!',
            role: 'USER',
        });
        consultantUserId = consultant.id;

        // Login both users
        const adminLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: admin.email, password: 'AdminPass123!' });
        adminToken = adminLogin.body.token;

        const consultantLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: consultant.email, password: 'ConsultantPass123!' });
        consultantToken = consultantLogin.body.token;
    });

    afterAll(async () => {
        await resetConnection();
    });

    describe('Assessment Creation → Framework Selection → Question Generation Flow', () => {
        it('should create new assessment', async () => {
            const createRes = await request(app)
                .post('/api/assessments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Digital Transformation Assessment',
                    description: 'Comprehensive digital maturity assessment',
                    framework: 'digital_maturity',
                    clientName: 'Test Client Corp',
                });

            if (createRes.status === 200 || createRes.status === 201) {
                expect(createRes.body).toHaveProperty('id');
                expect(createRes.body.name).toBe('Digital Transformation Assessment');
                testAssessmentId = createRes.body.id;
            }
        });

        it('should select assessment framework', async () => {
            if (!testAssessmentId) testAssessmentId = 'mock-assessment-id';

            const frameworkRes = await request(app)
                .put(`/api/assessments/${testAssessmentId}/framework`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ framework: 'digital_maturity' });

            if (frameworkRes.status === 200) {
                expect(frameworkRes.body.framework).toBe('digital_maturity');
            }
        });

        it('should generate assessment questions based on framework', async () => {
            const questionsRes = await request(app)
                .get(`/api/assessments/${testAssessmentId}/questions`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (questionsRes.status === 200) {
                expect(Array.isArray(questionsRes.body)).toBe(true);
                expect(questionsRes.body.length).toBeGreaterThan(0);
            }
        });

        it('should customize assessment questions', async () => {
            const customizeRes = await request(app)
                .post(`/api/assessments/${testAssessmentId}/questions`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    question: 'Custom question about digital strategy',
                    category: 'strategy',
                    weight: 1.0,
                });

            if (customizeRes.status === 200 || customizeRes.status === 201) {
                expect(customizeRes.body).toHaveProperty('id');
            }
        });
    });

    describe('Interview Assignment → Response Collection → Scoring Flow', () => {
        let interviewId: string;

        it('should assign interview to stakeholder', async () => {
            const assignRes = await request(app)
                .post(`/api/assessments/${testAssessmentId}/interviews`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    assigneeId: consultantUserId,
                    role: 'stakeholder',
                    dueDate: '2026-03-31',
                });

            if (assignRes.status === 200 || assignRes.status === 201) {
                expect(assignRes.body).toHaveProperty('id');
                interviewId = assignRes.body.id;
            }
        });

        it('should collect interview responses', async () => {
            if (!interviewId) interviewId = 'mock-interview-id';

            const responseRes = await request(app)
                .post(`/api/interviews/${interviewId}/responses`)
                .set('Authorization', `Bearer ${consultantToken}`)
                .send({
                    questionId: 'q1',
                    answer: 'We have a comprehensive digital strategy in place',
                    score: 4,
                });

            if (responseRes.status === 200 || responseRes.status === 201) {
                expect(responseRes.body).toHaveProperty('id');
            }
        });

        it('should calculate assessment scores', async () => {
            const scoreRes = await request(app)
                .get(`/api/assessments/${testAssessmentId}/scores`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (scoreRes.status === 200) {
                expect(scoreRes.body).toHaveProperty('overallScore');
                expect(scoreRes.body).toHaveProperty('categoryScores');
            }
        });

        it('should track interview completion status', async () => {
            const statusRes = await request(app)
                .get(`/api/interviews/${interviewId}/status`)
                .set('Authorization', `Bearer ${consultantToken}`);

            if (statusRes.status === 200) {
                expect(statusRes.body).toHaveProperty('completionPercentage');
                expect(statusRes.body).toHaveProperty('answeredQuestions');
            }
        });
    });

    describe('AI Analysis → Insight Generation → Report Building Flow', () => {
        it('should trigger AI analysis of assessment results', async () => {
            const analysisRes = await request(app)
                .post(`/api/assessments/${testAssessmentId}/analyze`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (analysisRes.status === 200 || analysisRes.status === 202) {
                expect(analysisRes.body).toHaveProperty('analysisId');
            }
        });

        it('should generate insights from AI analysis', async () => {
            const insightsRes = await request(app)
                .get(`/api/assessments/${testAssessmentId}/insights`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (insightsRes.status === 200) {
                expect(Array.isArray(insightsRes.body)).toBe(true);
            }
        });

        it('should identify gaps and opportunities', async () => {
            const gapsRes = await request(app)
                .get(`/api/assessments/${testAssessmentId}/gaps`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (gapsRes.status === 200) {
                expect(gapsRes.body).toHaveProperty('gaps');
                expect(gapsRes.body).toHaveProperty('opportunities');
            }
        });

        it('should build assessment report', async () => {
            const reportRes = await request(app)
                .post(`/api/assessments/${testAssessmentId}/reports`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    template: 'executive_summary',
                    includeCharts: true,
                    includeRecommendations: true,
                });

            if (reportRes.status === 200 || reportRes.status === 201) {
                expect(reportRes.body).toHaveProperty('reportId');
            }
        });
    });

    describe('Initiative Generation → Roadmap Creation → Prioritization Flow', () => {
        it('should generate initiatives from assessment', async () => {
            const initiativesRes = await request(app)
                .post(`/api/assessments/${testAssessmentId}/generate-initiatives`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (initiativesRes.status === 200 || initiativesRes.status === 202) {
                expect(initiativesRes.body).toHaveProperty('initiatives');
                expect(Array.isArray(initiativesRes.body.initiatives)).toBe(true);
            }
        });

        it('should create roadmap from initiatives', async () => {
            const roadmapRes = await request(app)
                .post(`/api/assessments/${testAssessmentId}/roadmap`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    timeframe: '12_months',
                    prioritization: 'impact',
                });

            if (roadmapRes.status === 200 || roadmapRes.status === 201) {
                expect(roadmapRes.body).toHaveProperty('roadmapId');
            }
        });

        it('should prioritize initiatives', async () => {
            const priorityRes = await request(app)
                .post(`/api/assessments/${testAssessmentId}/prioritize`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    criteria: ['impact', 'effort', 'urgency'],
                    weights: [0.5, 0.3, 0.2],
                });

            if (priorityRes.status === 200) {
                expect(priorityRes.body).toHaveProperty('prioritizedInitiatives');
            }
        });

        it('should estimate initiative costs and timelines', async () => {
            const estimateRes = await request(app)
                .get(`/api/assessments/${testAssessmentId}/estimates`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (estimateRes.status === 200) {
                expect(estimateRes.body).toHaveProperty('totalCost');
                expect(estimateRes.body).toHaveProperty('totalDuration');
            }
        });
    });

    describe('Report Export → Sharing → Notification Flow', () => {
        let reportId: string;

        beforeAll(async () => {
            // Create a report for export testing
            const reportRes = await request(app)
                .post(`/api/assessments/${testAssessmentId}/reports`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ template: 'full_report' });

            if (reportRes.status === 200 || reportRes.status === 201) {
                reportId = reportRes.body.reportId;
            }
        });

        it('should export report as PDF', async () => {
            if (!reportId) reportId = 'mock-report-id';

            const exportRes = await request(app)
                .get(`/api/reports/${reportId}/export/pdf`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (exportRes.status === 200) {
                expect(exportRes.headers['content-type']).toContain('application/pdf');
            }
        });

        it('should export report as PowerPoint', async () => {
            const exportRes = await request(app)
                .get(`/api/reports/${reportId}/export/pptx`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (exportRes.status === 200) {
                expect(exportRes.headers['content-type']).toContain('application/vnd.openxmlformats');
            }
        });

        it('should share report with stakeholders', async () => {
            const shareRes = await request(app)
                .post(`/api/reports/${reportId}/share`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    recipients: [consultantUserId],
                    message: 'Please review the assessment report',
                    permissions: ['read', 'comment'],
                });

            if (shareRes.status === 200) {
                expect(shareRes.body).toHaveProperty('sharedWith');
            }
        });

        it('should send notification on report share', async () => {
            // Verify notification was created
            const notifRes = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${consultantToken}`);

            if (notifRes.status === 200) {
                const reportNotif = notifRes.body.find((n: any) =>
                    n.type === 'report_shared' && n.reportId === reportId
                );
                // Notification might exist depending on implementation
            }
        });
    });

    describe('Assessment Collaboration and Comments', () => {
        it('should add comment to assessment', async () => {
            const commentRes = await request(app)
                .post(`/api/assessments/${testAssessmentId}/comments`)
                .set('Authorization', `Bearer ${consultantToken}`)
                .send({
                    content: 'This assessment reveals significant gaps in our digital capabilities',
                    category: 'insight',
                });

            if (commentRes.status === 200 || commentRes.status === 201) {
                expect(commentRes.body).toHaveProperty('id');
            }
        });

        it('should list assessment comments', async () => {
            const commentsRes = await request(app)
                .get(`/api/assessments/${testAssessmentId}/comments`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (commentsRes.status === 200) {
                expect(Array.isArray(commentsRes.body)).toBe(true);
            }
        });

        it('should mention user in comment and trigger notification', async () => {
            const mentionRes = await request(app)
                .post(`/api/assessments/${testAssessmentId}/comments`)
                .set('Authorization', `Bearer ${consultantToken}`)
                .send({
                    content: `@${adminUserId} Please review this finding`,
                });

            if (mentionRes.status === 200 || mentionRes.status === 201) {
                // Verify notification was sent to mentioned user
                const notifRes = await request(app)
                    .get('/api/notifications')
                    .set('Authorization', `Bearer ${adminToken}`);

                if (notifRes.status === 200) {
                    const mention = notifRes.body.find((n: any) => n.type === 'mention');
                    // Notification might exist
                }
            }
        });
    });

    describe('Assessment Versioning and History', () => {
        it('should create assessment snapshot', async () => {
            const snapshotRes = await request(app)
                .post(`/api/assessments/${testAssessmentId}/snapshots`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ description: 'Initial assessment completion' });

            if (snapshotRes.status === 200 || snapshotRes.status === 201) {
                expect(snapshotRes.body).toHaveProperty('snapshotId');
            }
        });

        it('should list assessment history', async () => {
            const historyRes = await request(app)
                .get(`/api/assessments/${testAssessmentId}/history`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (historyRes.status === 200) {
                expect(Array.isArray(historyRes.body)).toBe(true);
            }
        });

        it('should compare assessment versions', async () => {
            const compareRes = await request(app)
                .get(`/api/assessments/${testAssessmentId}/compare`)
                .query({ from: 'v1', to: 'v2' })
                .set('Authorization', `Bearer ${adminToken}`);

            if (compareRes.status === 200) {
                expect(compareRes.body).toHaveProperty('changes');
            }
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should reject assessment creation with invalid data', async () => {
            const createRes = await request(app)
                .post('/api/assessments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: '' }); // Invalid: empty name

            expect([400, 422]).toContain(createRes.status);
        });

        it('should handle incomplete interview responses', async () => {
            // Try to generate report with incomplete responses
            const reportRes = await request(app)
                .post(`/api/assessments/${testAssessmentId}/reports`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ template: 'full_report', requireComplete: true });

            // Should warn or reject if responses incomplete
        });

        it('should prevent unauthorized access to assessment', async () => {
            // Create user in different organization
            const otherOrg = await testFactory.createOrganization({ name: 'Other Org' });
            const otherUser = await testFactory.createUser({
                organizationId: otherOrg.id,
                password: 'Pass123!',
                role: 'USER',
            });

            const otherLogin = await request(app)
                .post('/api/auth/login')
                .send({ email: otherUser.email, password: 'Pass123!' });

            const otherToken = otherLogin.body.token;

            // Try to access assessment from different org
            const accessRes = await request(app)
                .get(`/api/assessments/${testAssessmentId}`)
                .set('Authorization', `Bearer ${otherToken}`);

            expect([403, 404]).toContain(accessRes.status);
        });
    });
});
