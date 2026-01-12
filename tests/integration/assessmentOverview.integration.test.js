/**
 * Integration Test for Assessment Overview API
 */

const request = require('supertest');
const app = require('../../../server/index');

describe('Assessment Overview API', () => {
    let authToken;
    let projectId = 'test-project-123';

    beforeAll(async () => {
        // Mock authentication
        authToken = 'test-token';
    });

    describe('GET /api/sessions/:projectId/assessment-overview', () => {
        test('should return consolidated assessment data', async () => {
            const response = await request(app)
                .get(`/api/sessions/${projectId}/assessment-overview`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('consolidated');
            expect(response.body.consolidated).toHaveProperty('totalAssessments');
            expect(response.body.consolidated).toHaveProperty('overallReadiness');
        });

        test('should include DRD summary if exists', async () => {
            const response = await request(app)
                .get(`/api/sessions/${projectId}/assessment-overview`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.body).toHaveProperty('drd');
            if (response.body.drd.exists) {
                expect(response.body.drd).toHaveProperty('overallScore');
                expect(response.body.drd).toHaveProperty('gap');
            }
        });

        test('should handle non-existent project gracefully', async () => {
            const response = await request(app)
                .get(`/api/sessions/non-existent-project/assessment-overview`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBeLessThan(500);
        });
    });
});
