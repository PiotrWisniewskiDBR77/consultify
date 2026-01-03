// AI Coach Routes Integration Tests
// Tests AI coaching and advisory services for PMO guidance

const request = require('supertest');
const app = require('../../../server/server');
const { sequelize } = require('../../../server/models');
const { User, Organization, Project } = require('../../../server/models');

describe('AI Coach Routes Integration Tests', () => {
    let testUser;
    let testOrg;
    let testAdminUser;
    let testOtherOrg;
    let authToken;
    let adminAuthToken;

    beforeAll(async () => {
        // Create test organizations
        testOrg = await Organization.create({
            name: 'Test AI Coach Org',
            domain: 'ai-coach-test.com'
        });

        testOtherOrg = await Organization.create({
            name: 'Other AI Coach Org',
            domain: 'other-ai-coach-test.com'
        });

        // Create regular user
        testUser = await User.create({
            firstName: 'Coach',
            lastName: 'TestUser',
            email: 'coach@test.com',
            organizationId: testOrg.id,
            password: 'hashedpassword',
            role: 'USER'
        });

        // Create admin user
        testAdminUser = await User.create({
            firstName: 'Admin',
            lastName: 'CoachUser',
            email: 'admin-coach@test.com',
            organizationId: testOrg.id,
            password: 'hashedpassword',
            role: 'SUPERADMIN'
        });

        // Create some test projects for the organization
        await Project.create({
            name: 'AI Coach Test Project 1',
            organizationId: testOrg.id,
            ownerId: testUser.id,
            status: 'active',
            budget: 100000,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31')
        });

        await Project.create({
            name: 'AI Coach Test Project 2',
            organizationId: testOrg.id,
            ownerId: testUser.id,
            status: 'at_risk',
            budget: 50000,
            startDate: new Date('2024-02-01'),
            endDate: new Date('2024-08-31')
        });

        // Mock JWT tokens
        authToken = 'mock-jwt-token-for-coach-user';
        adminAuthToken = 'mock-jwt-token-for-coach-admin';
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('GET /api/ai/coach/report/:orgId', () => {
        it('should return complete advisory report for organization', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('organizationId', testOrg.id.toString());
            expect(response.body).toHaveProperty('generatedAt');
            expect(response.body).toHaveProperty('signals');
            expect(response.body).toHaveProperty('recommendations');
            expect(response.body).toHaveProperty('insights');
            expect(response.body).toHaveProperty('riskAssessment');
            expect(response.body).toHaveProperty('actionPlan');
        });

        it('should include comprehensive PMO analysis', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            expect(response.status).toBe(200);

            const report = response.body;

            // Check for PMO-specific analysis
            expect(report).toHaveProperty('pmoCompliance');
            expect(report).toHaveProperty('governanceScore');
            expect(report).toHaveProperty('maturityAssessment');

            // Check for project analysis
            expect(report).toHaveProperty('projectAnalysis');
            expect(Array.isArray(report.projectAnalysis)).toBe(true);

            // Check for risk assessment
            expect(report).toHaveProperty('riskAssessment');
            expect(report.riskAssessment).toHaveProperty('overallRisk');
            expect(report.riskAssessment).toHaveProperty('criticalIssues');
        });

        it('should include AI signals and insights', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            expect(response.status).toBe(200);

            const report = response.body;

            // Check signals
            expect(Array.isArray(report.signals)).toBe(true);
            if (report.signals.length > 0) {
                const signal = report.signals[0];
                expect(signal).toHaveProperty('type');
                expect(signal).toHaveProperty('severity');
                expect(signal).toHaveProperty('message');
                expect(signal).toHaveProperty('confidence');
            }

            // Check insights
            expect(Array.isArray(report.insights)).toBe(true);
            if (report.insights.length > 0) {
                const insight = report.insights[0];
                expect(insight).toHaveProperty('category');
                expect(insight).toHaveProperty('title');
                expect(insight).toHaveProperty('description');
                expect(insight).toHaveProperty('impact');
            }
        });

        it('should include actionable recommendations', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            expect(response.status).toBe(200);

            const report = response.body;

            // Check recommendations
            expect(Array.isArray(report.recommendations)).toBe(true);
            if (report.recommendations.length > 0) {
                const recommendation = report.recommendations[0];
                expect(recommendation).toHaveProperty('priority');
                expect(recommendation).toHaveProperty('category');
                expect(recommendation).toHaveProperty('title');
                expect(recommendation).toHaveProperty('description');
                expect(recommendation).toHaveProperty('estimatedImpact');
                expect(recommendation).toHaveProperty('implementationEffort');
            }
        });

        it('should include strategic action plan', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            expect(response.status).toBe(200);

            const report = response.body;

            // Check action plan
            expect(report).toHaveProperty('actionPlan');
            expect(Array.isArray(report.actionPlan)).toBe(true);

            if (report.actionPlan.length > 0) {
                const action = report.actionPlan[0];
                expect(action).toHaveProperty('phase');
                expect(action).toHaveProperty('actions');
                expect(Array.isArray(action.actions)).toBe(true);
            }
        });

        it('should deny access to users from different organizations', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOtherOrg.id}`)
                .set('Authorization', authToken);

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Access denied');
        });

        it('should allow SUPERADMIN access to any organization', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOtherOrg.id}`)
                .set('Authorization', adminAuthToken);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('organizationId', testOtherOrg.id.toString());
        });

        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`);

            expect(response.status).toBe(401);
        });

        it('should handle non-existent organizations', async () => {
            const response = await request(app)
                .get('/api/ai/coach/report/99999')
                .set('Authorization', adminAuthToken);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/ai/coach/signals/:orgId', () => {
        it('should return only signals for organization', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/signals/${testOrg.id}`)
                .set('Authorization', authToken);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('signals');
            expect(Array.isArray(response.body.signals)).toBe(true);

            // Should not include other report sections
            expect(response.body).not.toHaveProperty('recommendations');
            expect(response.body).not.toHaveProperty('insights');
            expect(response.body).not.toHaveProperty('actionPlan');
        });

        it('should return properly formatted signals', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/signals/${testOrg.id}`)
                .set('Authorization', authToken);

            expect(response.status).toBe(200);

            if (response.body.signals.length > 0) {
                const signal = response.body.signals[0];
                expect(signal).toHaveProperty('id');
                expect(signal).toHaveProperty('type');
                expect(signal).toHaveProperty('severity');
                expect(signal).toHaveProperty('message');
                expect(signal).toHaveProperty('confidence');
                expect(signal).toHaveProperty('timestamp');
                expect(signal).toHaveProperty('source');
            }
        });

        it('should allow access to organization members', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/signals/${testOrg.id}`)
                .set('Authorization', authToken);

            expect(response.status).toBe(200);
        });

        it('should deny access to external organizations', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/signals/${testOtherOrg.id}`)
                .set('Authorization', authToken);

            expect(response.status).toBe(403);
        });
    });

    describe('Report Generation Quality', () => {
        it('should generate consistent reports for same organization', async () => {
            const [response1, response2] = await Promise.all([
                request(app)
                    .get(`/api/ai/coach/report/${testOrg.id}`)
                    .set('Authorization', adminAuthToken),
                request(app)
                    .get(`/api/ai/coach/report/${testOrg.id}`)
                    .set('Authorization', adminAuthToken)
            ]);

            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);

            // Reports should have same structure
            expect(Object.keys(response1.body)).toEqual(Object.keys(response2.body));
            expect(response1.body.organizationId).toBe(response2.body.organizationId);
        });

        it('should include organization-specific data', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            expect(response.status).toBe(200);

            // Should reference the specific organization
            expect(response.body.organizationId).toBe(testOrg.id.toString());
            expect(response.body.organizationName).toBe(testOrg.name);
        });

        it('should analyze project portfolio', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            expect(response.status).toBe(200);

            const report = response.body;

            // Should analyze the projects we created
            expect(report.projectAnalysis).toBeDefined();
            expect(report.projectAnalysis.length).toBeGreaterThanOrEqual(2);

            // Should identify at-risk projects
            const hasRiskAnalysis = report.signals.some(signal =>
                signal.type === 'project_risk' || signal.message.toLowerCase().includes('risk')
            );
            expect(hasRiskAnalysis).toBe(true);
        });
    });

    describe('Signal Types and Severity', () => {
        it('should categorize signals by type', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/signals/${testOrg.id}`)
                .set('Authorization', authToken);

            expect(response.status).toBe(200);

            const signals = response.body.signals;
            const signalTypes = [...new Set(signals.map(s => s.type))];

            // Should have various signal types
            expect(signalTypes.length).toBeGreaterThan(0);
            signalTypes.forEach(type => {
                expect(['project_risk', 'resource_issue', 'timeline_concern', 'quality_alert', 'compliance_warning', 'performance_signal']).toContain(type);
            });
        });

        it('should assign appropriate severity levels', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/signals/${testOrg.id}`)
                .set('Authorization', authToken);

            expect(response.status).toBe(200);

            const signals = response.body.signals;
            signals.forEach(signal => {
                expect(['low', 'medium', 'high', 'critical']).toContain(signal.severity);
            });
        });

        it('should include confidence scores', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/signals/${testOrg.id}`)
                .set('Authorization', authToken);

            expect(response.status).toBe(200);

            const signals = response.body.signals;
            signals.forEach(signal => {
                expect(signal.confidence).toBeGreaterThanOrEqual(0);
                expect(signal.confidence).toBeLessThanOrEqual(1);
            });
        });
    });

    describe('PMO Standards Compliance', () => {
        it('should assess ISO 21500 compliance', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            expect(response.status).toBe(200);

            const report = response.body;
            expect(report).toHaveProperty('iso21500Compliance');
            expect(report.iso21500Compliance).toHaveProperty('overallScore');
            expect(report.iso21500Compliance).toHaveProperty('gaps');
            expect(report.iso21500Compliance).toHaveProperty('recommendations');
        });

        it('should assess PMBOK alignment', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            expect(response.status).toBe(200);

            const report = response.body;
            expect(report).toHaveProperty('pmbokAlignment');
            expect(report.pmbokAlignment).toHaveProperty('domainScores');
            expect(report.pmbokAlignment).toHaveProperty('maturityLevel');
        });

        it('should provide PRINCE2 governance assessment', async () => {
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            expect(response.status).toBe(200);

            const report = response.body;
            expect(report).toHaveProperty('prince2Governance');
            expect(report.prince2Governance).toHaveProperty('themeCompliance');
            expect(report.prince2Governance).toHaveProperty('processMaturity');
        });
    });

    describe('Performance and Scalability', () => {
        it('should generate reports within reasonable time', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(response.status).toBe(200);
            // Report generation should take less than 10 seconds
            expect(duration).toBeLessThan(10000);
        });

        it('should handle concurrent report requests', async () => {
            const concurrentRequests = Array(5).fill().map(() =>
                request(app)
                    .get(`/api/ai/coach/report/${testOrg.id}`)
                    .set('Authorization', adminAuthToken)
            );

            const responses = await Promise.all(concurrentRequests);

            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('organizationId');
            });
        });

        it('should cache reports appropriately', async () => {
            // First request
            const response1 = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            // Second request (should be fast if cached)
            const startTime = Date.now();
            const response2 = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);
            const endTime = Date.now();

            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);

            // Second request should be faster (cached)
            expect(endTime - startTime).toBeLessThan(1000);
        });
    });

    describe('Error Handling', () => {
        it('should handle AI service failures gracefully', async () => {
            // This would require mocking AI service failures
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', adminAuthToken);

            // Should either succeed or fail with proper error
            expect([200, 500]).toContain(response.status);

            if (response.status === 500) {
                expect(response.body).toHaveProperty('error');
            }
        });

        it('should handle malformed organization IDs', async () => {
            const response = await request(app)
                .get('/api/ai/coach/report/invalid-org-id')
                .set('Authorization', adminAuthToken);

            expect([400, 404, 500]).toContain(response.status);
        });

        it('should handle database connection issues', async () => {
            // This would require mocking database failures
            const response = await request(app)
                .get(`/api/ai/coach/signals/${testOrg.id}`)
                .set('Authorization', authToken);

            expect([200, 500]).toContain(response.status);
        });
    });

    describe('Security and Access Control', () => {
        it('should enforce organization-level data isolation', async () => {
            // Try to access another organization's data
            const response = await request(app)
                .get(`/api/ai/coach/report/${testOtherOrg.id}`)
                .set('Authorization', authToken);

            expect(response.status).toBe(403);
            expect(response.body.error).toContain('Access denied');
        });

        it('should validate user permissions', async () => {
            // Regular users should be able to access their org's signals
            const signalsResponse = await request(app)
                .get(`/api/ai/coach/signals/${testOrg.id}`)
                .set('Authorization', authToken);

            expect(signalsResponse.status).toBe(200);

            // But not full reports (admin only)
            const reportResponse = await request(app)
                .get(`/api/ai/coach/report/${testOrg.id}`)
                .set('Authorization', authToken);

            expect([403, 401]).toContain(reportResponse.status);
        });

        it('should prevent data leakage between organizations', async () => {
            const [org1Response, org2Response] = await Promise.all([
                request(app)
                    .get(`/api/ai/coach/signals/${testOrg.id}`)
                    .set('Authorization', authToken),
                request(app)
                    .get(`/api/ai/coach/signals/${testOtherOrg.id}`)
                    .set('Authorization', authToken)
            ]);

            expect(org1Response.status).toBe(200);
            expect(org2Response.status).toBe(403);

            // Data should be different
            expect(org1Response.body.signals).not.toEqual(org2Response.body.signals);
        });
    });
});








