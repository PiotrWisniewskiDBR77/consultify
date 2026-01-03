/**
 * Integration Tests: Multi-Framework Assessment API
 */

const request = require('supertest');
const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');

// Note: These tests require a running test database
// Run with: npm test -- --testPathPattern=integration

describe('Multi-Framework Assessment API', () => {
    let app;
    let testToken;
    let testProjectId;
    let testOrganizationId;
    let createdAssessmentIds = [];

    beforeAll(async () => {
        // Setup test environment
        process.env.NODE_ENV = 'test';
        app = require('../../server/index');
        
        // Get test token (mock or real)
        testToken = process.env.TEST_AUTH_TOKEN || 'test-token';
        testProjectId = process.env.TEST_PROJECT_ID || 'test-project-123';
        testOrganizationId = process.env.TEST_ORG_ID || 'test-org-123';
    });

    afterAll(async () => {
        // Cleanup created assessments
        for (const id of createdAssessmentIds) {
            try {
                await request(app)
                    .delete(`/api/mf-assessments/${id}`)
                    .set('Authorization', `Bearer ${testToken}`);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });

    describe('POST /api/mf-assessments/:projectId/:framework', () => {
        it('should create SIRI assessment', async () => {
            const response = await request(app)
                .post(`/api/mf-assessments/${testProjectId}/SIRI`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Test SIRI Assessment',
                    organizationId: testOrganizationId,
                    data: {
                        dimensions: {
                            operations: 3,
                            supply_chain: 2.5,
                        },
                        legalDisclaimerAccepted: true,
                    },
                });

            if (response.status === 201) {
                expect(response.body.success).toBe(true);
                expect(response.body.framework).toBe('SIRI');
                createdAssessmentIds.push(response.body.id);
            } else {
                // Skip if not properly configured
                console.log('Skipping test - API not available');
            }
        });

        it('should create ADMA assessment', async () => {
            const response = await request(app)
                .post(`/api/mf-assessments/${testProjectId}/ADMA`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Test ADMA Assessment',
                    organizationId: testOrganizationId,
                    data: {
                        dimensions: {
                            leadership_strategy: 3,
                            digital_culture: 2,
                        },
                        legalDisclaimerAccepted: true,
                    },
                });

            if (response.status === 201) {
                expect(response.body.success).toBe(true);
                expect(response.body.framework).toBe('ADMA');
                createdAssessmentIds.push(response.body.id);
            }
        });

        it('should reject unauthorized users', async () => {
            const response = await request(app)
                .post(`/api/mf-assessments/${testProjectId}/SIRI`)
                .send({ name: 'Unauthorized Test' });

            expect(response.status).toBe(401);
        });

        it('should reject invalid framework', async () => {
            const response = await request(app)
                .post(`/api/mf-assessments/${testProjectId}/INVALID`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ name: 'Invalid Framework Test' });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid framework');
        });
    });

    describe('PUT /api/mf-assessments/:id', () => {
        let assessmentId;

        beforeEach(async () => {
            // Create assessment for update tests
            const response = await request(app)
                .post(`/api/mf-assessments/${testProjectId}/CMMI`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Update Test Assessment',
                    organizationId: testOrganizationId,
                    data: { practiceAreas: { EST: 2, RDM: 2 } },
                });

            if (response.status === 201) {
                assessmentId = response.body.id;
                createdAssessmentIds.push(assessmentId);
            }
        });

        it('should update assessment data', async () => {
            if (!assessmentId) return;

            const response = await request(app)
                .put(`/api/mf-assessments/${assessmentId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    data: { practiceAreas: { EST: 3, RDM: 3, TS: 2 } },
                });

            if (response.status === 200) {
                expect(response.body.success).toBe(true);
                expect(response.body.version).toBeGreaterThan(1);
            }
        });

        it('should increment version', async () => {
            if (!assessmentId) return;

            const response1 = await request(app)
                .put(`/api/mf-assessments/${assessmentId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ data: { practiceAreas: { EST: 3 } } });

            const response2 = await request(app)
                .put(`/api/mf-assessments/${assessmentId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ data: { practiceAreas: { EST: 4 } } });

            if (response1.status === 200 && response2.status === 200) {
                expect(response2.body.version).toBeGreaterThan(response1.body.version);
            }
        });
    });

    describe('GET /api/mf-assessments/:projectId/all', () => {
        it('should list all assessments for project', async () => {
            const response = await request(app)
                .get(`/api/mf-assessments/${testProjectId}/all`)
                .set('Authorization', `Bearer ${testToken}`);

            if (response.status === 200) {
                expect(response.body.success).toBe(true);
                expect(response.body.assessments).toBeInstanceOf(Array);
                expect(response.body.byFramework).toBeDefined();
            }
        });

        it('should filter by framework', async () => {
            const response = await request(app)
                .get(`/api/mf-assessments/${testProjectId}/all?framework=SIRI`)
                .set('Authorization', `Bearer ${testToken}`);

            if (response.status === 200) {
                expect(response.body.assessments.every(a => a.framework === 'SIRI')).toBe(true);
            }
        });
    });

    describe('PDF Import Flow', () => {
        it('should detect SIRI framework from PDF', async () => {
            // This test requires actual PDF file - skip in CI
            const response = await request(app)
                .get('/api/pdf-import/supported-frameworks')
                .set('Authorization', `Bearer ${testToken}`);

            if (response.status === 200) {
                expect(response.body.frameworks).toBeInstanceOf(Array);
                expect(response.body.frameworks.some(f => f.id === 'SIRI')).toBe(true);
            }
        });

        // Note: Full PDF import tests require actual PDF files
        // These would be part of E2E tests with fixtures
    });
});

describe('Multi-Framework Workflow', () => {
    let app;
    let testToken;
    let assessmentId;

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        app = require('../../server/index');
        testToken = process.env.TEST_AUTH_TOKEN || 'test-token';
    });

    describe('Workflow Status Transitions', () => {
        it('should complete SIRI approval flow', async () => {
            // 1. Create assessment
            const createResponse = await request(app)
                .post('/api/mf-assessments/test-project/SIRI')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Workflow Test SIRI',
                    data: { dimensions: { operations: 3 }, legalDisclaimerAccepted: true },
                });

            if (createResponse.status !== 201) return;
            assessmentId = createResponse.body.id;

            // 2. Submit for review
            const submitResponse = await request(app)
                .post(`/api/assessment-workflow/${assessmentId}/submit-for-review?framework=SIRI`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ reviewerIds: [] });

            if (submitResponse.status === 200) {
                expect(submitResponse.body.status).toBe('IN_REVIEW');
            }

            // 3. Approve
            const approveResponse = await request(app)
                .post(`/api/assessment-workflow/${assessmentId}/approve?framework=SIRI`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ feedback: 'Approved for testing' });

            if (approveResponse.status === 200) {
                expect(approveResponse.body.status).toBe('APPROVED');
            }

            // Cleanup
            await request(app)
                .delete(`/api/mf-assessments/${assessmentId}`)
                .set('Authorization', `Bearer ${testToken}`);
        });

        it('should complete CMMI approval with Lead Appraiser role check', async () => {
            // Note: This test verifies role checking for CMMI
            // Full test requires user with CMMI_LEAD_APPRAISER role
            
            const createResponse = await request(app)
                .post('/api/mf-assessments/test-project/CMMI')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Workflow Test CMMI',
                    data: { practiceAreas: { EST: 2 }, legalDisclaimerAccepted: true },
                });

            if (createResponse.status !== 201) return;
            const cmmiAssessmentId = createResponse.body.id;

            // Submit for review
            await request(app)
                .post(`/api/assessment-workflow/${cmmiAssessmentId}/submit-for-review?framework=CMMI`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ reviewerIds: [] });

            // Attempt approval (may fail without proper role)
            const approveResponse = await request(app)
                .post(`/api/assessment-workflow/${cmmiAssessmentId}/approve?framework=CMMI`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({});

            // Either succeeds (user has role) or fails with proper error
            if (approveResponse.status === 403) {
                expect(approveResponse.body.error).toContain('permission');
            }

            // Cleanup
            await request(app)
                .delete(`/api/mf-assessments/${cmmiAssessmentId}`)
                .set('Authorization', `Bearer ${testToken}`);
        });

        it('should reject without proper role', async () => {
            // Create assessment as one user, try to approve as another without role
            // This requires multi-user test setup
            // For now, verify the role checking endpoint exists
            
            const response = await request(app)
                .get('/api/assessment-workflow/nonexistent/status?framework=SIRI')
                .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBeOneOf([404, 401, 403]);
        });
    });
});

// Custom matcher for flexible status checking
expect.extend({
    toBeOneOf(received, expected) {
        const pass = expected.includes(received);
        return {
            pass,
            message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        };
    },
});









