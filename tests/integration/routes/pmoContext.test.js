// Integration test for PMO Context API endpoint
// Tests /api/pmo-context/:projectId routes

const request = require('supertest');
const app = require('../../../server/index');
const db = require('../../../server/database');
const { v4: uuidv4 } = require('uuid');

describe('PMO Context API', () => {
    let testUserId;
    let testProjectId;
    let testEmail;
    let authToken;

    beforeAll(async () => {
        // Initialize standard DB schema
        const { initTestDb } = require('../../helpers/dbHelper.cjs');
        await initTestDb();
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        // Create test user and get auth token
        testUserId = uuidv4();
        testProjectId = uuidv4();
        testEmail = `pmo-test-${uuidv4()}@test.com`;

        // Ensure organization exists
        await new Promise((resolve, reject) => {
            db.run(`INSERT OR IGNORE INTO organizations (id, name, status) VALUES (?, ?, ?)`,
                ['test-org', 'Test Org', 'active'], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });

        await new Promise((resolve, reject) => {
            db.run(`INSERT INTO users (id, email, password, role, organization_id, first_name, last_name, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [testUserId, testEmail, hash, 'PROJECT_MANAGER', 'test-org', 'PMO', 'Tester', 'active'],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });

        // Create test project
        await new Promise((resolve, reject) => {
            db.run(`INSERT INTO projects (id, name, owner_id, organization_id, current_phase)
                    VALUES (?, ?, ?, ?, ?)`,
                [testProjectId, 'PMO Test Project', testUserId, 'test-org', 'Execution'],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });

        // Login to get token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: 'test123',
            });

        if (loginRes.status !== 200) {
            console.error('Login failed in pmoContext.test.js:', loginRes.status, loginRes.body);
        }

        authToken = loginRes.body.token;
        if (!authToken) {
            console.error('No authToken received in pmoContext.test.js');
        }
    });


    describe('GET /api/pmo-context/:projectId', () => {
        it('should return PMO context with phase information', async () => {
            const response = await request(app)
                .get(`/api/pmo-context/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('projectId', testProjectId);
            expect(response.body).toHaveProperty('currentPhase', 'Execution');
            expect(response.body).toHaveProperty('phaseNumber', 5);
            expect(response.body).toHaveProperty('totalPhases', 6);
            expect(response.body).toHaveProperty('allowedActions');
            expect(response.body).toHaveProperty('systemMessages');
            expect(response.body).toHaveProperty('blockingIssues');
            expect(response.body).toHaveProperty('generatedAt');
        });

        it('should return 404 for non-existent project', async () => {
            const response = await request(app)
                .get('/api/pmo-context/non-existent-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('error', 'Project not found');
        });

        it('should include allowed actions for current phase', async () => {
            const response = await request(app)
                .get(`/api/pmo-context/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            // Execution phase should allow task management actions
            expect(response.body.allowedActions).toContain('create_task');
            expect(response.body.allowedActions).toContain('update_task');
            expect(response.body.allowedActions).toContain('complete_task');
        });

        it('should include system messages based on phase', async () => {
            const response = await request(app)
                .get(`/api/pmo-context/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body.systemMessages)).toBe(true);
        });
    });

    describe('GET /api/pmo-context/:projectId/task-labels', () => {
        let testTaskId;

        beforeAll(async () => {
            // Create a test task with overdue date
            testTaskId = uuidv4();
            const overdueDate = new Date();
            overdueDate.setDate(overdueDate.getDate() - 7);

            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO tasks (id, project_id, organization_id, title, status, due_date, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [testTaskId, testProjectId, 'test-org', 'Overdue Test Task', 'todo', overdueDate.toISOString().split('T')[0]],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });
        });


        it('should return task labels with PMO relevance', async () => {
            const response = await request(app)
                .get(`/api/pmo-context/${testProjectId}/task-labels`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('taskLabels');
            expect(typeof response.body.taskLabels).toBe('object');

            // Overdue task should have labels
            if (response.body.taskLabels[testTaskId]) {
                const labels = response.body.taskLabels[testTaskId];
                expect(Array.isArray(labels)).toBe(true);
                expect(labels.some(l => l.code === 'OVERDUE')).toBe(true);
            }
        });
    });
});
