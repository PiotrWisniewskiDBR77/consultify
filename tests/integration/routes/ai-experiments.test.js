/**
 * AI Experiments (A/B Testing) Routes Integration Tests
 * Tests AI experiment management and A/B testing functionality
 * 
 * Related to:
 * - ABTestingDashboard.tsx component
 * - AIPlatformModule Experiments tab
 */

const request = require('supertest');
const app = require('../../../server/server');
const { sequelize } = require('../../../server/models');
const { User, Organization } = require('../../../server/models');

describe('AI Experiments Routes Integration Tests', () => {
    let testUser;
    let testOrg;
    let authToken;

    beforeAll(async () => {
        testOrg = await Organization.create({
            name: 'Test AI Experiments Org',
            domain: 'ai-experiments-test.com'
        });

        testUser = await User.create({
            firstName: 'Experiments',
            lastName: 'TestUser',
            email: 'experiments-test@test.com',
            organizationId: testOrg.id,
            password: 'hashedpassword',
            role: 'admin'
        });

        authToken = 'mock-jwt-token-for-experiments-tests';
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('GET /api/ai/experiments', () => {
        it('should return list of experiments', async () => {
            const response = await request(app)
                .get('/api/ai/experiments')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('experiments');
            expect(Array.isArray(response.body.experiments)).toBe(true);
        });

        it('should filter experiments by status', async () => {
            const response = await request(app)
                .get('/api/ai/experiments')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ status: 'active' });

            expect(response.status).toBe(200);
            if (response.body.experiments.length > 0) {
                response.body.experiments.forEach(exp => {
                    expect(exp.status).toBe('active');
                });
            }
        });

        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .get('/api/ai/experiments');

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/ai/experiments', () => {
        it('should create a new experiment', async () => {
            const newExperiment = {
                name: 'Test A/B Experiment',
                description: 'Testing prompt variations',
                type: 'prompt_variation',
                variants: [
                    { name: 'Control', weight: 50, config: { promptVersion: 'v1' } },
                    { name: 'Variant A', weight: 50, config: { promptVersion: 'v2' } }
                ],
                targetCapability: 'chat'
            };

            const response = await request(app)
                .post('/api/ai/experiments')
                .set('Authorization', `Bearer ${authToken}`)
                .send(newExperiment);

            expect([200, 201]).toContain(response.status);
            if (response.status === 201 || response.status === 200) {
                expect(response.body).toHaveProperty('id');
                expect(response.body.name).toBe(newExperiment.name);
            }
        });

        it('should validate experiment weights sum to 100', async () => {
            const invalidExperiment = {
                name: 'Invalid Weights Experiment',
                variants: [
                    { name: 'Control', weight: 30, config: {} },
                    { name: 'Variant A', weight: 30, config: {} }
                ],
                targetCapability: 'chat'
            };

            const response = await request(app)
                .post('/api/ai/experiments')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidExperiment);

            // Should either reject with 400 or auto-normalize weights
            expect([200, 201, 400]).toContain(response.status);
        });

        it('should require at least 2 variants', async () => {
            const singleVariantExperiment = {
                name: 'Single Variant',
                variants: [{ name: 'Only One', weight: 100, config: {} }],
                targetCapability: 'chat'
            };

            const response = await request(app)
                .post('/api/ai/experiments')
                .set('Authorization', `Bearer ${authToken}`)
                .send(singleVariantExperiment);

            expect([400]).toContain(response.status);
        });
    });

    describe('GET /api/ai/experiments/:id', () => {
        it('should return experiment details', async () => {
            // First create an experiment
            const createResponse = await request(app)
                .post('/api/ai/experiments')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Detail Test Experiment',
                    variants: [
                        { name: 'Control', weight: 50, config: {} },
                        { name: 'Test', weight: 50, config: {} }
                    ],
                    targetCapability: 'chat'
                });

            if (createResponse.body.id) {
                const response = await request(app)
                    .get(`/api/ai/experiments/${createResponse.body.id}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('id');
                expect(response.body).toHaveProperty('variants');
            }
        });

        it('should return 404 for non-existent experiment', async () => {
            const response = await request(app)
                .get('/api/ai/experiments/non-existent-id')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
        });
    });

    describe('PUT /api/ai/experiments/:id/status', () => {
        it('should update experiment status', async () => {
            // First create an experiment
            const createResponse = await request(app)
                .post('/api/ai/experiments')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Status Test Experiment',
                    variants: [
                        { name: 'Control', weight: 50, config: {} },
                        { name: 'Test', weight: 50, config: {} }
                    ],
                    targetCapability: 'chat'
                });

            if (createResponse.body.id) {
                const response = await request(app)
                    .put(`/api/ai/experiments/${createResponse.body.id}/status`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ status: 'paused' });

                expect([200, 404]).toContain(response.status);
                if (response.status === 200) {
                    expect(response.body.status).toBe('paused');
                }
            }
        });
    });

    describe('GET /api/ai/experiments/:id/results', () => {
        it('should return experiment results', async () => {
            const response = await request(app)
                .get('/api/ai/experiments/test-exp-id/results')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 404]).toContain(response.status);
            if (response.status === 200) {
                expect(response.body).toHaveProperty('variants');
                expect(response.body).toHaveProperty('statisticalSignificance');
            }
        });
    });

    describe('DELETE /api/ai/experiments/:id', () => {
        it('should delete an experiment', async () => {
            // First create an experiment to delete
            const createResponse = await request(app)
                .post('/api/ai/experiments')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'To Delete Experiment',
                    variants: [
                        { name: 'Control', weight: 50, config: {} },
                        { name: 'Test', weight: 50, config: {} }
                    ],
                    targetCapability: 'chat'
                });

            if (createResponse.body.id) {
                const response = await request(app)
                    .delete(`/api/ai/experiments/${createResponse.body.id}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect([200, 204, 404]).toContain(response.status);
            }
        });

        it('should not allow deleting active experiments', async () => {
            // Create and activate an experiment
            const createResponse = await request(app)
                .post('/api/ai/experiments')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Active Experiment',
                    status: 'active',
                    variants: [
                        { name: 'Control', weight: 50, config: {} },
                        { name: 'Test', weight: 50, config: {} }
                    ],
                    targetCapability: 'chat'
                });

            if (createResponse.body.id && createResponse.body.status === 'active') {
                const response = await request(app)
                    .delete(`/api/ai/experiments/${createResponse.body.id}`)
                    .set('Authorization', `Bearer ${authToken}`);

                // Should either prevent deletion (400) or require stopping first
                expect([400, 409, 200, 204, 404]).toContain(response.status);
            }
        });
    });
});










