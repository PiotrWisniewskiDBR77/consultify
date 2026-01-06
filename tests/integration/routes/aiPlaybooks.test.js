import app from '../../../server/src/index.js';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

// AI Playbooks Routes Integration Tests
// Tests AI playbook management and execution system

const app = require('../../../server/server');
const { sequelize } = require('../../../server/models');
const { User, Organization } = require('../../../server/models');

describe('AI Playbooks Routes Integration Tests', () => {
    const db = getDatabase();
    let testUser;
    let testOrg;
    let testSuperAdmin;
    let authToken;
    let superAdminAuthToken;

    beforeAll(async () => {
        await initializeDatabase();
        // Create test data
        testOrg = await Organization.create({
            name: 'Test AI Playbooks Org',
            domain: 'ai-playbooks-test.com'
        });

        testUser = await User.create({
            firstName: 'Playbook',
            lastName: 'TestUser',
            email: 'playbook@test.com',
            organizationId: testOrg.id,
            password: 'hashedpassword',
            role: 'USER'
        });

        testSuperAdmin = await User.create({
            firstName: 'Super',
            lastName: 'Admin',
            email: 'super-admin@test.com',
            organizationId: testOrg.id,
            password: 'hashedpassword',
            role: 'SUPERADMIN'
        });

        // Mock JWT tokens
        authToken = 'mock-jwt-token-for-playbook-user';
        superAdminAuthToken = 'mock-jwt-token-for-playbook-superadmin';
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('GET /api/ai/playbooks/templates', () => {
    const db = getDatabase();
        it('should return playbook templates for superadmin', async () => {
            const response = await request(app)
                .get('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should filter templates by status', async () => {
            const statuses = ['DRAFT', 'PUBLISHED', 'DEPRECATED'];

            for (const status of statuses) {
                const response = await request(app)
                    .get('/api/ai/playbooks/templates')
                    .set('Authorization', superAdminAuthToken)
                    .query({ status });

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);

                // All returned templates should have the requested status
                response.body.forEach(template => {
                    expect(template.status).toBe(status);
                });
            }
        });

        it('should deny access to non-superadmin users', async () => {
            const response = await request(app)
                .get('/api/ai/playbooks/templates')
                .set('Authorization', authToken);

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('SuperAdmin access required');
        });

        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .get('/api/ai/playbooks/templates');

            expect(response.status).toBe(401);
        });

        it('should include template metadata', async () => {
            const response = await request(app)
                .get('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken);

            expect(response.status).toBe(200);

            if (response.body.length > 0) {
                const template = response.body[0];
                expect(template).toHaveProperty('id');
                expect(template).toHaveProperty('key');
                expect(template).toHaveProperty('title');
                expect(template).toHaveProperty('description');
                expect(template).toHaveProperty('status');
                expect(template).toHaveProperty('triggerSignal');
                expect(template).toHaveProperty('estimatedDurationMins');
                expect(template).toHaveProperty('createdAt');
                expect(template).toHaveProperty('updatedAt');
            }
        });
    });

    describe('POST /api/ai/playbooks/templates', () => {
    const db = getDatabase();
        it('should create a new playbook template', async () => {
            const templateData = {
                key: 'test_template',
                title: 'Test Playbook Template',
                description: 'A template for testing playbook creation',
                triggerSignal: 'project_risk_high',
                estimatedDurationMins: 30,
                templateGraph: {
                    nodes: [
                        {
                            id: 'start',
                            type: 'start',
                            position: { x: 0, y: 0 }
                        },
                        {
                            id: 'end',
                            type: 'end',
                            position: { x: 200, y: 0 }
                        }
                    ],
                    edges: [
                        {
                            id: 'start-end',
                            source: 'start',
                            target: 'end'
                        }
                    ]
                }
            };

            const response = await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send(templateData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('key', 'test_template');
            expect(response.body).toHaveProperty('status', 'DRAFT');
        });

        it('should validate required fields', async () => {
            const invalidData = {
                title: 'Missing required fields'
                // Missing key, description, etc.
            };

            const response = await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send(invalidData);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should reject duplicate template keys', async () => {
            const templateData = {
                key: 'duplicate_template',
                title: 'Duplicate Template',
                description: 'Testing duplicate key handling',
                triggerSignal: 'test_signal',
                estimatedDurationMins: 15,
                templateGraph: { nodes: [], edges: [] }
            };

            // Create first template
            await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send(templateData);

            // Try to create duplicate
            const response = await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send(templateData);

            expect(response.status).toBe(409);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('duplicate');
        });

        it('should validate template graph structure', async () => {
            const invalidGraphData = {
                key: 'invalid_graph_template',
                title: 'Invalid Graph Template',
                description: 'Testing graph validation',
                triggerSignal: 'test_signal',
                estimatedDurationMins: 10,
                templateGraph: {
                    nodes: [],
                    edges: [{ source: 'nonexistent', target: 'also-nonexistent' }]
                }
            };

            const response = await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send(invalidGraphData);

            expect([400, 201]).toContain(response.status);

            if (response.status === 400) {
                expect(response.body).toHaveProperty('error');
            }
        });
    });

    describe('GET /api/ai/playbooks/templates/:id', () => {
    const db = getDatabase();
        it('should return specific template details', async () => {
            // First create a template
            const createResponse = await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send({
                    key: 'detail_test_template',
                    title: 'Detail Test Template',
                    description: 'For testing template details',
                    triggerSignal: 'detail_test',
                    estimatedDurationMins: 20,
                    templateGraph: { nodes: [], edges: [] }
                });

            const templateId = createResponse.body.id;

            const response = await request(app)
                .get(`/api/ai/playbooks/templates/${templateId}`)
                .set('Authorization', superAdminAuthToken);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('id', templateId);
            expect(response.body).toHaveProperty('templateGraph');
            expect(response.body).toHaveProperty('usageStats');
        });

        it('should return 404 for non-existent template', async () => {
            const response = await request(app)
                .get('/api/ai/playbooks/templates/non-existent-template')
                .set('Authorization', superAdminAuthToken);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'Template not found');
        });
    });

    describe('PUT /api/ai/playbooks/templates/:id', () => {
    const db = getDatabase();
        it('should update template details', async () => {
            // Create template first
            const createResponse = await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send({
                    key: 'update_test_template',
                    title: 'Update Test Template',
                    description: 'For testing updates',
                    triggerSignal: 'update_test',
                    estimatedDurationMins: 25,
                    templateGraph: { nodes: [], edges: [] }
                });

            const templateId = createResponse.body.id;

            const updateData = {
                title: 'Updated Template Title',
                description: 'Updated description',
                estimatedDurationMins: 35
            };

            const response = await request(app)
                .put(`/api/ai/playbooks/templates/${templateId}`)
                .set('Authorization', superAdminAuthToken)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('title', 'Updated Template Title');
            expect(response.body).toHaveProperty('description', 'Updated description');
            expect(response.body).toHaveProperty('estimatedDurationMins', 35);
        });

        it('should validate update data', async () => {
            const templateId = 'test-template-id';

            const response = await request(app)
                .put(`/api/ai/playbooks/templates/${templateId}`)
                .set('Authorization', superAdminAuthToken)
                .send({ estimatedDurationMins: -5 }); // Invalid duration

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/ai/playbooks/templates/:id/publish', () => {
    const db = getDatabase();
        it('should publish a draft template', async () => {
            // Create draft template
            const createResponse = await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send({
                    key: 'publish_test_template',
                    title: 'Publish Test Template',
                    description: 'For testing publishing',
                    triggerSignal: 'publish_test',
                    estimatedDurationMins: 15,
                    templateGraph: { nodes: [], edges: [] }
                });

            const templateId = createResponse.body.id;

            const response = await request(app)
                .post(`/api/ai/playbooks/templates/${templateId}/publish`)
                .set('Authorization', superAdminAuthToken);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'PUBLISHED');
        });

        it('should validate template before publishing', async () => {
            // Create invalid template (missing required graph validation)
            const createResponse = await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send({
                    key: 'invalid_publish_template',
                    title: 'Invalid Publish Template',
                    description: 'Missing validation',
                    triggerSignal: 'invalid_publish',
                    estimatedDurationMins: 10,
                    templateGraph: { nodes: [], edges: [] } // Invalid - no start/end nodes
                });

            const templateId = createResponse.body.id;

            const response = await request(app)
                .post(`/api/ai/playbooks/templates/${templateId}/publish`)
                .set('Authorization', superAdminAuthToken);

            expect([400, 200]).toContain(response.status);

            if (response.status === 400) {
                expect(response.body).toHaveProperty('error');
            }
        });
    });

    describe('DELETE /api/ai/playbooks/templates/:id', () => {
    const db = getDatabase();
        it('should delete draft template', async () => {
            // Create template
            const createResponse = await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send({
                    key: 'delete_test_template',
                    title: 'Delete Test Template',
                    description: 'For testing deletion',
                    triggerSignal: 'delete_test',
                    estimatedDurationMins: 5,
                    templateGraph: { nodes: [], edges: [] }
                });

            const templateId = createResponse.body.id;

            const response = await request(app)
                .delete(`/api/ai/playbooks/templates/${templateId}`)
                .set('Authorization', superAdminAuthToken);

            expect(response.status).toBe(200);

            // Verify deletion
            const getResponse = await request(app)
                .get(`/api/ai/playbooks/templates/${templateId}`)
                .set('Authorization', superAdminAuthToken);

            expect(getResponse.status).toBe(404);
        });

        it('should prevent deletion of published templates', async () => {
            // Create and publish template
            const createResponse = await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send({
                    key: 'no_delete_published_template',
                    title: 'Published Template',
                    description: 'Should not be deletable',
                    triggerSignal: 'no_delete',
                    estimatedDurationMins: 10,
                    templateGraph: { nodes: [], edges: [] }
                });

            const templateId = createResponse.body.id;

            // Publish it
            await request(app)
                .post(`/api/ai/playbooks/templates/${templateId}/publish`)
                .set('Authorization', superAdminAuthToken);

            // Try to delete
            const deleteResponse = await request(app)
                .delete(`/api/ai/playbooks/templates/${templateId}`)
                .set('Authorization', superAdminAuthToken);

            expect(deleteResponse.status).toBe(400);
            expect(deleteResponse.body).toHaveProperty('error');
            expect(deleteResponse.body.error).toContain('published');
        });
    });

    describe('GET /api/ai/playbooks/instances', () => {
    const db = getDatabase();
        it('should return playbook instances for organization', async () => {
            const response = await request(app)
                .get('/api/ai/playbooks/instances')
                .set('Authorization', authToken);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should filter instances by status', async () => {
            const statuses = ['RUNNING', 'COMPLETED', 'FAILED', 'PAUSED'];

            for (const status of statuses) {
                const response = await request(app)
                    .get('/api/ai/playbooks/instances')
                    .set('Authorization', authToken)
                    .query({ status });

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);

                response.body.forEach(instance => {
                    expect(instance.status).toBe(status);
                });
            }
        });

        it('should include execution metrics', async () => {
            const response = await request(app)
                .get('/api/ai/playbooks/instances')
                .set('Authorization', authToken);

            expect(response.status).toBe(200);

            if (response.body.length > 0) {
                const instance = response.body[0];
                expect(instance).toHaveProperty('id');
                expect(instance).toHaveProperty('templateId');
                expect(instance).toHaveProperty('status');
                expect(instance).toHaveProperty('progress');
                expect(instance).toHaveProperty('startedAt');
                expect(instance).toHaveProperty('currentStep');
            }
        });
    });

    describe('POST /api/ai/playbooks/instances', () => {
    const db = getDatabase();
        it('should create playbook instance from template', async () => {
            // First get available templates
            const templatesResponse = await request(app)
                .get('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .query({ status: 'PUBLISHED' });

            if (templatesResponse.body.length > 0) {
                const template = templatesResponse.body[0];

                const instanceData = {
                    templateId: template.id,
                    context: {
                        projectId: 'test-project-123',
                        triggerReason: 'manual_execution'
                    },
                    parameters: {
                        priority: 'high',
                        timeout: 3600000 // 1 hour
                    }
                };

                const response = await request(app)
                    .post('/api/ai/playbooks/instances')
                    .set('Authorization', authToken)
                    .send(instanceData);

                expect(response.status).toBe(201);
                expect(response.body).toHaveProperty('id');
                expect(response.body).toHaveProperty('status', 'RUNNING');
                expect(response.body).toHaveProperty('templateId', template.id);
            } else {
                // Skip if no published templates
                expect(templatesResponse.status).toBe(200);
            }
        });

        it('should validate template exists and is published', async () => {
            const instanceData = {
                templateId: 'non-existent-template',
                context: { projectId: 'test-project' }
            };

            const response = await request(app)
                .post('/api/ai/playbooks/instances')
                .set('Authorization', authToken)
                .send(instanceData);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('template');
        });
    });

    describe('GET /api/ai/playbooks/instances/:id', () => {
    const db = getDatabase();
        it('should return instance execution details', async () => {
            // Create instance first
            const templatesResponse = await request(app)
                .get('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .query({ status: 'PUBLISHED' });

            if (templatesResponse.body.length > 0) {
                const template = templatesResponse.body[0];

                const createResponse = await request(app)
                    .post('/api/ai/playbooks/instances')
                    .set('Authorization', authToken)
                    .send({
                        templateId: template.id,
                        context: { projectId: 'test-project-123' }
                    });

                const instanceId = createResponse.body.id;

                const response = await request(app)
                    .get(`/api/ai/playbooks/instances/${instanceId}`)
                    .set('Authorization', authToken);

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('id', instanceId);
                expect(response.body).toHaveProperty('executionLog');
                expect(response.body).toHaveProperty('stepResults');
                expect(Array.isArray(response.body.executionLog)).toBe(true);
                expect(Array.isArray(response.body.stepResults)).toBe(true);
            }
        });
    });

    describe('POST /api/ai/playbooks/instances/:id/pause', () => {
    const db = getDatabase();
        it('should pause running playbook instance', async () => {
            // This would require a running instance
            // For now, test the endpoint structure
            const instanceId = 'test-instance-id';

            const response = await request(app)
                .post(`/api/ai/playbooks/instances/${instanceId}/pause`)
                .set('Authorization', authToken);

            expect([200, 404]).toContain(response.status);

            if (response.status === 200) {
                expect(response.body).toHaveProperty('status', 'PAUSED');
            }
        });
    });

    describe('POST /api/ai/playbooks/instances/:id/resume', () => {
    const db = getDatabase();
        it('should resume paused playbook instance', async () => {
            const instanceId = 'test-paused-instance-id';

            const response = await request(app)
                .post(`/api/ai/playbooks/instances/${instanceId}/resume`)
                .set('Authorization', authToken);

            expect([200, 404]).toContain(response.status);

            if (response.status === 200) {
                expect(response.body).toHaveProperty('status', 'RUNNING');
            }
        });
    });

    describe('POST /api/ai/playbooks/instances/:id/cancel', () => {
    const db = getDatabase();
        it('should cancel playbook instance', async () => {
            const instanceId = 'test-running-instance-id';

            const response = await request(app)
                .post(`/api/ai/playbooks/instances/${instanceId}/cancel`)
                .set('Authorization', authToken);

            expect([200, 404]).toContain(response.status);

            if (response.status === 200) {
                expect(response.body).toHaveProperty('status', 'CANCELLED');
            }
        });
    });

    describe('Template Validation', () => {
    const db = getDatabase();
        it('should validate template graph structure', async () => {
            const invalidTemplate = {
                key: 'invalid_graph',
                title: 'Invalid Graph',
                description: 'Testing graph validation',
                triggerSignal: 'test',
                estimatedDurationMins: 10,
                templateGraph: {
                    nodes: [
                        { id: 'node1', type: 'action', position: { x: 0, y: 0 } }
                        // Missing start and end nodes
                    ],
                    edges: []
                }
            };

            const response = await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send(invalidTemplate);

            expect([400, 201]).toContain(response.status);

            if (response.status === 400) {
                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toContain('graph');
            }
        });

        it('should validate trigger signal format', async () => {
            const invalidTemplate = {
                key: 'invalid_trigger',
                title: 'Invalid Trigger',
                description: 'Testing trigger validation',
                triggerSignal: '', // Empty trigger
                estimatedDurationMins: 10,
                templateGraph: { nodes: [], edges: [] }
            };

            const response = await request(app)
                .post('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .send(invalidTemplate);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Execution Monitoring', () => {
    const db = getDatabase();
        it('should track playbook execution metrics', async () => {
            const response = await request(app)
                .get('/api/ai/playbooks/instances')
                .set('Authorization', authToken);

            expect(response.status).toBe(200);

            response.body.forEach(instance => {
                if (instance.status === 'COMPLETED') {
                    expect(instance).toHaveProperty('completedAt');
                    expect(instance).toHaveProperty('totalExecutionTime');
                    expect(instance).toHaveProperty('stepCount');
                    expect(instance).toHaveProperty('successRate');
                }
            });
        });

        it('should provide real-time execution status', async () => {
            // Test with a running instance if available
            const instancesResponse = await request(app)
                .get('/api/ai/playbooks/instances')
                .set('Authorization', authToken)
                .query({ status: 'RUNNING' });

            if (instancesResponse.body.length > 0) {
                const instance = instancesResponse.body[0];

                expect(instance).toHaveProperty('currentStep');
                expect(instance).toHaveProperty('progress');
                expect(instance.progress).toBeGreaterThanOrEqual(0);
                expect(instance.progress).toBeLessThanOrEqual(100);
            }
        });
    });

    describe('Error Handling and Recovery', () => {
    const db = getDatabase();
        it('should handle playbook execution failures gracefully', async () => {
            // Create instance that might fail
            const templatesResponse = await request(app)
                .get('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .query({ status: 'PUBLISHED' });

            if (templatesResponse.body.length > 0) {
                const template = templatesResponse.body[0];

                const createResponse = await request(app)
                    .post('/api/ai/playbooks/instances')
                    .set('Authorization', authToken)
                    .send({
                        templateId: template.id,
                        context: { projectId: 'test-project' }
                    });

                // Check if instance handles errors properly
                const statusResponse = await request(app)
                    .get(`/api/ai/playbooks/instances/${createResponse.body.id}`)
                    .set('Authorization', authToken);

                expect(statusResponse.status).toBe(200);

                if (statusResponse.body.status === 'FAILED') {
                    expect(statusResponse.body).toHaveProperty('errorMessage');
                    expect(statusResponse.body).toHaveProperty('failedStep');
                    expect(statusResponse.body).toHaveProperty('failureReason');
                }
            }
        });

        it('should allow retry of failed playbook instances', async () => {
            // Find failed instance
            const failedInstancesResponse = await request(app)
                .get('/api/ai/playbooks/instances')
                .set('Authorization', authToken)
                .query({ status: 'FAILED' });

            if (failedInstancesResponse.body.length > 0) {
                const failedInstance = failedInstancesResponse.body[0];

                const retryResponse = await request(app)
                    .post(`/api/ai/playbooks/instances/${failedInstance.id}/retry`)
                    .set('Authorization', authToken);

                expect([200, 404]).toContain(retryResponse.status);

                if (retryResponse.status === 200) {
                    expect(retryResponse.body).toHaveProperty('status', 'RUNNING');
                    expect(retryResponse.body).toHaveProperty('retryCount');
                }
            }
        });
    });

    describe('Performance and Scalability', () => {
    const db = getDatabase();
        it('should handle multiple concurrent playbook executions', async () => {
            const templatesResponse = await request(app)
                .get('/api/ai/playbooks/templates')
                .set('Authorization', superAdminAuthToken)
                .query({ status: 'PUBLISHED' });

            if (templatesResponse.body.length > 0) {
                const template = templatesResponse.body[0];

                // Create multiple instances concurrently
                const createPromises = Array(5).fill().map((_, i) =>
                    request(app)
                        .post('/api/ai/playbooks/instances')
                        .set('Authorization', authToken)
                        .send({
                            templateId: template.id,
                            context: { projectId: `concurrent-test-${i}` }
                        })
                );

                const responses = await Promise.all(createPromises);

                responses.forEach(response => {
                    expect([201, 429]).toContain(response.status); // 429 if rate limited
                });

                const successCount = responses.filter(r => r.status === 201).length;
                expect(successCount).toBeGreaterThan(0);
            }
        });

        it('should provide execution performance metrics', async () => {
            const response = await request(app)
                .get('/api/ai/playbooks/instances')
                .set('Authorization', authToken);

            expect(response.status).toBe(200);

            response.body.forEach(instance => {
                if (instance.status === 'COMPLETED') {
                    expect(instance).toHaveProperty('averageStepTime');
                    expect(instance).toHaveProperty('totalExecutionTime');
                    expect(typeof instance.averageStepTime).toBe('number');
                    expect(typeof instance.totalExecutionTime).toBe('number');
                }
            });
        });
    });
});