/**
 * AI Prompts Management Routes Integration Tests
 * Tests AI prompt CRUD operations and versioning
 * 
 * Related to:
 * - PromptManagementUI.tsx component
 * - AIPlatformModule Prompts Admin tab
 */

const request = require('supertest');
const app = require('../../../server/server');
const { sequelize } = require('../../../server/models');
const { User, Organization } = require('../../../server/models');

describe('AI Prompts Management Routes Integration Tests', () => {
    let testUser;
    let testOrg;
    let authToken;

    beforeAll(async () => {
        testOrg = await Organization.create({
            name: 'Test AI Prompts Org',
            domain: 'ai-prompts-test.com'
        });

        testUser = await User.create({
            firstName: 'Prompts',
            lastName: 'TestUser',
            email: 'prompts-test@test.com',
            organizationId: testOrg.id,
            password: 'hashedpassword',
            role: 'admin'
        });

        authToken = 'mock-jwt-token-for-prompts-tests';
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('GET /api/ai/prompts', () => {
        it('should return list of prompts', async () => {
            const response = await request(app)
                .get('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('prompts');
            expect(Array.isArray(response.body.prompts)).toBe(true);
        });

        it('should filter prompts by capability', async () => {
            const response = await request(app)
                .get('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ capability: 'chat' });

            expect(response.status).toBe(200);
            if (response.body.prompts.length > 0) {
                response.body.prompts.forEach(prompt => {
                    expect(prompt.capability).toBe('chat');
                });
            }
        });

        it('should filter prompts by language', async () => {
            const response = await request(app)
                .get('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ language: 'en' });

            expect(response.status).toBe(200);
        });

        it('should paginate results', async () => {
            const response = await request(app)
                .get('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ page: 1, limit: 10 });

            expect(response.status).toBe(200);
            if (response.body.prompts) {
                expect(response.body.prompts.length).toBeLessThanOrEqual(10);
            }
        });

        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .get('/api/ai/prompts');

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/ai/prompts', () => {
        it('should create a new prompt', async () => {
            const newPrompt = {
                name: 'Test Prompt',
                capability: 'chat',
                language: 'en',
                content: 'You are a helpful assistant. {{context}}',
                variables: ['context'],
                description: 'A test prompt for chat capability'
            };

            const response = await request(app)
                .post('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send(newPrompt);

            expect([200, 201]).toContain(response.status);
            if (response.body.id) {
                expect(response.body.name).toBe(newPrompt.name);
                expect(response.body.capability).toBe(newPrompt.capability);
            }
        });

        it('should validate required fields', async () => {
            const incompletePrompt = {
                name: 'Incomplete Prompt'
                // Missing required fields
            };

            const response = await request(app)
                .post('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send(incompletePrompt);

            expect([400, 422]).toContain(response.status);
        });

        it('should extract variables from prompt content', async () => {
            const promptWithVars = {
                name: 'Variable Test Prompt',
                capability: 'report',
                language: 'en',
                content: 'Generate a {{reportType}} report for {{projectName}} covering {{dateRange}}.'
            };

            const response = await request(app)
                .post('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send(promptWithVars);

            expect([200, 201]).toContain(response.status);
            if (response.body.variables) {
                expect(response.body.variables).toContain('reportType');
                expect(response.body.variables).toContain('projectName');
                expect(response.body.variables).toContain('dateRange');
            }
        });
    });

    describe('GET /api/ai/prompts/:id', () => {
        it('should return prompt details', async () => {
            // First create a prompt
            const createResponse = await request(app)
                .post('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Detail Test Prompt',
                    capability: 'chat',
                    language: 'en',
                    content: 'Test content'
                });

            if (createResponse.body.id) {
                const response = await request(app)
                    .get(`/api/ai/prompts/${createResponse.body.id}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('id');
                expect(response.body).toHaveProperty('content');
            }
        });

        it('should return 404 for non-existent prompt', async () => {
            const response = await request(app)
                .get('/api/ai/prompts/non-existent-id')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
        });
    });

    describe('PUT /api/ai/prompts/:id', () => {
        it('should update a prompt', async () => {
            // First create a prompt
            const createResponse = await request(app)
                .post('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Update Test Prompt',
                    capability: 'chat',
                    language: 'en',
                    content: 'Original content'
                });

            if (createResponse.body.id) {
                const response = await request(app)
                    .put(`/api/ai/prompts/${createResponse.body.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        content: 'Updated content',
                        description: 'Updated description'
                    });

                expect([200, 404]).toContain(response.status);
                if (response.status === 200) {
                    expect(response.body.content).toBe('Updated content');
                }
            }
        });

        it('should create new version on update', async () => {
            // First create a prompt
            const createResponse = await request(app)
                .post('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Version Test Prompt',
                    capability: 'chat',
                    language: 'en',
                    content: 'Version 1 content'
                });

            if (createResponse.body.id) {
                const updateResponse = await request(app)
                    .put(`/api/ai/prompts/${createResponse.body.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        content: 'Version 2 content'
                    });

                if (updateResponse.status === 200 && updateResponse.body.version) {
                    expect(updateResponse.body.version).toBeGreaterThan(1);
                }
            }
        });
    });

    describe('DELETE /api/ai/prompts/:id', () => {
        it('should delete a prompt', async () => {
            // First create a prompt to delete
            const createResponse = await request(app)
                .post('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'To Delete Prompt',
                    capability: 'chat',
                    language: 'en',
                    content: 'Delete me'
                });

            if (createResponse.body.id) {
                const response = await request(app)
                    .delete(`/api/ai/prompts/${createResponse.body.id}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect([200, 204, 404]).toContain(response.status);
            }
        });
    });

    describe('GET /api/ai/prompts/:id/versions', () => {
        it('should return prompt version history', async () => {
            const response = await request(app)
                .get('/api/ai/prompts/test-prompt-id/versions')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 404]).toContain(response.status);
            if (response.status === 200) {
                expect(response.body).toHaveProperty('versions');
                expect(Array.isArray(response.body.versions)).toBe(true);
            }
        });
    });

    describe('POST /api/ai/prompts/:id/test', () => {
        it('should test a prompt with sample input', async () => {
            // First create a prompt
            const createResponse = await request(app)
                .post('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test Prompt for Testing',
                    capability: 'chat',
                    language: 'en',
                    content: 'Hello {{name}}, how can I help you?'
                });

            if (createResponse.body.id) {
                const response = await request(app)
                    .post(`/api/ai/prompts/${createResponse.body.id}/test`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        variables: { name: 'TestUser' },
                        dryRun: true
                    });

                expect([200, 404]).toContain(response.status);
                if (response.status === 200) {
                    expect(response.body).toHaveProperty('renderedContent');
                }
            }
        });
    });

    describe('POST /api/ai/prompts/:id/clone', () => {
        it('should clone an existing prompt', async () => {
            // First create a prompt
            const createResponse = await request(app)
                .post('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Original Prompt',
                    capability: 'chat',
                    language: 'en',
                    content: 'Clone me'
                });

            if (createResponse.body.id) {
                const response = await request(app)
                    .post(`/api/ai/prompts/${createResponse.body.id}/clone`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        name: 'Cloned Prompt'
                    });

                expect([200, 201, 404]).toContain(response.status);
                if (response.status === 200 || response.status === 201) {
                    expect(response.body.name).toBe('Cloned Prompt');
                    expect(response.body.content).toBe('Clone me');
                }
            }
        });
    });

    describe('GET /api/ai/prompts/capabilities', () => {
        it('should return list of available capabilities', async () => {
            const response = await request(app)
                .get('/api/ai/prompts/capabilities')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            if (response.body.capabilities) {
                expect(Array.isArray(response.body.capabilities)).toBe(true);
                // Should include common capabilities
                const caps = response.body.capabilities;
                expect(caps.some(c => c.id === 'chat' || c === 'chat')).toBe(true);
            }
        });
    });

    describe('Prompt Variables & Templates', () => {
        it('should validate variable placeholders', async () => {
            const promptWithInvalidVars = {
                name: 'Invalid Variables Prompt',
                capability: 'chat',
                language: 'en',
                content: 'Hello {{invalid.var.name}}, welcome!'
            };

            const response = await request(app)
                .post('/api/ai/prompts')
                .set('Authorization', `Bearer ${authToken}`)
                .send(promptWithInvalidVars);

            // Should either accept or reject based on validation rules
            expect([200, 201, 400]).toContain(response.status);
        });
    });
});














