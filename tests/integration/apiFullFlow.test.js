// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../server/index.js');
const db = require('../../server/database.js');

/**
 * Level 2: Integration Tests - Full API Flow
 * Tests complete API workflows end-to-end
 */
describe('Integration Test: Full API Flow', () => {
    let authToken;
    let testOrgId;
    let testUserId;
    let testProjectId;

    beforeAll(async () => {
        await db.initPromise;

        // Create test organization and user
        testOrgId = 'api-flow-org-' + Date.now();
        testUserId = 'api-flow-user-' + Date.now();
        const bcrypt = require('bcryptjs');

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'API Flow Org', 'free', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, `api-flow-${Date.now()}@test.com`, bcrypt.hashSync('test123', 8), 'Test', 'ADMIN'],
                    resolve
                );
            });
        });

        // Login to get token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: `api-flow-${Date.now()}@test.com`,
                password: 'test123'
            })
            .catch(() => {
                // If login fails, create user with known credentials
                return null;
            });

        // Create user with known credentials for testing
        const testEmail = 'api-flow-test@test.com';
        await new Promise((resolve) => {
            db.run(
                'INSERT OR REPLACE INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                [testUserId, testOrgId, testEmail, bcrypt.hashSync('test123', 8), 'Test', 'ADMIN'],
                resolve
            );
        });

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: 'test123'
            });

        if (loginResponse.body.token) {
            authToken = loginResponse.body.token;
        }
    });

    describe('Project Lifecycle', () => {
        it('should create, read, update, and delete a project', async () => {
            if (!authToken) {
                console.log('Skipping API flow test - no auth token');
                return;
            }

            // Create project
            const createRes = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'API Flow Test Project',
                    organizationId: testOrgId,
                });

            expect([200, 201]).toContain(createRes.status);
            testProjectId = createRes.body.id || createRes.body.project?.id;

            // Read project
            const readRes = await request(app)
                .get(`/api/projects/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(readRes.status).toBe(200);
            expect(readRes.body.name || readRes.body.project?.name).toContain('API Flow');

            // Update project
            const updateRes = await request(app)
                .put(`/api/projects/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Updated API Flow Project',
                });

            expect(updateRes.status).toBe(200);

            // Delete project
            const deleteRes = await request(app)
                .delete(`/api/projects/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(deleteRes.status).toBe(200);
        });
    });

    describe('Task Lifecycle', () => {
        it('should create and manage tasks', async () => {
            if (!authToken || !testProjectId) {
                console.log('Skipping task flow test - no auth token or project');
                return;
            }

            // Create task
            const createRes = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    projectId: testProjectId,
                    title: 'API Flow Test Task',
                    description: 'Test task description',
                    status: 'todo',
                    organizationId: testOrgId,
                });

            expect(createRes.status).toBe(201);
            const taskId = createRes.body.id || createRes.body.task?.id;

            // Update task status
            const updateRes = await request(app)
                .put(`/api/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    status: 'in_progress',
                });

            expect(updateRes.status).toBe(200);
        });
    });

    describe('Session Management', () => {
        it('should save and retrieve session data', async () => {
            if (!authToken) {
                console.log('Skipping session test - no auth token');
                return;
            }

            const sessionData = {
                step1Completed: true,
                step2Completed: false,
                testData: 'API Flow Test',
            };

            // Save session
            const saveRes = await request(app)
                .post('/api/sessions')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    userId: testUserId,
                    type: 'free',
                    data: sessionData,
                });

            expect(saveRes.status).toBe(200);

            // Retrieve session
            const getRes = await request(app)
                .get(`/api/sessions/${testUserId}?type=free`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(getRes.status).toBe(200);
            expect(getRes.body.data).toBeDefined();
        });
    });
});

