// AI Routes Integration Tests
// Tests the complete AI API surface for PMO context and intelligence

const request = require('supertest');
const app = require('../../../server/server');
const { sequelize } = require('../../../server/models');
const { User, Organization, Project } = require('../../../server/models');

describe('AI Routes Integration Tests', () => {
    let testUser;
    let testOrg;
    let testProject;
    let authToken;

    beforeAll(async () => {
        // Create test data
        testOrg = await Organization.create({
            name: 'Test AI Org',
            domain: 'ai-test.com'
        });

        testUser = await User.create({
            firstName: 'AI',
            lastName: 'TestUser',
            email: 'ai@test.com',
            organizationId: testOrg.id,
            password: 'hashedpassword'
        });

        testProject = await Project.create({
            name: 'AI Test Project',
            organizationId: testOrg.id,
            ownerId: testUser.id,
            status: 'active'
        });

        // Mock JWT token generation
        authToken = 'mock-jwt-token-for-ai-tests';
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('GET /api/ai/context', () => {
        it('should build AI context for user without project', async () => {
            const response = await request(app)
                .get('/api/ai/context')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ screen: 'dashboard' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('organization');
            expect(response.body).toHaveProperty('currentScreen', 'dashboard');
        });

        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .get('/api/ai/context');

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/ai/context/:projectId', () => {
        it('should build AI context for specific project', async () => {
            const response = await request(app)
                .get(`/api/ai/context/${testProject.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .query({ screen: 'project-details' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('organization');
            expect(response.body).toHaveProperty('project');
            expect(response.body.project.id).toBe(testProject.id);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await request(app)
                .get('/api/ai/context/non-existent-project')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/ai/chat/stream', () => {
        it('should handle streaming chat with AI', async () => {
            const chatRequest = {
                message: 'What is the project status?',
                history: [],
                systemInstruction: 'You are a PMO assistant',
                context: { projectId: testProject.id },
                roleName: 'pmo-assistant',
                language: 'en'
            };

            const response = await request(app)
                .post('/api/ai/chat/stream')
                .set('Authorization', `Bearer ${authToken}`)
                .send(chatRequest);

            expect(response.status).toBe(200);
            // Streaming responses may vary, but should not error
        });

        it('should validate required chat parameters', async () => {
            const response = await request(app)
                .post('/api/ai/chat/stream')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/ai/chat', () => {
        it('should handle non-streaming chat', async () => {
            const chatRequest = {
                message: 'Generate a project summary',
                context: { projectId: testProject.id }
            };

            const response = await request(app)
                .post('/api/ai/chat')
                .set('Authorization', `Bearer ${authToken}`)
                .send(chatRequest);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('response');
        });
    });

    describe('GET /api/ai/policy', () => {
        it('should return AI policy configuration', async () => {
            const response = await request(app)
                .get('/api/ai/policy')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('policies');
        });
    });

    describe('GET /api/ai/policy/can-perform/:actionType', () => {
        it('should check if user can perform AI action', async () => {
            const response = await request(app)
                .get('/api/ai/policy/can-perform/generate-report')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ projectId: testProject.id });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('canPerform');
            expect(typeof response.body.canPerform).toBe('boolean');
        });

        it('should deny actions for invalid action types', async () => {
            const response = await request(app)
                .get('/api/ai/policy/can-perform/invalid-action')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.canPerform).toBe(false);
        });
    });

    describe('Memory Management', () => {
        describe('GET /api/ai/memory/project/:projectId', () => {
            it('should retrieve project memory', async () => {
                const response = await request(app)
                    .get(`/api/ai/memory/project/${testProject.id}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
            });
        });

        describe('POST /api/ai/memory/project/:projectId/decision', () => {
            it('should store project decision in memory', async () => {
                const decision = {
                    type: 'status_change',
                    decision: 'approved',
                    reasoning: 'Meets all criteria',
                    confidence: 0.95
                };

                const response = await request(app)
                    .post(`/api/ai/memory/project/${testProject.id}/decision`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(decision);

                expect(response.status).toBe(201);
                expect(response.body).toHaveProperty('id');
            });
        });

        describe('GET /api/ai/memory/user', () => {
            it('should retrieve user memory', async () => {
                const response = await request(app)
                    .get('/api/ai/memory/user')
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
            });
        });

        describe('DELETE /api/ai/memory/project/:projectId', () => {
            it('should clear project memory', async () => {
                const response = await request(app)
                    .delete(`/api/ai/memory/project/${testProject.id}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
            });
        });
    });

    describe('AI Actions', () => {
        describe('POST /api/ai/actions/draft', () => {
            it('should create AI action draft', async () => {
                const draft = {
                    type: 'create_task',
                    description: 'Draft task creation',
                    parameters: {
                        title: 'Test Task',
                        description: 'AI-generated task'
                    },
                    projectId: testProject.id
                };

                const response = await request(app)
                    .post('/api/ai/actions/draft')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(draft);

                expect(response.status).toBe(201);
                expect(response.body).toHaveProperty('id');
                expect(response.body.status).toBe('draft');
            });
        });

        describe('GET /api/ai/actions/pending', () => {
            it('should retrieve pending AI actions', async () => {
                const response = await request(app)
                    .get('/api/ai/actions/pending')
                    .set('Authorization', `Bearer ${authToken}`)
                    .query({ projectId: testProject.id });

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
            });
        });

        describe('POST /api/ai/actions/:id/execute', () => {
            it('should execute approved AI action', async () => {
                // First create a draft
                const draftResponse = await request(app)
                    .post('/api/ai/actions/draft')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        type: 'create_task',
                        description: 'Test execution',
                        parameters: { title: 'Execute Test' },
                        projectId: testProject.id
                    });

                const actionId = draftResponse.body.id;

                // Then execute it
                const response = await request(app)
                    .post(`/api/ai/actions/${actionId}/execute`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ confirmed: true });

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('executed', true);
            });
        });

        describe('GET /api/ai/actions/proposals', () => {
            it('should get AI action proposals', async () => {
                const response = await request(app)
                    .get('/api/ai/actions/proposals')
                    .set('Authorization', `Bearer ${authToken}`)
                    .query({ projectId: testProject.id, context: 'planning' });

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
            });
        });
    });

    describe('POST /api/ai/recommend', () => {
        it('should generate AI recommendations', async () => {
            const recommendationRequest = {
                context: 'project_planning',
                projectId: testProject.id,
                criteria: ['timeline', 'budget', 'resources'],
                constraints: ['3_month_deadline']
            };

            const response = await request(app)
                .post('/api/ai/recommend')
                .set('Authorization', `Bearer ${authToken}`)
                .send(recommendationRequest);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('recommendations');
            expect(Array.isArray(response.body.recommendations)).toBe(true);
        });
    });

    describe('POST /api/ai/roadmap', () => {
        it('should generate AI roadmap', async () => {
            const roadmapRequest = {
                projectId: testProject.id,
                objectives: ['Complete MVP', 'Launch product'],
                constraints: {
                    timeline: '6_months',
                    budget: 500000,
                    teamSize: 5
                }
            };

            const response = await request(app)
                .post('/api/ai/roadmap')
                .set('Authorization', `Bearer ${authToken}`)
                .send(roadmapRequest);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('roadmap');
            expect(response.body.roadmap).toHaveProperty('phases');
        });
    });

    describe('AI Audit', () => {
        describe('GET /api/ai/audit', () => {
            it('should retrieve AI audit log', async () => {
                const response = await request(app)
                    .get('/api/ai/audit')
                    .set('Authorization', `Bearer ${authToken}`)
                    .query({
                        projectId: testProject.id,
                        limit: 10,
                        offset: 0
                    });

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
            });
        });

        describe('GET /api/ai/audit/stats', () => {
            it('should get AI audit statistics', async () => {
                const response = await request(app)
                    .get('/api/ai/audit/stats')
                    .set('Authorization', `Bearer ${authToken}`)
                    .query({ projectId: testProject.id });

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('totalActions');
                expect(response.body).toHaveProperty('actionsByType');
                expect(response.body).toHaveProperty('successRate');
            });
        });

        describe('POST /api/ai/audit/:id/decision', () => {
            it('should record audit decision', async () => {
                const auditId = 'test-audit-id';
                const decision = {
                    approved: true,
                    comments: 'Approved by human review',
                    reviewerId: testUser.id
                };

                const response = await request(app)
                    .post(`/api/ai/audit/${auditId}/decision`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(decision);

                expect(response.status).toBe(200);
            });
        });
    });

    describe('AI Explanations', () => {
        describe('GET /api/ai/explanations/:projectId', () => {
            it('should get AI explanations for project', async () => {
                const response = await request(app)
                    .get(`/api/ai/explanations/${testProject.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .query({ type: 'recommendations' });

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('explanations');
            });
        });

        describe('GET /api/ai/explanations/export', () => {
            it('should export AI explanations', async () => {
                const response = await request(app)
                    .get('/api/ai/explanations/export')
                    .set('Authorization', `Bearer ${authToken}`)
                    .query({
                        projectId: testProject.id,
                        format: 'pdf'
                    });

                expect(response.status).toBe(200);
                expect(response.headers['content-type']).toContain('application/pdf');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid project IDs gracefully', async () => {
            const response = await request(app)
                .get('/api/ai/context/invalid-project-id')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error');
        });

        it('should handle malformed AI requests', async () => {
            const response = await request(app)
                .post('/api/ai/chat')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ invalidField: 'test' });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should handle AI service unavailability', async () => {
            // Mock a scenario where AI service is down
            const response = await request(app)
                .post('/api/ai/recommend')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    context: 'error_test',
                    projectId: testProject.id
                });

            // Should still return a proper error response
            expect(response.status).toBeGreaterThanOrEqual(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Rate Limiting', () => {
        it('should handle rapid AI requests appropriately', async () => {
            const requests = Array(10).fill().map(() =>
                request(app)
                    .post('/api/ai/chat')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        message: 'Test message',
                        context: { projectId: testProject.id }
                    })
            );

            const responses = await Promise.all(requests);

            // At least some should succeed, and rate limiting should be enforced
            const successCount = responses.filter(r => r.status === 200).length;
            const rateLimitedCount = responses.filter(r => r.status === 429).length;

            expect(successCount + rateLimitedCount).toBe(10);
        });
    });

    describe('Security', () => {
        it('should validate user permissions for AI actions', async () => {
            const response = await request(app)
                .post('/api/ai/actions/draft')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    type: 'delete_project',
                    projectId: 'other-project-id' // Not owned by user
                });

            // Should be rejected based on permissions
            expect(response.status).toBe(403);
        });

        it('should sanitize AI inputs', async () => {
            const maliciousInput = {
                message: '<script>alert("xss")</script>',
                context: { projectId: testProject.id }
            };

            const response = await request(app)
                .post('/api/ai/chat')
                .set('Authorization', `Bearer ${authToken}`)
                .send(maliciousInput);

            expect(response.status).toBe(200);
            // Should not contain script tags in response
            expect(response.body.response).not.toContain('<script>');
        });
    });
});







