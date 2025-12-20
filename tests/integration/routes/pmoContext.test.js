// Integration test for PMO Context API endpoint
// Tests /api/pmo-context/:projectId routes

const request = require('supertest');
const app = require('../../../server/index');
const db = require('../../../server/database');
const { v4: uuidv4 } = require('uuid');

describe('PMO Context API', () => {
    let authToken;
    let testProjectId;
    let testUserId;

    beforeAll(async () => {
        // Create test user and get auth token
        testUserId = uuidv4();
        testProjectId = uuidv4();

        await new Promise((resolve, reject) => {
            db.run(`INSERT INTO users (id, email, password_hash, role, organization_id, first_name, last_name, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [testUserId, 'pmo-test@test.com', 'hashedpassword', 'PROJECT_MANAGER', 'test-org', 'PMO', 'Tester', 'active'],
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

        // Get auth token
        const jwt = require('jsonwebtoken');
        authToken = jwt.sign(
            { userId: testUserId, organizationId: 'test-org', role: 'PROJECT_MANAGER' },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );
    });

    afterAll(async () => {
        // Cleanup
        await new Promise((resolve) => {
            db.run(`DELETE FROM projects WHERE id = ?`, [testProjectId], resolve);
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM users WHERE id = ?`, [testUserId], resolve);
        });
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
                db.run(`INSERT INTO tasks (id, project_id, title, status, due_date, created_at)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [testTaskId, testProjectId, 'Overdue Test Task', 'todo', overdueDate.toISOString().split('T')[0]],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });
        });

        afterAll(async () => {
            await new Promise((resolve) => {
                db.run(`DELETE FROM tasks WHERE id = ?`, [testTaskId], resolve);
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
